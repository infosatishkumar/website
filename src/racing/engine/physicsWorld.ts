// Couples vehicles with the track: surface classification, gravity on
// gradients, barrier collisions and car-to-car collisions.

import { project, inRanges, type Projection, type TrackData } from "../shared/trackGeom.ts";
import type { SurfaceEnv } from "./vehicle.ts";
import type { Vehicle } from "./vehicle.ts";

const G = 9.81;

export function wallDistAt(t: TrackData, s: number) {
  if (inRanges(t.tunnels, s, t.length)) return t.halfWidth + 1.2;
  if (inRanges(t.bridges, s, t.length)) return t.halfWidth + 1.0;
  return t.wallDist;
}

export function updateSurface(t: TrackData, v: Vehicle, proj: Projection, grip: number, env: SurfaceEnv) {
  project(t, v.x, v.z, v.hint, proj);
  v.hint = proj.i;
  env.grip = grip;
  env.d = proj.d;
  env.nx = proj.nx;
  env.nz = proj.nz;
  env.halfWidth = t.halfWidth;
  env.gx = -G * proj.slope * proj.tx;
  env.gz = -G * proj.slope * proj.tz;
  v.y = proj.y;
  return env;
}

export interface Impact {
  speed: number;
  x: number;
  z: number;
  /** Local impact direction: +1 front, -1 rear, 0 side. */
  zone: number;
  side: number;
}

/** Keep the car between the barriers. Returns impact info when it hits. */
export function collideWalls(t: TrackData, v: Vehicle, proj: Projection, restitution = 0.25): Impact | null {
  const wall = wallDistAt(t, proj.s);
  const hl = v.spec.body.length / 2 * 0.95, hw = v.spec.body.width / 2;
  const sin = Math.sin(v.yaw), cos = Math.cos(v.yaw);
  let worst: Impact | null = null;
  for (const [ox, oy] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) {
    // forward (sin, cos), left (cos, -sin)
    const wx = sin * ox + cos * oy;
    const wz = cos * ox - sin * oy;
    const d = proj.d + wx * proj.nx + wz * proj.nz;
    let pen = 0, nx = 0, nz = 0;
    if (d > wall) { pen = d - wall; nx = -proj.nx; nz = -proj.nz; }
    else if (d < -wall) { pen = -wall - d; nx = proj.nx; nz = proj.nz; }
    if (pen <= 0) continue;
    v.x += nx * pen;
    v.z += nz * pen;
    // Contact velocity
    const cvx = v.vx + v.r * wz;
    const cvz = v.vz - v.r * wx;
    const vn = cvx * nx + cvz * nz;
    if (vn >= 0) continue;
    const m = v.spec.mass, I = v.inertia;
    const rn = wz * nx - wx * nz;
    const j = (-(1 + restitution) * vn) / (1 / m + (rn * rn) / I);
    v.impulse(nx * j, nz * j, wx, wz);
    // Friction along the wall
    const tx = -nz, tz = nx;
    const vt = cvx * tx + cvz * tz;
    const rt = wz * tx - wx * tz;
    let jt = -vt / (1 / m + (rt * rt) / I);
    const maxJt = 0.35 * j;
    jt = Math.max(-maxJt, Math.min(maxJt, jt));
    v.impulse(tx * jt, tz * jt, wx, wz);
    const spd = -vn;
    if (!worst || spd > worst.speed) worst = { speed: spd, x: v.x + wx, z: v.z + wz, zone: ox > 0 ? 1 : -1, side: oy > 0 ? 1 : -1 };
  }
  if (worst && worst.speed > 4) v.damage = Math.min(1, v.damage + (worst.speed - 4) * 0.006);
  return worst;
}

/**
 * Two-circle car collision. When `bStatic` is true (remote network car), only
 * `a` is pushed, using b's velocity as the moving obstacle.
 */
export function collideCars(a: Vehicle, b: Vehicle, bStatic: boolean, restitution = 0.3): Impact | null {
  const circles = (v: Vehicle) => {
    const off = v.spec.body.length * 0.27;
    const sin = Math.sin(v.yaw), cos = Math.cos(v.yaw);
    return [
      [v.x + sin * off, v.z + cos * off, sin * off, cos * off],
      [v.x - sin * off, v.z - cos * off, -sin * off, -cos * off],
    ];
  };
  const dx0 = b.x - a.x, dz0 = b.z - a.z;
  if (dx0 * dx0 + dz0 * dz0 > 100) return null;
  if (Math.abs(a.y - b.y) > 3) return null;
  const ra = a.spec.body.width / 2 + 0.05, rb = b.spec.body.width / 2 + 0.05;
  let hit: Impact | null = null;
  for (const ca of circles(a)) {
    for (const cb of circles(b)) {
      const dx = cb[0] - ca[0], dz = cb[1] - ca[1];
      const dist = Math.hypot(dx, dz);
      const minD = ra + rb;
      if (dist >= minD || dist < 1e-4) continue;
      const nx = dx / dist, nz = dz / dist; // from a to b
      const pen = minD - dist;
      const ma = a.spec.mass, mb = b.spec.mass;
      const wa = bStatic ? 1 : mb / (ma + mb);
      a.x -= nx * pen * wa;
      a.z -= nz * pen * wa;
      if (!bStatic) { b.x += nx * pen * (1 - wa); b.z += nz * pen * (1 - wa); }
      // Relative velocity at contact
      const vax = a.vx + a.r * ca[3], vaz = a.vz - a.r * ca[2];
      const vbx = b.vx + b.r * cb[3], vbz = b.vz - b.r * cb[2];
      const vn = (vbx - vax) * nx + (vbz - vaz) * nz;
      if (vn >= 0) continue;
      const rnA = ca[3] * nx - ca[2] * nz;
      const rnB = cb[3] * nx - cb[2] * nz;
      const invA = 1 / ma + (rnA * rnA) / a.inertia;
      const invB = bStatic ? 0 : 1 / mb + (rnB * rnB) / b.inertia;
      // Treat a remote car as having its real mass for the impulse size but don't move it.
      const denom = invA + (bStatic ? 1 / mb : invB);
      const j = (-(1 + restitution) * vn) / denom;
      a.impulse(-nx * j, -nz * j, ca[2], ca[3]);
      if (!bStatic) b.impulse(nx * j, nz * j, cb[2], cb[3]);
      const spd = -vn;
      if (spd > 3) {
        const dmg = (spd - 3) * 0.004;
        a.damage = Math.min(1, a.damage + dmg);
        if (!bStatic) b.damage = Math.min(1, b.damage + dmg);
      }
      if (!hit || spd > hit.speed) {
        const fwd = nx * Math.sin(a.yaw) + nz * Math.cos(a.yaw);
        hit = { speed: spd, x: (ca[0] + cb[0]) / 2, z: (ca[1] + cb[1]) / 2, zone: fwd > 0.5 ? 1 : fwd < -0.5 ? -1 : 0, side: 0 };
      }
    }
  }
  return hit;
}
