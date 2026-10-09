// Camera rig: chase (near/far), hood, bumper, cockpit and a cinematic
// trackside director. Speed-dependent FOV, drift-aware chase yaw, impact
// shake and terrain clearance.

import * as THREE from "three";
import type { TrackData } from "../shared/trackGeom.ts";
import { sampleAt, sDelta } from "../shared/trackGeom.ts";
import type { CarModel } from "./carModel.ts";
import type { CameraMode } from "./settings.ts";

export interface CamTarget {
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
  s: number;
  nitro: boolean;
  model: CarModel;
}

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const flipY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

function angDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  mode: CameraMode = "chase";
  private yaw = 0;
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private look = new THREE.Vector3();
  private shakeAmt = 0;
  private baseFov = 62;
  private cineIndex = -1;
  private cineTime = 0;
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.08, 6000);
  }

  setMode(m: CameraMode) {
    this.mode = m;
    this.initialized = false;
  }

  shake(a: number) {
    this.shakeAmt = Math.min(1.2, this.shakeAmt + a);
  }

  reset() {
    this.initialized = false;
  }

  update(dt: number, t: CamTarget, track: TrackData, lookBack: boolean, groundY: (x: number, z: number) => number) {
    const cam = this.camera;
    const kmh = t.speed * 3.6;
    let fov = this.baseFov + Math.min(16, kmh / 22) + (t.nitro ? 6 : 0);
    if (!this.initialized) {
      this.yaw = t.yaw;
    }
    // Drift-aware heading: blend car yaw with velocity direction.
    const velYaw = Math.atan2(t.vx, t.vz);
    const targetYaw = t.speed > 4 ? t.yaw + angDiff(velYaw, t.yaw) * 0.45 : t.yaw;
    this.yaw += angDiff(targetYaw, this.yaw) * Math.min(1, dt * 4.5);

    const internal = this.mode === "hood" || this.mode === "bumper" || this.mode === "cockpit";
    if (internal) {
      const body = t.model.body;
      body.updateWorldMatrix(true, false);
      const anchor = this.mode === "hood" ? t.model.anchors.hood : this.mode === "bumper" ? t.model.anchors.bumper : t.model.anchors.cockpit;
      tmpV.copy(anchor).applyMatrix4(body.matrixWorld);
      cam.position.copy(tmpV);
      body.getWorldQuaternion(tmpQ);
      cam.quaternion.copy(tmpQ).multiply(flipY);
      if (lookBack) cam.quaternion.multiply(flipY);
      if (this.mode === "cockpit") {
        // Slight head movement with g-forces.
        cam.rotateX(-0.06);
        fov += 6;
      }
      this.pos.copy(cam.position);
    } else if (this.mode === "cinematic") {
      this.cinematic(dt, t, track);
      fov = cam.fov;
    } else {
      const far = this.mode === "far";
      const dist = (far ? 8.6 : 5.9) + Math.min(1.6, t.speed * 0.02);
      const height = far ? 2.9 : 1.85;
      const dir = lookBack ? -1 : 1;
      const fx = Math.sin(this.yaw) * dir, fz = Math.cos(this.yaw) * dir;
      const desired = tmpV.set(t.x - fx * dist, t.y + height, t.z - fz * dist);
      if (!this.initialized) {
        this.pos.copy(desired);
        this.vel.set(0, 0, 0);
      }
      // Critically damped spring towards the desired position.
      const k = 60, c = 2 * Math.sqrt(k) * 0.9;
      const ax = (desired.x - this.pos.x) * k - this.vel.x * c;
      const ay = (desired.y - this.pos.y) * k - this.vel.y * c;
      const az = (desired.z - this.pos.z) * k - this.vel.z * c;
      this.vel.x += ax * dt; this.vel.y += ay * dt; this.vel.z += az * dt;
      this.pos.addScaledVector(this.vel, dt);
      // Keep up with the car at very high speed (the spring alone lags).
      const lag = this.pos.distanceTo(desired);
      if (lag > dist * 0.6) this.pos.lerp(desired, 1 - (dist * 0.6) / lag);
      const gy = groundY(this.pos.x, this.pos.z);
      if (this.pos.y < gy + 0.6) this.pos.y = gy + 0.6;
      cam.position.copy(this.pos);
      this.look.set(t.x + fx * 4, t.y + (far ? 1.2 : 0.95), t.z + fz * 4);
      cam.lookAt(this.look);
    }
    // Shake: impacts + subtle high-speed vibration.
    const hs = Math.max(0, kmh - 180) / 400;
    const sh = this.shakeAmt * 0.12 + hs * 0.012;
    if (sh > 0.0005) {
      cam.position.x += (Math.random() - 0.5) * sh;
      cam.position.y += (Math.random() - 0.5) * sh;
      cam.rotation.z += (Math.random() - 0.5) * sh * 0.3;
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    if (this.mode !== "cinematic") cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
    cam.updateProjectionMatrix();
    this.initialized = true;
  }

  private cinematic(dt: number, t: CamTarget, track: TrackData) {
    const cam = this.camera;
    this.cineTime += dt;
    const spacing = 140;
    const count = Math.floor(track.length / spacing);
    // Pick the trackside camera just ahead of the car.
    const want = Math.floor((((t.s + 70) % track.length) + track.length) % track.length / spacing) % count;
    if (want !== this.cineIndex && (this.cineTime > 2.5 || this.cineIndex < 0 || !this.initialized)) {
      this.cineIndex = want;
      this.cineTime = 0;
    }
    const camS = this.cineIndex * spacing;
    const p = sampleAt(track, camS, { x: 0, y: 0, z: 0, tx: 0, tz: 0, i: 0 });
    const side = this.cineIndex % 2 === 0 ? 1 : -1;
    const d = (track.wallDist + 5) * side;
    const h = 2.5 + (this.cineIndex % 3) * 2.5;
    cam.position.set(p.x + p.tz * d, p.y + h, p.z - p.tx * d);
    // If the car is far from this camera (e.g. after a respawn), fall back to a helicopter shot.
    const ds = Math.abs(sDelta(track, camS, t.s));
    if (ds > 220) {
      cam.position.set(t.x - Math.sin(t.yaw) * 14, t.y + 7, t.z - Math.cos(t.yaw) * 14);
    }
    cam.lookAt(t.x, t.y + 0.8, t.z);
    const dist = cam.position.distanceTo(tmpV.set(t.x, t.y, t.z));
    const targetFov = THREE.MathUtils.clamp(2 * Math.atan(7 / Math.max(1, dist)) * (180 / Math.PI), 8, 70);
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 4);
  }
}
