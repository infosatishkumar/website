// Pure-math track geometry shared by client and server: builds an evenly
// sampled centreline from a TrackDef and answers "where on the track is this
// point" queries used by physics, AI, lap timing and server-side validation.

import type { TrackDef } from "./tracks.ts";

export const SAMPLE_STEP = 2; // metres between centreline samples

export interface TrackData {
  def: TrackDef;
  n: number;
  length: number;
  halfWidth: number;
  /** Distance from the centreline to the barrier face. */
  wallDist: number;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  /** Horizontal unit tangent. */
  tx: Float32Array;
  tz: Float32Array;
  /** Horizontal unit normal pointing to the LEFT of the direction of travel. */
  nx: Float32Array;
  nz: Float32Array;
  /** Sine of the road gradient (positive = uphill). */
  slope: Float32Array;
  /** Signed curvature (1/m), positive = turning left. */
  curv: Float32Array;
  s: Float32Array;
  /** s of the projection of each polygon corner. */
  cornerS: number[];
  checkpoints: number[];
  tunnels: [number, number][];
  bridges: [number, number][];
  grid: Map<number, number[]>;
}

export interface Projection {
  i: number;
  s: number;
  /** Lateral offset from the centreline, positive = left. */
  d: number;
  y: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  slope: number;
}

export function newProjection(): Projection {
  return { i: -1, s: 0, d: 0, y: 0, tx: 1, tz: 0, nx: 0, nz: -1, slope: 0 };
}

const GRID_CELL = 30;
const gridKey = (cx: number, cz: number) => cx * 100003 + cz;

type P3 = [number, number, number];

function roundedPolygon(def: TrackDef): P3[] {
  const c = def.corners;
  const m = c.length;
  const out: P3[] = [];
  const arcs: { start: P3; end: P3; pts: P3[] }[] = [];
  for (let i = 0; i < m; i++) {
    const [px, pz, py, r] = c[i];
    const [ax, az] = c[(i - 1 + m) % m];
    const [bx, bz] = c[(i + 1) % m];
    let ux = ax - px, uz = az - pz;
    let vx = bx - px, vz = bz - pz;
    const lu = Math.hypot(ux, uz), lv = Math.hypot(vx, vz);
    ux /= lu; uz /= lu; vx /= lv; vz /= lv;
    const phi = Math.acos(Math.max(-1, Math.min(1, ux * vx + uz * vz)));
    if (r <= 0 || phi > Math.PI - 0.02) {
      const p: P3 = [px, py, pz];
      arcs.push({ start: p, end: p, pts: [p] });
      continue;
    }
    const h = phi / 2;
    let d = r / Math.tan(h);
    const maxD = 0.48 * Math.min(lu, lv);
    if (d > maxD) d = maxD;
    const rr = d * Math.tan(h);
    let bxs = ux + vx, bzs = uz + vz;
    const lb = Math.hypot(bxs, bzs);
    bxs /= lb; bzs /= lb;
    const cdist = rr / Math.sin(h);
    const cx = px + bxs * cdist, cz = pz + bzs * cdist;
    const t1x = px + ux * d, t1z = pz + uz * d;
    const t2x = px + vx * d, t2z = pz + vz * d;
    const a0 = Math.atan2(t1z - cz, t1x - cx);
    let a1 = Math.atan2(t2z - cz, t2x - cx);
    let da = a1 - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    a1 = a0 + da;
    const steps = Math.max(2, Math.ceil((Math.abs(da) * rr) / 3));
    const pts: P3[] = [];
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (da * k) / steps;
      pts.push([cx + Math.cos(a) * rr, py, cz + Math.sin(a) * rr]);
    }
    arcs.push({ start: pts[0], end: pts[pts.length - 1], pts });
  }
  for (let i = 0; i < m; i++) {
    const arc = arcs[i];
    for (const p of arc.pts) out.push(p);
    const next = arcs[(i + 1) % m];
    const [ex, ey, ez] = arc.end;
    const [sx, sy, sz] = next.start;
    const len = Math.hypot(sx - ex, sz - ez);
    const steps = Math.max(1, Math.ceil(len / 8));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      out.push([ex + (sx - ex) * t, ey + (sy - ey) * t, ez + (sz - ez) * t]);
    }
  }
  return out;
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function buildTrack(def: TrackDef): TrackData {
  const dense = roundedPolygon(def);
  const m = dense.length;
  // Fine Catmull-Rom subdivision.
  const fine: P3[] = [];
  const SUB = 4;
  for (let i = 0; i < m; i++) {
    const a = dense[(i - 1 + m) % m], b = dense[i], c = dense[(i + 1) % m], d = dense[(i + 2) % m];
    for (let k = 0; k < SUB; k++) {
      const t = k / SUB;
      fine.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t), catmull(a[2], b[2], c[2], d[2], t)]);
    }
  }
  // Cumulative horizontal length.
  const fl = fine.length;
  const cum = new Float64Array(fl + 1);
  for (let i = 0; i < fl; i++) {
    const a = fine[i], b = fine[(i + 1) % fl];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[2] - a[2]);
  }
  const total = cum[fl];
  const n = Math.round(total / SAMPLE_STEP);
  const step = total / n;
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = i * step;
    while (cum[j + 1] < target) j++;
    const t = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const a = fine[j], b = fine[(j + 1) % fl];
    px[i] = a[0] + (b[0] - a[0]) * t;
    py[i] = a[1] + (b[1] - a[1]) * t;
    pz[i] = a[2] + (b[2] - a[2]) * t;
  }
  // Smooth elevation over ±40 m so gradients stay drivable.
  const win = Math.round(40 / step);
  const ys = new Float32Array(n);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let k = -win; k <= win; k++) acc += py[(i + k + n) % n];
      ys[i] = acc / (2 * win + 1);
    }
    py.set(ys);
  }
  const tx = new Float32Array(n), tz = new Float32Array(n), nx = new Float32Array(n), nz = new Float32Array(n);
  const slope = new Float32Array(n), curv = new Float32Array(n), s = new Float32Array(n);
  const heading = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    let dx = px[b] - px[a], dz = pz[b] - pz[a];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    tx[i] = dx; tz[i] = dz;
    // Left of travel: with y up and forward (sinθ, cosθ) the left is (cosθ, -sinθ) = (tz, -tx).
    nx[i] = dz; nz[i] = -dx;
    const dy = py[b] - py[a];
    slope[i] = dy / Math.hypot(l, dy);
    s[i] = i * step;
    heading[i] = Math.atan2(dx, dz);
  }
  for (let i = 0; i < n; i++) {
    const a = (i - 3 + n) % n, b = (i + 3) % n;
    let dh = heading[b] - heading[a];
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    curv[i] = dh / (6 * step);
  }
  const grid = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const key = gridKey(Math.floor(px[i] / GRID_CELL), Math.floor(pz[i] / GRID_CELL));
    let arr = grid.get(key);
    if (!arr) grid.set(key, (arr = []));
    arr.push(i);
  }
  const td: TrackData = {
    def, n, length: total, halfWidth: def.width / 2, wallDist: def.width / 2 + def.runoff,
    px, py, pz, tx, tz, nx, nz, slope, curv, s, cornerS: [], checkpoints: [], tunnels: [], bridges: [], grid,
  };
  const pr = newProjection();
  td.cornerS = def.corners.map(([x, z]) => project(td, x, z, -1, pr).s);
  const segRange = (sg: { seg: number; a: number; b: number }): [number, number] => {
    const s0 = td.cornerS[sg.seg];
    let s1 = td.cornerS[(sg.seg + 1) % def.corners.length];
    if (s1 < s0) s1 += total;
    return [s0 + (s1 - s0) * sg.a, s0 + (s1 - s0) * sg.b];
  };
  td.tunnels = (def.tunnels ?? []).map(segRange);
  td.bridges = (def.bridges ?? []).map(segRange);
  const cpCount = Math.max(8, Math.round(total / 220));
  for (let k = 0; k < cpCount; k++) td.checkpoints.push((k * total) / cpCount);
  return td;
}

/** Find the closest centreline position. `hint` is the previous sample index or -1. */
export function project(t: TrackData, x: number, z: number, hint: number, out: Projection): Projection {
  const n = t.n;
  let best = -1;
  let bestD = Infinity;
  const dist2 = (i: number) => {
    const dx = t.px[i] - x, dz = t.pz[i] - z;
    return dx * dx + dz * dz;
  };
  if (hint >= 0 && hint < n) {
    best = hint;
    bestD = dist2(hint);
    // Hill-climb in both directions.
    for (const dir of [1, -1]) {
      let i = hint;
      for (let k = 0; k < 400; k++) {
        const j = (i + dir + n) % n;
        const d = dist2(j);
        if (d < bestD) { bestD = d; best = j; i = j; } else if (k > 6) break; else i = j;
      }
    }
    // A jump of more than ~50 m suggests the hint was stale; fall back to the grid.
    if (bestD > 50 * 50) best = -1;
  }
  if (best < 0) {
    bestD = Infinity;
    const cx = Math.floor(x / GRID_CELL), cz = Math.floor(z / GRID_CELL);
    for (let r = 1; r <= 8 && best < 0; r++) {
      for (let ix = cx - r; ix <= cx + r; ix++) {
        for (let iz = cz - r; iz <= cz + r; iz++) {
          const arr = t.grid.get(gridKey(ix, iz));
          if (!arr) continue;
          for (const i of arr) {
            const d = dist2(i);
            if (d < bestD) { bestD = d; best = i; }
          }
        }
      }
    }
    if (best < 0) {
      for (let i = 0; i < n; i++) {
        const d = dist2(i);
        if (d < bestD) { bestD = d; best = i; }
      }
    }
  }
  // Refine on the adjacent segments.
  const prev = (best - 1 + n) % n, next = (best + 1) % n;
  let i0 = best, i1 = next;
  const segT = (a: number, b: number) => {
    const ax = t.px[a], az = t.pz[a];
    const bx = t.px[b] - ax, bz = t.pz[b] - az;
    const l2 = bx * bx + bz * bz || 1;
    return Math.max(0, Math.min(1, ((x - ax) * bx + (z - az) * bz) / l2));
  };
  let u = segT(best, next);
  if (u <= 0) { i0 = prev; i1 = best; u = segT(prev, best); }
  const lerp = (arr: Float32Array) => arr[i0] + (arr[i1] - arr[i0]) * u;
  const qx = lerp(t.px), qz = lerp(t.pz);
  let ntx = lerp(t.tx), ntz = lerp(t.tz);
  const l = Math.hypot(ntx, ntz) || 1;
  ntx /= l; ntz /= l;
  out.i = best;
  const step = t.length / n;
  let s = i0 * step + u * step;
  if (s >= t.length) s -= t.length;
  out.s = s;
  out.tx = ntx; out.tz = ntz;
  out.nx = ntz; out.nz = -ntx;
  out.d = (x - qx) * out.nx + (z - qz) * out.nz;
  out.y = lerp(t.py);
  out.slope = lerp(t.slope);
  return out;
}

/** Sample the centreline at arc length s (wrapping). */
export function sampleAt(t: TrackData, s: number, out: { x: number; y: number; z: number; tx: number; tz: number; i: number }) {
  const step = t.length / t.n;
  s = ((s % t.length) + t.length) % t.length;
  const f = s / step;
  const i0 = Math.floor(f) % t.n, i1 = (i0 + 1) % t.n, u = f - Math.floor(f);
  out.x = t.px[i0] + (t.px[i1] - t.px[i0]) * u;
  out.y = t.py[i0] + (t.py[i1] - t.py[i0]) * u;
  out.z = t.pz[i0] + (t.pz[i1] - t.pz[i0]) * u;
  let tx = t.tx[i0] + (t.tx[i1] - t.tx[i0]) * u, tz = t.tz[i0] + (t.tz[i1] - t.tz[i0]) * u;
  const l = Math.hypot(tx, tz) || 1;
  tx /= l; tz /= l;
  out.tx = tx; out.tz = tz;
  out.i = i0;
  return out;
}

/** Signed forward distance from a to b along the loop, in (-L/2, L/2]. */
export function sDelta(t: TrackData, a: number, b: number) {
  let d = b - a;
  const L = t.length;
  if (d > L / 2) d -= L;
  if (d <= -L / 2) d += L;
  return d;
}

export function inRanges(ranges: [number, number][], s: number, L: number) {
  for (const [a, b] of ranges) {
    if ((s >= a && s <= b) || (s + L >= a && s + L <= b)) return true;
  }
  return false;
}

/**
 * Lap progress tracker used identically by the client HUD and the server
 * referee. Checkpoints must be crossed in order; crossing the start line with
 * every checkpoint collected completes a lap.
 */
export interface LapState {
  lap: number; // completed laps
  nextCp: number; // index into checkpoints (0 = finish line)
  lastS: number;
  /** Total distance driven along the track in the race direction, for ordering. */
  progress: number;
  hint: number;
}

export function newLapState(t: TrackData, startS: number): LapState {
  // Grid slots sit behind the line, so the first thing crossed is checkpoint 0 (the line) which
  // does not count as a lap; we start already "expecting" checkpoint 1.
  return { lap: 0, nextCp: 1 % t.checkpoints.length, lastS: startS, progress: sDelta(t, 0, startS), hint: -1 };
}

/** Returns "cp" when a checkpoint was taken, "lap" when a lap completed, else null. */
export function advanceLap(t: TrackData, st: LapState, s: number): "cp" | "lap" | null {
  const ds = sDelta(t, st.lastS, s);
  // Ignore implausible jumps (respawn / glitches) for progress accounting.
  if (Math.abs(ds) < 60) st.progress += ds;
  const prevS = st.lastS;
  st.lastS = s;
  if (ds <= 0 || ds > 60) return null;
  const cpS = t.checkpoints[st.nextCp];
  // Did we cross cpS going forward between prevS and s?
  const crossed = sDelta(t, prevS, cpS) > 0 && sDelta(t, cpS, s) >= 0;
  if (!crossed) return null;
  if (st.nextCp === 0) {
    st.lap++;
    st.nextCp = 1 % t.checkpoints.length;
    return "lap";
  }
  st.nextCp = (st.nextCp + 1) % t.checkpoints.length;
  return "cp";
}

/** Minimum-curvature-ish racing line as lateral offsets from the centreline. */
export function computeRacingLine(t: TrackData, margin = 1.8): Float32Array {
  const n = t.n;
  const off = new Float32Array(n);
  const lim = Math.max(0, t.halfWidth - margin);
  const pxs = new Float32Array(n), pzs = new Float32Array(n);
  // Minimise squared curvature (bi-Laplacian relaxation) within the road edges:
  // this yields the classic outside-apex-outside line instead of a taut string.
  const run = (k: number, iters: number) => {
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < n; i++) {
        pxs[i] = t.px[i] + t.nx[i] * off[i];
        pzs[i] = t.pz[i] + t.nz[i] * off[i];
      }
      for (let i = 0; i < n; i++) {
        const a2 = (i - 2 * k + 2 * n) % n, a1 = (i - k + n) % n, b1 = (i + k) % n, b2 = (i + 2 * k) % n;
        const mx = (-pxs[a2] + 4 * pxs[a1] + 4 * pxs[b1] - pxs[b2]) / 6;
        const mz = (-pzs[a2] + 4 * pzs[a1] + 4 * pzs[b1] - pzs[b2]) / 6;
        const target = (mx - t.px[i]) * t.nx[i] + (mz - t.pz[i]) * t.nz[i];
        off[i] = Math.max(-lim, Math.min(lim, off[i] + (target - off[i]) * 0.5));
      }
    }
  };
  run(10, 300);
  run(5, 200);
  run(2, 100);
  return off;
}

/** World transform of starting-grid slot `slot` (0 = pole), staggered behind the start line. */
export function gridSlot(t: TrackData, slot: number) {
  const row = Math.floor(slot / 2);
  const side = slot % 2 === 0 ? 1 : -1;
  const lateral = Math.min(3.2, t.halfWidth * 0.45) * side;
  const p = sampleAt(t, -10 - row * 9 - (slot % 2) * 3, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
  // Left normal is (tz, -tx).
  return {
    x: p.x + p.tz * lateral,
    y: p.y,
    z: p.z - p.tx * lateral,
    yaw: Math.atan2(p.tx, p.tz),
    i: p.i,
  };
}
