// Vehicle dynamics: a four-wheel planar model on the track surface with
// per-wheel load transfer, a Pacejka-style lateral tyre curve, friction
// ellipse for combined slip, engine torque curve + gearbox, aero drag and
// downforce, ABS / traction control / stability control and nitro.
// No rendering code lives here so it can run in Node for tests.

import type { CarSpec } from "../shared/cars.ts";

export type HandlingPreset = "arcade" | "sport" | "sim";

export interface Controls {
  throttle: number;
  brake: number;
  /** -1 (left) .. 1 (right) */
  steer: number;
  handbrake: boolean;
  nitro: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
  /** True when the steer value comes from an analog device (stick, wheel, tilt). */
  analog?: boolean;
}

export interface Assists {
  abs: boolean;
  tc: boolean;
  esc: boolean;
  autoGear: boolean;
  preset: HandlingPreset;
}

export interface SurfaceEnv {
  /** Base road grip multiplier (1 dry, ~0.72 wet). */
  grip: number;
  /** Track lateral offset of the car's CG and the left normal, to classify each wheel on/off the road. */
  d: number;
  nx: number;
  nz: number;
  halfWidth: number;
  /** World-space gravity acceleration along the road (from slope). */
  gx: number;
  gz: number;
}

interface PresetTuning {
  grip: number;
  rearGrip: number;
  steerSpeedK: number;
  countersteer: number;
  brake: number;
  B: number;
  C: number;
  slide: number;
  forceAssists: boolean;
  yawDamp: number;
}

export const PRESETS: Record<HandlingPreset, PresetTuning> = {
  arcade: { grip: 1.3, rearGrip: 1.1, steerSpeedK: 24, countersteer: 0.55, brake: 1.25, B: 10, C: 1.25, slide: 0.88, forceAssists: true, yawDamp: 0.6 },
  sport: { grip: 1.06, rearGrip: 1.03, steerSpeedK: 27, countersteer: 0.18, brake: 1.05, B: 12, C: 1.35, slide: 0.82, forceAssists: false, yawDamp: 0.2 },
  sim: { grip: 1.0, rearGrip: 1.0, steerSpeedK: 42, countersteer: 0, brake: 1.0, B: 14, C: 1.45, slide: 0.76, forceAssists: false, yawDamp: 0 },
};

export interface WheelState {
  spin: number; // accumulated rotation (rad)
  load: number;
  slide: number; // 0.. sliding intensity for audio / smoke / skid marks
  offroad: boolean;
  compress: number; // visual suspension offset (m)
  wx: number; // world position (x, z) – updated each step
  wz: number;
}

const G = 9.81;
const RHO = 1.225;

export class Vehicle {
  spec: CarSpec;
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  vx = 0;
  vz = 0;
  r = 0;
  steerAngle = 0;
  gear = 1;
  rpm = 900;
  shiftTimer = 0;
  reverseTimer = 0;
  nitro = 1;
  nitroActive = false;
  damage = 0;
  ax = 0;
  ay = 0;
  vxl = 0;
  vyl = 0;
  pitch = 0;
  roll = 0;
  private pitchV = 0;
  private rollV = 0;
  absActive = false;
  tcActive = false;
  escActive = false;
  limiter = false;
  wheelspin = 0;
  slideTotal = 0;
  throttleOut = 0;
  brakeOut = 0;
  wheels: WheelState[];
  hint = -1;
  lastShift = 0; // +1 / -1 when a shift happened this step (for audio)
  private prevUp = false;
  private prevDown = false;

  constructor(spec: CarSpec) {
    this.spec = spec;
    this.wheels = [0, 1, 2, 3].map(() => ({ spin: 0, load: 0, slide: 0, offroad: false, compress: 0, wx: 0, wz: 0 }));
    this.rpm = spec.idleRpm;
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }
  get kmh() {
    return this.vxl * 3.6;
  }

  place(x: number, y: number, z: number, yaw: number) {
    this.x = x; this.y = y; this.z = z; this.yaw = yaw;
    this.vx = this.vz = this.r = 0;
    this.steerAngle = 0;
    this.gear = 1;
    this.rpm = this.spec.idleRpm;
    this.ax = this.ay = 0;
    this.pitch = this.roll = this.pitchV = this.rollV = 0;
  }

  torqueCurve(rpm: number) {
    const s = this.spec;
    const p = s.torqueRpm;
    let k: number;
    if (rpm <= p) {
      const t = Math.max(0, (rpm - s.idleRpm) / (p - s.idleRpm));
      k = s.sound.turbo ? 0.38 + 0.62 * t * t * (3 - 2 * t) : 0.55 + 0.45 * Math.sin((Math.PI / 2) * t);
    } else {
      const plateau = s.sound.turbo ? 0.35 : 0;
      const t = Math.max(0, ((rpm - p) / (s.redline - p) - plateau) / (1 - plateau));
      k = 1 - 0.42 * Math.pow(t, 1.5);
    }
    return Math.max(0, k);
  }

  gearRatio(g = this.gear) {
    const s = this.spec;
    if (g === 0) return 0;
    if (g < 0) return -3.3 * s.finalDrive;
    return s.gears[g - 1] * s.finalDrive;
  }

  step(dt: number, c: Controls, as: Assists, env: SurfaceEnv) {
    const s = this.spec;
    const pre = PRESETS[as.preset];
    const abs = as.abs || pre.forceAssists;
    const tc = as.tc || pre.forceAssists;
    const esc = as.esc || pre.forceAssists;
    const m = s.mass;
    const L = s.wheelbase;
    const a = L * (1 - s.frontWeight);
    const b = L * s.frontWeight;
    const t = s.track / 2;
    const R = s.wheelRadius;
    const I = m * L * L * 0.3;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const fx = sin, fz = cos; // forward
    const lx = cos, lz = -sin; // left
    let vxl = this.vx * fx + this.vz * fz;
    let vyl = this.vx * lx + this.vz * lz;
    const speed = Math.hypot(vxl, vyl);
    this.lastShift = 0;

    // ---- Gearbox -------------------------------------------------------
    const up = c.shiftUp && !this.prevUp;
    const down = c.shiftDown && !this.prevDown;
    this.prevUp = c.shiftUp;
    this.prevDown = c.shiftDown;
    let throttle = c.throttle;
    let brake = c.brake;
    if (this.shiftTimer > 0) this.shiftTimer -= dt;
    const nG = s.gears.length;
    if (as.autoGear) {
      if (this.gear >= 1 && speed < 0.8 && c.brake > 0.5 && c.throttle < 0.1) {
        this.reverseTimer += dt;
        if (this.reverseTimer > 0.35) { this.gear = -1; this.reverseTimer = 0; }
      } else if (this.gear === -1 && c.throttle > 0.1 && vxl > -0.8) {
        this.gear = 1;
      } else this.reverseTimer = 0;
      if (this.gear === 0) this.gear = 1;
    } else {
      if (up && this.gear < nG) { this.gear = this.gear === -1 ? 0 : this.gear + 1; this.shiftTimer = 0.12; this.lastShift = 1; }
      if (down && this.gear > -1) {
        if (this.gear > 1 || speed < 2) { this.gear = this.gear - 1; this.shiftTimer = 0.12; this.lastShift = -1; }
      }
    }
    if (this.gear === -1) {
      // In reverse the pedals swap: brake pedal drives backwards, throttle brakes.
      throttle = c.brake;
      brake = c.throttle;
    }

    // ---- Engine --------------------------------------------------------
    const gr = this.gearRatio();
    const wheelRpm = (Math.abs(vxl) / R) * Math.abs(gr) * (60 / (2 * Math.PI));
    let rpm = Math.max(wheelRpm, s.idleRpm);
    const launch = s.idleRpm + (s.torqueRpm * 0.85 - s.idleRpm) * throttle;
    if (this.gear !== 0 && Math.abs(this.gear) === 1 && wheelRpm < launch) rpm = Math.max(rpm, launch); // clutch slip
    if (this.gear === 0) rpm = s.idleRpm + throttle * (s.redline - s.idleRpm);
    this.limiter = rpm >= s.redline;
    if (this.limiter) throttle = 0;
    // Nitro
    this.nitroActive = c.nitro && this.nitro > 0 && throttle > 0.3 && this.gear > 0;
    if (this.nitroActive) this.nitro = Math.max(0, this.nitro - dt / 3.2);
    else this.nitro = Math.min(1, this.nitro + dt / 28);

    // Stability control: compare yaw rate with what the steering asks for.
    const delta0 = this.steerAngle;
    let escMoment = 0;
    this.escActive = false;
    if (esc && vxl > 8) {
      const muG = s.tireGrip * env.grip * pre.grip * G;
      let rT = (vxl * Math.tan(delta0)) / L;
      const rMax = muG / vxl;
      rT = Math.max(-rMax, Math.min(rMax, rT));
      const err = this.r - rT;
      const beta = Math.atan2(vyl, vxl);
      if (Math.abs(err) > 0.12 || Math.abs(beta) > 0.12) {
        this.escActive = true;
        escMoment = -I * err * 3.2;
        throttle *= 1 - Math.min(0.7, Math.abs(err) * 1.6);
      }
    }

    let Te = s.torque * this.torqueCurve(rpm) * throttle * (1 - 0.3 * this.damage);
    if (this.nitroActive) Te *= 1.4;
    if (this.gear !== 0) Te -= s.torque * 0.14 * (rpm / s.redline) * (1 - throttle); // engine braking
    if (this.shiftTimer > 0 || this.gear === 0) Te = 0;
    const driveTotal = (Te * gr * 0.9) / R;

    // ---- Steering ------------------------------------------------------
    const k = c.analog ? pre.steerSpeedK * 1.4 : pre.steerSpeedK;
    const lock = s.steerLock / (1 + (speed / k) * (speed / k));
    let target = -c.steer * lock;
    if (pre.countersteer > 0 && vxl > 4) {
      const beta = Math.atan2(vyl, Math.abs(vxl));
      target += pre.countersteer * beta;
    }
    target = Math.max(-s.steerLock, Math.min(s.steerLock, target));
    const rate = (Math.abs(target) < Math.abs(this.steerAngle) ? 5 : 3.2) * s.steerLock;
    const ds = target - this.steerAngle;
    this.steerAngle += Math.max(-rate * dt, Math.min(rate * dt, ds));
    const delta = this.steerAngle;
    const cd = Math.cos(delta), sd = Math.sin(delta);

    // ---- Loads -----------------------------------------------------------
    const v2 = vxl * vxl;
    const DF = 0.5 * RHO * s.clA * v2;
    const h = s.cgHeight;
    const Fzf = m * G * s.frontWeight - (m * this.ax * h) / L + DF * s.aeroBalance;
    const Fzr = m * G * (1 - s.frontWeight) + (m * this.ax * h) / L + DF * (1 - s.aeroBalance);
    const latT = (m * this.ay * h) / s.track;
    const rollF = 0.55;
    const loads = [
      Fzf / 2 - latT * rollF,
      Fzf / 2 + latT * rollF,
      Fzr / 2 - latT * (1 - rollF),
      Fzr / 2 + latT * (1 - rollF),
    ];

    // Drive split
    const front = s.drivetrain === "FWD" ? 1 : s.drivetrain === "AWD" ? s.frontSplit : 0;
    const drive = [driveTotal * front / 2, driveTotal * front / 2, driveTotal * (1 - front) / 2, driveTotal * (1 - front) / 2];
    const brakeTotal = s.brakeForce * brake * pre.brake;
    const brakes = [brakeTotal * s.brakeBias / 2, brakeTotal * s.brakeBias / 2, brakeTotal * (1 - s.brakeBias) / 2, brakeTotal * (1 - s.brakeBias) / 2];
    const pos: [number, number][] = [[a, t], [a, -t], [-b, t], [-b, -t]];

    let Fx = 0, Fy = 0, Mz = escMoment;
    this.absActive = false;
    this.tcActive = false;
    let spinSum = 0;
    let slideSum = 0;
    const mw = m / 4;
    const aPeak = Math.tan(Math.PI / (2 * pre.C)) / pre.B;
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      const [px, py] = pos[i];
      const isFront = i < 2;
      // World position & on/off road
      w.wx = this.x + fx * px + lx * py;
      w.wz = this.z + fz * px + lz * py;
      const dW = env.d + (w.wx - this.x) * env.nx + (w.wz - this.z) * env.nz;
      w.offroad = Math.abs(dW) > env.halfWidth + 0.4;
      const Fz = Math.max(0, loads[i]);
      w.load = Fz;
      let mu = s.tireGrip * pre.grip * (w.offroad ? 0.62 : env.grip);
      if (!isFront) mu *= pre.rearGrip;
      const Fmax = mu * Fz;
      // Wheel velocity
      const wvx = vxl - this.r * py;
      const wvy = vyl + this.r * px;
      let vxw = wvx, vyw = wvy;
      if (isFront) {
        vxw = wvx * cd + wvy * sd;
        vyw = -wvx * sd + wvy * cd;
      }
      let fxw = drive[i];
      let bw = brakes[i];
      if (Math.abs(vxw) < 0.6) bw = Math.min(bw, (mw * Math.abs(vxw)) / dt + (throttle > 0 ? 0 : mw * 2));
      let locked = !isFront && c.handbrake && Math.abs(vxw) > 0.5;
      if (bw > 0) {
        if (bw > Fmax * 0.98 && Math.abs(vxw) > 1) {
          if (abs) { bw = Fmax * 0.95; this.absActive = true; }
          else locked = true;
        }
        fxw -= Math.sign(vxw || 1) * bw;
      }
      let spinning = false;
      if (Math.abs(drive[i]) > Fmax * 0.98 && bw === 0) {
        if (tc) { fxw = Math.sign(fxw) * Fmax * 0.94; this.tcActive = true; }
        else { spinning = true; spinSum += Math.abs(drive[i]) / (Fmax + 1) - 1; }
      }
      // Rolling resistance (more off-road)
      const crr = w.offroad ? 0.06 : 0.012;
      const roll = Math.min(crr * Fz, (mw * Math.abs(vxw)) / dt) * Math.sign(vxw);
      let fx_ = 0, fy_ = 0;
      if (locked) {
        const vs = Math.hypot(vxw, vyw) || 1;
        const fs = Fmax * pre.slide;
        fx_ = (-vxw / vs) * fs;
        fy_ = (-vyw / vs) * fs;
        w.slide = Math.min(1, vs / 12);
      } else {
        if (spinning) fxw = Math.sign(fxw) * Fmax * pre.slide * 1.05;
        fx_ = Math.max(-Fmax, Math.min(Fmax, fxw)) - roll;
        const alpha = Math.atan2(vyw, Math.max(Math.abs(vxw), 1.5));
        const mf = Math.sin(pre.C * Math.atan(pre.B * alpha));
        fy_ = -Fmax * mf;
        // Friction ellipse
        const cap = Math.sqrt(Math.max(0, Fmax * Fmax - fx_ * fx_));
        fy_ = Math.max(-cap, Math.min(cap, fy_));
        // Never push more than what stops the lateral motion this step (low-speed stability).
        const stopF = (mw * Math.abs(vyw)) / dt;
        if (Math.abs(fy_) > stopF) fy_ = Math.sign(fy_) * stopF;
        const over = Math.max(0, Math.abs(alpha) - aPeak * 0.9);
        w.slide = Math.min(1, over * Math.min(1, Math.abs(vxw) / 8) * 3 + (spinning ? 0.6 : 0));
      }
      slideSum += w.slide;
      // Wheel rotation for rendering
      const rotSpeed = locked ? 0 : spinning ? vxw / R + Math.sign(fxw) * 25 : vxw / R;
      w.spin += rotSpeed * dt;
      // Back to body frame
      let bx = fx_, by = fy_;
      if (isFront) {
        bx = fx_ * cd - fy_ * sd;
        by = fx_ * sd + fy_ * cd;
      }
      Fx += bx;
      Fy += by;
      Mz += px * by - py * bx;
    }
    this.wheelspin = spinSum;
    this.slideTotal = slideSum / 4;

    // Aero drag
    const Fd = 0.5 * RHO * s.cdA * (vxl * vxl + vyl * vyl);
    if (speed > 0.01) {
      Fx -= (Fd * vxl) / speed;
      Fy -= (Fd * vyl) / speed;
    }
    Mz -= I * this.r * pre.yawDamp * Math.min(1, speed / 10);

    // ---- Integrate -------------------------------------------------------
    const axl = Fx / m, ayl = Fy / m;
    this.vx += (axl * fx + ayl * lx + env.gx) * dt;
    this.vz += (axl * fz + ayl * lz + env.gz) * dt;
    this.r += (Mz / I) * dt;
    if (speed < 2.5 && Math.abs(throttle) < 0.05) this.r *= 1 - Math.min(1, dt * 4);
    // Hold still when braking at rest so gravity on slopes doesn't creep.
    if (speed < 0.25 && throttle < 0.05 && (brake > 0.1 || c.handbrake)) { this.vx = 0; this.vz = 0; this.r *= 0.5; }
    this.yaw += this.r * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    const kk = Math.min(1, dt * 8);
    this.ax += (axl - this.ax) * kk;
    this.ay += (ayl - this.ay) * kk;
    vxl = this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw);
    vyl = this.vx * Math.cos(this.yaw) - this.vz * Math.sin(this.yaw);
    this.vxl = vxl;
    this.vyl = vyl;
    this.throttleOut = throttle;
    this.brakeOut = brake;

    // ---- Auto gearbox ----------------------------------------------------
    if (as.autoGear && this.gear >= 1 && this.shiftTimer <= 0) {
      const curWheelRpm = (Math.abs(vxl) / R) * this.gearRatio() * (60 / (2 * Math.PI));
      if (curWheelRpm > s.redline * 0.965 && this.gear < nG) {
        this.gear++; this.shiftTimer = 0.16; this.lastShift = 1;
      } else if (this.gear > 1) {
        const lower = curWheelRpm * (s.gears[this.gear - 2] / s.gears[this.gear - 1]);
        const downAt = brake > 0.3 ? s.redline * 0.78 : s.redline * 0.6;
        if (lower < downAt && curWheelRpm < s.torqueRpm * 0.95) { this.gear--; this.shiftTimer = 0.1; this.lastShift = -1; }
      }
    }

    // ---- Engine rpm for display / audio -----------------------------------
    const flare = Math.min(1, this.wheelspin) * (s.redline - rpm) * 0.8;
    const targetRpm = Math.min(s.redline + 150, rpm + flare);
    this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * (this.shiftTimer > 0 ? 6 : 14));
    if (this.limiter) this.rpm -= 250 * Math.random();

    // ---- Visual body motion (spring-damper) -------------------------------
    const pitchT = -this.ax * 0.0045;
    const rollT = this.ay * 0.006;
    this.pitchV += ((pitchT - this.pitch) * 90 - this.pitchV * 11) * dt;
    this.rollV += ((rollT - this.roll) * 90 - this.rollV * 11) * dt;
    this.pitch += this.pitchV * dt;
    this.roll += this.rollV * dt;
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i];
      const static_ = (i < 2 ? m * G * s.frontWeight : m * G * (1 - s.frontWeight)) / 2;
      w.compress = Math.max(-0.05, Math.min(0.05, ((w.load - static_) / static_) * 0.03));
    }
  }

  /** Apply an impulse (N·s) at a world-space offset (ox, oz) from the CG. */
  impulse(jx: number, jz: number, ox: number, oz: number) {
    const m = this.spec.mass;
    const I = m * this.spec.wheelbase * this.spec.wheelbase * 0.3;
    this.vx += jx / m;
    this.vz += jz / m;
    this.r += (oz * jx - ox * jz) / I;
  }

  get inertia() {
    return this.spec.mass * this.spec.wheelbase * this.spec.wheelbase * 0.3;
  }
}
