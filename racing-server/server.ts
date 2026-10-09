// Velocity Rush authoritative race server.
//
// Runs on Node >= 22.18 (native TypeScript type stripping):
//   node racing-server/server.ts
//
// Responsibilities: player identity + persistent profiles, public matchmaking,
// private rooms with invite codes, lobby state, synchronised race starts,
// state relay at 20 Hz, server-side lap/checkpoint refereeing, anti-cheat
// movement validation, authoritative results, ranked rating, tournament
// series points, reconnection, and a global leaderboard.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { TRACKS, getTrack } from "../src/racing/shared/tracks.ts";
import {
  buildTrack, project, newProjection, newLapState, advanceLap, gridSlot, sDelta,
  type TrackData, type LapState,
} from "../src/racing/shared/trackGeom.ts";
import { CARS, getCar, applyUpgrades } from "../src/racing/shared/cars.ts";
import {
  PROTOCOL_VERSION, MAX_PLAYERS, SNAPSHOT_HZ, STATE_LEN,
  type ClientMsg, type ServerMsg, type Loadout, type RoomSettings, type RoomKind, type RoomPhase,
  type LobbyPlayer, type Profile, type CarState, type ResultRow,
} from "../src/racing/shared/protocol.ts";
import { levelFromXp, raceXp, SERIES_POINTS } from "../src/racing/shared/progress.ts";

const PORT = Number(process.env.PORT ?? 8787);
const REGION = process.env.REGION ?? "local";
const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), "racing-server", "data");
const DATA_FILE = join(DATA_DIR, "racing-data.json");
const RECONNECT_GRACE_MS = 45_000;
const COUNTDOWN_MS = 6_000;
const FINISH_GRACE_MS = 40_000;
const RACE_TIMEOUT_MS = 20 * 60_000;
const RESULTS_MS = 12_000;
const QUICK_AUTOSTART_MS = 30_000;

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

interface StoredProfile extends Profile { token: string; id: string }
interface LapRecord { name: string; car: string; time: number; date: number; id: string }
interface Db { profiles: Record<string, StoredProfile>; laps: Record<string, LapRecord[]> }

let db: Db = { profiles: {}, laps: {} };
let dirty = false;
try {
  if (existsSync(DATA_FILE)) db = JSON.parse(readFileSync(DATA_FILE, "utf8"));
} catch (e) {
  log("could not read data file, starting fresh", e);
}
function save() {
  if (!dirty) return;
  dirty = false;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE + ".tmp", JSON.stringify(db));
    renameSync(DATA_FILE + ".tmp", DATA_FILE);
  } catch (e) {
    log("save failed", e);
  }
}
setInterval(save, 5000).unref();

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// ---------------------------------------------------------------------------
// Tracks (built once; the same geometry the clients use)
// ---------------------------------------------------------------------------

const trackCache = new Map<string, TrackData>();
function trackData(id: string) {
  let t = trackCache.get(id);
  if (!t) trackCache.set(id, (t = buildTrack(getTrack(id))));
  return t;
}
for (const t of TRACKS) trackData(t.id);

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const clampInt = (v: unknown, lo: number, hi: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : def;

function sanitizeName(n: unknown) {
  const s = typeof n === "string" ? n.replace(/[^\p{L}\p{N} _\-.]/gu, "").trim().slice(0, 16) : "";
  return s || "Driver";
}

function sanitizeLoadout(l: unknown): Loadout {
  const o = (l ?? {}) as Partial<Loadout>;
  const spec = getCar(typeof o.id === "string" ? o.id : "");
  const c = (o.cust ?? {}) as Partial<Loadout["cust"]>;
  const u = (o.up ?? {}) as Partial<Loadout["up"]>;
  const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  return {
    id: spec.id,
    cust: {
      color: hex(c.color, spec.defaultColor),
      finish: (["metallic", "gloss", "matte", "pearl"] as const).includes(c.finish as never) ? c.finish! : "metallic",
      rim: clampInt(c.rim, 0, 2, 0),
      rimColor: hex(c.rimColor, "#c0c4c8"),
      wing: clampInt(c.wing, -1, 3, -1),
      kit: clampInt(c.kit, 0, 1, 0),
    },
    up: { engine: clampInt(u.engine, 0, 3, 0), tires: clampInt(u.tires, 0, 3, 0), weight: clampInt(u.weight, 0, 3, 0) },
  };
}

function sanitizeSettings(s: unknown, kind: RoomKind): RoomSettings {
  const o = (s ?? {}) as Partial<RoomSettings>;
  return {
    track: TRACKS.some((t) => t.id === o.track) ? o.track! : TRACKS[0].id,
    laps: clampInt(o.laps, 1, 10, 3),
    maxPlayers: kind === "timetrial" ? 1 : clampInt(o.maxPlayers, 2, MAX_PLAYERS, 8),
    series: clampInt(o.series, 1, 5, 1),
    time: (["day", "sunset", "night"] as const).includes(o.time as never) ? o.time! : "day",
    weather: o.weather === "rain" ? "rain" : "dry",
    collisions: o.collisions !== false,
  };
}

function maxSpeedFor(l: Loadout) {
  const spec = applyUpgrades(getCar(l.id), l.up, l.cust);
  // Nitro adds ~25 %, downhill and slipstream a little more.
  return (spec.topSpeed / 3.6) * 1.25 * 1.12 + 3;
}

// ---------------------------------------------------------------------------
// Clients and rooms
// ---------------------------------------------------------------------------

class Client {
  id = "";
  token = "";
  profile!: StoredProfile;
  room: Room | null = null;
  ping = 0;
  msgCount = 0;
  windowStart = Date.now();
  helloed = false;
  ws: WebSocket;
  constructor(ws: WebSocket) {
    this.ws = ws;
  }
  send(m: ServerMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }
}

interface RacerState {
  lap: LapState;
  last: CarState | null;
  lastValid: { x: number; y: number; z: number; yaw: number; s: number } | null;
  lastTime: number;
  lapStart: number;
  best: number | null;
  finished: boolean;
  finishTime: number | null;
  place: number;
  violations: number;
  respawnPending: boolean;
  maxSpeed: number;
  timingStarted: boolean;
}

interface RoomPlayer {
  id: string;
  client: Client | null;
  name: string;
  avatar: number;
  car: Loadout;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number;
  points: number;
  race: RacerState | null;
  left: boolean;
}

const rooms = new Map<string, Room>();
const clientsById = new Map<string, Client>();

function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    let c = "";
    for (let i = 0; i < 5; i++) c += alphabet[randomBytes(1)[0] % alphabet.length];
    if (!rooms.has(c)) return c;
  }
}

class Room {
  code = newCode();
  players = new Map<string, RoomPlayer>();
  phase: RoomPhase = "lobby";
  hostId = "";
  raceIndex = 0;
  startAt = 0;
  firstFinishAt = 0;
  finishCount = 0;
  autoStartAt: number | null = null;
  grid: { id: string; slot: number }[] = [];
  phaseTimer: ReturnType<typeof setTimeout> | null = null;
  track!: TrackData;

  kind: RoomKind;
  settings: RoomSettings;
  constructor(kind: RoomKind, settings: RoomSettings) {
    this.kind = kind;
    this.settings = settings;
    rooms.set(this.code, this);
    this.track = trackData(settings.track);
    log(`room ${this.code} created (${kind}, ${settings.track})`);
  }

  get ranked() { return this.kind === "public"; }

  broadcast(m: ServerMsg, except?: string) {
    const s = JSON.stringify(m);
    for (const p of this.players.values()) {
      if (p.id !== except && p.client && p.client.ws.readyState === WebSocket.OPEN) p.client.ws.send(s);
    }
  }

  lobbyView(): ServerMsg {
    const players: LobbyPlayer[] = [...this.players.values()].filter((p) => !p.left).map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, car: p.car, ready: p.ready, ping: p.client?.ping ?? 0,
      connected: p.connected, rating: p.client?.profile.rating ?? 1000, level: p.client?.profile.level ?? 1, points: p.points,
    }));
    return {
      t: "room", code: this.code, kind: this.kind, hostId: this.hostId, settings: this.settings,
      phase: this.phase, players, raceIndex: this.raceIndex, autoStartAt: this.autoStartAt,
    };
  }
  sync() { this.broadcast(this.lobbyView()); }

  activeCount() { return [...this.players.values()].filter((p) => !p.left).length; }

  add(c: Client, car: Loadout) {
    const p: RoomPlayer = {
      id: c.id, client: c, name: c.profile.name, avatar: c.profile.avatar, car, ready: this.kind === "timetrial",
      connected: true, disconnectedAt: 0, points: 0, race: null, left: false,
    };
    this.players.set(c.id, p);
    c.room = this;
    if (!this.hostId || !this.players.get(this.hostId) || this.players.get(this.hostId)!.left) this.hostId = c.id;
    this.updateAutoStart();
    this.sync();
    if (this.kind === "timetrial") this.startRace();
  }

  remove(id: string, reason = "left") {
    const p = this.players.get(id);
    if (!p) return;
    if (p.client) p.client.room = null;
    if (this.phase === "race" || this.phase === "countdown") {
      // Keep them for the results table as a DNF.
      p.left = true;
      p.connected = false;
      p.client = null;
    } else {
      this.players.delete(id);
    }
    log(`room ${this.code}: ${p.name} ${reason}`);
    if (this.hostId === id) {
      const next = [...this.players.values()].find((q) => !q.left);
      this.hostId = next?.id ?? "";
    }
    if (this.activeCount() === 0) return this.destroy();
    this.updateAutoStart();
    this.sync();
    if (this.phase === "race") this.checkRaceEnd();
  }

  destroy() {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    rooms.delete(this.code);
    log(`room ${this.code} closed`);
  }

  updateAutoStart() {
    if (this.kind !== "public" || this.phase !== "lobby") { this.autoStartAt = null; return; }
    const n = this.activeCount();
    if (n < 2) this.autoStartAt = null;
    else if (!this.autoStartAt) this.autoStartAt = Date.now() + QUICK_AUTOSTART_MS;
    const all = [...this.players.values()].filter((p) => !p.left);
    if (n >= 2 && all.every((p) => p.ready)) this.autoStartAt = Math.min(this.autoStartAt ?? Infinity, Date.now() + 3000);
  }

  canStart(): string | null {
    if (this.phase !== "lobby") return "Race already running";
    const active = [...this.players.values()].filter((p) => !p.left && p.connected);
    if (this.kind !== "timetrial" && active.length < 2) return "Need at least 2 players";
    if (this.kind === "private" && !active.every((p) => p.ready || p.id === this.hostId)) return "Everyone must be ready";
    return null;
  }

  startRace() {
    this.track = trackData(this.settings.track);
    this.phase = "countdown";
    this.autoStartAt = null;
    this.startAt = Date.now() + COUNTDOWN_MS;
    this.firstFinishAt = 0;
    this.finishCount = 0;
    const racers = [...this.players.values()].filter((p) => !p.left && p.connected);
    // Tournament races after the first start in reverse championship order.
    racers.sort((a, b) => (this.raceIndex > 0 ? a.points - b.points : 0));
    const grid = racers.map((p, slot) => ({ id: p.id, slot }));
    this.grid = grid;
    for (const g of grid) {
      const p = this.players.get(g.id)!;
      const gs = gridSlot(this.track, g.slot);
      const lap = newLapState(this.track, this.track.s[gs.i]);
      if (this.kind === "timetrial") lap.nextCp = 0;
      p.race = {
        lap, last: null, lastValid: { x: gs.x, y: gs.y, z: gs.z, yaw: gs.yaw, s: this.track.s[gs.i] }, lastTime: Date.now(),
        lapStart: this.startAt, best: null, finished: false, finishTime: null, place: 0, violations: 0,
        respawnPending: false, maxSpeed: maxSpeedFor(p.car), timingStarted: this.kind !== "timetrial",
      };
    }
    for (const p of this.players.values()) if (!grid.some((g) => g.id === p.id)) p.race = null;
    this.broadcast({ t: "start", startAt: this.startAt, settings: this.settings, grid, kind: this.kind });
    this.sync();
    this.phaseTimer = setTimeout(() => { this.phase = "race"; this.sync(); }, COUNTDOWN_MS);
    log(`room ${this.code}: race ${this.raceIndex + 1} starting with ${grid.length} on ${this.settings.track}`);
  }

  onState(p: RoomPlayer, s: unknown) {
    const r = p.race;
    if (!r || r.finished && this.kind !== "timetrial") { if (r) r.last = sanitizeState(s) ?? r.last; return; }
    const st = sanitizeState(s);
    if (!st) return;
    const now = Date.now();
    const [x, y, z, yaw] = st;
    const lv = r.lastValid!;
    const pr = project(this.track, x, z, r.lap.hint, newProjection());
    const correct = (reason: string) => {
      r.violations++;
      p.client?.send({ t: "correct", x: lv.x, y: lv.y, z: lv.z, yaw: lv.yaw, reason });
    };
    // Before the lights go out nobody may leave their grid box.
    if (now < this.startAt - 150) {
      if (Math.hypot(x - lv.x, z - lv.z) > 3) return correct("jump start");
      r.last = st;
      r.lastTime = now;
      return;
    }
    const dt = Math.max(0.05, (now - r.lastTime) / 1000);
    const dist = Math.hypot(x - lv.x, z - lv.z);
    const allowed = r.maxSpeed * Math.min(dt, 2) * 1.35 + 6;
    let teleportOk = false;
    if (r.respawnPending) {
      // A respawn may only put the car back on the road near where it already was.
      const ds = Math.abs(sDelta(this.track, lv.s, pr.s));
      teleportOk = ds < 40 && Math.abs(pr.d) < this.track.halfWidth;
      r.respawnPending = false;
    }
    if (!teleportOk && dist > allowed) return correct("moved too fast");
    if (Math.abs(pr.d) > this.track.wallDist + 4) return correct("off course");
    const spd = Math.hypot(st[6], st[7]);
    if (spd > r.maxSpeed * 1.1) return correct("speed limit");
    r.lap.hint = pr.i;
    r.last = st;
    r.lastTime = now;
    r.lastValid = { x, y, z, yaw, s: pr.s };
    if (now < this.startAt) return;
    const ev = advanceLap(this.track, r.lap, pr.s);
    if (ev === "lap") this.onLap(p, r, now);
  }

  onLap(p: RoomPlayer, r: RacerState, now: number) {
    if (!r.timingStarted) {
      // Time trial out-lap: the first line crossing starts the clock.
      r.timingStarted = true;
      r.lapStart = now;
      r.lap.lap = 0;
      return;
    }
    const lapTime = now - r.lapStart;
    r.lapStart = now;
    // Faster than physically possible for this car → reject.
    const minLap = (this.track.length / r.maxSpeed) * 1000;
    const valid = lapTime >= minLap && r.violations < 3;
    if (valid && (r.best === null || lapTime < r.best)) r.best = lapTime;
    this.broadcast({ t: "lap", id: p.id, lap: r.lap.lap, time: lapTime, best: r.best ?? 0 });
    if (valid && p.client) submitLap(this.settings.track, p, lapTime);
    r.violations = 0;
    if (this.kind === "timetrial") return;
    if (r.lap.lap >= this.settings.laps) {
      r.finished = true;
      r.finishTime = now - this.startAt;
      r.place = ++this.finishCount;
      if (!this.firstFinishAt) this.firstFinishAt = now;
      this.broadcast({ t: "finish", id: p.id, place: r.place, time: r.finishTime });
      this.checkRaceEnd();
    }
  }

  standings() {
    const racers = [...this.players.values()].filter((p) => p.race);
    racers.sort((a, b) => {
      const ra = a.race!, rb = b.race!;
      if (ra.finished !== rb.finished) return ra.finished ? -1 : 1;
      if (ra.finished && rb.finished) return ra.place - rb.place;
      return rb.lap.progress - ra.lap.progress;
    });
    return racers;
  }

  checkRaceEnd() {
    if (this.phase !== "race" && this.phase !== "countdown") return;
    if (this.kind === "timetrial") return;
    const now = Date.now();
    const racing = [...this.players.values()].filter((p) => p.race && !p.left && p.connected);
    const allDone = racing.every((p) => p.race!.finished);
    if (allDone || racing.length === 0 || (this.firstFinishAt && now - this.firstFinishAt > FINISH_GRACE_MS) || now - this.startAt > RACE_TIMEOUT_MS) {
      this.finishRace();
    }
  }

  finishRace() {
    this.phase = "results";
    const order = this.standings();
    const n = order.length;
    const rows: ResultRow[] = order.map((p, i) => {
      const r = p.race!;
      const pts = this.settings.series > 1 && r.finished ? SERIES_POINTS[i] ?? 0 : 0;
      p.points += pts;
      return {
        id: p.id, name: p.name, car: p.car.id, place: i + 1, time: r.finished ? r.finishTime : null, best: r.best,
        laps: r.lap.lap, dnf: !r.finished, xp: raceXp(i + 1, n, r.finished), ratingDelta: 0, points: pts, seriesPoints: p.points,
      };
    });
    if (this.ranked && n >= 2) {
      // Pairwise Elo on finishing order.
      const ratings = order.map((p) => p.client?.profile.rating ?? clientRatingFallback(p.id));
      const K = 32 / (n - 1);
      for (let i = 0; i < n; i++) {
        let d = 0;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const exp = 1 / (1 + 10 ** ((ratings[j] - ratings[i]) / 400));
          d += K * ((i < j ? 1 : 0) - exp);
        }
        rows[i].ratingDelta = Math.round(d);
      }
    }
    for (const row of rows) {
      const prof = profileById(row.id);
      if (!prof) continue;
      prof.xp += row.xp;
      prof.level = levelFromXp(prof.xp);
      prof.rating += row.ratingDelta;
      prof.races++;
      if (row.place === 1 && n > 1) prof.wins++;
      dirty = true;
      clientsById.get(row.id)?.send({ t: "profile", profile: publicProfile(prof) });
    }
    const final = this.raceIndex + 1 >= this.settings.series;
    this.broadcast({ t: "results", rows, final, raceIndex: this.raceIndex });
    // Drop players who left mid-race now that results are out.
    for (const p of [...this.players.values()]) if (p.left) this.players.delete(p.id);
    this.phaseTimer = setTimeout(() => {
      if (!rooms.has(this.code)) return;
      if (!final) {
        this.raceIndex++;
        // Tournaments rotate through the circuits.
        const idx = TRACKS.findIndex((t) => t.id === this.settings.track);
        this.settings = { ...this.settings, track: TRACKS[(idx + 1) % TRACKS.length].id };
        this.phase = "lobby";
        this.startRace();
        return;
      }
      this.raceIndex = 0;
      this.phase = "lobby";
      for (const p of this.players.values()) { p.ready = false; p.points = 0; p.race = null; }
      if (this.kind === "public") {
        this.settings = { ...this.settings, track: TRACKS[Math.floor(Math.random() * 3)].id };
      }
      this.updateAutoStart();
      this.sync();
    }, RESULTS_MS);
    log(`room ${this.code}: race finished; winner ${rows[0]?.name ?? "-"}`);
  }

  tick(now: number) {
    for (const p of [...this.players.values()]) {
      if (!p.connected && !p.left && now - p.disconnectedAt > RECONNECT_GRACE_MS) this.remove(p.id, "timed out");
    }
    if (!rooms.has(this.code)) return;
    if (this.phase === "lobby" && this.autoStartAt && now >= this.autoStartAt) {
      if (this.activeCount() >= 2) this.startRace();
      else this.autoStartAt = null;
    }
    if (this.phase === "race" || this.phase === "countdown") {
      const order = this.standings();
      const p: [string, CarState, number, number, number, number][] = [];
      order.forEach((pl, i) => {
        const r = pl.race!;
        if (r.last && !pl.left) p.push([pl.id, r.last, r.lap.lap, r.lap.nextCp, r.finished ? 1 : 0, i + 1]);
      });
      this.broadcast({ t: "snap", time: now, p });
      this.checkRaceEnd();
    }
  }
}

function clientRatingFallback(id: string) {
  return profileById(id)?.rating ?? 1000;
}
function profileById(id: string) {
  const c = clientsById.get(id);
  if (c) return c.profile;
  return Object.values(db.profiles).find((p) => p.id === id);
}
function publicProfile(p: StoredProfile): Profile {
  return { name: p.name, avatar: p.avatar, xp: p.xp, level: p.level, rating: p.rating, races: p.races, wins: p.wins };
}

function sanitizeState(s: unknown): CarState | null {
  if (!Array.isArray(s) || s.length !== STATE_LEN) return null;
  for (const v of s) if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e6) return null;
  const st = s.slice() as CarState;
  st[10] = Math.max(-1, Math.min(10, Math.round(st[10])));
  st[11] = st[11] & 127;
  st[12] = Math.max(0, Math.min(1, st[12]));
  return st;
}

function submitLap(track: string, p: RoomPlayer, time: number) {
  const list = (db.laps[track] ??= []);
  const existing = list.find((l) => l.id === p.id);
  if (existing && existing.time <= time) return;
  if (existing) list.splice(list.indexOf(existing), 1);
  list.push({ name: p.name, car: p.car.id, time, date: Date.now(), id: p.id });
  list.sort((a, b) => a.time - b.time);
  list.length = Math.min(list.length, 100);
  dirty = true;
}

function leaderboard(track: string) {
  const laps = (db.laps[track] ?? []).slice(0, 25).map(({ name, car, time, date }) => ({ name, car, time, date }));
  const ratings = Object.values(db.profiles)
    .filter((p) => p.races > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 25)
    .map((p) => ({ name: p.name, rating: p.rating, wins: p.wins }));
  return { track, laps, ratings };
}

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

function onHello(c: Client, m: Extract<ClientMsg, { t: "hello" }>) {
  if (m.v !== PROTOCOL_VERSION) {
    c.send({ t: "error", msg: "Client version mismatch – please reload the game." });
    c.ws.close();
    return;
  }
  let token = typeof m.token === "string" && /^[0-9a-f]{48}$/.test(m.token) ? m.token : "";
  let prof = token ? db.profiles[hashToken(token)] : undefined;
  if (!prof) {
    token = randomBytes(24).toString("hex");
    prof = {
      token: hashToken(token), id: randomBytes(5).toString("hex"), name: sanitizeName(m.name),
      avatar: clampInt(m.avatar, 0, 11, 0), xp: 0, level: 1, rating: 1000, races: 0, wins: 0,
    };
    db.profiles[prof.token] = prof;
    dirty = true;
  }
  prof.name = sanitizeName(m.name);
  prof.avatar = clampInt(m.avatar, 0, 11, prof.avatar);
  c.token = token;
  c.id = prof.id;
  c.profile = prof;
  c.helloed = true;
  // Kick a stale duplicate connection with the same identity.
  const old = clientsById.get(c.id);
  if (old && old !== c) {
    old.room = null;
    old.send({ t: "left", reason: "Signed in from another tab" });
    old.ws.close();
  }
  clientsById.set(c.id, c);
  c.send({ t: "welcome", id: c.id, token, profile: publicProfile(prof), region: REGION, serverTime: Date.now() });
  // Reconnection: re-attach to a room that is holding our slot.
  for (const room of rooms.values()) {
    const p = room.players.get(c.id);
    if (p && !p.left) {
      p.client = c;
      p.connected = true;
      c.room = room;
      room.sync();
      if ((room.phase === "race" || room.phase === "countdown") && p.race) {
        c.send({ t: "start", startAt: room.startAt, settings: room.settings, grid: room.grid, kind: room.kind });
        const lv = p.race.lastValid!;
        c.send({ t: "correct", x: lv.x, y: lv.y, z: lv.z, yaw: lv.yaw, reason: "reconnected" });
      }
      log(`${p.name} reconnected to ${room.code}`);
      break;
    }
  }
}

function onMessage(c: Client, raw: string) {
  const now = Date.now();
  if (now - c.windowStart > 1000) { c.windowStart = now; c.msgCount = 0; }
  if (++c.msgCount > 120) {
    if (c.msgCount > 400) c.ws.close(1008, "rate limit");
    return;
  }
  if (raw.length > 4096) return;
  let m: ClientMsg;
  try { m = JSON.parse(raw); } catch { return; }
  if (!m || typeof m !== "object") return;
  if (m.t === "hello") return onHello(c, m);
  if (!c.helloed) return;
  const room = c.room;
  const me = room?.players.get(c.id);
  switch (m.t) {
    case "ping":
      if (typeof m.rtt === "number" && Number.isFinite(m.rtt)) c.ping = Math.max(0, Math.min(9999, Math.round(m.rtt)));
      c.send({ t: "pong", c: Number(m.c) || 0, s: Date.now() });
      return;
    case "quick": {
      if (room) room.remove(c.id);
      const car = sanitizeLoadout(m.car);
      let target = [...rooms.values()].find((r) => r.kind === "public" && r.phase === "lobby" && r.activeCount() < r.settings.maxPlayers);
      if (!target) {
        target = new Room("public", sanitizeSettings({ track: TRACKS[Math.floor(Math.random() * 3)].id, laps: 2, maxPlayers: MAX_PLAYERS }, "public"));
      }
      target.add(c, car);
      return;
    }
    case "create": {
      if (room) room.remove(c.id);
      const r = new Room("private", sanitizeSettings(m.settings, "private"));
      r.add(c, sanitizeLoadout(m.car));
      return;
    }
    case "timetrial": {
      if (room) room.remove(c.id);
      const r = new Room("timetrial", sanitizeSettings({ track: m.track, laps: 99 }, "timetrial"));
      r.add(c, sanitizeLoadout(m.car));
      return;
    }
    case "join": {
      const code = String(m.code ?? "").toUpperCase().trim();
      const r = rooms.get(code);
      if (!r || r.kind === "timetrial") return c.send({ t: "error", msg: `Room ${code} not found` });
      if (r.activeCount() >= r.settings.maxPlayers) return c.send({ t: "error", msg: "Room is full" });
      if (r.phase !== "lobby") return c.send({ t: "error", msg: "Race in progress – try again after it finishes" });
      if (room && room !== r) room.remove(c.id);
      r.add(c, sanitizeLoadout(m.car));
      return;
    }
    case "leave":
      room?.remove(c.id);
      c.send({ t: "left", reason: "You left the room" });
      return;
    case "ready":
      if (!room || !me || room.phase !== "lobby") return;
      me.ready = !!m.ready;
      room.updateAutoStart();
      room.sync();
      return;
    case "car":
      if (!room || !me || room.phase !== "lobby") return;
      me.car = sanitizeLoadout(m.car);
      room.sync();
      return;
    case "settings":
      if (!room || room.hostId !== c.id || room.kind !== "private" || room.phase !== "lobby") return;
      room.settings = sanitizeSettings(m.settings, room.kind);
      room.sync();
      return;
    case "start": {
      if (!room || room.hostId !== c.id || room.kind === "public") return;
      const err = room.canStart();
      if (err) return c.send({ t: "error", msg: err });
      room.startRace();
      return;
    }
    case "state":
      if (room && me) room.onState(me, m.s);
      return;
    case "respawn":
      if (me?.race) me.race.respawnPending = true;
      return;
    case "lb":
      c.send({ t: "lbdata", ...leaderboard(String(m.track)) });
      return;
  }
}

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------

function httpHandler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  const url = new URL(req.url ?? "/", "http://x");
  if (url.pathname === "/health" || url.pathname === "/") {
    const players = [...rooms.values()].reduce((a, r) => a + r.activeCount(), 0);
    res.end(JSON.stringify({ ok: true, region: REGION, rooms: rooms.size, players, online: clientsById.size, cars: CARS.length }));
    return;
  }
  if (url.pathname === "/leaderboard") {
    res.end(JSON.stringify(leaderboard(url.searchParams.get("track") ?? TRACKS[0].id)));
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not found" }));
}

const server = createServer(httpHandler);
const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 });

wss.on("connection", (ws) => {
  const c = new Client(ws);
  const helloTimer = setTimeout(() => { if (!c.helloed) ws.close(1008, "no hello"); }, 8000);
  let alive = true;
  ws.on("pong", () => { alive = true; });
  const hb = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, 15000);
  ws.on("message", (data) => onMessage(c, data.toString()));
  ws.on("close", () => {
    clearTimeout(helloTimer);
    clearInterval(hb);
    if (clientsById.get(c.id) === c) clientsById.delete(c.id);
    const room = c.room;
    const p = room?.players.get(c.id);
    if (room && p && p.client === c) {
      // Hold the slot for reconnection.
      p.connected = false;
      p.client = null;
      p.disconnectedAt = Date.now();
      room.updateAutoStart();
      room.sync();
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const r of [...rooms.values()]) r.tick(now);
}, 1000 / SNAPSHOT_HZ);

server.listen(PORT, () => log(`Velocity Rush race server listening on :${PORT} (region ${REGION})`));

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    dirty = true;
    save();
    process.exit(0);
  });
}
