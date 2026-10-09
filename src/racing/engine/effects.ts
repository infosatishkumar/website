// Visual effects: GPU point-sprite particles (tyre smoke, sparks, dust, wet
// spray, nitro flashes), skid-mark ribbons and rain streaks around the camera.

import * as THREE from "three";
import { smokeSprite, radialSprite, skidTexture } from "./textures.ts";

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
  if (gl_FragColor.a < 0.005) discard;
  #include <colorspace_fragment>
}`;

interface Emit {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; size: number; grow: number; alpha: number;
  r: number; g: number; b: number;
  gravity?: number; drag?: number;
}

export class Particles {
  points: THREE.Points;
  private n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private size0: Float32Array;
  private grow: Float32Array;
  private alpha0: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private sizeA: Float32Array;
  private alphaA: Float32Array;
  private colorA: Float32Array;
  private head = 0;
  material: THREE.ShaderMaterial;

  constructor(max: number, map: THREE.Texture, additive: boolean) {
    this.n = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1e9);
    this.life = new Float32Array(max).fill(1);
    this.size0 = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.sizeA = new Float32Array(max);
    this.alphaA = new Float32Array(max);
    this.colorA = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.sizeA, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alphaA, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aColor", new THREE.BufferAttribute(this.colorA, 3).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, uScale: { value: 600 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
  }

  emit(e: Emit) {
    const i = this.head;
    this.head = (this.head + 1) % this.n;
    this.pos.set([e.x, e.y, e.z], i * 3);
    this.vel.set([e.vx, e.vy, e.vz], i * 3);
    this.age[i] = 0;
    this.life[i] = e.life;
    this.size0[i] = e.size;
    this.grow[i] = e.grow;
    this.alpha0[i] = e.alpha;
    this.grav[i] = e.gravity ?? 0;
    this.drag[i] = e.drag ?? 0.5;
    this.colorA.set([e.r, e.g, e.b], i * 3);
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      const a = (this.age[i] += dt);
      const L = this.life[i];
      if (a >= L) { this.alphaA[i] = 0; this.sizeA[i] = 0; continue; }
      const k = 1 - Math.min(1, this.drag[i] * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const f = a / L;
      this.sizeA[i] = this.size0[i] + this.grow[i] * a;
      this.alphaA[i] = this.alpha0[i] * (f < 0.1 ? f / 0.1 : 1 - (f - 0.1) / 0.9);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
  }

  setScale(height: number, fov: number) {
    this.material.uniforms.uScale.value = height / (2 * Math.tan((fov * Math.PI) / 360));
  }
}

export class SkidMarks {
  mesh: THREE.Mesh;
  private max: number;
  private pos: Float32Array;
  private col: Float32Array;
  private head = 0;
  private last = new Map<number, { x: number; y: number; z: number; lx: number; lz: number }>();

  constructor(max = 3000) {
    this.max = max;
    this.pos = new Float32Array(max * 4 * 3);
    this.col = new Float32Array(max * 4 * 4);
    const uv = new Float32Array(max * 4 * 2);
    const idx: number[] = [];
    for (let q = 0; q < max; q++) {
      uv.set([0, 0, 1, 0, 0, 1, 1, 1], q * 8);
      const b = q * 4;
      idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      map: skidTexture(), transparent: true, depthWrite: false, vertexColors: true,
      polygonOffset: true, polygonOffsetFactor: -4, color: 0x050505,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  /** Add a segment for wheel `key` at world (x,y,z); intensity 0 breaks the trail. */
  add(key: number, x: number, y: number, z: number, intensity: number) {
    const prev = this.last.get(key);
    if (intensity <= 0.05) { this.last.delete(key); return; }
    if (!prev) { this.last.set(key, { x, y, z, lx: 0, lz: 0 }); return; }
    const dx = x - prev.x, dz = z - prev.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.25) return;
    if (d > 4) { this.last.set(key, { x, y, z, lx: 0, lz: 0 }); return; }
    const w = 0.13;
    const lx = (-dz / d) * w, lz = (dx / d) * w;
    const q = this.head;
    this.head = (this.head + 1) % this.max;
    const plx = prev.lx || lx, plz = prev.lz || lz;
    const yy = y + 0.05;
    this.pos.set([
      prev.x - plx, prev.y + 0.05, prev.z - plz,
      prev.x + plx, prev.y + 0.05, prev.z + plz,
      x - lx, yy, z - lz,
      x + lx, yy, z + lz,
    ], q * 12);
    const a = Math.min(0.85, intensity);
    for (let k = 0; k < 4; k++) this.col.set([1, 1, 1, a], q * 16 + k * 4);
    this.last.set(key, { x, y, z, lx, lz });
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }

  clear() {
    this.pos.fill(0);
    this.col.fill(0);
    this.last.clear();
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

export class Rain {
  lines: THREE.LineSegments;
  private n: number;
  private pos: Float32Array;
  private offs: Float32Array;
  constructor(count: number) {
    this.n = count;
    this.pos = new Float32Array(count * 6);
    this.offs = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.offs[i * 3] = (Math.random() - 0.5) * 60;
      this.offs[i * 3 + 1] = Math.random() * 30;
      this.offs[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.35, depthWrite: false }));
    this.lines.frustumCulled = false;
  }
  update(dt: number, cam: THREE.Vector3, windX: number, windZ: number, carVx: number, carVz: number) {
    const fall = 22;
    for (let i = 0; i < this.n; i++) {
      let y = this.offs[i * 3 + 1] - fall * dt;
      if (y < -4) y += 34;
      this.offs[i * 3 + 1] = y;
      let ox = this.offs[i * 3] - carVx * dt * 0.6;
      let oz = this.offs[i * 3 + 2] - carVz * dt * 0.6;
      if (ox < -30) ox += 60; if (ox > 30) ox -= 60;
      if (oz < -30) oz += 60; if (oz > 30) oz -= 60;
      this.offs[i * 3] = ox;
      this.offs[i * 3 + 2] = oz;
      const x = cam.x + ox, z = cam.z + oz, yy = cam.y + y - 8;
      // Streak direction combines fall and relative wind from driving.
      const sx = (windX - carVx) * 0.03, sz = (windZ - carVz) * 0.03;
      this.pos.set([x, yy, z, x + sx, yy + 0.9, z + sz], i * 6);
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}

export class Effects {
  group = new THREE.Group();
  smoke: Particles;
  sparks: Particles;
  dust: Particles;
  spray: Particles;
  skids: SkidMarks;
  rain: Rain | null = null;

  constructor(quality: "low" | "medium" | "ultra", wet: boolean) {
    const mult = quality === "low" ? 0.4 : quality === "medium" ? 0.7 : 1;
    this.smoke = new Particles(Math.floor(900 * mult), smokeSprite(), false);
    this.dust = new Particles(Math.floor(600 * mult), smokeSprite(), false);
    this.spray = new Particles(Math.floor(900 * mult), smokeSprite(), false);
    this.sparks = new Particles(Math.floor(500 * mult), radialSprite("spark", "rgba(255,240,200,1)", "rgba(255,120,20,0)", 32), true);
    this.skids = new SkidMarks(quality === "low" ? 1200 : 3000);
    this.group.add(this.skids.mesh, this.smoke.points, this.dust.points, this.spray.points, this.sparks.points);
    if (wet) this.setRain(true, quality);
  }

  setRain(on: boolean, quality: "low" | "medium" | "ultra") {
    if (on && !this.rain) {
      this.rain = new Rain(quality === "low" ? 1200 : quality === "medium" ? 2500 : 4500);
      this.group.add(this.rain.lines);
    } else if (!on && this.rain) {
      this.group.remove(this.rain.lines);
      this.rain.lines.geometry.dispose();
      this.rain = null;
    }
  }

  burstSparks(x: number, y: number, z: number, vx: number, vz: number, intensity: number) {
    const n = Math.min(40, Math.floor(intensity * 3));
    for (let k = 0; k < n; k++) {
      this.sparks.emit({
        x, y: y + 0.3, z,
        vx: vx * 0.5 + (Math.random() - 0.5) * 8, vy: Math.random() * 5 + 1, vz: vz * 0.5 + (Math.random() - 0.5) * 8,
        life: 0.3 + Math.random() * 0.5, size: 0.12 + Math.random() * 0.1, grow: -0.1, alpha: 1,
        r: 1, g: 0.75 + Math.random() * 0.2, b: 0.4, gravity: 12, drag: 0.8,
      });
    }
  }

  update(dt: number, height: number, fov: number) {
    for (const p of [this.smoke, this.sparks, this.dust, this.spray]) {
      p.setScale(height, fov);
      p.update(dt);
    }
  }
}
