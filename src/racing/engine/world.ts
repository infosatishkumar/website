// Builds the 3D environment around a track: terrain blended into the road
// corridor, PBR road surface with markings and rubber, curbs, barriers,
// tunnels, bridges, water and the per-environment scenery (grandstands, pit
// building, skyline, neon, street lights, forests, airfield...).

import * as THREE from "three";
import type { TrackData } from "../shared/trackGeom.ts";
import { project, newProjection, sampleAt, inRanges, computeRacingLine } from "../shared/trackGeom.ts";
import type { Weather } from "../shared/tracks.ts";
import { SkySystem } from "./sky.ts";
import type { Quality } from "./settings.ts";
import { wallDistAt } from "./physicsWorld.ts";
import {
  asphalt, grass, sand, rock, concrete, facade, signTexture, SIGN_WORDS, radialSprite, crowdTexture,
  checkerTexture, rubberTexture, runwayNumberTexture, waterNormals, fbm,
} from "./textures.ts";

type Range = [number, number];

const TL_COLORS = [0xff2020, 0xffaa00, 0x20ff60];

// ---------------------------------------------------------------------------
// Small deterministic RNG + 2D noise for terrain
// ---------------------------------------------------------------------------

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise2(x: number, z: number) {
  // Non-periodic smooth noise (sum of rotated sines) – cheap and good enough for landforms.
  return (
    Math.sin(x * 1.0 + Math.sin(z * 0.7) * 1.3) * 0.5 +
    Math.sin(z * 1.1 + Math.sin(x * 0.8) * 1.1) * 0.5 +
    Math.sin((x + z) * 2.3 + 1.7) * 0.25 +
    Math.sin((x - z) * 3.1 + 0.4) * 0.15
  ) / 1.4;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export interface WorldOptions {
  quality: Quality;
  hours: number;
  weather: Weather;
}

export class World {
  scene = new THREE.Scene();
  track: TrackData;
  sky: SkySystem;
  bbox = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  private renderer: THREE.WebGLRenderer;
  private opts: WorldOptions;
  private water: THREE.Mesh | null = null;
  private startLamps: THREE.MeshStandardMaterial[] = [];
  private nightOnly: THREE.Object3D[] = [];
  private nightMats: { mat: THREE.MeshStandardMaterial; on: number; off: number }[] = [];
  private trafficLights: { mats: THREE.MeshBasicMaterial[]; phase: number }[] = [];
  private roadMat!: THREE.MeshStandardMaterial;
  private runoffMat!: THREE.MeshStandardMaterial;
  private tunnelLightScale = 1;
  private pr = newProjection();
  heightCache = new Map<number, number>();
  racingLine: Float32Array;
  speedTrap: THREE.Object3D | null = null;

  constructor(renderer: THREE.WebGLRenderer, track: TrackData, opts: WorldOptions) {
    this.renderer = renderer;
    this.track = track;
    this.opts = opts;
    this.sky = new SkySystem(this.scene, renderer, track.def.environment, opts.quality);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < track.n; i++) {
      minX = Math.min(minX, track.px[i]); maxX = Math.max(maxX, track.px[i]);
      minZ = Math.min(minZ, track.pz[i]); maxZ = Math.max(maxZ, track.pz[i]);
    }
    this.bbox = { minX, maxX, minZ, maxZ };
    this.racingLine = computeRacingLine(track);
  }

  /** Build everything, yielding between stages so a loading screen can update. */
  async build(onProgress: (p: number, label: string) => void) {
    const steps: [string, () => void][] = [
      ["Lighting the sky", () => this.sky.setConditions(this.opts.hours, this.opts.weather)],
      ["Sculpting terrain", () => this.buildTerrain()],
      ["Laying asphalt", () => this.buildRoad()],
      ["Painting markings", () => this.buildMarkings()],
      ["Installing barriers", () => this.buildBarriers()],
      ["Tunnels and bridges", () => this.buildStructures()],
      ["Building scenery", () => this.buildScenery()],
      ["Street lighting", () => this.buildLights()],
    ];
    for (let i = 0; i < steps.length; i++) {
      onProgress(i / steps.length, steps[i][0]);
      await new Promise((r) => setTimeout(r, 0));
      steps[i][1]();
    }
    this.applyNight();
    onProgress(1, "Ready");
  }

  get env() {
    return this.track.def.environment;
  }
  get wet() {
    return this.opts.weather === "rain";
  }
  get q() {
    return this.opts.quality;
  }

  // -------------------------------------------------------------------------
  // Terrain
  // -------------------------------------------------------------------------

  private baseHeight(x: number, z: number) {
    const cx = (this.bbox.minX + this.bbox.maxX) / 2, cz = (this.bbox.minZ + this.bbox.maxZ) / 2;
    const r = Math.hypot((x - cx) / ((this.bbox.maxX - this.bbox.minX) / 2 + 200), (z - cz) / ((this.bbox.maxZ - this.bbox.minZ) / 2 + 200));
    switch (this.env) {
      case "circuit":
        return noise2(x * 0.008, z * 0.008) * 3 + Math.max(0, r - 1) * 160 * (0.6 + 0.4 * noise2(x * 0.004, z * 0.004));
      case "city":
        return z < -42 ? -7 : 0;
      case "coast": {
        let h = 22 + noise2(x * 0.006, z * 0.006) * 18 + Math.max(0, -x - 120) * 0.35 + Math.max(0, z - 560) * 0.4 + Math.max(0, -z - 60) * 0.15;
        h = THREE.MathUtils.lerp(h, -14, smooth(395, 470, x));
        return h;
      }
      case "desert":
        return Math.sin(x * 0.018 + Math.sin(z * 0.011) * 3) * Math.sin(z * 0.013) * 2.2 + Math.max(0, r - 0.9) * 90 * (0.5 + 0.5 * noise2(x * 0.003, z * 0.003));
    }
  }

  /** Ground height at (x, z), blended into the road corridor. */
  ground(x: number, z: number) {
    const t = this.track;
    const base = this.baseHeight(x, z);
    // Nearest centreline sample via the spatial grid (only care within ~100 m).
    const GRID = 30;
    const cx = Math.floor(x / GRID), cz = Math.floor(z / GRID);
    let best = -1, bestD = Infinity;
    for (let ix = cx - 3; ix <= cx + 3; ix++) {
      for (let iz = cz - 3; iz <= cz + 3; iz++) {
        const arr = t.grid.get(ix * 100003 + iz);
        if (!arr) continue;
        for (const i of arr) {
          const d = (t.px[i] - x) ** 2 + (t.pz[i] - z) ** 2;
          if (d < bestD) { bestD = d; best = i; }
        }
      }
    }
    if (best < 0) return base;
    const p = project(t, x, z, best, this.pr);
    const ad = Math.abs(p.d);
    const wall = wallDistAt(t, p.s);
    const roadY = p.y - 0.25;
    if (inRanges(t.bridges, p.s, t.length)) {
      // Ravine under the bridge.
      return Math.min(base, p.y - 30 + ad * 0.18);
    }
    if (inRanges(t.tunnels, p.s, t.length)) {
      return Math.max(base, p.y + 10 + ad * 0.1);
    }
    const flat = wall + 3;
    const blend = smooth(flat, flat + 45, ad);
    return THREE.MathUtils.lerp(roadY, base, blend);
  }

  private buildTerrain() {
    const margin = this.env === "desert" ? 700 : 650;
    const { minX, maxX, minZ, maxZ } = this.bbox;
    const w = maxX - minX + margin * 2, h = maxZ - minZ + margin * 2;
    const N = this.q === "low" ? 140 : this.q === "medium" ? 220 : 300;
    const cell = Math.max(w, h) / N;
    const nx = Math.ceil(w / cell), nz = Math.ceil(h / cell);
    const geo = new THREE.PlaneGeometry(nx * cell, nz * cell, nx, nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate(minX - margin + (nx * cell) / 2, 0, minZ - margin + (nz * cell) / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = this.ground(x, z);
      pos.setY(i, y);
      uv.setXY(i, x / 14, z / 14);
    }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), ny = nrm.getY(i);
      const x = pos.getX(i), z = pos.getZ(i);
      const v = fbm(x * 0.01, z * 0.01, 64, 3, 5);
      switch (this.env) {
        case "circuit":
          c.setRGB(0.75 + v * 0.35, 0.85 + v * 0.3, 0.7 + v * 0.2);
          break;
        case "city":
          c.setRGB(0.55 + v * 0.2, 0.55 + v * 0.2, 0.58 + v * 0.2);
          break;
        case "coast": {
          const rocky = smooth(0.86, 0.7, ny);
          const beach = smooth(3, 0.5, y) * smooth(-6, -1, y);
          c.setRGB(0.8 + v * 0.3, 0.85 + v * 0.3, 0.7);
          c.lerp(new THREE.Color(0.85, 0.82, 0.78), rocky);
          c.lerp(new THREE.Color(2.2, 1.9, 1.3), beach);
          break;
        }
        case "desert":
          c.setRGB(0.74 + v * 0.16, 0.7 + v * 0.13, 0.64 + v * 0.1);
          break;
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const texSize = this.q === "low" ? 256 : 512;
    const set = this.env === "desert" ? sand(texSize) : this.env === "city" ? concrete(texSize) : this.env === "coast" ? rock(texSize) : grass(texSize);
    if (this.env === "coast") {
      // Grass-tinted rock reads as scrubland; cliffs show the rock strata.
      for (let i = 0; i < pos.count; i++) {
        const ny = nrm.getY(i);
        const g = smooth(0.75, 0.92, ny) * (pos.getY(i) > 2 ? 1 : 0);
        colors[i * 3] *= 1 - g * 0.55;
        colors[i * 3 + 1] *= 1 - g * 0.25;
        colors[i * 3 + 2] *= 1 - g * 0.6;
      }
    }
    const mat = new THREE.MeshStandardMaterial({
      map: set.map, normalMap: this.q === "low" ? null : set.normalMap, roughness: 0.95, vertexColors: true,
      color: this.env === "circuit" ? 0xd8e8c8 : 0xffffff,
    });
    if (this.wet) mat.roughness = 0.7;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = this.env === "coast" && this.q !== "low";
    this.scene.add(mesh);

    // Distant mountain ring for depth
    if (this.env !== "city") {
      const ringR = Math.max(w, h) * 0.75 + 600;
      const segs = 96;
      const mg = new THREE.CylinderGeometry(ringR, ringR + 400, 1, segs, 6, true);
      const mp = mg.attributes.position as THREE.BufferAttribute;
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      for (let i = 0; i < mp.count; i++) {
        const x = mp.getX(i), z = mp.getZ(i);
        const a = Math.atan2(z, x);
        const top = mp.getY(i) > 0;
        const hgt = this.env === "desert" ? 60 + 90 * Math.abs(noise2(a * 3, 1)) : 140 + 260 * Math.abs(noise2(a * 2.2, 0.3)) ** 1.3;
        mp.setY(i, top ? hgt * (0.6 + 0.4 * Math.abs(Math.sin(a * 9 + 1))) : -40);
        mp.setX(i, x + cx);
        mp.setZ(i, z + cz);
      }
      mg.computeVertexNormals();
      const mm = new THREE.MeshStandardMaterial({
        color: this.env === "desert" ? 0xb08a62 : this.env === "coast" ? 0x5d6a58 : 0x55684a, roughness: 1, side: THREE.BackSide,
      });
      const ring = new THREE.Mesh(mg, mm);
      this.scene.add(ring);
    }

    // Water
    if (this.env === "city" || this.env === "coast") {
      const wn = waterNormals();
      wn.repeat.set(60, 60);
      const wm = new THREE.MeshPhysicalMaterial({
        color: this.env === "city" ? 0x0b1e2a : 0x0f4c5c, roughness: 0.06, metalness: 0.1, normalMap: wn,
        normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.3,
      });
      const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), wm);
      water.rotation.x = -Math.PI / 2;
      water.position.set((minX + maxX) / 2, this.env === "city" ? -1.6 : 0, (minZ + maxZ) / 2);
      water.receiveShadow = this.q === "ultra";
      this.scene.add(water);
      this.water = water;
    }
  }

  // -------------------------------------------------------------------------
  // Road geometry helpers
  // -------------------------------------------------------------------------

  /** Index runs [i0, i1] (inclusive, may exceed n for wrap) covering the given s-ranges, or the whole loop. */
  private runs(ranges: Range[] | null): [number, number][] {
    const t = this.track;
    const step = t.length / t.n;
    if (!ranges) return [[0, t.n]];
    return ranges.map(([a, b]) => [Math.floor(a / step), Math.ceil(b / step)]);
  }

  /** Index runs where the predicate holds (for curbs, barrier gaps...). */
  private runsWhere(pred: (i: number) => boolean, dilate = 0): [number, number][] {
    const n = this.track.n;
    const flag = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (pred(i)) for (let k = -dilate; k <= dilate; k++) flag[(i + k + n) % n] = 1;
    const out: [number, number][] = [];
    let start = -1;
    for (let i = 0; i <= n; i++) {
      const f = i < n ? flag[i] : 0;
      if (f && start < 0) start = i;
      if (!f && start >= 0) { out.push([start, i]); start = -1; }
    }
    if (out.length > 1 && out[0][0] === 0 && out[out.length - 1][1] === n) {
      const last = out.pop()!;
      out[0] = [last[0], out[0][1] + n];
    }
    if (out.length === 1 && out[0][0] === 0 && out[0][1] === n) return [[0, n]];
    return out;
  }

  /**
   * Extrude a 2D profile ([lateral offset, height] pairs) along the track.
   * Lateral offsets are measured along the left normal; `side` mirrors them.
   */
  private extrude(profile: [number, number][], runs: [number, number][], side: 1 | -1, vScale: number, uScale = 1, yBase = 0) {
    const t = this.track;
    const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
    const P = profile.length;
    const ucum = [0];
    for (let k = 1; k < P; k++) ucum.push(ucum[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
    for (const [i0, i1] of runs) {
      const base = pos.length / 3;
      for (let ii = i0; ii <= i1; ii++) {
        const i = ii % t.n;
        const s = ii * (t.length / t.n);
        for (let k = 0; k < P; k++) {
          const d = profile[k][0] * side;
          pos.push(t.px[i] + t.nx[i] * d, t.py[i] + profile[k][1] + yBase, t.pz[i] + t.nz[i] * d);
          uvs.push(ucum[k] / uScale, s / vScale);
        }
      }
      const rows = i1 - i0 + 1;
      for (let r = 0; r < rows - 1; r++) {
        for (let k = 0; k < P - 1; k++) {
          const a = base + r * P + k, b = a + P;
          if (side === 1) idx.push(a, b, a + 1, a + 1, b, b + 1);
          else idx.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // -------------------------------------------------------------------------
  // Road
  // -------------------------------------------------------------------------

  private buildRoad() {
    const t = this.track;
    const hw = t.halfWidth;
    const size = this.q === "low" ? 256 : 512;
    const tone = this.env === "desert" ? 0.2 : this.env === "city" ? 0.15 : 0.17;
    const set = asphalt(size, this.wet, tone);
    const road = this.extrude([[-hw, 0], [hw, 0]], [[0, t.n]], 1, hw, hw);
    this.roadMat = new THREE.MeshStandardMaterial({
      map: set.map, roughnessMap: set.roughnessMap, normalMap: this.q === "low" ? null : set.normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6), roughness: 1, metalness: this.wet ? 0.05 : 0, envMapIntensity: this.wet ? 1.4 : 0.6,
    });
    // Tile across the road twice (sharper texels).
    set.map.repeat.set(1, 1);
    const mesh = new THREE.Mesh(road, this.roadMat);
    mesh.receiveShadow = true;
    mesh.position.y = 0.02;
    this.scene.add(mesh);

    // Run-off / shoulders / sidewalks up to the barriers.
    const roSet = this.env === "desert" ? concrete(256) : this.env === "city" ? concrete(256) : this.env === "coast" ? asphalt(256, this.wet, 0.32) : grass(256);
    this.runoffMat = new THREE.MeshStandardMaterial({ map: roSet.map, roughness: 0.92, color: this.env === "circuit" ? 0xb8d0a0 : 0xffffff });
    const gravelMat = new THREE.MeshStandardMaterial({ map: sand(256).map, roughness: 1, color: 0xd8cbb0 });
    const corner = (i: number) => Math.abs(t.curv[i]) > 1 / 140;
    for (const side of [1, -1] as const) {
      const ro = this.extrude([[hw, 0], [hw + 40, 0]], [[0, t.n]], side, 6, 6);
      // Clip to the barrier by moving outer vertices to the wall distance.
      const p = ro.attributes.position as THREE.BufferAttribute;
      for (let r = 0; r <= t.n; r++) {
        const i = r % t.n;
        const s = t.s[i];
        const wall = wallDistAt(t, s) + 0.5;
        const k = r * 2 + 1;
        const d = wall * side;
        p.setXYZ(k, t.px[i] + t.nx[i] * d, t.py[i] - (this.env === "city" ? -0.15 : 0.02), t.pz[i] + t.nz[i] * d);
        if (this.env === "city") p.setY(k - 1, t.py[i] + 0.15);
      }
      ro.computeVertexNormals();
      const m = new THREE.Mesh(ro, this.runoffMat);
      m.receiveShadow = true;
      this.scene.add(m);
      if (this.env === "circuit") {
        // Gravel traps on the outside of corners.
        const outside = this.runsWhere((i) => corner(i) && Math.sign(t.curv[i]) === -side, 8);
        if (outside.length) {
          const gt = this.extrude([[hw + 2.2, 0.03], [t.wallDist - 0.5, 0.03]], outside, side, 5, 5);
          const gm = new THREE.Mesh(gt, gravelMat);
          gm.receiveShadow = true;
          this.scene.add(gm);
        }
      }
    }

    // Curbs at corners (circuit, coast hairpins, airfield turns).
    if (this.env !== "city") {
      const curbCanvas = document.createElement("canvas");
      curbCanvas.width = 16; curbCanvas.height = 64;
      const ctx = curbCanvas.getContext("2d")!;
      ctx.fillStyle = "#d81e1e"; ctx.fillRect(0, 0, 16, 32);
      ctx.fillStyle = "#f2f2f2"; ctx.fillRect(0, 32, 16, 32);
      const curbTex = new THREE.CanvasTexture(curbCanvas);
      curbTex.colorSpace = THREE.SRGBColorSpace;
      curbTex.wrapS = curbTex.wrapT = THREE.RepeatWrapping;
      const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.55 });
      const runs = this.runsWhere((i) => Math.abs(t.curv[i]) > 1 / 120, 6);
      for (const side of [1, -1] as const) {
        if (!runs.length) break;
        const g = this.extrude([[hw - 0.2, 0.0], [hw + 0.5, 0.07], [hw + 1.3, 0.0]], runs, side, 6, 1);
        const m = new THREE.Mesh(g, curbMat);
        m.receiveShadow = true;
        m.position.y = 0.03;
        this.scene.add(m);
      }
    }

    // Rubber laid down on the racing line through braking zones and corners.
    if (this.env !== "desert") {
      const rl = this.racingLine;
      const pos: number[] = [], uvs: number[] = [], cols: number[] = [], idx: number[] = [];
      for (let r = 0; r <= t.n; r++) {
        const i = r % t.n;
        const k = Math.min(1, Math.abs(t.curv[(i + 15) % t.n]) * 90 + Math.abs(t.curv[i]) * 60);
        for (const e of [-1.3, 1.3]) {
          const d = rl[i] + e;
          pos.push(t.px[i] + t.nx[i] * d, t.py[i] + 0.035, t.pz[i] + t.nz[i] * d);
          uvs.push(e > 0 ? 1 : 0, (r * (t.length / t.n)) / 14);
          cols.push(1, 1, 1, 0.25 + k * 0.75);
        }
        if (r < t.n) {
          const a = r * 2;
          idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 4));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        map: rubberTexture(), transparent: true, vertexColors: true, roughness: 0.75, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -1,
      }));
      m.receiveShadow = true;
      m.renderOrder = 1;
      this.scene.add(m);
    }

    // Potholes, patches and manhole covers for street environments.
    if (this.env === "city" || this.env === "coast") {
      const rnd = rng(42);
      const count = this.env === "city" ? 26 : 14;
      const patchMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: this.wet ? 0.08 : 0.9, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const holeMat = new THREE.MeshStandardMaterial({ map: radialSprite("hole", "rgba(10,10,10,0.95)", "rgba(30,30,30,0)", 64), transparent: true, depthWrite: false, roughness: this.wet ? 0.02 : 0.95, polygonOffset: true, polygonOffsetFactor: -2 });
      const manMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2e, metalness: 0.8, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
      for (let k = 0; k < count; k++) {
        const s = rnd() * t.length;
        const p = sampleAt(t, s, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
        const d = (rnd() - 0.5) * (t.halfWidth * 1.6);
        const x = p.x + p.tz * d, z = p.z - p.tx * d;
        const kind = rnd();
        let mesh: THREE.Mesh;
        if (kind < 0.4) mesh = new THREE.Mesh(new THREE.PlaneGeometry(1 + rnd() * 2.5, 0.8 + rnd() * 2), patchMat);
        else if (kind < 0.75) mesh = new THREE.Mesh(new THREE.CircleGeometry(0.3 + rnd() * 0.35, 12), holeMat);
        else mesh = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), manMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = rnd() * Math.PI;
        mesh.position.set(x, p.y + 0.05, z);
        mesh.receiveShadow = true;
        this.scene.add(mesh);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Markings
  // -------------------------------------------------------------------------

  private buildMarkings() {
    const t = this.track;
    const hw = t.halfWidth;
    const white = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: this.wet ? 0.3 : 0.65, polygonOffset: true, polygonOffsetFactor: -1 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -1 });
    const add = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.y = 0.04;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };
    // Edge lines
    const edge = this.env === "desert" ? 0.9 : 0.35;
    for (const side of [1, -1] as const) add(this.extrude([[hw - edge - 0.2, 0], [hw - edge, 0]], [[0, t.n]], side, 4), white);
    // Dashed centre lines
    const dashRuns = (on: number, off: number): [number, number][] => {
      const step = t.length / t.n;
      const out: [number, number][] = [];
      for (let s = 0; s < t.length - on; s += on + off) out.push([Math.floor(s / step), Math.floor((s + on) / step)]);
      return out;
    };
    if (this.env === "city") add(this.extrude([[-0.08, 0], [0.08, 0]], dashRuns(4, 8), 1, 4), white);
    if (this.env === "coast") {
      add(this.extrude([[-0.22, 0], [-0.08, 0]], [[0, t.n]], 1, 4), yellow);
      add(this.extrude([[0.08, 0], [0.22, 0]], [[0, t.n]], 1, 4), yellow);
    }
    if (this.env === "desert") {
      add(this.extrude([[-0.45, 0], [0.45, 0]], dashRuns(30, 20), 1, 4), white);
      // Threshold stripes and runway numbers at both ends of the runway straight.
      for (const [s0, num] of [[60, "09"], [2000, "27"]] as [number, string][]) {
        const p = sampleAt(t, s0, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
        const yaw = Math.atan2(p.tx, p.tz);
        for (let k = -6; k <= 6; k++) {
          if (k === 0) continue;
          const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 30), white);
          bar.rotation.set(-Math.PI / 2, 0, yaw);
          const d = k * 2.1;
          bar.position.set(p.x + p.tz * d, p.y + 0.045, p.z - p.tx * d);
          this.scene.add(bar);
        }
        const numMesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 18), new THREE.MeshStandardMaterial({ map: runwayNumberTexture(num), transparent: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }));
        const q = sampleAt(t, s0 + (num === "09" ? 40 : -40), { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
        numMesh.rotation.set(-Math.PI / 2, 0, yaw + (num === "09" ? Math.PI : 0));
        numMesh.position.set(q.x, q.y + 0.045, q.z);
        this.scene.add(numMesh);
      }
    }
    // Start / finish line (checkered) and grid boxes
    const ck = checkerTexture().clone();
    ck.needsUpdate = true;
    ck.repeat.set(t.def.width / 2, 1);
    const finish = new THREE.Mesh(new THREE.PlaneGeometry(t.def.width, 1.6), new THREE.MeshStandardMaterial({ map: ck, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }));
    const p0 = sampleAt(t, 0, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
    finish.rotation.set(-Math.PI / 2, 0, Math.atan2(p0.tx, p0.tz));
    finish.position.set(p0.x, p0.y + 0.045, p0.z);
    this.scene.add(finish);
    for (let slot = 0; slot < 12; slot++) {
      const row = Math.floor(slot / 2), sideS = slot % 2 === 0 ? 1 : -1;
      const lateral = Math.min(3.2, hw * 0.45) * sideS;
      const p = sampleAt(t, -10 - row * 9 - (slot % 2) * 3 + 2.6, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.18), white);
      bar.rotation.set(-Math.PI / 2, 0, Math.atan2(p.tx, p.tz));
      bar.position.set(p.x + p.tz * lateral, p.y + 0.045, p.z - p.tx * lateral);
      this.scene.add(bar);
    }
    // Drag strip finish line + speed trap
    if (t.def.dragDistance) {
      const p = sampleAt(t, t.def.dragDistance, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
      const line = new THREE.Mesh(new THREE.PlaneGeometry(t.def.width, 1.2), new THREE.MeshStandardMaterial({ map: ck, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }));
      line.rotation.set(-Math.PI / 2, 0, Math.atan2(p.tx, p.tz));
      line.position.set(p.x, p.y + 0.045, p.z);
      this.scene.add(line);
      this.gantry(t.def.dragDistance, "402 M FINISH", "#ffcc33");
    }
    if (t.def.speedTrapS) this.speedTrap = this.gantry(t.def.speedTrapS, "SPEED TRAP", "#29d3ff");
  }

  private gantry(s: number, text: string, color: string) {
    const t = this.track;
    const p = sampleAt(t, s, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: 0.8, roughness: 0.4 });
    const span = t.halfWidth + 2;
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), steel);
      post.position.set(side * span, 3.5, 0);
      post.castShadow = true;
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 0.4, 1.4, 0.5), steel);
    beam.position.y = 7;
    beam.castShadow = true;
    g.add(beam);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(span * 1.2, 1.1), new THREE.MeshBasicMaterial({ map: signTexture(text, color, "#0a0c10", 1024, 96), toneMapped: false }));
    sign.position.set(0, 7, -0.26);
    sign.rotation.y = Math.PI;
    g.add(sign);
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = Math.atan2(p.tx, p.tz);
    this.scene.add(g);
    return g;
  }

  // -------------------------------------------------------------------------
  // Barriers
  // -------------------------------------------------------------------------

  private buildBarriers() {
    const t = this.track;
    const special = [...t.tunnels, ...t.bridges];
    const open = this.runsWhere((i) => !inRanges(special, t.s[i], t.length), 0);
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9bec4, metalness: 0.85, roughness: 0.35 });
    const conc = concrete(256);
    const concMat = new THREE.MeshStandardMaterial({ map: conc.map, roughness: 0.85, color: 0xe0ddd5 });
    const W = t.wallDist;
    for (const side of [1, -1] as const) {
      if (this.env === "circuit" || this.env === "coast") {
        // Armco / guardrail: two rails on posts
        const rails = this.env === "circuit" ? [0.45, 0.8] : [0.55];
        for (const y of rails) {
          const g = this.extrude([[W, y - 0.17], [W - 0.05, y - 0.08], [W, y], [W - 0.05, y + 0.08], [W, y + 0.17], [W + 0.06, y + 0.17], [W + 0.06, y - 0.17], [W, y - 0.17]], open, side, 4);
          const m = new THREE.Mesh(g, steel);
          m.castShadow = this.q === "ultra";
          m.receiveShadow = true;
          this.scene.add(m);
        }
        // Posts (instanced)
        const step = t.length / t.n;
        const postGeo = new THREE.BoxGeometry(0.12, 1, 0.12);
        const count = Math.floor(t.length / 4);
        const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshStandardMaterial({ color: 0x6b7077, metalness: 0.6, roughness: 0.5 }), count);
        const mtx = new THREE.Matrix4();
        let n = 0;
        for (let s = 0; s < t.length && n < count; s += 4) {
          if (inRanges(special, s, t.length)) continue;
          const i = Math.floor(s / step) % t.n;
          const d = (W + 0.15) * side;
          mtx.makeTranslation(t.px[i] + t.nx[i] * d, t.py[i] + 0.5, t.pz[i] + t.nz[i] * d);
          posts.setMatrixAt(n++, mtx);
        }
        posts.count = n;
        posts.computeBoundingSphere();
        this.scene.add(posts);
      } else {
        // Concrete jersey barrier with painted chevrons in corners
        const g = this.extrude([[W, 0], [W + 0.05, 0.32], [W + 0.18, 0.95], [W + 0.38, 0.95], [W + 0.6, 0]], open, side, 3, 1);
        const m = new THREE.Mesh(g, concMat);
        m.castShadow = this.q !== "low";
        m.receiveShadow = true;
        this.scene.add(m);
      }
    }
    // Tyre walls on the outside of the fastest corners (circuit)
    if (this.env === "circuit" || this.env === "desert") {
      const rnd = rng(7);
      const tyreGeo = new THREE.TorusGeometry(0.32, 0.14, 6, 12);
      const cols = [0x111111, 0x111111, 0xd8d8d8, 0xc81e1e];
      const meshes = cols.map((c) => new THREE.InstancedMesh(tyreGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }), 2000));
      const counts = [0, 0, 0, 0];
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3();
      q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
      const step = t.length / t.n;
      for (let s = 0; s < t.length; s += 0.85) {
        const i = Math.floor(s / step) % t.n;
        const k = t.curv[i];
        if (Math.abs(k) < 1 / 90) continue;
        const side = -Math.sign(k);
        for (let layer = 0; layer < 3; layer++) {
          const d = (W + 0.45) * side;
          ps.set(t.px[i] + t.nx[i] * d, t.py[i] + 0.15 + layer * 0.28, t.pz[i] + t.nz[i] * d);
          m4.compose(ps, q, sc);
          const ci = Math.floor(s / 0.85) % 8 < 4 ? (rnd() < 0.5 ? 0 : 1) : layer === 1 ? 2 : 3;
          if (counts[ci] < 2000) meshes[ci].setMatrixAt(counts[ci]++, m4);
        }
      }
      meshes.forEach((m, i) => { m.count = counts[i]; m.computeBoundingSphere(); m.castShadow = this.q === "ultra"; this.scene.add(m); });
    }
  }

  // -------------------------------------------------------------------------
  // Tunnels, bridges, start gantry
  // -------------------------------------------------------------------------

  private buildStructures() {
    const t = this.track;
    const conc = concrete(256);
    const tunnelMat = new THREE.MeshStandardMaterial({ map: conc.map, color: 0x8d8a84, roughness: 0.9, side: THREE.DoubleSide });
    for (const [a, b] of t.tunnels) {
      const R = t.halfWidth + 1.2;
      const prof: [number, number][] = [];
      for (let k = 0; k <= 16; k++) {
        const ang = Math.PI - (k / 16) * Math.PI;
        prof.push([Math.cos(ang) * R, Math.sin(ang) * 6.8]);
      }
      const g = this.extrude(prof, this.runs([[a, b]]), 1, 6, 4);
      const m = new THREE.Mesh(g, tunnelMat);
      m.receiveShadow = true;
      m.castShadow = true;
      this.scene.add(m);
      // Ceiling light strips (emissive)
      const step = t.length / t.n;
      const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.08, 2.4), new THREE.MeshBasicMaterial({ color: 0xfff1c8, toneMapped: false }), Math.ceil((b - a) / 7) * 2);
      let n = 0;
      const mtx = new THREE.Matrix4();
      for (let s = a + 3; s < b - 2; s += 7) {
        const p = sampleAt(t, s, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
        const yaw = Math.atan2(p.tx, p.tz);
        for (const d of [-2.5, 2.5]) {
          mtx.makeRotationY(yaw);
          mtx.setPosition(p.x + p.tz * d, p.y + 6.4, p.z - p.tx * d);
          lights.setMatrixAt(n++, mtx);
        }
      }
      lights.count = n;
      lights.computeBoundingSphere();
      this.scene.add(lights);
      void step;
      // Portals
      for (const s of [a, b]) {
        const p = sampleAt(t, s, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
        const portal = new THREE.Mesh(new THREE.BoxGeometry(R * 2 + 6, 3, 1.2), new THREE.MeshStandardMaterial({ map: conc.map, color: 0xb4b0a8, roughness: 0.85 }));
        portal.position.set(p.x, p.y + 8, p.z);
        portal.rotation.y = Math.atan2(p.tx, p.tz);
        portal.castShadow = true;
        this.scene.add(portal);
      }
    }
    for (const [a, b] of t.bridges) {
      const W = t.halfWidth + 1.1;
      const deck = this.extrude([[-W, -0.05], [W, -0.05], [W, -1.6], [-W, -1.6], [-W, -0.05]], this.runs([[a, b]]), 1, 6, 4);
      const dm = new THREE.Mesh(deck, new THREE.MeshStandardMaterial({ map: conc.map, color: 0xa9a59c, roughness: 0.9, side: THREE.DoubleSide }));
      dm.castShadow = true;
      dm.receiveShadow = true;
      this.scene.add(dm);
      for (const side of [1, -1] as const) {
        const par = this.extrude([[W - 0.35, 0], [W - 0.35, 1.0], [W, 1.0], [W, 0]], this.runs([[a, b]]), side, 3);
        const pm = new THREE.Mesh(par, new THREE.MeshStandardMaterial({ map: conc.map, color: 0xd0ccc2, roughness: 0.85 }));
        pm.castShadow = true;
        this.scene.add(pm);
      }
      const pillarMat = new THREE.MeshStandardMaterial({ map: conc.map, color: 0x9f9b92, roughness: 0.9 });
      for (let s = a + 12; s < b - 6; s += 26) {
        const p = sampleAt(t, s, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
        const gy = this.baseHeight(p.x, p.z);
        const bottom = Math.min(gy, p.y - 30) - 4;
        const h = p.y - 1.6 - bottom;
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, h, 14), pillarMat);
        pillar.position.set(p.x, bottom + h / 2, p.z);
        pillar.castShadow = true;
        this.scene.add(pillar);
      }
    }
    // Start gantry with race lights
    const p = sampleAt(t, 6, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.7, roughness: 0.4 });
    const span = t.halfWidth + 1.5;
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 0.5), steel);
      post.position.set(side * span, 3.75, 0);
      post.castShadow = true;
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span * 2, 1.0, 0.7), steel);
    beam.position.y = 7.2;
    beam.castShadow = true;
    g.add(beam);
    for (let k = 0; k < 5; k++) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.5), steel);
      const x = (k - 2) * 1.0;
      pod.position.set(x, 6.1, -0.2);
      g.add(pod);
      for (let r = 0; r < 2; r++) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff0000, emissiveIntensity: 0 });
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), mat);
        lamp.position.set(x, 6.5 - r * 0.7, -0.46);
        lamp.rotation.y = Math.PI;
        g.add(lamp);
        this.startLamps.push(mat);
      }
    }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(span * 1.6, 0.8), new THREE.MeshBasicMaterial({ map: signTexture("VELOCITY RUSH", "#ffffff", "#c8102e", 1024, 96), toneMapped: false }));
    banner.position.set(0, 7.2, -0.36);
    banner.rotation.y = Math.PI;
    g.add(banner);
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = Math.atan2(p.tx, p.tz);
    this.scene.add(g);
  }

  /** Start lights: `lit` red pairs (0..5); `green` turns them all green. */
  setStartLights(lit: number, green = false) {
    this.startLamps.forEach((m, i) => {
      const col = Math.floor(i / 2);
      if (green) { m.emissive.set(0x00ff40); m.emissiveIntensity = 4; }
      else { m.emissive.set(0xff0000); m.emissiveIntensity = col < lit ? 5 : 0; }
    });
  }

  // -------------------------------------------------------------------------
  // Scenery
  // -------------------------------------------------------------------------

  /** Distance from (x, z) to the track centreline (approx, only accurate up to ~100 m). */
  private trackDist(x: number, z: number) {
    const t = this.track;
    const GRID = 30;
    const cx = Math.floor(x / GRID), cz = Math.floor(z / GRID);
    let bestD = Infinity;
    for (let ix = cx - 3; ix <= cx + 3; ix++) {
      for (let iz = cz - 3; iz <= cz + 3; iz++) {
        const arr = t.grid.get(ix * 100003 + iz);
        if (!arr) continue;
        for (const i of arr) bestD = Math.min(bestD, (t.px[i] - x) ** 2 + (t.pz[i] - z) ** 2);
      }
    }
    return Math.sqrt(bestD);
  }

  /** Place a mesh at track position s, lateral offset d (left positive), facing the track. */
  private placeAt(obj: THREE.Object3D, s: number, d: number, yOff = 0, face = true) {
    const p = sampleAt(this.track, s, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
    const x = p.x + p.tz * d, z = p.z - p.tx * d;
    obj.position.set(x, p.y + yOff, z);
    const yaw = Math.atan2(p.tx, p.tz);
    // Local +z faces the track centre.
    obj.rotation.y = face ? yaw + (d > 0 ? -Math.PI / 2 : Math.PI / 2) : yaw;
    this.scene.add(obj);
    return obj;
  }

  private buildScenery() {
    switch (this.env) {
      case "circuit": this.circuitScenery(); break;
      case "city": this.cityScenery(); break;
      case "coast": this.coastScenery(); break;
      case "desert": this.desertScenery(); break;
    }
    if (this.env !== "desert" && this.env !== "city") this.forest(this.env === "coast" ? "pine" : "mixed");
  }

  private forest(kind: "pine" | "mixed") {
    const count = { low: 500, medium: 1500, ultra: 3200 }[this.q];
    const rnd = rng(1234);
    const { minX, maxX, minZ, maxZ } = this.bbox;
    const CH = 260;
    const chunks = new Map<string, THREE.Matrix4[]>();
    const tints = new Map<string, THREE.Color[]>();
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let placed = 0;
    for (let tries = 0; tries < count * 5 && placed < count; tries++) {
      const x = minX - 350 + rnd() * (maxX - minX + 700);
      const z = minZ - 350 + rnd() * (maxZ - minZ + 700);
      const dist = this.trackDist(x, z);
      if (dist < this.track.wallDist + 7) continue;
      if (dist > 160 && rnd() < 0.6) continue;
      const y = this.ground(x, z);
      if (y < 1 && this.env === "coast") continue;
      if (this.env === "circuit" && x > -230 && x < 380 && z < -10 && z > -90) continue; // grandstands
      if (this.env === "circuit" && x > -110 && x < 270 && z > 10 && z < 70) continue; // pit building
      const scale = 0.7 + rnd() * 0.8;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
      s.set(scale, scale * (0.85 + rnd() * 0.4), scale);
      p.set(x, y - 0.2, z);
      m.compose(p, q, s);
      const key = `${Math.floor(x / CH)},${Math.floor(z / CH)}`;
      if (!chunks.has(key)) { chunks.set(key, []); tints.set(key, []); }
      chunks.get(key)!.push(m.clone());
      const g = 0.75 + rnd() * 0.5;
      tints.get(key)!.push(new THREE.Color(g * (kind === "pine" ? 0.8 : 0.9 + rnd() * 0.2), g, g * 0.85));
      placed++;
    }
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3, 6);
    trunkGeo.translate(0, 1.5, 0);
    const pineGeo = new THREE.ConeGeometry(2.3, 8, 8);
    pineGeo.translate(0, 6.5, 0);
    const leafGeo = new THREE.IcosahedronGeometry(2.8, 1);
    leafGeo.translate(0, 5, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x2f5233, roughness: 0.95, flatShading: true });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f7a32, roughness: 0.95, flatShading: true });
    for (const [key, mats] of chunks) {
      const cols = tints.get(key)!;
      const useLeaf = kind === "mixed";
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, mats.length);
      const crowns = new THREE.InstancedMesh(useLeaf ? leafGeo : pineGeo, useLeaf ? leafMat : pineMat, mats.length);
      mats.forEach((mm, i) => {
        trunks.setMatrixAt(i, mm);
        // Mixed forests alternate between broadleaf and pine silhouettes by tint.
        crowns.setMatrixAt(i, mm);
        crowns.setColorAt(i, cols[i]);
      });
      for (const im of [trunks, crowns]) {
        im.computeBoundingSphere();
        im.castShadow = this.q !== "low";
        im.receiveShadow = true;
        this.scene.add(im);
      }
      if (useLeaf) {
        // A second pass of pines for variety in mixed woods.
        const pines = new THREE.InstancedMesh(pineGeo, pineMat, Math.floor(mats.length / 3));
        for (let i = 0; i < pines.count; i++) {
          const mm = mats[i * 3].clone();
          mm.multiply(new THREE.Matrix4().makeTranslation(3.5, 0, 2));
          pines.setMatrixAt(i, mm);
        }
        pines.computeBoundingSphere();
        pines.castShadow = this.q !== "low";
        this.scene.add(pines);
      }
    }
  }

  private billboard(s: number, d: number, text: string, color: string, bg: string, w = 12, h = 3, height = 1.2) {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: signTexture(text, color, bg, 1024, 256), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: signTexture(text, color, bg, 1024, 256) }));
    board.position.y = height + h / 2;
    g.add(board);
    this.nightMats.push({ mat: board.material as THREE.MeshStandardMaterial, on: 0.7, off: 0 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6, roughness: 0.5 });
    for (const x of [-w * 0.35, w * 0.35]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, height + h, 0.2), legMat);
      leg.position.set(x, (height + h) / 2, -0.15);
      g.add(leg);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    back.rotation.y = Math.PI;
    back.position.set(0, height + h / 2, -0.02);
    g.add(back);
    g.traverse((o) => { o.castShadow = this.q !== "low"; });
    this.placeAt(g, s, d);
  }

  private circuitScenery() {
    const t = this.track;
    const W = t.wallDist;
    const conc = concrete(256);
    const steel = new THREE.MeshStandardMaterial({ color: 0x8b9097, metalness: 0.7, roughness: 0.4 });
    const crowd = crowdTexture();
    // Grandstands along the main straight (left side / outside).
    for (const s0 of [-170, -60, 60, 170]) {
      const g = new THREE.Group();
      const len = 90;
      for (let r = 0; r < 8; r++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(len, 0.6, 1.4), new THREE.MeshStandardMaterial({ map: conc.map, color: 0x9a9da3 }));
        step.position.set(0, 0.3 + r * 0.7, -r * 1.3);
        g.add(step);
        const seats = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.7), new THREE.MeshStandardMaterial({ map: crowd, roughness: 0.9 }));
        (seats.material as THREE.MeshStandardMaterial).map = crowd.clone();
        (seats.material as THREE.MeshStandardMaterial).map!.repeat.set(len / 30, 1 / 8);
        (seats.material as THREE.MeshStandardMaterial).map!.offset.set(0, r / 8);
        (seats.material as THREE.MeshStandardMaterial).map!.needsUpdate = true;
        seats.position.set(0, 0.95 + r * 0.7, -r * 1.3 + 0.71);
        g.add(seats);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len + 4, 0.3, 14), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, metalness: 0.3, roughness: 0.5 }));
      roof.position.set(0, 10.5, -5);
      roof.rotation.x = -0.08;
      g.add(roof);
      for (let k = -2; k <= 2; k++) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.4, 11, 0.4), steel);
        col.position.set(k * len * 0.24, 5.5, -11);
        g.add(col);
      }
      const back = new THREE.Mesh(new THREE.BoxGeometry(len, 10, 0.4), new THREE.MeshStandardMaterial({ map: conc.map, color: 0x75787e }));
      back.position.set(0, 5, -11.5);
      g.add(back);
      g.traverse((o) => { o.castShadow = this.q !== "low"; o.receiveShadow = true; });
      this.placeAt(g, ((s0 % t.length) + t.length) % t.length, W + 4);
    }
    // Pit building + pit wall on the inside of the main straight.
    const pit = new THREE.Group();
    const pitLen = 260;
    const body = new THREE.Mesh(new THREE.BoxGeometry(pitLen, 9, 16), new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.6 }));
    body.position.set(0, 4.5, -10);
    pit.add(body);
    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(pitLen + 0.2, 2.4, 16.2), new THREE.MeshPhysicalMaterial({ color: 0x1a2a3a, roughness: 0.05, metalness: 0.5, clearcoat: 1 }));
    glassBand.position.set(0, 7, -10);
    pit.add(glassBand);
    for (let k = 0; k < 18; k++) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.6), new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.8 }));
      door.position.set(-pitLen / 2 + 8 + k * 14, 2.4, -1.95);
      pit.add(door);
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), new THREE.MeshBasicMaterial({ map: signTexture(SIGN_WORDS[k % SIGN_WORDS.length], "#ffffff", ["#c8102e", "#1f4fff", "#11b37d", "#f5a300", "#222"][k % 5], 512, 64), toneMapped: false }));
      lbl.position.set(-pitLen / 2 + 8 + k * 14, 5.4, -1.94);
      pit.add(lbl);
    }
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 26, 16), new THREE.MeshPhysicalMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.6, clearcoat: 1 }));
    tower.position.set(pitLen / 2 - 20, 13, -12);
    pit.add(tower);
    const pitWall = new THREE.Mesh(new THREE.BoxGeometry(pitLen + 40, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }));
    pitWall.position.set(0, 0.6, 12);
    pit.add(pitWall);
    const pitLane = new THREE.Mesh(new THREE.PlaneGeometry(pitLen + 40, 12), new THREE.MeshStandardMaterial({ map: asphalt(256, this.wet, 0.26).map, roughness: 0.85 }));
    pitLane.rotation.x = -Math.PI / 2;
    pitLane.position.set(0, 0.03, 5.8);
    pit.add(pitLane);
    pit.traverse((o) => { o.castShadow = this.q !== "low"; o.receiveShadow = true; });
    // Main straight runs along +x at z=0; inside (right of travel) is +z.
    pit.rotation.y = Math.PI;
    pit.position.set(80, 0, W + 13);
    this.scene.add(pit);
    // Billboards
    const brands: [string, string, string][] = [["NOVA", "#ffffff", "#1f4fff"], ["KINETIC", "#111111", "#ffcc00"], ["ORBITAL", "#ffffff", "#c8102e"], ["ZENITH", "#ffffff", "#111111"], ["PULSE", "#111111", "#2ec4b6"], ["VOLTA", "#ffffff", "#8338ec"]];
    let bi = 0;
    for (let s = 260; s < t.length - 300; s += 140) {
      const i = Math.floor(s / (t.length / t.n));
      const side = t.curv[i] > 0 ? -1 : 1;
      const [txt, c, bg] = brands[bi++ % brands.length];
      this.billboard(s, side * (W + 3), txt, c, bg);
    }
    // Marshal posts
    for (let s = 120; s < t.length; s += 330) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(2, 2.6, 2), new THREE.MeshStandardMaterial({ color: 0xff7a00 }));
      post.castShadow = true;
      this.placeAt(post, s, -(W + 3), 1.3);
    }
  }

  private buildingMaterial(variant: number) {
    const day = facade(variant, false);
    const night = facade(variant, true);
    const mat = new THREE.MeshStandardMaterial({ map: day, emissiveMap: night, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.55, metalness: 0.25 });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vWUv;\nvarying float vRoof;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
          vec3 wn = normalize(mat3(modelMatrix * instanceMatrix) * normal);
          vRoof = step(0.5, wn.y);
          vWUv = (abs(wn.x) > 0.5 ? vec2(wp.z, wp.y) : vec2(wp.x, wp.y)) / vec2(32.0, 64.0);`,
        );
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vWUv;\nvarying float vRoof;")
        .replace("#include <map_fragment>", `vec4 sampledDiffuseColor = texture2D(map, vWUv); diffuseColor *= mix(sampledDiffuseColor, vec4(0.18,0.18,0.2,1.0), vRoof);`)
        .replace("#include <emissivemap_fragment>", `totalEmissiveRadiance *= texture2D(emissiveMap, vWUv).rgb * (1.0 - vRoof);`);
    };
    mat.customProgramCacheKey = () => "facade";
    this.nightMats.push({ mat, on: 1.6, off: 0 });
    return mat;
  }

  private cityScenery() {
    const t = this.track;
    const rnd = rng(99);
    const { minX, maxX, minZ, maxZ } = this.bbox;
    const variants = 4;
    const lists: THREE.Matrix4[][] = Array.from({ length: variants }, () => []);
    const glassTowers: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    const STEP = 42;
    const signSpots: { x: number; z: number; h: number; w: number; d: number }[] = [];
    for (let x = minX - 320; x < maxX + 320; x += STEP) {
      for (let z = minZ - 40; z < maxZ + 320; z += STEP) {
        const jx = x + (rnd() - 0.5) * 8, jz = z + (rnd() - 0.5) * 8;
        if (jz < -38) continue;
        const fw = 18 + rnd() * 14, fd = 18 + rnd() * 14;
        const dist = this.trackDist(jx, jz);
        if (dist < t.wallDist + Math.max(fw, fd) * 0.72 + 3) continue;
        const centre = Math.hypot(jx - cx, jz - cz);
        const tall = rnd() < 0.18 ? 80 + rnd() * 120 : 14 + rnd() * 50;
        const h = tall * (centre < 260 ? 1.2 : 0.8);
        const y = this.ground(jx, jz);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 0.05);
        sc.set(fw, h, fd);
        p.set(jx, y + h / 2 - 0.5, jz);
        m.compose(p, q, sc);
        if (h > 90 && rnd() < 0.55) glassTowers.push(m.clone());
        else lists[Math.floor(rnd() * variants)].push(m.clone());
        if (dist < t.wallDist + 40 && rnd() < 0.5) signSpots.push({ x: jx, z: jz, h: Math.min(h, 40), w: fw, d: fd });
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    lists.forEach((list, v) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(box, this.buildingMaterial(v), list.length);
      list.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.computeBoundingSphere();
      im.castShadow = this.q !== "low";
      im.receiveShadow = true;
      this.scene.add(im);
    });
    if (glassTowers.length) {
      const gm = new THREE.MeshPhysicalMaterial({ color: 0x2b3f55, metalness: 0.9, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.5, emissive: 0x1a3050, emissiveIntensity: 0 });
      this.nightMats.push({ mat: gm, on: 0.5, off: 0 });
      const im = new THREE.InstancedMesh(box, gm, glassTowers.length);
      glassTowers.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.computeBoundingSphere();
      im.castShadow = this.q !== "low";
      this.scene.add(im);
    }
    // Neon signs facing the track
    const neonColors = ["#ff2fa4", "#29d3ff", "#ffb347", "#8a5cff", "#4dff9a", "#ff4040"];
    signSpots.slice(0, this.q === "low" ? 12 : 30).forEach((sp, k) => {
      const pr = project(t, sp.x, sp.z, -1, newProjection());
      const word = SIGN_WORDS[k % SIGN_WORDS.length];
      const col = neonColors[k % neonColors.length];
      const tex = signTexture(word, col, "#05050a", 512, 128, true);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(sp.w * 0.8, sp.w * 0.2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, opacity: 0.95 }));
      const toTrackX = t.px[pr.i] - sp.x, toTrackZ = t.pz[pr.i] - sp.z;
      const l = Math.hypot(toTrackX, toTrackZ) || 1;
      const off = Math.max(sp.w, sp.d) / 2 + 0.3;
      sign.position.set(sp.x + (toTrackX / l) * off, this.ground(sp.x, sp.z) + sp.h * 0.55 + 4, sp.z + (toTrackZ / l) * off);
      sign.lookAt(sign.position.x + toTrackX, sign.position.y, sign.position.z + toTrackZ);
      this.scene.add(sign);
      this.nightOnly.push(sign);
    });
    // Harbor: quay wall, containers and cranes along the waterfront
    const quay = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX + 700, 8, 4), new THREE.MeshStandardMaterial({ map: concrete(256).map, color: 0x8a8780 }));
    quay.position.set(cx, -3.5, -42);
    this.scene.add(quay);
    const contCols = [0xc8102e, 0x1f4fff, 0x2a9d8f, 0xf4a261, 0x6c757d, 0xffb703];
    const contGeo = new THREE.BoxGeometry(12, 2.6, 2.5);
    const cont = new THREE.InstancedMesh(contGeo, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.4 }), 260);
    let ci = 0;
    for (let x = maxX + 40; x < maxX + 260 && ci < 260; x += 13) {
      for (let row = 0; row < 6 && ci < 260; row++) {
        const stack = 1 + Math.floor(rnd() * 4);
        for (let k = 0; k < stack && ci < 260; k++) {
          m.makeTranslation(x, 1.3 + k * 2.6, -30 + row * 3);
          cont.setMatrixAt(ci, m);
          cont.setColorAt(ci++, new THREE.Color(contCols[Math.floor(rnd() * contCols.length)]));
        }
      }
    }
    cont.count = ci;
    cont.computeBoundingSphere();
    cont.castShadow = this.q !== "low";
    this.scene.add(cont);
    for (let k = 0; k < 3; k++) {
      const crane = new THREE.Group();
      const cmat = new THREE.MeshStandardMaterial({ color: 0xd94a1e, roughness: 0.6, metalness: 0.4 });
      for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1, 34, 1), cmat);
        leg.position.set(dx, 17, dz);
        crane.add(leg);
      }
      const boom = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 70), cmat);
      boom.position.set(0, 35, -18);
      crane.add(boom);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      light.position.set(0, 37, -50);
      crane.add(light);
      crane.position.set(maxX + 60 + k * 70, 0, -44);
      crane.traverse((o) => { o.castShadow = this.q !== "low"; });
      this.scene.add(crane);
    }
    // Traffic lights at each corner
    const cornerCount = t.def.corners.length;
    for (let c = 1; c < cornerCount; c++) {
      const s = t.cornerS[c] - 25;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 8), new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.6 }));
      pole.position.y = 2.75;
      g.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.3, 0.35), new THREE.MeshStandardMaterial({ color: 0x15171b }));
      head.position.set(0, 5.2, 0.2);
      g.add(head);
      const mats: THREE.MeshBasicMaterial[] = [];
      [0xff2020, 0xffaa00, 0x20ff60].forEach((col, k) => {
        const mat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), mat);
        lamp.position.set(0, 5.6 - k * 0.4, 0.38);
        g.add(lamp);
        mats.push(mat);
      });
      this.trafficLights.push({ mats, phase: c * 3.7 });
      const i = Math.floor((((s % t.length) + t.length) % t.length) / (t.length / t.n));
      const side = t.curv[(i + 12) % t.n] > 0 ? -1 : 1;
      this.placeAt(g, s, side * (t.wallDist + 0.9));
    }
  }

  private coastScenery() {
    const t = this.track;
    // Petrol station beside the start straight (fictional brand).
    const st = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(22, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.5 }));
    canopy.position.y = 5.5;
    st.add(canopy);
    const band = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.5, 12.2), new THREE.MeshStandardMaterial({ color: 0x0d8a5f, emissive: 0x0d8a5f, emissiveIntensity: 0 }));
    band.position.y = 5.1;
    st.add(band);
    this.nightMats.push({ mat: band.material as THREE.MeshStandardMaterial, on: 1.2, off: 0 });
    for (const [x, z] of [[-8, -4], [8, -4], [-8, 4], [8, 4]]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
      col.position.set(x, 2.75, z);
      st.add(col);
    }
    for (const x of [-5, 0, 5]) {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, 0.6), new THREE.MeshStandardMaterial({ color: 0x0d8a5f, roughness: 0.4 }));
      pump.position.set(x, 0.9, 0);
      st.add(pump);
    }
    const shop = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 9), new THREE.MeshStandardMaterial({ color: 0xe7e2d6 }));
    shop.position.set(0, 2, -14);
    st.add(shop);
    const shopWin = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.2), new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0xffe2b0, emissiveIntensity: 0, roughness: 0.1, metalness: 0.4 }));
    shopWin.position.set(0, 2, -9.48);
    st.add(shopWin);
    this.nightMats.push({ mat: shopWin.material as THREE.MeshStandardMaterial, on: 1.4, off: 0 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: signTexture("AURA", "#ffffff", "#0d8a5f", 256, 256), toneMapped: false }));
    sign.position.set(14, 7, 0);
    st.add(sign);
    const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 7), new THREE.MeshStandardMaterial({ color: 0x777777 }));
    signPole.position.set(14, 3.5, -0.3);
    st.add(signPole);
    st.traverse((o) => { o.castShadow = this.q !== "low"; o.receiveShadow = true; });
    this.placeAt(st, 90, -(t.wallDist + 14), -0.1);
    // Lighthouse on the headland
    const lh = new THREE.Group();
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xf2efe8 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 22, 16), towerMat);
    tower.position.y = 11;
    lh.add(tower);
    for (const y of [6, 14]) {
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.9 - y * 0.04, 3.0 - y * 0.04, 2.5, 16), new THREE.MeshStandardMaterial({ color: 0xc8102e }));
      stripe.position.y = y;
      lh.add(stripe);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c0, toneMapped: false }));
    lamp.position.y = 23.5;
    lh.add(lamp);
    this.nightOnly.push(lamp);
    const lx = 440, lz = 180;
    lh.position.set(lx, this.ground(lx, lz), lz);
    lh.traverse((o) => { o.castShadow = this.q !== "low"; });
    this.scene.add(lh);
    // Rocks along the shore
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ map: rock(256).map, roughness: 0.95, flatShading: true }), 300);
    const rnd = rng(5);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0;
    for (let k = 0; k < 2000 && n < 300; k++) {
      const x = 360 + rnd() * 160, z = -200 + rnd() * 900;
      const y = this.ground(x, z);
      if (y > 6 || y < -6 || this.trackDist(x, z) < t.wallDist + 4) continue;
      const s = 1 + rnd() * 4;
      q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
      sc.set(s, s * 0.7, s);
      p.set(x, y, z);
      mm.compose(p, q, sc);
      rocks.setMatrixAt(n++, mm);
    }
    rocks.count = n;
    rocks.computeBoundingSphere();
    rocks.castShadow = this.q !== "low";
    this.scene.add(rocks);
  }

  private desertScenery() {
    const t = this.track;
    const metal = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.7, roughness: 0.35 });
    // Hangars
    for (let k = 0; k < 4; k++) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 50, 24, 1, false, 0, Math.PI), metal);
      h.rotation.z = Math.PI / 2;
      h.rotation.y = Math.PI / 2;
      h.position.set(300 + k * 70, 0, -95);
      h.castShadow = this.q !== "low";
      h.receiveShadow = true;
      this.scene.add(h);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ color: 0x2a2d33 }));
      door.position.set(300 + k * 70, 7, -69.9);
      this.scene.add(door);
    }
    // Control tower
    const tw = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 30, 12), new THREE.MeshStandardMaterial({ color: 0xe6dccb }));
    shaft.position.y = 15;
    tw.add(shaft);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 5, 5, 12), new THREE.MeshPhysicalMaterial({ color: 0x1f3550, metalness: 0.6, roughness: 0.08, clearcoat: 1 }));
    cab.position.y = 32.5;
    tw.add(cab);
    tw.position.set(160, 0, -110);
    tw.traverse((o) => { o.castShadow = this.q !== "low"; });
    this.scene.add(tw);
    // Parked aircraft (generic shapes)
    for (let k = 0; k < 3; k++) {
      const plane = new THREE.Group();
      const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.2, roughness: 0.4 });
      const fus = new THREE.Mesh(new THREE.CapsuleGeometry(2, 26, 6, 12), white);
      fus.rotation.z = Math.PI / 2;
      fus.position.y = 3.5;
      plane.add(fus);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 30), white);
      wing.position.set(1, 3, 0);
      plane.add(wing);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(3, 6, 0.4), new THREE.MeshStandardMaterial({ color: [0xc8102e, 0x1f4fff, 0x0d8a5f][k] }));
      tail.position.set(-13, 7, 0);
      plane.add(tail);
      plane.position.set(620 + k * 60, 0, -120);
      plane.rotation.y = 0.4;
      plane.traverse((o) => { o.castShadow = this.q !== "low"; });
      this.scene.add(plane);
    }
    // Rocks and cacti scattered in the desert
    const rnd = rng(11);
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x9a7552, roughness: 1, flatShading: true }), 400);
    const cacti = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.35, 3, 4, 8), new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 0.9 }), 300);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    let nr = 0, nc = 0;
    const { minX, maxX, minZ, maxZ } = this.bbox;
    for (let k = 0; k < 5000 && (nr < 400 || nc < 300); k++) {
      const x = minX - 500 + rnd() * (maxX - minX + 1000), z = minZ - 500 + rnd() * (maxZ - minZ + 1000);
      if (this.trackDist(x, z) < t.wallDist + 12) continue;
      if (z > -140 && z < -60 && x > 100 && x < 800) continue;
      const y = this.ground(x, z);
      if (rnd() < 0.6 && nr < 400) {
        const s = 0.6 + rnd() * 3.5;
        q.setFromEuler(new THREE.Euler(rnd(), rnd() * 3, rnd()));
        sc.set(s, s * 0.6, s * 1.2);
        p.set(x, y, z);
        mm.compose(p, q, sc);
        rocks.setMatrixAt(nr++, mm);
      } else if (nc < 300) {
        const s = 0.8 + rnd() * 0.8;
        q.identity();
        sc.set(s, s, s);
        p.set(x, y + 1.8 * s, z);
        mm.compose(p, q, sc);
        cacti.setMatrixAt(nc++, mm);
      }
    }
    rocks.count = nr;
    cacti.count = nc;
    for (const im of [rocks, cacti]) { im.computeBoundingSphere(); im.castShadow = this.q !== "low"; this.scene.add(im); }
    // Windsock
    const sock = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xff6a00, side: THREE.DoubleSide }));
    sock.rotation.z = Math.PI / 2;
    sock.position.set(60, 7, -60);
    this.scene.add(sock);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 7), metal);
    pole.position.set(61.5, 3.5, -60);
    this.scene.add(pole);
  }

  // -------------------------------------------------------------------------
  // Street lights
  // -------------------------------------------------------------------------

  private buildLights() {
    const t = this.track;
    const spacing = this.env === "city" ? 30 : this.env === "coast" ? 45 : this.env === "desert" ? 80 : 60;
    const height = this.env === "circuit" ? 14 : this.env === "desert" ? 12 : 8;
    const positions: { x: number; y: number; z: number; ax: number; az: number }[] = [];
    const step = t.length / t.n;
    let alt = 1;
    for (let s = 5; s < t.length; s += spacing) {
      if (inRanges(t.tunnels, s, t.length)) continue;
      const i = Math.floor(s / step) % t.n;
      const sides = this.env === "city" ? [alt] : this.env === "coast" ? [-1] : [1, -1];
      alt = -alt;
      for (const side of sides) {
        const d = (wallDistAt(t, s) + (this.env === "city" ? 0.9 : 1.6)) * side;
        positions.push({ x: t.px[i] + t.nx[i] * d, y: t.py[i], z: t.pz[i] + t.nz[i] * d, ax: -t.nx[i] * side, az: -t.nz[i] * side });
      }
    }
    const n = positions.length;
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.16, height, 8);
    poleGeo.translate(0, height / 2, 0);
    const armGeo = new THREE.BoxGeometry(0.12, 0.12, 2.2);
    const headGeo = new THREE.BoxGeometry(0.5, 0.18, 0.9);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.7, roughness: 0.45 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xffe8b8, emissiveIntensity: 0 });
    this.nightMats.push({ mat: headMat, on: 6, off: 0 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, n);
    const arms = new THREE.InstancedMesh(armGeo, poleMat, n);
    const heads = new THREE.InstancedMesh(headGeo, headMat, n);
    const glowPos = new Float32Array(n * 3);
    const poolGeo = new THREE.CircleGeometry(1, 20);
    poolGeo.rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({
      map: radialSprite("pool", "rgba(255,226,170,0.8)", "rgba(255,226,170,0)", 64), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3,
    }), n);
    const m = new THREE.Matrix4();
    positions.forEach((p, k) => {
      const yaw = Math.atan2(p.ax, p.az);
      m.makeRotationY(yaw);
      m.setPosition(p.x, p.y, p.z);
      poles.setMatrixAt(k, m);
      m.makeRotationY(yaw);
      m.setPosition(p.x + p.ax * 1.1, p.y + height - 0.1, p.z + p.az * 1.1);
      arms.setMatrixAt(k, m);
      m.setPosition(p.x + p.ax * 2.1, p.y + height - 0.2, p.z + p.az * 2.1);
      heads.setMatrixAt(k, m);
      glowPos.set([p.x + p.ax * 2.1, p.y + height - 0.4, p.z + p.az * 2.1], k * 3);
      const r = this.env === "circuit" ? 11 : 7.5;
      m.makeScale(r, 1, r);
      m.setPosition(p.x + p.ax * 4.5, p.y + 0.06, p.z + p.az * 4.5);
      pools.setMatrixAt(k, m);
    });
    for (const im of [poles, arms, heads, pools]) im.computeBoundingSphere();
    poles.castShadow = this.q === "ultra";
    this.scene.add(poles, arms, heads, pools);
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
    const glow = new THREE.Points(glowGeo, new THREE.PointsMaterial({
      map: radialSprite("glow", "rgba(255,236,200,1)", "rgba(255,200,120,0)", 64), size: 7, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false,
    }));
    this.scene.add(glow);
    this.nightOnly.push(glow, pools);
  }

  private applyNight() {
    const night = this.sky.night;
    for (const o of this.nightOnly) o.visible = night;
    for (const { mat, on, off } of this.nightMats) mat.emissiveIntensity = night ? on : off;
  }

  setConditions(hours: number, weather: Weather, regenEnv = true) {
    const wasWet = this.wet;
    this.opts.hours = hours;
    this.opts.weather = weather;
    this.sky.setConditions(hours, weather, regenEnv);
    this.applyNight();
    if (wasWet !== this.wet && this.roadMat) {
      const set = asphalt(this.q === "low" ? 256 : 512, this.wet, this.env === "desert" ? 0.2 : this.env === "city" ? 0.15 : 0.17);
      this.roadMat.map = set.map;
      this.roadMat.roughnessMap = set.roughnessMap;
      this.roadMat.envMapIntensity = this.wet ? 1.4 : 0.6;
      this.roadMat.needsUpdate = true;
    }
  }

  /** 0..1 how deep inside a tunnel the given s is (for dimming the sky light). */
  tunnelFactor(s: number) {
    for (const [a, b] of this.track.tunnels) {
      if (s >= a && s <= b) return smooth(0, 25, Math.min(s - a, b - s));
    }
    return 0;
  }

  update(dt: number, time: number, camPos: THREE.Vector3, focus: THREE.Vector3, focusS: number) {
    this.sky.update(dt, time, camPos, focus);
    if (this.water) {
      const nm = (this.water.material as THREE.MeshPhysicalMaterial).normalMap!;
      nm.offset.x = time * 0.004;
      nm.offset.y = time * 0.0025;
    }
    for (const tl of this.trafficLights) {
      const ph = ((time + tl.phase) % 14) / 14;
      const state = ph < 0.45 ? 2 : ph < 0.55 ? 1 : 0;
      tl.mats.forEach((m, k) => m.color.setHex(TL_COLORS[k]).multiplyScalar(k === state ? 1 : 0.06));
    }
    // Dim sky lighting deep inside tunnels.
    const tf = this.tunnelFactor(focusS);
    const target = 1 - tf * 0.8;
    this.tunnelLightScale += (target - this.tunnelLightScale) * Math.min(1, dt * 3);
    this.scene.environmentIntensity = (this.sky.night ? 1 : this.wet ? 0.85 : 0.8) * this.tunnelLightScale;
    this.sky.sun.intensity = this.sky.sunBase * this.tunnelLightScale;
    if (!this.sky.flashing) this.sky.hemi.intensity = this.sky.hemiBase * (0.35 + 0.65 * this.tunnelLightScale);
  }

  dispose() {
    this.sky.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
