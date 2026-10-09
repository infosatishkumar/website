// Race session orchestrator. Owns the world, cars, camera, effects and the
// fixed-step simulation, and implements every game mode's rules (circuit,
// sprint, time trial with ghost, drift, drag, speed trap, free roam with
// traffic/dynamic weather, online races synced with the server) plus replay.

import * as THREE from "three";
import { getTrack, type TimeOfDay, type Weather } from "../shared/tracks.ts";
import {
  buildTrack, newProjection, newLapState, advanceLap, gridSlot, sampleAt,
  type TrackData, type Projection, type LapState,
} from "../shared/trackGeom.ts";
import { getCar, applyUpgrades, TRAFFIC_CAR, type CarSpec } from "../shared/cars.ts";
import type { Loadout, RoomKind, ResultRow, CarState } from "../shared/protocol.ts";
import { STATE_HZ } from "../shared/protocol.ts";
import { raceXp } from "../shared/progress.ts";
import { Vehicle, PRESETS, type Controls, type Assists, type SurfaceEnv } from "./vehicle.ts";
import { updateSurface, collideWalls, collideCars, type Impact } from "./physicsWorld.ts";
import { buildLine, newDriver, drive, type AiDriver, type Skill, type LineData } from "./ai.ts";
import { CarModel } from "./carModel.ts";
import { World } from "./world.ts";
import { TIME_HOURS } from "./sky.ts";
import { Effects } from "./effects.ts";
import { CameraRig } from "./camera.ts";
import type { AudioEngine, EngineVoice } from "./audio.ts";
import type { Input, EdgeAction } from "./input.ts";
import type { RenderCore } from "./renderer.ts";
import { CAMERA_MODES, type CameraMode, type Settings } from "./settings.ts";
import type { NetClient } from "./net.ts";

export type GameMode = "race" | "sprint" | "timetrial" | "drift" | "drag" | "speed" | "freeroam" | "online";

export interface OnlineSetup {
  net: NetClient;
  grid: { id: string; slot: number }[];
  startAt: number;
  players: Map<string, { name: string; car: Loadout; avatar: number }>;
  kind: RoomKind;
  laps: number;
  collisions: boolean;
}

export interface SessionConfig {
  mode: GameMode;
  track: string;
  laps: number;
  opponents: number;
  skill: Skill;
  time: TimeOfDay;
  weather: Weather;
  dynamicTime: boolean;
  dynamicWeather: boolean;
  traffic: boolean;
  car: Loadout;
  playerName: string;
  online?: OnlineSetup;
  /** Drift challenge length (s) / sprint length (m) etc. */
  duration?: number;
  sprintDistance?: number;
  label?: string;
}

export interface HudMessage {
  id: number;
  text: string;
  kind: "info" | "good" | "warn" | "big";
  t: number;
}

export interface HudState {
  mode: GameMode;
  phase: "intro" | "countdown" | "racing" | "finished" | "replay";
  speed: number;
  rpm: number;
  redline: number;
  gear: string;
  nitro: number;
  nitroActive: boolean;
  damage: number;
  lap: number;
  laps: number;
  position: number;
  total: number;
  raceTime: number;
  lapTime: number;
  bestLap: number | null;
  lastLap: number | null;
  lights: number;
  go: boolean;
  messages: HudMessage[];
  abs: boolean;
  tc: boolean;
  esc: boolean;
  manual: boolean;
  drift: { score: number; current: number; combo: number } | null;
  timeLeft: number | null;
  trap: number | null;
  wrongWay: boolean;
  ping: number | null;
  netStatus: string | null;
  cars: { x: number; z: number; player: boolean; color: string }[];
  standings: { name: string; lap: number; player: boolean; finished: boolean }[];
  camera: CameraMode;
  hours: number;
  weather: Weather;
  fps: number;
  scale: number;
  distanceLeft: number | null;
  spectating: boolean;
}

export interface RaceResult {
  mode: GameMode;
  track: string;
  label?: string;
  rows: { name: string; car: string; time: number | null; best: number | null; place: number; player: boolean; dnf: boolean }[];
  place: number;
  total: number;
  time: number | null;
  best: number | null;
  score: number | null;
  trap: number | null;
  reaction: number | null;
  xp: number;
  credits: number;
  topSpeed: number;
  distance: number;
  won: boolean;
  online?: { rows: ResultRow[]; final: boolean; raceIndex: number };
  skill: Skill;
}

interface CarEntity {
  id: string;
  name: string;
  kind: "player" | "ai" | "remote" | "traffic" | "ghost";
  spec: CarSpec;
  color: string;
  v: Vehicle;
  model: CarModel;
  proj: Projection;
  env: SurfaceEnv;
  lap: LapState;
  controls: Controls;
  driver: AiDriver | null;
  voice: EngineVoice | null;
  finished: boolean;
  finishTime: number;
  best: number | null;
  last: number | null;
  lapStart: number;
  indicator: number;
  headlights: boolean;
  remote: number[];
  remoteValid: boolean;
  serverPos: number;
  serverLap: number;
  sprayTimer: number;
  respawnCooldown: number;
}

const FIXED = 1 / 120;
const WET_GRIP = 0.72;

const ghostKey = (track: string) => `vr.ghost.${track}`;

export class Game {
  cfg: SessionConfig;
  track!: TrackData;
  world!: World;
  cars: CarEntity[] = [];
  player!: CarEntity;
  rig: CameraRig;
  effects!: Effects;
  phase: HudState["phase"] = "intro";
  onHud: ((h: HudState) => void) | null = null;
  onResult: ((r: RaceResult) => void) | null = null;
  onPause: (() => void) | null = null;
  /** Development/test hook: let the AI drive the player's car. */
  autopilot = false;
  private core: RenderCore;
  private audio: AudioEngine;
  private input: Input;
  private settings: Settings;
  private raf = 0;
  private lastFrame = 0;
  private acc = 0;
  time = 0;
  private raceClock = 0;
  private startAt = 0; // local performance-time (s) of the green light
  private hudTimer = 0;
  private sendTimer = 0;
  private messages: HudMessage[] = [];
  private msgId = 0;
  private paused = false;
  private lookBack = false;
  private lines = new Map<string, LineData>();
  private headlight: THREE.SpotLight | null = null;
  private assists!: Assists;
  private wrongWayTime = 0;
  private lastLightsLit = -1;
  private resultsSent = false;
  private finishWait = 0;
  private topSpeed = 0;
  private distance = 0;
  private dashTimer = 0;
  private dynTimer = 0;
  private hours = 13;
  private weather: Weather = "dry";
  // Mode state
  private drift = { score: 0, current: 0, combo: 1, comboTime: 0, idle: 0 };
  private trapSpeed: number | null = null;
  private reaction: number | null = null;
  private dragFinish: number | null = null;
  private ghostRec: number[] = [];
  private ghostBest: { time: number; data: number[] } | null = null;
  private ghost: CarModel | null = null;
  // Replay
  private replay: Float32Array[] = [];
  private replayTimer = 0;
  private replayFrame = 0;
  private replayLen = 0;
  private stride = 10;
  private onlineOff: (() => void)[] = [];
  private onlineFinished = false;
  private spectating = false;
  private tmpV = new THREE.Vector3();
  private others: { v: Vehicle; s: number }[] = [];

  constructor(core: RenderCore, audio: AudioEngine, input: Input, settings: Settings, cfg: SessionConfig) {
    this.core = core;
    this.audio = audio;
    this.input = input;
    this.settings = settings;
    this.cfg = cfg;
    const el = core.renderer.domElement;
    this.rig = new CameraRig(el.clientWidth / Math.max(1, el.clientHeight));
    this.rig.setMode(settings.camera);
    this.hours = TIME_HOURS[cfg.time];
    this.weather = cfg.weather;
  }

  get q() {
    return this.settings.quality;
  }
  /** Offline or online time trial: the first crossing of the line starts the lap clock. */
  get isTimeTrial() {
    return this.cfg.mode === "timetrial" || this.cfg.online?.kind === "timetrial";
  }

  get grip() {
    return this.weather === "rain" ? WET_GRIP : 1;
  }

  updateSettings(s: Settings) {
    this.settings = s;
    this.assists = this.makeAssists();
    this.input.setSettings(s);
  }

  private makeAssists(): Assists {
    const s = this.settings;
    return { abs: s.abs, tc: s.tc, esc: s.esc, autoGear: s.autoGear, preset: s.handling };
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  async load(onProgress: (p: number, label: string) => void) {
    const cfg = this.cfg;
    this.assists = this.makeAssists();
    this.track = buildTrack(getTrack(cfg.track));
    this.world = new World(this.core.renderer, this.track, { quality: this.q, hours: this.hours, weather: this.weather });
    await this.world.build((p, l) => onProgress(p * 0.85, l));
    this.effects = new Effects(this.q, this.weather === "rain");
    this.world.scene.add(this.effects.group);
    this.world.sky.onThunder = (d) => this.audio.thunder(d);
    onProgress(0.88, "Rolling out the cars");
    await new Promise((r) => setTimeout(r, 0));
    this.spawnCars();
    onProgress(0.97, "Warming up engines");
    await new Promise((r) => setTimeout(r, 0));
    // Compile shaders up front to avoid hitches on the first frames.
    this.rig.update(0.016, this.camTarget(this.player), this.track, false, (x, z) => this.world.ground(x, z));
    this.core.renderer.compile(this.world.scene, this.rig.camera);
    this.audio.setEnvironment(this.track.def.environment, this.weather === "rain");
    if (cfg.mode === "timetrial") this.loadGhost();
    onProgress(1, "Ready");
  }

  private makeEntity(id: string, name: string, kind: CarEntity["kind"], spec: CarSpec, load: Loadout | null, x: number, y: number, z: number, yaw: number): CarEntity {
    const cust = load?.cust ?? { color: "#cccccc", finish: "gloss" as const, rim: 0, rimColor: "#aaaaaa", wing: 0, kit: 0 };
    const phys = load ? applyUpgrades(spec, load.up, load.cust) : spec;
    const v = new Vehicle(phys);
    v.place(x, y, z, yaw);
    const model = new CarModel(spec, cust, { quality: this.q, interior: kind === "player", traffic: kind === "traffic" });
    model.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && this.q !== "low") o.castShadow = true; });
    this.world.scene.add(model.root);
    const e: CarEntity = {
      id, name, kind, spec: phys, color: cust.color, v, model, proj: newProjection(),
      env: { grip: 1, d: 0, nx: 0, nz: 0, halfWidth: this.track.halfWidth, gx: 0, gz: 0 },
      lap: newLapState(this.track, 0), controls: { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, shiftUp: false, shiftDown: false },
      driver: null, voice: null, finished: false, finishTime: 0, best: null, last: null, lapStart: 0, indicator: 0,
      headlights: false, remote: new Array(13).fill(0), remoteValid: false, serverPos: 0, serverLap: 0, sprayTimer: 0, respawnCooldown: 0,
    };
    updateSurface(this.track, v, e.proj, this.grip, e.env);
    e.lap = newLapState(this.track, e.proj.s);
    if (kind !== "traffic" && kind !== "remote") e.voice = this.audio.createEngine(spec.sound, kind !== "player");
    this.cars.push(e);
    return e;
  }

  private aiLine(spec: CarSpec, traffic: boolean, lane = 0) {
    const key = traffic ? `traffic${lane}` : spec.id;
    let l = this.lines.get(key);
    if (!l) {
      const pre = PRESETS[this.settings.handling];
      const grip = spec.tireGrip * pre.grip * this.grip * 0.88;
      l = buildLine(this.track, grip, spec.clA / spec.mass, grip * 9.81 * 0.82, traffic ? lane : null);
      this.lines.set(key, l);
    }
    return l;
  }

  private spawnCars() {
    const cfg = this.cfg;
    const t = this.track;
    const playerSpec = getCar(cfg.car.id);
    if (cfg.online) {
      const on = cfg.online;
      for (const g of on.grid) {
        const info = on.players.get(g.id);
        if (!info) continue;
        const gs = gridSlot(t, g.slot);
        const isMe = g.id === on.net.id;
        const e = this.makeEntity(g.id, info.name, isMe ? "player" : "remote", getCar(info.car.id), info.car, gs.x, gs.y, gs.z, gs.yaw);
        if (isMe) this.player = e;
        else {
          e.voice = this.audio.createEngine(getCar(info.car.id).sound, true);
        }
      }
      if (!this.player) {
        // Spectating (joined during a running race or not on the grid).
        this.spectating = true;
        const gs = gridSlot(t, 0);
        this.player = this.makeEntity("spectator", cfg.playerName, "player", playerSpec, cfg.car, gs.x, gs.y, gs.z, gs.yaw);
        this.player.model.root.visible = false;
      }
      this.startAt = this.serverToLocal(on.startAt);
      this.bindOnline();
    } else {
      let playerSlot = 0;
      const opp = cfg.mode === "race" || cfg.mode === "sprint" ? cfg.opponents : cfg.mode === "drag" ? 1 : 0;
      if (cfg.mode === "race" || cfg.mode === "sprint") playerSlot = Math.min(opp, Math.max(0, Math.floor(opp * 0.6)));
      const slots = opp + 1;
      const pool = ["vantor", "strada", "aurion", "kaiju", "apexrs"];
      const names = ["R. Okafor", "M. Lindqvist", "S. Tanaka", "L. Moreau", "D. Alvarez", "K. Novak", "A. Haddad", "J. Kowalski", "P. Duarte", "E. Varga", "N. Ito"];
      const colors = ["#c8102e", "#f5a300", "#11b37d", "#f2f2f2", "#1f4fff", "#8338ec", "#ff006e", "#111111", "#2ec4b6", "#e9c46a", "#adb5bd"];
      let ai = 0;
      for (let slot = 0; slot < slots; slot++) {
        let gs = gridSlot(t, slot);
        if (cfg.mode === "drag") {
          // Side by side on the start line.
          const p = sampleAt(t, -4, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
          const lat = slot === 0 ? 4 : -4;
          gs = { x: p.x + p.tz * lat, y: p.y, z: p.z - p.tx * lat, yaw: Math.atan2(p.tx, p.tz), i: p.i };
        }
        if (cfg.mode === "freeroam" || cfg.mode === "timetrial" || cfg.mode === "drift" || cfg.mode === "speed") {
          const p = sampleAt(t, cfg.mode === "timetrial" ? -60 : -15, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
          gs = { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(p.tx, p.tz), i: p.i };
        }
        if (slot === playerSlot) {
          this.player = this.makeEntity("me", cfg.playerName || "You", "player", playerSpec, cfg.car, gs.x, gs.y, gs.z, gs.yaw);
        } else {
          const carId = cfg.mode === "drag" ? cfg.car.id : pool[(ai + (cfg.skill === "elite" ? 2 : cfg.skill === "pro" ? 1 : 0)) % pool.length];
          const spec = getCar(carId);
          const lvl = cfg.skill === "elite" ? 2 : cfg.skill === "pro" ? 1 : 0;
          const load: Loadout = {
            id: carId,
            cust: { color: colors[ai % colors.length], finish: ai % 3 === 0 ? "gloss" : "metallic", rim: ai % 3, rimColor: "#c4c8cc", wing: -1, kit: ai % 2 },
            up: { engine: lvl, tires: lvl, weight: lvl },
          };
          const e = this.makeEntity(`ai${ai}`, names[ai % names.length], "ai", spec, load, gs.x, gs.y, gs.z, gs.yaw);
          e.driver = newDriver(cfg.skill, this.aiLine(e.spec, false));
          ai++;
        }
      }
      this.startAt = cfg.mode === "freeroam" ? 0 : 4.6;
      if (cfg.mode === "freeroam") this.phase = "racing";
    }
    // Free-roam / street traffic
    if (!cfg.online && (cfg.traffic && (cfg.mode === "freeroam") && this.track.def.traffic)) {
      const n = this.q === "low" ? 6 : 10;
      const tColors = ["#9aa3ad", "#2b2d42", "#e5e5e5", "#7a1f1f", "#264653", "#d4a373", "#5a5a5a", "#1d3557", "#f1faee", "#6b705c"];
      for (let k = 0; k < n; k++) {
        const s = ((k + 1) / (n + 1)) * t.length;
        const lane = -t.halfWidth * 0.45;
        const p = sampleAt(t, s, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
        const x = p.x + p.tz * lane, z = p.z - p.tx * lane;
        const e = this.makeEntity(`traffic${k}`, "Traffic", "traffic", TRAFFIC_CAR, {
          id: "traffic", cust: { color: tColors[k % tColors.length], finish: "gloss", rim: 1, rimColor: "#999999", wing: 0, kit: 0 },
          up: { engine: 0, tires: 0, weight: 0 },
        }, x, p.y, z, Math.atan2(p.tx, p.tz));
        e.driver = newDriver("rookie", this.aiLine(TRAFFIC_CAR, true, lane), true, (45 + Math.random() * 35) / 3.6);
      }
    }
    // Headlight for the player car
    if (this.q !== "low") {
      const spot = new THREE.SpotLight(0xfff1dc, 0, 140, 0.48, 0.55, 1.4);
      const a = this.player.model.anchors.headL;
      spot.position.set(0, a.y, a.z);
      spot.target.position.set(0, 0, a.z + 30);
      this.player.model.root.add(spot, spot.target);
      this.headlight = spot;
    }
    const night = this.world.sky.night;
    for (const c of this.cars) c.headlights = night;
    this.player.v.gear = 1;
    // Time trial: the first crossing of the line starts the clock.
    if (this.isTimeTrial) this.player.lap.nextCp = 0;
  }

  private loadGhost() {
    try {
      const raw = localStorage.getItem(ghostKey(this.cfg.track));
      if (raw) this.ghostBest = JSON.parse(raw);
    } catch { /* ignore */ }
    this.ghost = new CarModel(getCar(this.cfg.car.id), { ...this.cfg.car.cust, color: "#7fd8ff", finish: "gloss" }, { quality: "low", interior: false });
    const ghostify = (mm: THREE.Material) => {
      const c = mm.clone();
      c.transparent = true;
      c.opacity = 0.28;
      c.depthWrite = false;
      return c;
    };
    this.ghost.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = Array.isArray(m.material) ? m.material.map(ghostify) : ghostify(m.material);
      m.castShadow = false;
    });
    this.ghost.root.visible = false;
    this.world.scene.add(this.ghost.root);
  }

  // -------------------------------------------------------------------------
  // Online
  // -------------------------------------------------------------------------

  private serverToLocal(serverMs: number) {
    const net = this.cfg.online!.net;
    // Seconds on our local game clock when the server time is reached.
    return this.time + (serverMs - net.serverNow()) / 1000;
  }

  private bindOnline() {
    const net = this.cfg.online!.net;
    net.clearBuffers();
    this.onlineOff.push(
      net.on("lap", (m) => {
        const e = this.cars.find((c) => c.id === m.id);
        if (!e) return;
        e.serverLap = m.lap;
        if (e === this.player) {
          e.last = m.time / 1000;
          e.best = m.best ? m.best / 1000 : e.best;
          this.msg(`Lap ${m.lap}  ${fmt(m.time / 1000)}`, "good");
        }
      }),
      net.on("finish", (m) => {
        const e = this.cars.find((c) => c.id === m.id);
        if (!e) return;
        e.finished = true;
        e.finishTime = m.time / 1000;
        if (e === this.player) {
          this.onlineFinished = true;
          this.phase = "finished";
          this.msg(`FINISHED  P${m.place}`, "big");
        } else this.msg(`${e.name} finished P${m.place}`, "info");
      }),
      net.on("correct", (m) => {
        if (this.spectating) return;
        const v = this.player.v;
        v.place(m.x, m.y, m.z, m.yaw);
        this.player.v.hint = -1;
        if (m.reason !== "reconnected") this.msg(`Server correction: ${m.reason}`, "warn");
        this.rig.reset();
      }),
      net.on("snap", (m) => {
        for (const [id, , lap, , fin, pos] of m.p) {
          const e = this.cars.find((c) => c.id === id);
          if (!e) continue;
          e.serverPos = pos;
          e.serverLap = lap;
          if (fin) e.finished = true;
        }
      }),
      net.on("results", (m) => {
        this.finishResults(m.rows, m.final, m.raceIndex);
      }),
      net.on("start", (m) => {
        // Re-sync after a reconnect.
        this.startAt = this.serverToLocal(m.startAt);
      }),
    );
  }

  private sendState() {
    const on = this.cfg.online;
    if (!on || this.spectating) return;
    const v = this.player.v;
    const flags = (v.brakeOut > 0.1 ? 1 : 0) | (v.gear === -1 ? 2 : 0) | (this.player.headlights ? 4 : 0) | (v.nitroActive ? 8 : 0)
      | (this.player.indicator === -1 || this.player.indicator === 2 ? 16 : 0) | (this.player.indicator === 1 || this.player.indicator === 2 ? 32 : 0)
      | (v.slideTotal > 0.3 ? 64 : 0);
    const s: CarState = [
      round(v.x, 100), round(v.y, 100), round(v.z, 100), round(v.yaw, 1000), round(v.pitch, 1000), round(v.roll, 1000),
      round(v.vx, 100), round(v.vz, 100), round(v.steerAngle, 1000), Math.round(v.rpm), v.gear, flags, round(v.damage, 100),
    ];
    on.net.send({ t: "state", s });
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  start() {
    this.lastFrame = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
      this.lastFrame = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  setPaused(p: boolean) {
    if (this.cfg.online) {
      // The race keeps running on the server; only the menu is shown.
      this.paused = false;
      return;
    }
    this.paused = p;
    for (const c of this.cars) c.voice?.out.gain.setTargetAtTime(p ? 0 : 1, this.audio.ctx?.currentTime ?? 0, 0.05);
  }

  onAction(a: EdgeAction) {
    const p = this.player;
    switch (a) {
      case "camera": {
        if (this.phase === "replay") {
          this.rig.setMode(this.rig.mode === "cinematic" ? "chase" : "cinematic");
          return;
        }
        const i = CAMERA_MODES.indexOf(this.rig.mode);
        this.rig.setMode(CAMERA_MODES[(i + 1) % CAMERA_MODES.length]);
        break;
      }
      case "pause": this.onPause?.(); break;
      case "reset": this.respawn(p); break;
      case "indLeft": p.indicator = p.indicator === -1 ? 0 : -1; break;
      case "indRight": p.indicator = p.indicator === 1 ? 0 : 1; break;
      case "hazard": p.indicator = p.indicator === 2 ? 0 : 2; break;
      case "lights": p.headlights = !p.headlights; break;
      case "horn": this.audio.horn(); break;
    }
  }

  /** Change time of day / weather mid-session (free roam). */
  setWorld(hours: number, weather: Weather) {
    this.hours = hours;
    this.weather = weather;
    this.effects.setRain(weather === "rain", this.q);
    this.audio.setEnvironment(this.track.def.environment, weather === "rain");
    this.world.setConditions(hours, weather, true);
    for (const c of this.cars) c.headlights = this.world.sky.night;
  }

  get worldHours() {
    return this.hours;
  }

  get worldWeather() {
    return this.weather;
  }

  setCamera(m: CameraMode) {
    this.rig.setMode(m);
  }

  private msg(text: string, kind: HudMessage["kind"] = "info") {
    this.messages.push({ id: ++this.msgId, text, kind, t: this.time });
    if (this.messages.length > 6) this.messages.shift();
  }

  private respawn(e: CarEntity) {
    if (e.respawnCooldown > 0 || this.phase === "replay" || this.spectating) return;
    e.respawnCooldown = 2.5;
    const s = e.proj.s - 6;
    const p = sampleAt(this.track, s, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
    const lane = e.kind === "traffic" ? -this.track.halfWidth * 0.45 : 0;
    if (e === this.player && this.cfg.online) this.cfg.online.net.send({ t: "respawn" });
    e.v.place(p.x + p.tz * lane, p.y, p.z - p.tx * lane, Math.atan2(p.tx, p.tz));
    e.v.hint = p.i;
    if (e.driver) e.driver.stuckTime = 0;
    if (e === this.player) {
      this.rig.reset();
      this.drift.current = 0;
      this.drift.combo = 1;
    }
  }

  private frame(dt: number) {
    this.core.adapt(dt);
    if (!this.paused) {
      this.time += dt;
      if (this.phase === "replay") this.replayStep(dt);
      else {
        this.acc += dt;
        let steps = 0;
        const lookBack = this.input.sample(dt, this.player.controls);
        this.lookBack = lookBack;
        // dt is clamped to 0.1 s, so 12 steps always keeps simulation and race clock in sync.
        while (this.acc >= FIXED && steps < 12) {
          this.simStep(FIXED);
          this.acc -= FIXED;
          steps++;
        }
        if (steps === 12) this.acc = 0;
        this.postStep(dt);
      }
    }
    this.render(dt);
  }

  private get racing() {
    return this.phase === "racing" || this.phase === "finished";
  }

  private simStep(dt: number) {
    const t = this.track;
    const countdown = this.time < this.startAt && this.cfg.mode !== "freeroam";
    if (!this.racing && !countdown && this.phase !== "intro") return;
    // Shared list of cars for AI avoidance (positions from the previous step).
    const others = this.others;
    others.length = 0;
    for (const o of this.cars) if (o.kind !== "ghost" && !(this.spectating && o === this.player)) others.push({ v: o.v, s: o.proj.s });
    for (const e of this.cars) {
      if (e.kind === "remote" || e.kind === "ghost") continue;
      if (this.spectating && e === this.player) continue;
      updateSurface(t, e.v, e.proj, this.grip, e.env);
      if (e.driver) {
        drive(t, e.driver, e.v, e.proj.s, others, dt, e.controls, this.settings.handling);
        if (e.kind === "ai" && this.cfg.mode === "drag") { e.controls.steer *= 0.5; e.controls.nitro = e.v.kmh > 120; }
        if (e.driver.stuckTime > 3) this.respawn(e);
      }
      if (e.finished && e.kind !== "player") {
        // Cool-down lap
        e.controls.throttle = Math.min(e.controls.throttle, 0.35);
      }
      if (e === this.player && this.autopilot && !e.finished) {
        if (!e.driver) e.driver = newDriver("pro", this.aiLine(e.spec, false));
        drive(t, e.driver, e.v, e.proj.s, [], dt, e.controls, this.settings.handling);
        if (this.cfg.mode === "drift") { e.controls.handbrake = Math.abs(e.controls.steer) > 0.3 && e.v.kmh > 50; }
      }
      if (e === this.player && e.finished && !this.cfg.online && this.cfg.mode !== "freeroam") {
        // Autopilot after the flag.
        if (!e.driver) e.driver = newDriver("rookie", this.aiLine(e.spec, false));
        drive(t, e.driver, e.v, e.proj.s, [], dt, e.controls, this.settings.handling);
        e.controls.throttle *= 0.5;
      }
      if (countdown || this.phase === "intro") {
        // Held on the grid: rev the engine but don't move.
        const s = e.spec;
        const target = s.idleRpm + e.controls.throttle * (s.redline * 0.85 - s.idleRpm);
        e.v.rpm += (target - e.v.rpm) * Math.min(1, dt * 6);
        e.v.throttleOut = e.controls.throttle;
        continue;
      }
      const assists: Assists = e.kind === "player" ? this.assists : { abs: true, tc: true, esc: true, autoGear: true, preset: this.settings.handling };
      e.v.step(dt, e.controls, assists, e.env);
      updateSurface(t, e.v, e.proj, this.grip, e.env);
      const hit = collideWalls(t, e.v, e.proj);
      if (hit && e === this.player) this.onPlayerImpact(hit, true);
      else if (hit && hit.speed > 6 && e.kind === "ai") this.effects.burstSparks(hit.x, e.v.y, hit.z, e.v.vx, e.v.vz, hit.speed);
    }
    // Car-to-car contact
    const collide = !this.cfg.online || this.cfg.online.collisions;
    if (collide && this.racing) {
      for (let i = 0; i < this.cars.length; i++) {
        const a = this.cars[i];
        if (a.kind === "ghost" || a.kind === "remote" || (this.spectating && a === this.player)) continue;
        for (let j = 0; j < this.cars.length; j++) {
          if (i === j) continue;
          const b = this.cars[j];
          if (b.kind === "ghost" || (this.spectating && b === this.player)) continue;
          const remote = b.kind === "remote";
          if (!remote && j < i) continue;
          if (remote && !b.remoteValid) continue;
          const hit = collideCars(a.v, b.v, remote);
          if (hit && (a === this.player || b === this.player)) this.onPlayerImpact(hit, false);
        }
      }
    }
    // Lap / checkpoint progress for local cars
    for (const e of this.cars) {
      if (e.kind === "remote" || e.kind === "traffic" || e.kind === "ghost") continue;
      if (this.spectating && e === this.player) continue;
      if (!this.racing) { e.lap.lastS = e.proj.s; continue; }
      const ev = advanceLap(t, e.lap, e.proj.s);
      if (ev === "lap") this.onLap(e);
      if (e.respawnCooldown > 0) e.respawnCooldown -= dt;
    }
  }

  private onPlayerImpact(hit: Impact, wall: boolean) {
    const p = this.player;
    if (hit.speed < 2.5) return;
    this.audio.impact(hit.speed);
    this.rig.shake(Math.min(1, hit.speed / 18));
    this.input.rumble(Math.min(1, hit.speed / 15), 0.5, 180);
    if (wall && hit.speed > 4) this.effects.burstSparks(hit.x, p.v.y, hit.z, p.v.vx, p.v.vz, hit.speed);
    if (hit.speed > 6) {
      const dx = hit.x - p.v.x, dz = hit.z - p.v.z;
      const s = Math.sin(p.v.yaw), c = Math.cos(p.v.yaw);
      const fwd = dx * s + dz * c, left = dx * c - dz * s;
      p.model.deform(left, 0.5, fwd, Math.min(0.12, (hit.speed - 6) * 0.01));
      if (this.cfg.mode === "drift") {
        if (this.drift.current > 0) this.msg("Drift lost!", "warn");
        this.drift.current = 0;
        this.drift.combo = 1;
      }
    }
  }

  private onLap(e: CarEntity) {
    const now = this.raceClock;
    const cfg = this.cfg;
    const lapTime = now - e.lapStart;
    const firstCrossing = this.isTimeTrial && e.lapStart < 0;
    e.lapStart = now;
    if (firstCrossing) {
      this.ghostRec = [];
      this.msg("Timing started", "info");
      return;
    }
    if (cfg.mode === "freeroam" || cfg.mode === "drift" || cfg.mode === "speed" || cfg.mode === "drag") return;
    if (cfg.online && e === this.player) return; // server reports laps
    e.last = lapTime;
    const isBest = e.best === null || lapTime < e.best;
    if (isBest) e.best = lapTime;
    if (e === this.player) {
      const n = cfg.mode === "timetrial" ? e.lap.lap - 1 : e.lap.lap;
      this.msg(`Lap ${n}  ${fmt(lapTime)}${isBest ? "  · best" : ""}`, isBest ? "good" : "info");
      if (cfg.mode === "timetrial") {
        if (!this.ghostBest || lapTime < this.ghostBest.time) {
          this.ghostBest = { time: lapTime, data: this.ghostRec.slice() };
          try { localStorage.setItem(ghostKey(cfg.track), JSON.stringify(this.ghostBest)); } catch { /* quota */ }
          this.msg("New ghost saved", "good");
        }
        this.ghostRec = [];
      }
    }
    if (cfg.mode === "race" && e.lap.lap >= cfg.laps && !e.finished) this.finishCar(e, now);
  }

  private finishCar(e: CarEntity, time: number) {
    e.finished = true;
    e.finishTime = time;
    if (e === this.player) {
      this.phase = "finished";
      const pos = this.positions().indexOf(e) + 1;
      this.msg(this.cfg.mode === "race" || this.cfg.mode === "sprint" ? `FINISHED  P${pos}` : "FINISHED", "big");
      this.finishWait = 0;
    }
  }

  /** Cars ordered by race progress (finished cars first by time). */
  private positions() {
    const racers = this.cars.filter((c) => c.kind === "player" || c.kind === "ai" || c.kind === "remote");
    if (this.cfg.online) {
      return racers.slice().sort((a, b) => (a.serverPos || 99) - (b.serverPos || 99));
    }
    return racers.slice().sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      return b.lap.progress - a.lap.progress;
    });
  }

  private postStep(dt: number) {
    const cfg = this.cfg;
    const p = this.player;
    // Phase transitions
    if (this.phase === "intro") this.phase = cfg.mode === "freeroam" ? "racing" : "countdown";
    if (this.phase === "countdown") {
      const left = this.startAt - this.time;
      const lit = left > 3.6 ? 0 : Math.min(5, Math.floor((3.6 - left) / 0.6) + 1);
      if (lit !== this.lastLightsLit && left > 0) {
        this.lastLightsLit = lit;
        this.world.setStartLights(lit);
        if (lit > 0) this.audio.beep(false);
      }
      if (left <= 0) {
        this.phase = "racing";
        this.world.setStartLights(0, true);
        this.audio.beep(true);
        this.msg("GO!", "big");
        this.raceClock = 0;
        for (const c of this.cars) c.lapStart = this.isTimeTrial ? -1 : 0;
        setTimeout(() => this.world.setStartLights(0), 4000);
      }
    }
    if (this.racing) this.raceClock += dt;
    // Online: remote cars from interpolated snapshots
    if (cfg.online) {
      const net = cfg.online.net;
      for (const e of this.cars) {
        if (e.kind !== "remote") continue;
        e.remoteValid = net.sample(e.id, e.remote);
        if (!e.remoteValid) continue;
        const r = e.remote;
        const v = e.v;
        v.x = r[0]; v.y = r[1]; v.z = r[2]; v.yaw = r[3]; v.pitch = r[4]; v.roll = r[5];
        v.vx = r[6]; v.vz = r[7]; v.steerAngle = r[8]; v.rpm = r[9]; v.gear = r[10]; v.damage = r[12];
        v.vxl = v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw);
        const flags = r[11];
        v.brakeOut = flags & 1 ? 1 : 0;
        v.nitroActive = !!(flags & 8);
        v.slideTotal = flags & 64 ? 0.5 : 0;
        e.headlights = !!(flags & 4);
        e.indicator = flags & 16 && flags & 32 ? 2 : flags & 16 ? -1 : flags & 32 ? 1 : 0;
        for (const w of v.wheels) { w.spin += (v.vxl / v.spec.wheelRadius) * dt; w.slide = v.slideTotal; }
        updateSurface(this.track, v, e.proj, this.grip, e.env);
        v.y = r[1];
      }
      this.sendTimer += dt;
      if (this.sendTimer >= 1 / STATE_HZ) {
        this.sendTimer = 0;
        this.sendState();
      }
    }
    // Stats
    if (this.racing && !this.spectating) {
      this.topSpeed = Math.max(this.topSpeed, p.v.kmh);
      this.distance += p.v.speed * dt;
    }
    // Wrong way
    const dot = p.v.vx * p.proj.tx + p.v.vz * p.proj.tz;
    this.wrongWayTime = dot < -4 ? this.wrongWayTime + dt : 0;
    // Mode logic
    this.modeLogic(dt);
    // Time trial ghost recording / playback
    if (cfg.mode === "timetrial" && this.racing && p.lapStart >= 0) {
      const lt = this.raceClock - p.lapStart;
      if (this.ghostRec.length / 4 < lt * 20) this.ghostRec.push(round(p.v.x, 100), round(p.v.y, 100), round(p.v.z, 100), round(p.v.yaw, 1000));
      if (this.ghost && this.ghostBest && this.ghostBest.data.length >= 8) {
        const f = lt * 20, i = Math.floor(f), u = f - i;
        const d = this.ghostBest.data;
        const n = d.length / 4;
        if (i < n - 1) {
          this.ghost.root.visible = true;
          const a = i * 4, b = (i + 1) * 4;
          this.ghost.root.position.set(d[a] + (d[b] - d[a]) * u, d[a + 1] + (d[b + 1] - d[a + 1]) * u, d[a + 2] + (d[b + 2] - d[a + 2]) * u);
          let dy = d[b + 3] - d[a + 3];
          if (dy > Math.PI) dy -= Math.PI * 2;
          if (dy < -Math.PI) dy += Math.PI * 2;
          this.ghost.root.rotation.y = d[a + 3] + dy * u;
        } else this.ghost.root.visible = false;
      }
    }
    // Replay recording (30 Hz)
    if (this.racing) {
      this.replayTimer += dt;
      if (this.replayTimer >= 1 / 30 && this.replayLen < 30 * 60 * 12) {
        this.replayTimer = 0;
        const fr = new Float32Array(this.cars.length * this.stride);
        this.cars.forEach((c, k) => {
          const v = c.v;
          fr.set([v.x, v.y, v.z, v.yaw, v.pitch, v.roll, v.steerAngle, v.vxl, v.brakeOut, v.nitroActive ? 1 : 0], k * this.stride);
        });
        this.replay.push(fr);
        this.replayLen++;
      }
    }
    // Finish handling for offline races
    if (!cfg.online && this.phase === "finished" && !this.resultsSent) {
      this.finishWait += dt;
      const allDone = this.cars.every((c) => c.kind !== "ai" || c.finished);
      if (allDone || this.finishWait > 9 || cfg.mode !== "race" && cfg.mode !== "sprint") {
        if (this.finishWait > 2.5) this.finishResults();
      }
    }
    // Free roam dynamic time & weather
    if (cfg.mode === "freeroam" && (cfg.dynamicTime || cfg.dynamicWeather)) {
      this.dynTimer += dt;
      if (cfg.dynamicTime) this.hours = (this.hours + dt / 60) % 24;
      if (this.dynTimer > 15) {
        this.dynTimer = 0;
        if (cfg.dynamicWeather && Math.random() < 0.15) {
          this.weather = this.weather === "rain" ? "dry" : "rain";
          this.effects.setRain(this.weather === "rain", this.q);
          this.audio.setEnvironment(this.track.def.environment, this.weather === "rain");
          this.msg(this.weather === "rain" ? "Rain is moving in" : "Skies clearing", "info");
        }
        const wasNight = this.world.sky.night;
        this.world.setConditions(this.hours, this.weather, true);
        if (wasNight !== this.world.sky.night) for (const c of this.cars) if (c.kind !== "player") c.headlights = this.world.sky.night;
        if (!wasNight && this.world.sky.night) this.player.headlights = true;
      }
    }
    // HUD at 20 Hz
    this.hudTimer += dt;
    if (this.hudTimer > 0.05) {
      this.hudTimer = 0;
      this.onHud?.(this.hud());
    }
  }

  private modeLogic(dt: number) {
    const cfg = this.cfg;
    const p = this.player;
    if (!this.racing || p.finished) return;
    const v = p.v;
    switch (cfg.mode) {
      case "sprint": {
        const dist = cfg.sprintDistance ?? this.track.length * 0.9;
        for (const e of this.cars) {
          if (e.kind === "player" || e.kind === "ai") {
            if (!e.finished && e.lap.progress >= dist) this.finishCar(e, this.raceClock);
          }
        }
        break;
      }
      case "drift": {
        const d = this.drift;
        const beta = Math.abs(Math.atan2(v.vyl, Math.max(1, Math.abs(v.vxl))));
        if (beta > 0.2 && v.speed > 9 && v.vxl > 0) {
          d.idle = 0;
          d.comboTime += dt;
          if (d.comboTime > 2.2) { d.combo = Math.min(5, d.combo + 1); d.comboTime = 0; }
          d.current += beta * v.speed * dt * 12 * d.combo;
        } else {
          d.idle += dt;
          if (d.idle > 0.7 && d.current > 0) {
            d.score += Math.round(d.current);
            if (d.current > 1500) this.msg(`+${Math.round(d.current)} drift`, "good");
            d.current = 0;
            d.combo = 1;
            d.comboTime = 0;
          }
        }
        const limit = cfg.duration ?? 90;
        if (this.raceClock >= limit) {
          d.score += Math.round(d.current);
          d.current = 0;
          this.finishCar(p, this.raceClock);
        }
        break;
      }
      case "drag": {
        if (this.reaction === null && p.controls.throttle > 0.3) this.reaction = this.raceClock;
        const len = this.track.def.dragDistance ?? 402;
        for (const e of this.cars) {
          if (!e.finished && e.lap.progress >= len) {
            this.finishCar(e, this.raceClock);
            if (e === p) { this.dragFinish = this.raceClock; this.trapSpeed = v.kmh; }
          }
        }
        break;
      }
      case "speed": {
        const trap = this.track.def.speedTrapS ?? 1500;
        if (this.trapSpeed === null && p.lap.progress >= trap) {
          this.trapSpeed = v.kmh;
          this.msg(`Speed trap: ${Math.round(v.kmh)} km/h`, "big");
          this.finishCar(p, this.raceClock);
        }
        break;
      }
      case "timetrial": {
        const limit = (cfg.duration ?? 0) || Infinity;
        if (this.raceClock > limit) this.finishCar(p, this.raceClock);
        if (p.lap.lap >= cfg.laps + 1 && cfg.laps > 0) this.finishCar(p, this.raceClock);
        break;
      }
    }
  }

  private finishResults(online?: ResultRow[], final = true, raceIndex = 0) {
    if (this.resultsSent && !online) return;
    this.resultsSent = true;
    const cfg = this.cfg;
    const order = this.positions();
    const p = this.player;
    const place = online ? (online.find((r) => r.id === p.id)?.place ?? order.length) : order.indexOf(p) + 1;
    const total = order.length;
    const mult = cfg.skill === "elite" ? 1.4 : cfg.skill === "pro" ? 1 : 0.75;
    let credits = 0, xp = 0, won = false;
    switch (cfg.mode) {
      case "race":
      case "sprint":
        won = place === 1;
        credits = Math.round(([6000, 3500, 2200][place - 1] ?? 900) * mult * (1 + total / 10));
        xp = raceXp(place, total, p.finished);
        break;
      case "timetrial":
        credits = 1500;
        xp = 150;
        break;
      case "drift":
        credits = Math.round(this.drift.score / 10);
        xp = 100 + Math.round(this.drift.score / 200);
        break;
      case "drag":
        won = this.cars.filter((c) => c.kind === "ai").every((c) => !c.finished || c.finishTime > (this.dragFinish ?? Infinity));
        credits = won ? 3000 : 800;
        xp = won ? 200 : 80;
        break;
      case "speed":
        credits = Math.round((this.trapSpeed ?? 0) * 8);
        xp = 120;
        break;
      case "freeroam":
        xp = Math.round(this.distance / 200);
        credits = Math.round(this.distance / 20);
        break;
      case "online": break;
    }
    if (online) {
      const me = online.find((r) => r.id === p.id);
      xp = me?.xp ?? 0;
      credits = me ? Math.round(xp * 12) : 0;
      won = me?.place === 1;
    }
    const res: RaceResult = {
      mode: cfg.mode, track: cfg.track, label: cfg.label,
      rows: order.map((c, i) => ({ name: c.name, car: c.spec.name, time: c.finished ? c.finishTime : null, best: c.best, place: i + 1, player: c === p, dnf: !c.finished })),
      place, total, time: p.finished ? p.finishTime : null, best: p.best, score: cfg.mode === "drift" ? this.drift.score : null,
      trap: this.trapSpeed, reaction: this.reaction, xp, credits, topSpeed: Math.round(this.topSpeed), distance: Math.round(this.distance), won,
      online: online ? { rows: online, final, raceIndex } : undefined, skill: cfg.skill,
    };
    if (cfg.mode === "drag" && this.dragFinish !== null) res.time = this.dragFinish;
    this.onResult?.(res);
  }

  /** End a free-roam / time-trial session from the pause menu and get its stats. */
  endSession() {
    if (!this.resultsSent && !this.cfg.online) {
      this.player.finished = this.cfg.mode === "timetrial" ? this.player.best !== null : this.player.finished;
      this.finishResults();
    }
  }

  // -------------------------------------------------------------------------
  // Replay
  // -------------------------------------------------------------------------

  startReplay() {
    if (!this.replay.length) return false;
    this.phase = "replay";
    this.replayFrame = 0;
    this.rig.setMode("cinematic");
    for (const c of this.cars) c.voice?.out.gain.setTargetAtTime(0.4, this.audio.ctx?.currentTime ?? 0, 0.1);
    if (this.ghost) this.ghost.root.visible = false;
    return true;
  }

  stopReplay() {
    this.phase = "finished";
  }

  private replayStep(dt: number) {
    this.replayFrame += dt * 30;
    if (this.replayFrame >= this.replay.length - 1) this.replayFrame = 0;
    const i = Math.floor(this.replayFrame), u = this.replayFrame - i;
    const a = this.replay[i], b = this.replay[Math.min(this.replay.length - 1, i + 1)];
    this.cars.forEach((c, k) => {
      const o = k * this.stride;
      if (o >= a.length || o >= b.length) return;
      const v = c.v;
      const L = (x: number) => a[o + x] + (b[o + x] - a[o + x]) * u;
      v.x = L(0); v.y = L(1); v.z = L(2);
      let dy = b[o + 3] - a[o + 3];
      if (dy > Math.PI) dy -= Math.PI * 2;
      if (dy < -Math.PI) dy += Math.PI * 2;
      v.yaw = a[o + 3] + dy * u;
      v.pitch = L(4); v.roll = L(5); v.steerAngle = L(6); v.vxl = L(7);
      v.brakeOut = a[o + 8];
      v.nitroActive = a[o + 9] > 0.5;
      v.vx = Math.sin(v.yaw) * v.vxl;
      v.vz = Math.cos(v.yaw) * v.vxl;
      for (const w of v.wheels) w.spin += (v.vxl / v.spec.wheelRadius) * dt;
      v.rpm = v.spec.idleRpm + Math.min(1, Math.abs(v.vxl) / 80) * (v.spec.redline - v.spec.idleRpm) * 0.8;
      updateSurface(this.track, v, c.proj, this.grip, c.env);
    });
    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.onHud?.(this.hud());
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  private camTarget(e: CarEntity) {
    const v = e.v;
    return { x: v.x, y: v.y, z: v.z, yaw: v.yaw, vx: v.vx, vz: v.vz, speed: v.speed, s: e.proj.s, nitro: v.nitroActive, model: e.model };
  }

  private render(dt: number) {
    const p = this.player;
    // Spectators follow the race leader.
    const focus = this.spectating ? (this.positions().find((c) => c.kind === "remote" && c.remoteValid) ?? p) : p;
    const camPos = this.rig.camera.position;
    for (const c of this.cars) {
      const v = c.v;
      const m = c.model;
      m.root.position.set(v.x, v.y, v.z);
      m.root.rotation.y = v.yaw;
      const dist = camPos.distanceTo(m.root.position);
      m.setDetail(dist < 70 || c === p);
      m.root.visible = !(this.spectating && c === p) && (dist < 900);
      m.update({
        steerAngle: v.steerAngle,
        wheelSpin: v.wheels.map((w) => w.spin),
        compress: v.wheels.map((w) => w.compress),
        pitch: v.pitch,
        roll: v.roll,
        braking: v.brakeOut > 0.1 && v.vxl > 0.5,
        reverse: v.gear === -1,
        headlights: c.headlights || this.world.tunnelFactor(c.proj.s) > 0.2,
        nitro: v.nitroActive,
        indicator: c.indicator,
      }, this.time);
      // Engine audio
      if (c.voice && !this.paused) {
        const isP = c === p;
        const vol = isP ? (this.rig.mode === "cockpit" ? 1.0 : 0.85) : 1.0;
        c.voice.update({ rpm: v.rpm, redline: v.spec.redline, throttle: isP ? v.throttleOut : Math.max(0.25, v.throttleOut), speed: v.speed, shift: v.lastShift, nitro: v.nitroActive, limiter: v.limiter }, dt, vol);
        if (!isP) c.voice.setPosition(v.x, v.y + 0.5, v.z);
      }
      // Particle effects for cars near the camera
      if (dist < 140) this.carEffects(c, dt);
    }
    if (this.headlight) this.headlight.intensity = p.headlights || this.world.tunnelFactor(p.proj.s) > 0.2 ? 520 : 0;
    // Camera + world
    const tgt = this.camTarget(focus);
    const groundY = (x: number, z: number) => this.world.ground(x, z);
    this.rig.update(dt, tgt, this.track, this.lookBack, groundY);
    const cam = this.rig.camera;
    const el = this.core.renderer.domElement;
    const aspect = el.clientWidth / Math.max(1, el.clientHeight);
    if (Math.abs(cam.aspect - aspect) > 0.001) { cam.aspect = aspect; cam.updateProjectionMatrix(); }
    this.tmpV.set(focus.v.x, focus.v.y, focus.v.z);
    this.world.update(dt, this.time, cam.position, this.tmpV, focus.proj.s);
    if (this.effects.rain) this.effects.rain.update(dt, cam.position, 2, 1, focus.v.vx, focus.v.vz);
    this.effects.update(dt, this.core.drawHeight, cam.fov);
    // Audio listener + vehicle sounds
    const fwd = cam.getWorldDirection(this.tmpV);
    this.audio.setListener(cam.position.x, cam.position.y, cam.position.z, fwd.x, fwd.y, fwd.z);
    const offroad = p.v.wheels.filter((w) => w.offroad).length / 4;
    this.audio.updateVehicle({
      speed: this.paused ? 0 : focus.v.speed, slide: this.paused ? 0 : focus.v.slideTotal * 1.6, offroad, nitro: focus.v.nitroActive && !this.paused,
      tunnel: this.world.tunnelFactor(focus.proj.s), wet: this.weather === "rain",
    });
    if (focus.v.slideTotal > 0.4 && focus === p) this.input.rumble(0, focus.v.slideTotal * 0.4, 60);
    // Cockpit display
    this.dashTimer += dt;
    if (this.rig.mode === "cockpit" && this.dashTimer > 0.1) {
      this.dashTimer = 0;
      p.model.drawDash(p.v.kmh, p.v.rpm, p.v.spec.redline, gearLabel(p.v.gear));
    }
    this.core.hazeAmount = this.track.def.environment === "desert" && !this.world.sky.night ? 1 : 0;
    this.core.render(this.world.scene, cam, this.time);
  }

  private carEffects(c: CarEntity, dt: number) {
    const v = c.v;
    const fx = this.effects;
    const wet = this.weather === "rain";
    const sin = Math.sin(v.yaw), cos = Math.cos(v.yaw);
    v.wheels.forEach((w, i) => {
      const key = c.id.length * 1000 + i + (c.kind === "player" ? 0 : 10 * (this.cars.indexOf(c) + 1));
      const onRoad = !w.offroad;
      const skid = onRoad && !wet && this.phase !== "replay" ? w.slide : 0;
      fx.skids.add(key, w.wx, v.y, w.wz, skid > 0.25 ? skid : 0);
      if (i < 2) return;
      if (onRoad && !wet && w.slide > 0.3 && Math.random() < w.slide * dt * 60) {
        fx.smoke.emit({
          x: w.wx, y: v.y + 0.25, z: w.wz, vx: v.vx * 0.15 + (Math.random() - 0.5) * 1.5, vy: 0.6 + Math.random() * 0.8, vz: v.vz * 0.15 + (Math.random() - 0.5) * 1.5,
          life: 1.6 + Math.random() * 1.4, size: 0.9, grow: 2.6, alpha: 0.32 * w.slide + 0.1, r: 0.92, g: 0.92, b: 0.93, drag: 1.2,
        });
      }
      if (w.offroad && v.speed > 4 && Math.random() < dt * 40) {
        const sand = this.track.def.environment === "desert";
        fx.dust.emit({
          x: w.wx, y: v.y + 0.2, z: w.wz, vx: -sin * v.speed * 0.1 + (Math.random() - 0.5) * 2, vy: 1 + Math.random(), vz: -cos * v.speed * 0.1 + (Math.random() - 0.5) * 2,
          life: 1.5, size: 0.8, grow: 2.2, alpha: 0.35, r: sand ? 0.85 : 0.55, g: sand ? 0.72 : 0.48, b: sand ? 0.55 : 0.36, drag: 1.5,
        });
      }
      if (wet && v.speed > 10 && Math.random() < Math.min(1, v.speed / 40) * dt * 70) {
        fx.spray.emit({
          x: w.wx - sin * 0.3, y: v.y + 0.25, z: w.wz - cos * 0.3, vx: v.vx * 0.55 + (Math.random() - 0.5) * 1.8, vy: 0.8 + Math.random() * 1.2, vz: v.vz * 0.55 + (Math.random() - 0.5) * 1.8,
          life: 0.8 + Math.random() * 0.5, size: 0.7, grow: 3.2, alpha: 0.16, r: 0.82, g: 0.85, b: 0.88, drag: 2.2,
        });
      }
    });
    if (v.nitroActive && Math.random() < dt * 30) {
      for (const ex of c.model.anchors.exhaust) {
        const wx = v.x + sin * ex.z + cos * ex.x, wz = v.z + cos * ex.z - sin * ex.x;
        fx.sparks.emit({ x: wx, y: v.y + ex.y, z: wz, vx: v.vx * 0.7, vy: 0.2, vz: v.vz * 0.7, life: 0.15, size: 0.35, grow: 1, alpha: 0.8, r: 0.5, g: 0.7, b: 1, drag: 0.2 });
      }
    }
  }

  // -------------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------------

  private hud(): HudState {
    const p = this.player;
    const v = p.v;
    const cfg = this.cfg;
    const order = this.positions();
    const total = order.length;
    const position = cfg.online ? (p.serverPos || order.indexOf(p) + 1) : order.indexOf(p) + 1;
    const lapsTotal = cfg.online ? (cfg.online.kind === "timetrial" ? 0 : cfg.online.laps) : cfg.mode === "race" || cfg.mode === "timetrial" ? cfg.laps : 0;
    const lapNow = cfg.online
      ? Math.min(lapsTotal || 999, (p.serverLap || p.lap.lap) + 1)
      : cfg.mode === "timetrial" ? Math.max(1, p.lap.lap) : Math.min(lapsTotal || 999, p.lap.lap + 1);
    const lapTime = this.racing && p.lapStart >= 0 ? this.raceClock - p.lapStart : 0;
    const countdownLeft = this.startAt - this.time;
    const lights = this.phase === "countdown" ? (countdownLeft > 3.6 ? 0 : Math.min(5, Math.floor((3.6 - countdownLeft) / 0.6) + 1)) : 0;
    let timeLeft: number | null = null;
    if (cfg.mode === "drift") timeLeft = Math.max(0, (cfg.duration ?? 90) - this.raceClock);
    let distanceLeft: number | null = null;
    if (cfg.mode === "sprint") distanceLeft = Math.max(0, (cfg.sprintDistance ?? this.track.length * 0.9) - p.lap.progress);
    if (cfg.mode === "drag") distanceLeft = Math.max(0, (this.track.def.dragDistance ?? 402) - p.lap.progress);
    if (cfg.mode === "speed") distanceLeft = Math.max(0, (this.track.def.speedTrapS ?? 1500) - p.lap.progress);
    const recent = this.messages.filter((m) => this.time - m.t < 3.5);
    return {
      mode: cfg.mode,
      phase: this.phase,
      speed: v.kmh,
      rpm: v.rpm,
      redline: v.spec.redline,
      gear: gearLabel(v.gear),
      nitro: v.nitro,
      nitroActive: v.nitroActive,
      damage: v.damage,
      lap: lapNow,
      laps: lapsTotal,
      position,
      total,
      raceTime: this.racing ? this.raceClock : 0,
      lapTime,
      bestLap: p.best,
      lastLap: p.last,
      lights,
      go: this.phase === "racing" && this.raceClock < 1.2,
      messages: recent,
      abs: v.absActive,
      tc: v.tcActive,
      esc: v.escActive,
      manual: !this.settings.autoGear,
      drift: cfg.mode === "drift" ? { score: this.drift.score, current: Math.round(this.drift.current), combo: this.drift.combo } : null,
      timeLeft,
      trap: this.trapSpeed,
      wrongWay: this.wrongWayTime > 1.2 && cfg.mode !== "freeroam",
      ping: cfg.online ? Math.round(cfg.online.net.rtt) : null,
      netStatus: cfg.online ? cfg.online.net.status : null,
      cars: this.cars.filter((c) => c.kind !== "ghost" && !(this.spectating && c === p)).map((c) => ({ x: c.v.x, z: c.v.z, player: c === p, color: c.kind === "traffic" ? "#777777" : c.color })),
      standings: order.slice(0, 12).map((c) => ({ name: c.name, lap: cfg.online ? c.serverLap : c.lap.lap, player: c === p, finished: c.finished })),
      camera: this.rig.mode,
      hours: this.hours,
      weather: this.weather,
      fps: Math.round(this.core.fps),
      scale: this.core.scale,
      distanceLeft,
      spectating: this.spectating,
    };
  }

  dispose() {
    this.stop();
    for (const off of this.onlineOff) off();
    for (const c of this.cars) {
      c.voice?.stop();
      c.model.dispose();
    }
    this.ghost?.dispose();
    this.world?.dispose();
  }
}

function round(v: number, k: number) {
  return Math.round(v * k) / k;
}

export function gearLabel(g: number) {
  return g === -1 ? "R" : g === 0 ? "N" : String(g);
}

export function fmt(t: number | null | undefined) {
  if (t === null || t === undefined || !Number.isFinite(t)) return "--:--.---";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}
