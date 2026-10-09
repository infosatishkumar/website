// Physics + AI regression test (no browser needed):
//   node racing-server/test-physics.ts
// Every car is driven by the AI for two laps of every track. The run fails if
// the simulation produces NaNs, a car gets stuck, or lap times / top speeds /
// acceleration fall outside realistic bounds.

import { TRACKS } from "../src/racing/shared/tracks.ts";
import { buildTrack, newProjection, gridSlot, newLapState, advanceLap } from "../src/racing/shared/trackGeom.ts";
import { CARS } from "../src/racing/shared/cars.ts";
import { Vehicle, PRESETS, type Controls, type SurfaceEnv } from "../src/racing/engine/vehicle.ts";
import { updateSurface, collideWalls } from "../src/racing/engine/physicsWorld.ts";
import { buildLine, newDriver, drive } from "../src/racing/engine/ai.ts";

let failures = 0;
const dt = 1 / 120;
for (const def of TRACKS) {
  const t = buildTrack(def);
  for (const spec of CARS) {
    const v = new Vehicle(spec);
    const g = gridSlot(t, 0);
    v.place(g.x, g.y, g.z, g.yaw);
    const grip = spec.tireGrip * PRESETS.sport.grip * 0.88;
    const dr = newDriver("elite", buildLine(t, grip, spec.clA / spec.mass, grip * 9.81 * 0.82));
    const proj = newProjection();
    const env: SurfaceEnv = { grip: 1, d: 0, nx: 0, nz: 0, halfWidth: t.halfWidth, gx: 0, gz: 0 };
    const c: Controls = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, shiftUp: false, shiftDown: false };
    updateSurface(t, v, proj, 1, env);
    const lap = newLapState(t, proj.s);
    const laps: number[] = [];
    let time = 0, last = 0, vmax = 0, t100 = 0, stuck = 0, bad = "";
    while (laps.length < 2 && time < 400) {
      updateSurface(t, v, proj, 1, env);
      drive(t, dr, v, proj.s, [], dt, c, "sport");
      v.step(dt, c, { abs: true, tc: true, esc: true, autoGear: true, preset: "sport" }, env);
      updateSurface(t, v, proj, 1, env);
      collideWalls(t, v, proj);
      time += dt;
      if (!Number.isFinite(v.x + v.z + v.vx + v.vz + v.r)) { bad = "NaN"; break; }
      if (!t100 && v.kmh >= 100) t100 = time;
      vmax = Math.max(vmax, v.kmh);
      if (dr.stuckTime > 5) stuck++;
      if (advanceLap(t, lap, proj.s) === "lap") { laps.push(time - last); last = time; }
    }
    const lapOk = laps.length === 2 && laps.every((l) => l > t.length / (spec.topSpeed / 3.6) && l < t.length / 15);
    const ok = !bad && !stuck && lapOk && t100 > 1.8 && t100 < 6.5 && vmax < spec.topSpeed * 1.05;
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${def.id.padEnd(7)} ${spec.id.padEnd(7)} laps ${laps.map((l) => l.toFixed(1)).join(" / ").padEnd(13)} vmax ${vmax.toFixed(0).padStart(3)} km/h  0-100 ${t100.toFixed(2)} s${bad ? "  " + bad : ""}${stuck ? "  stuck" : ""}`);
  }
}
console.log(failures ? `\n${failures} failure(s)` : "\nAll physics checks passed");
process.exit(failures ? 1 : 0);
