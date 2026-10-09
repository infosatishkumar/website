// End-to-end multiplayer test against a running race server.
//   node racing-server/server.ts &   # or point RACE_URL at a deployed server
//   node racing-server/test-race.ts
//
// Two real WebSocket clients create/join a private room, ready up, race a lap
// on Neon Harbor along the centreline, and must receive server-authoritative
// lap, finish and results messages in the right order. A third client tries to
// teleport and must be corrected, and one racer drops and reconnects mid-race.

import { WebSocket } from "ws";
import { getTrack } from "../src/racing/shared/tracks.ts";
import { buildTrack, sampleAt, gridSlot } from "../src/racing/shared/trackGeom.ts";
import { PROTOCOL_VERSION, type ServerMsg, type ClientMsg, type Loadout } from "../src/racing/shared/protocol.ts";

const URL = process.env.RACE_URL ?? "ws://localhost:8787";
const track = buildTrack(getTrack("harbor"));
const car: Loadout = {
  id: "kaiju",
  cust: { color: "#c8102e", finish: "metallic", rim: 0, rimColor: "#cccccc", wing: -1, kit: 0 },
  up: { engine: 0, tires: 0, weight: 0 },
};

let failures = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

class Bot {
  ws!: WebSocket;
  id = "";
  token = "";
  log: ServerMsg[] = [];
  waiters: { pred: (m: ServerMsg) => boolean; res: (m: ServerMsg) => void }[] = [];
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  connect(token = "") {
    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(URL);
      this.ws.on("error", reject);
      this.ws.on("open", () => this.send({ t: "hello", v: PROTOCOL_VERSION, name: this.name, avatar: 1, token: token || undefined }));
      this.ws.on("message", (d) => {
        const m = JSON.parse(d.toString()) as ServerMsg;
        this.log.push(m);
        if (m.t === "welcome") { this.id = m.id; this.token = m.token; resolve(); }
        this.waiters = this.waiters.filter((w) => (w.pred(m) ? (w.res(m), false) : true));
      });
    });
  }
  send(m: ClientMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }
  wait<T extends ServerMsg["t"]>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, ms = 60000) {
    const hit = this.log.find((m) => m.t === t && pred(m as Extract<ServerMsg, { t: T }>));
    if (hit) return Promise.resolve(hit as Extract<ServerMsg, { t: T }>);
    return new Promise<Extract<ServerMsg, { t: T }>>((res, rej) => {
      const timer = setTimeout(() => rej(new Error(`${this.name}: timeout waiting for ${t}`)), ms);
      this.waiters.push({ pred: (m) => m.t === t && pred(m as Extract<ServerMsg, { t: T }>), res: (m) => { clearTimeout(timer); res(m as Extract<ServerMsg, { t: T }>); } });
    });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Drive along the centreline from the grid slot at `speed` m/s, sending 20 Hz state until `until()` is true. */
async function drive(bot: Bot, slot: number, speed: number, startAt: number, until: () => boolean, onTick?: (s: number) => boolean) {
  const g = gridSlot(track, slot);
  let s = track.s[g.i] - track.length; // negative: behind the line
  const lateral = slot % 2 === 0 ? 2 : -2;
  const out = { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 };
  let last = Date.now();
  while (!until()) {
    await sleep(50);
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    if (now >= startAt) s += speed * dt;
    if (onTick && onTick(s)) continue;
    sampleAt(track, s, out);
    const x = out.x + out.tz * lateral, z = out.z - out.tx * lateral;
    const yaw = Math.atan2(out.tx, out.tz);
    const v = now >= startAt ? speed : 0;
    bot.send({ t: "state", s: [x, out.y, z, yaw, 0, 0, out.tx * v, out.tz * v, 0, 6000, 4, 0, 0] });
  }
}

async function main() {
  console.log(`Testing ${URL} on ${track.def.name} (${Math.round(track.length)} m)`);
  const a = new Bot("Alpha"), b = new Bot("Bravo"), c = new Bot("Cheater");
  await Promise.all([a.connect(), b.connect(), c.connect()]);
  check(!!a.id && !!b.id && a.id !== b.id, "clients receive distinct identities");

  a.send({ t: "create", settings: { track: "harbor", laps: 1, maxPlayers: 4, series: 1, time: "night", weather: "dry", collisions: true }, car });
  const room = await a.wait("room");
  check(room.kind === "private" && room.code.length === 5, `private room created (${room.code})`);
  b.send({ t: "join", code: room.code, car: { ...car, id: "vantor" } });
  c.send({ t: "join", code: room.code, car });
  await b.wait("room", (m) => m.players.length === 3);
  a.send({ t: "start" });
  const early = await a.wait("error");
  check(/ready/i.test(early.msg), "host cannot start before everyone is ready");
  b.send({ t: "ready", ready: true });
  c.send({ t: "ready", ready: true });
  await a.wait("room", (m) => m.players.filter((p) => p.ready).length === 2);
  a.send({ t: "start" });
  const start = await a.wait("start");
  check(start.grid.length === 3, "server assigns a 3-car grid");
  const slot = (id: string) => start.grid.find((g) => g.id === id)!.slot;
  const startAt = start.startAt - (Date.now() - Date.now()); // server and test share a clock locally

  let done = false;
  // Cheater teleports half a lap after the start.
  const cheat = drive(c, slot(c.id), 40, startAt, () => done, (s) => {
    if (s > 30 && s < 34) {
      const far = sampleAt(track, s + 600, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
      c.send({ t: "state", s: [far.x, far.y, far.z, 0, 0, 0, 0, 0, 0, 6000, 4, 0, 0] });
      return true;
    }
    return false;
  });
  // Bravo drops out briefly and reconnects with its token.
  const reconnect = (async () => {
    await sleep(start.startAt - Date.now() + 3000);
    const token = b.token;
    b.ws.terminate();
    await sleep(1500);
    const b2 = new Bot("Bravo");
    await b2.connect(token);
    check(b2.id === b.id, "reconnect with token restores the same identity");
    const again = await b2.wait("start");
    check(again.startAt === start.startAt, "reconnected client receives the running race");
    await drive(b2, slot(b2.id), 95, startAt, () => done);
    return b2;
  })();
  const alpha = drive(a, slot(a.id), 110, startAt, () => done);

  const corr = await c.wait("correct", () => true, 40000);
  check(/fast|course/.test(corr.reason), `teleport rejected by anti-cheat (${corr.reason})`);
  const lap = await a.wait("lap", (m) => m.id === a.id, 60000);
  check(lap.time > 10000 && lap.time < 30000, `server timed Alpha's lap: ${(lap.time / 1000).toFixed(2)} s`);
  const fin = await a.wait("finish", (m) => m.id === a.id, 60000);
  check(fin.place === 1, "Alpha finishes P1 by server referee");
  const results = await a.wait("results", () => true, 90000);
  done = true;
  await Promise.all([alpha, cheat, reconnect]);
  const rows = results.rows;
  console.log(rows.map((r) => `  ${r.place}. ${r.name} ${r.dnf ? "DNF" : (r.time! / 1000).toFixed(2) + "s"} xp+${r.xp}`).join("\n"));
  check(rows[0].id === a.id && !rows[0].dnf, "results: Alpha won");
  check(rows.some((r) => r.id === b.id && !r.dnf), "results: Bravo finished after reconnecting");
  const cRow = rows.find((r) => r.id === c.id);
  check(!!cRow && (cRow.dnf || cRow.place === 3), "results: cheater did not gain positions");
  const health = await fetch(URL.replace(/^ws/, "http") + "/leaderboard?track=harbor").then((r) => r.json());
  check(health.laps.length > 0, "validated lap posted to the global leaderboard");
  for (const bot of [a, c]) bot.ws.close();
  (await reconnect).ws.close();
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll multiplayer checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
