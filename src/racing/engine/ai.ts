// AI drivers: follow a precomputed racing line with a physics-derived speed
// profile, pure-pursuit steering, overtaking offsets and skill-dependent
// mistakes. Also used (with a lane offset and a speed cap) for free-roam traffic.

import { computeRacingLine, sDelta, type TrackData } from "../shared/trackGeom.ts";
import { PRESETS, type Controls, type Vehicle } from "./vehicle.ts";

export type Skill = "rookie" | "pro" | "elite";
export const SKILL_PACE: Record<Skill, number> = { rookie: 0.84, pro: 0.92, elite: 0.985 };

export interface LineData {
  off: Float32Array;
  lx: Float32Array;
  lz: Float32Array;
  vmax: Float32Array;
}

const G = 9.81;

/** Racing line + per-sample speed limit for a given grip level. */
export function buildLine(t: TrackData, grip: number, clAperMass: number, decel: number, laneOffset: number | null = null): LineData {
  const n = t.n;
  const off = laneOffset === null ? computeRacingLine(t) : new Float32Array(n).fill(laneOffset);
  const lx = new Float32Array(n), lz = new Float32Array(n), vmax = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    lx[i] = t.px[i] + t.nx[i] * off[i];
    lz[i] = t.pz[i] + t.nz[i] * off[i];
  }
  const step = t.length / n;
  const k = 0.5 * 1.225 * clAperMass;
  for (let i = 0; i < n; i++) {
    const a = (i - 4 + n) % n, b = (i + 4) % n;
    const h1 = Math.atan2(lx[i] - lx[a], lz[i] - lz[a]);
    const h2 = Math.atan2(lx[b] - lx[i], lz[b] - lz[i]);
    let dh = h2 - h1;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    const kap = Math.abs(dh) / (4 * step) + 1e-5;
    const denom = kap - grip * k;
    vmax[i] = denom <= 0 ? 120 : Math.min(120, Math.sqrt((grip * G) / denom));
    // (grip is expected to already include a safety margin)
  }
  // Braking zones: backward pass, twice around the loop.
  for (let pass = 0; pass < 2; pass++) {
    for (let j = n - 1; j >= 0; j--) {
      const i = j, nx = (j + 1) % n;
      const lim = Math.sqrt(vmax[nx] * vmax[nx] + 2 * decel * step);
      if (vmax[i] > lim) vmax[i] = lim;
    }
  }
  return { off, lx, lz, vmax };
}

export interface AiDriver {
  skill: Skill;
  pace: number;
  line: LineData;
  latOffset: number;
  latTarget: number;
  stuckTime: number;
  mistakeTimer: number;
  mistake: number;
  /** Speed cap (m/s) for traffic. */
  cap: number;
  traffic: boolean;
  seed: number;
}

export function newDriver(skill: Skill, line: LineData, traffic = false, cap = 200): AiDriver {
  return {
    skill, pace: SKILL_PACE[skill] * (0.985 + Math.random() * 0.03), line, latOffset: 0, latTarget: 0,
    stuckTime: 0, mistakeTimer: 5 + Math.random() * 20, mistake: 0, cap, traffic, seed: Math.random() * 100,
  };
}

/** Compute control inputs. `others` are the other cars on track for avoidance. */
export function drive(
  t: TrackData, dr: AiDriver, v: Vehicle, s: number, others: { v: Vehicle; s: number }[], dt: number, out: Controls,
  presetName: keyof typeof PRESETS = "sport",
) {
  const n = t.n;
  const step = t.length / n;
  const speed = Math.max(0, v.vxl);
  // Avoidance / overtaking
  let blocked = Infinity;
  dr.latTarget = 0;
  for (const o of others) {
    if (o.v === v) continue;
    const ahead = sDelta(t, s, o.s);
    if (ahead <= 0 || ahead > 28) continue;
    // Lateral position difference using the track normal at our position
    const i = Math.floor(((s % t.length) + t.length) % t.length / step) % n;
    const dLat = (o.v.x - v.x) * t.nx[i] + (o.v.z - v.z) * t.nz[i];
    if (Math.abs(dLat) < 2.6) {
      if (dr.traffic) {
        blocked = Math.min(blocked, ahead);
      } else {
        // Pick the side with more room.
        const oLat = (o.v.x - t.px[i]) * t.nx[i] + (o.v.z - t.pz[i]) * t.nz[i];
        const room = t.halfWidth - 1.4;
        const leftSpace = room - oLat, rightSpace = oLat + room;
        const want = leftSpace > rightSpace ? oLat + 2.8 : oLat - 2.8;
        dr.latTarget = Math.max(-room, Math.min(room, want)) - dr.line.off[i];
        if (ahead < 12 && o.v.vxl < speed - 2) blocked = Math.min(blocked, ahead);
      }
    }
  }
  dr.latOffset += (dr.latTarget - dr.latOffset) * Math.min(1, dt * 1.2);

  // Pure pursuit on the (offset) racing line.
  const look = 7 + speed * 0.42;
  const fi = ((s + look) / step) | 0;
  const i2 = ((fi % n) + n) % n;
  const off = dr.latOffset + Math.sin(performance_now() * 0.0003 + dr.seed) * (dr.skill === "rookie" ? 0.6 : 0.25);
  const tx = dr.line.lx[i2] + t.nx[i2] * off;
  const tz = dr.line.lz[i2] + t.nz[i2] * off;
  const dx = tx - v.x, dz = tz - v.z;
  const sin = Math.sin(v.yaw), cos = Math.cos(v.yaw);
  const fwd = dx * sin + dz * cos;
  const left = dx * cos - dz * sin;
  const alpha = Math.atan2(left, fwd);
  const Ld = Math.hypot(dx, dz);
  const delta = Math.atan((2 * v.spec.wheelbase * Math.sin(alpha)) / Ld);
  const pre = PRESETS[presetName];
  const k = pre.steerSpeedK * 1.4;
  const lock = v.spec.steerLock / (1 + (speed / k) * (speed / k));
  out.steer = Math.max(-1, Math.min(1, -delta / lock));
  out.analog = true;

  // Speed control: look a little ahead for the limit.
  let vt = Infinity;
  const i0 = ((Math.floor(s / step) % n) + n) % n;
  for (let k2 = 0; k2 < 6; k2++) vt = Math.min(vt, dr.line.vmax[(i0 + k2 * 2) % n]);
  vt *= dr.pace;
  if (dr.traffic) vt = Math.min(vt, dr.cap);
  // Mistakes: occasional late braking for rookies / pros.
  dr.mistakeTimer -= dt;
  if (dr.mistakeTimer < 0) {
    dr.mistakeTimer = 8 + Math.random() * (dr.skill === "elite" ? 60 : dr.skill === "pro" ? 30 : 15);
    dr.mistake = dr.skill === "elite" ? 0.4 : 1.2;
  }
  if (dr.mistake > 0) { dr.mistake -= dt; vt *= 1.08; }
  if (blocked < Infinity) {
    const follow = dr.traffic ? Math.max(0, (blocked - 8) * 0.8) : speed;
    vt = Math.min(vt, follow + (dr.traffic ? 0 : -1));
  }
  const err = vt - speed;
  if (err > 0) {
    out.throttle = Math.min(1, 0.35 + err * 0.25);
    out.brake = 0;
  } else if (err < -1.2) {
    out.throttle = 0;
    out.brake = Math.min(1, -err * 0.18);
  } else {
    out.throttle = 0.25;
    out.brake = 0;
  }
  // Ease off when sliding.
  const beta = Math.abs(Math.atan2(v.vyl, Math.max(3, v.vxl)));
  if (beta > 0.12) out.throttle *= 0.5;
  out.handbrake = false;
  out.nitro = !dr.traffic && dr.skill !== "rookie" && err > 15 && Math.abs(out.steer) < 0.15;
  out.shiftUp = false;
  out.shiftDown = false;
  // Stuck detection
  if (speed < 1.5) dr.stuckTime += dt; else dr.stuckTime = 0;
}

// performance.now() exists in browsers and Node; isolate for tests.
function performance_now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
