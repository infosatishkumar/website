// Procedural car models. Bodies are lofted from per-car profile curves with
// wheel arches cut into the sills, a glass greenhouse with a painted roof,
// lights, aero parts, detailed wheels and a simple interior. Original designs –
// no logos or real-world model replicas.

import * as THREE from "three";
import type { CarSpec, Customization } from "../shared/cars.ts";
import { carbonFiber, tireSidewall } from "./textures.ts";

export interface CarVisualState {
  steerAngle: number;
  wheelSpin: number[];
  compress: number[];
  pitch: number;
  roll: number;
  braking: boolean;
  reverse: boolean;
  headlights: boolean;
  nitro: boolean;
  indicator: number; // -1 left, 1 right, 2 hazard, 0 off
}

function curve(keys: [number, number][], t: number) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      const u = (t - t0) / (t1 - t0);
      const s = u * u * (3 - 2 * u);
      return v0 + (v1 - v0) * s;
    }
  }
  return keys[keys.length - 1][1];
}

const spow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

export class CarModel {
  root = new THREE.Group();
  body = new THREE.Group();
  detail = new THREE.Group();
  interior = new THREE.Group();
  paint: THREE.MeshPhysicalMaterial;
  rimMat: THREE.MeshStandardMaterial;
  wheelPivots: THREE.Group[] = [];
  wheelSpins: THREE.Group[] = [];
  steeringWheel: THREE.Group;
  bodyMesh!: THREE.Mesh;
  private brakeMat: THREE.MeshStandardMaterial;
  private reverseMat: THREE.MeshStandardMaterial;
  private headMat: THREE.MeshStandardMaterial;
  private indMatL: THREE.MeshStandardMaterial;
  private indMatR: THREE.MeshStandardMaterial;
  private flameMat: THREE.MeshBasicMaterial;
  private flames: THREE.Mesh[] = [];
  private wingGroup = new THREE.Group();
  private kitGroup = new THREE.Group();
  private rimGroups: THREE.Group[] = [];
  private origPositions!: Float32Array;
  spec: CarSpec;
  cust: Customization;
  dashCanvas: HTMLCanvasElement | null = null;
  dashTexture: THREE.CanvasTexture | null = null;
  /** Local positions useful to the game (camera mounts, light anchors). */
  anchors = {
    cockpit: new THREE.Vector3(),
    hood: new THREE.Vector3(),
    bumper: new THREE.Vector3(),
    headL: new THREE.Vector3(),
    headR: new THREE.Vector3(),
    exhaust: [] as THREE.Vector3[],
    rearWheels: [] as THREE.Vector3[],
  };
  readonly zc: number;
  readonly frontZ: number;
  readonly rearZ: number;

  constructor(spec: CarSpec, cust: Customization, opts: { quality: "low" | "medium" | "ultra"; interior?: boolean; traffic?: boolean } = { quality: "medium" }) {
    this.spec = spec;
    this.cust = cust;
    const b = spec.body;
    const L = spec.wheelbase;
    const aF = L * (1 - spec.frontWeight); // CG → front axle
    const bR = L * spec.frontWeight; // CG → rear axle
    this.zc = (aF - bR) / 2 + (spec.cls === "Exotic" || spec.cls === "Tuned" ? 0.06 : -0.08);
    this.frontZ = this.zc + b.length / 2;
    this.rearZ = this.zc - b.length / 2;
    this.root.add(this.body);
    this.body.add(this.detail);
    this.body.add(this.interior);

    this.paint = new THREE.MeshPhysicalMaterial({ color: cust.color });
    this.applyFinish();
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x04070a, metalness: 0.35, roughness: 0.04, transparent: true, opacity: 0.9, clearcoat: 1, clearcoatRoughness: 0.02,
      envMapIntensity: 1.8,
    });
    const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.6, metalness: 0.2 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.35, metalness: 0.6 });
    const carbon = new THREE.MeshPhysicalMaterial({ map: carbonFiber(), roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.12, metalness: 1 });
    this.headMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, emissive: 0xfff4e0, emissiveIntensity: 0.2, roughness: 0.05, metalness: 0.9 });
    const drlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 2.2, roughness: 0.2 });
    this.brakeMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff1010, emissiveIntensity: 0.6, roughness: 0.3 });
    this.reverseMat = new THREE.MeshStandardMaterial({ color: 0x777777, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 });
    this.indMatL = new THREE.MeshStandardMaterial({ color: 0x553300, emissive: 0xff9a00, emissiveIntensity: 0, roughness: 0.3 });
    this.indMatR = this.indMatL.clone();
    this.rimMat = new THREE.MeshStandardMaterial({ color: cust.rimColor, roughness: 0.22, metalness: 1 });
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

    // ---- Body loft ------------------------------------------------------
    const NS = opts.quality === "low" ? 40 : 72;
    const NR = opts.quality === "low" ? 20 : 32;
    const wR = spec.wheelRadius;
    const archR = wR + 0.07;
    const axles = [aF, -bR];
    const hw = (t: number) => (b.width / 2) * curve(b.plan, t);
    const topY = (t: number) => b.height * curve(b.top, t);
    const botY = (t: number) => {
      const z = this.rearZ + t * b.length;
      let y = b.clearance + 0.04 * Math.max(0, Math.abs(t - 0.5) * 2 - 0.7) * 3;
      for (const az of axles) {
        const dz = z - az;
        if (Math.abs(dz) < archR) y = Math.max(y, wR + Math.sqrt(archR * archR - dz * dz) - 0.02);
      }
      return Math.min(y, topY(t) - 0.06);
    };
    const pos: number[] = [];
    const idx: number[] = [];
    const stationT = (i: number) => 0.5 - 0.5 * Math.cos((Math.PI * i) / NS); // denser at the nose and tail
    for (let i = 0; i <= NS; i++) {
      const t = stationT(i);
      const z = this.rearZ + t * b.length;
      const w = hw(t), top = topY(t), bot = botY(t);
      const mid = (top + bot) / 2, hh = (top - bot) / 2;
      for (let j = 0; j <= NR; j++) {
        const phi = -Math.PI / 2 + (j / NR) * Math.PI * 2;
        const c = Math.cos(phi), s = Math.sin(phi);
        const n = s > 0 ? 3 : 9;
        let x = w * spow(c, 2 / n);
        const y = mid + hh * spow(s, 2 / n);
        if (s > 0) x *= 1 - 0.2 * Math.pow(s, 1.6);
        pos.push(x, y, z);
      }
    }
    for (let i = 0; i < NS; i++) {
      for (let j = 0; j < NR; j++) {
        const a = i * (NR + 1) + j, c = a + NR + 1;
        idx.push(a, a + 1, c, a + 1, c + 1, c);
      }
    }
    // End caps
    const capCenter = (i: number) => {
      const t = stationT(i);
      pos.push(0, (topY(t) + botY(t)) / 2, this.rearZ + t * b.length);
      return pos.length / 3 - 1;
    };
    const rc = capCenter(0), fc = capCenter(NS);
    for (let j = 0; j < NR; j++) {
      idx.push(rc, j + 1, j);
      const base = NS * (NR + 1);
      idx.push(fc, base + j, base + j + 1);
    }
    const bodyGeo = new THREE.BufferGeometry();
    bodyGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    bodyGeo.setIndex(idx);
    bodyGeo.computeVertexNormals();
    this.origPositions = new Float32Array(pos);
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.paint);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.body.add(this.bodyMesh);

    // Arch liners
    for (const az of axles) {
      const liner = new THREE.Mesh(
        new THREE.CylinderGeometry(archR, archR, b.width * 0.98, 20, 1, true, Math.PI * 0.5 - 1.3, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, side: THREE.BackSide }),
      );
      liner.rotation.z = Math.PI / 2;
      liner.position.set(0, wR, az);
      this.body.add(liner);
    }

    // ---- Greenhouse -------------------------------------------------------
    const [c0, c1, ch] = b.cabin;
    const CS = opts.quality === "low" ? 16 : 28, CR = 16;
    const cpos: number[] = [];
    const glassIdx: number[] = [], roofIdx: number[] = [];
    const shapeAt = (u: number) => {
      const p = b.cabinPeak;
      return u < p ? Math.pow(Math.sin((Math.PI / 2) * (u / p)), 0.75) : Math.pow(Math.cos((Math.PI / 2) * ((u - p) / (1 - p))), 0.85);
    };
    for (let i = 0; i <= CS; i++) {
      const u = i / CS;
      const t = c0 + (c1 - c0) * u;
      const z = this.rearZ + t * b.length;
      const base = topY(t) - 0.03;
      const hgt = ch * shapeAt(u) + 0.02;
      const wBase = hw(t) * 0.84;
      const wTop = hw(t) * 0.6;
      for (let j = 0; j <= CR; j++) {
        const a = (j / CR) * Math.PI; // 0 → left side (+x), π → right side, over the top
        const c = Math.cos(a), s = Math.sin(a);
        const wy = Math.pow(s, 0.6);
        const x = c * (wBase + (wTop - wBase) * wy);
        cpos.push(x, base + hgt * wy, z);
      }
    }
    for (let i = 0; i < CS; i++) {
      const u = (i + 0.5) / CS;
      for (let j = 0; j < CR; j++) {
        const a = i * (CR + 1) + j, c = a + CR + 1;
        const ja = (j + 0.5) / CR;
        const isRoof = shapeAt(u) > 0.82 && ja > 0.22 && ja < 0.78;
        (isRoof ? roofIdx : glassIdx).push(a, a + 1, c, a + 1, c + 1, c);
      }
    }
    const cabGeo = new THREE.BufferGeometry();
    cabGeo.setAttribute("position", new THREE.Float32BufferAttribute(cpos, 3));
    cabGeo.setIndex([...glassIdx, ...roofIdx]);
    cabGeo.addGroup(0, glassIdx.length, 0);
    cabGeo.addGroup(glassIdx.length, roofIdx.length, 1);
    cabGeo.computeVertexNormals();
    const cabin = new THREE.Mesh(cabGeo, [glass, this.paint]);
    cabin.castShadow = true;
    this.body.add(cabin);
    // Pillars: thin painted strips at the A-pillars
    const tA = c0 + (c1 - c0) * b.cabinPeak * 0.6;

    const at = (t: number) => this.rearZ + t * b.length;
    const frontT = 0.985, rearT = 0.015;

    // ---- Lights -----------------------------------------------------------
    for (const side of [1, -1]) {
      const slope = Math.atan2(topY(0.9) - topY(0.98), at(0.98) - at(0.9));
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.26), this.headMat);
      hl.position.set(side * hw(0.95) * 0.6, topY(0.945) - 0.005, at(0.945));
      hl.rotation.set(slope, side * 0.28, 0, "YXZ");
      this.body.add(hl);
      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.04), drlMat);
      drl.position.set(side * hw(0.97) * 0.66, (topY(0.97) + b.clearance) * 0.5 + 0.05, at(0.985));
      drl.rotation.y = side * 0.35;
      this.detail.add(drl);
      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.06), side > 0 ? this.indMatL : this.indMatR);
      ind.position.set(side * hw(0.93) * 0.88, topY(0.93) - 0.06, at(0.93));
      this.detail.add(ind);
      const rind = ind.clone();
      rind.position.set(side * hw(0.03) * 0.86, topY(0.02) * 0.82, at(rearT) - 0.01);
      this.detail.add(rind);
      const rev = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.03), this.reverseMat);
      rev.position.set(side * hw(0.03) * 0.3, topY(0.02) * 0.62, at(rearT) - 0.01);
      this.detail.add(rev);
      this.anchors[side > 0 ? "headL" : "headR"].set(side * hw(0.95) * 0.6, topY(0.945), at(0.99));
    }
    // Full-width tail light strip
    const tail = new THREE.Mesh(new THREE.BoxGeometry(hw(0.03) * 1.9, 0.05, 0.04), this.brakeMat);
    tail.position.set(0, topY(0.02) * 0.84, at(rearT) - 0.005);
    this.body.add(tail);
    for (const side of [1, -1]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.05), this.brakeMat);
      tl.position.set(side * hw(0.03) * 0.72, topY(0.02) * 0.78, at(rearT));
      this.body.add(tl);
    }

    // ---- Intakes, diffuser, exhausts, mirrors ------------------------------
    const grille = new THREE.Mesh(new THREE.BoxGeometry(hw(1) * 1.2, 0.16, 0.06), black);
    grille.position.set(0, b.clearance + 0.14, at(frontT) - 0.01);
    this.body.add(grille);
    for (const side of [1, -1]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.05), black);
      vent.position.set(side * hw(0.97) * 0.62, b.clearance + 0.16, at(0.975));
      vent.rotation.y = side * 0.3;
      this.detail.add(vent);
      if (spec.cls !== "Exotic" && spec.cls !== "Tuned") {
        const side_ = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 10), black);
        side_.scale.set(0.1, 0.5, 1.2);
        side_.position.set(side * hw(0.36) * 0.955, topY(0.36) * 0.58, at(0.36));
        this.detail.add(side_);
      }
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.12), this.paint);
      mirror.position.set(side * (hw(tA) * 0.9 + 0.08), topY(tA) + 0.08, at(tA) - 0.05);
      this.detail.add(mirror);
      const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.04), trim);
      stalk.position.set(side * (hw(tA) * 0.86), topY(tA) + 0.06, at(tA) - 0.05);
      this.detail.add(stalk);
    }
    const diff = new THREE.Mesh(new THREE.BoxGeometry(hw(0.02) * 1.6, 0.14, 0.32), black);
    diff.position.set(0, b.clearance + 0.07, at(0.04));
    this.body.add(diff);
    for (let k = -2; k <= 2; k++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.14, 0.34), trim);
      fin.position.set(k * 0.2, b.clearance + 0.07, at(0.04));
      this.detail.add(fin);
    }
    const exCount = spec.sound.cylinders >= 8 ? 4 : 2;
    for (let k = 0; k < exCount; k++) {
      const x = exCount === 4 ? [-0.62, -0.48, 0.48, 0.62][k] : [-0.18, 0.18][k] * (spec.cls === "Track" ? 0.5 : 2.8);
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.18, 14, 1, true), chrome);
      ex.rotation.x = Math.PI / 2;
      ex.position.set(x, b.clearance + 0.13, at(0.01) - 0.02);
      this.detail.add(ex);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), black);
      inner.position.set(x, b.clearance + 0.13, at(0.01) - 0.06);
      inner.rotation.y = Math.PI;
      this.detail.add(inner);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 10, 1, true), this.flameMat);
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(x, b.clearance + 0.13, at(0.01) - 0.33);
      this.body.add(flame);
      this.flames.push(flame);
      this.anchors.exhaust.push(new THREE.Vector3(x, b.clearance + 0.13, at(0.01) - 0.1));
    }

    // ---- Aero: wing + kit -------------------------------------------------
    this.body.add(this.wingGroup);
    this.body.add(this.kitGroup);
    this.buildWing(carbon, trim);
    this.buildKit(carbon);

    // ---- Wheels -------------------------------------------------------------
    const tireProfile: THREE.Vector2[] = [];
    const tw = spec.cls === "Hypercar" || spec.cls === "Track" ? 0.3 : 0.26;
    const rimR = wR * 0.66;
    const prof = [[rimR, -tw / 2], [wR - 0.03, -tw / 2], [wR, -tw / 2 + 0.04], [wR, tw / 2 - 0.04], [wR - 0.03, tw / 2], [rimR, tw / 2]];
    for (const [r, y] of prof) tireProfile.push(new THREE.Vector2(r, y));
    const tireGeo = new THREE.LatheGeometry(tireProfile, opts.quality === "low" ? 18 : 36);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92, metalness: 0, map: tireSidewall() });
    const discMat = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.45, metalness: 0.9 });
    const caliperMat = new THREE.MeshStandardMaterial({ color: spec.cls === "Hypercar" || spec.cls === "Track" ? 0xffcc00 : 0xc8102e, roughness: 0.4, metalness: 0.3 });
    const wheelPos: [number, number][] = [[aF, 1], [aF, -1], [-bR, 1], [-bR, -1]];
    wheelPos.forEach(([z, side], i) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (spec.track / 2), wR, z);
      const spin = new THREE.Group();
      pivot.add(spin);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      spin.add(tire);
      // Rim barrel
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, tw * 0.9, 24, 1, true), this.rimMat);
      barrel.rotation.z = Math.PI / 2;
      spin.add(barrel);
      const rimG = new THREE.Group();
      rimG.position.x = side * tw * 0.36;
      spin.add(rimG);
      this.rimGroups.push(rimG);
      // Brake disc and caliper (do not spin)
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.82, rimR * 0.82, 0.03, 24), discMat);
      disc.rotation.z = Math.PI / 2;
      disc.position.x = side * 0.02;
      pivot.add(disc);
      const cal = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.1), caliperMat);
      cal.position.set(side * 0.04, rimR * 0.55, i < 2 ? -0.1 : 0.1);
      pivot.add(cal);
      // Wheels live on the root so body pitch/roll doesn't move them.
      this.root.add(pivot);
      this.wheelPivots.push(pivot);
      this.wheelSpins.push(spin);
      if (i >= 2) this.anchors.rearWheels.push(new THREE.Vector3(side * (spec.track / 2), 0, z));
    });
    this.buildRims();

    // ---- Interior -------------------------------------------------------------
    const leather = new THREE.MeshStandardMaterial({ color: 0x1b1612, roughness: 0.7 });
    const seatT = c0 + (c1 - c0) * 0.42;
    const floorY = b.clearance + 0.12;
    const dashT = c0 + (c1 - c0) * 0.82;
    const deckAt = (t: number) => topY(t);
    for (const side of [1, -1]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.46), leather);
      seat.position.set(side * 0.36, floorY + 0.08, at(seatT));
      this.interior.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.09), leather);
      back.position.set(side * 0.36, Math.min(floorY + 0.38, deckAt(seatT) + 0.02), at(seatT) - 0.25);
      back.rotation.x = -0.22;
      this.interior.add(back);
    }
    const dash = new THREE.Mesh(new THREE.BoxGeometry(hw(dashT) * 1.45, 0.12, 0.34), leather);
    dash.position.set(0, deckAt(dashT) - 0.04, at(dashT) - 0.05);
    this.interior.add(dash);
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.8), trim);
    console_.position.set(0, floorY + 0.08, at(seatT) + 0.2);
    this.interior.add(console_);
    // Steering wheel (driver on the left: +x)
    this.steeringWheel = new THREE.Group();
    const swRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 10, 28), leather);
    const swHub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.05, 12), carbon);
    swHub.rotation.x = Math.PI / 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.02), carbon);
    this.steeringWheel.add(swRing, swHub, spoke);
    const swZ = at(dashT) - 0.32;
    this.steeringWheel.position.set(0.36, deckAt(dashT) - 0.1, swZ);
    this.steeringWheel.rotation.x = -0.35;
    this.interior.add(this.steeringWheel);
    this.anchors.cockpit.set(0.36, topY(seatT) + ch * 0.62, at(seatT) - 0.02);
    this.anchors.hood.set(0, topY(c1) + 0.12, at(c1) - 0.15);
    this.anchors.bumper.set(0, b.clearance + 0.3, at(0.99) + 0.05);
    if (opts.interior !== false && typeof document !== "undefined") {
      this.dashCanvas = document.createElement("canvas");
      this.dashCanvas.width = 256;
      this.dashCanvas.height = 96;
      this.dashTexture = new THREE.CanvasTexture(this.dashCanvas);
      this.dashTexture.colorSpace = THREE.SRGBColorSpace;
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.34, 0.13),
        new THREE.MeshBasicMaterial({ map: this.dashTexture, toneMapped: false }),
      );
      screen.position.set(0.36, deckAt(dashT) + 0.02, at(dashT) - 0.2);
      screen.rotation.set(-0.5, 0, 0);
      // Plane faces +z by default; the driver looks forward (+z), so flip it to face back.
      screen.rotation.y = Math.PI;
      screen.rotation.x = 0.5;
      this.interior.add(screen);
    }

    // ---- Contact shadow (cheap AO under the car) -------------------------
    const shCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (shCanvas) {
      shCanvas.width = shCanvas.height = 64;
      const ctx = shCanvas.getContext("2d")!;
      const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
      g.addColorStop(0, "rgba(0,0,0,0.75)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(shCanvas);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(b.width * 1.25, b.length * 1.15),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(0, 0.02, this.zc);
      shadow.renderOrder = 1;
      this.root.add(shadow);
    }

    if (opts.traffic) this.interior.visible = false;
  }

  applyFinish() {
    const p = this.paint;
    p.color.set(this.cust.color);
    p.iridescence = 0;
    switch (this.cust.finish) {
      case "gloss": p.metalness = 0.05; p.roughness = 0.22; p.clearcoat = 1; p.clearcoatRoughness = 0.02; break;
      case "matte": p.metalness = 0.15; p.roughness = 0.62; p.clearcoat = 0; p.clearcoatRoughness = 0.5; break;
      case "pearl": p.metalness = 0.4; p.roughness = 0.26; p.clearcoat = 1; p.clearcoatRoughness = 0.03; p.iridescence = 0.8; p.iridescenceIOR = 1.6; break;
      default: p.metalness = 0.35; p.roughness = 0.3; p.clearcoat = 1; p.clearcoatRoughness = 0.03;
    }
    p.envMapIntensity = 1.0;
    p.needsUpdate = true;
  }

  setCustomization(c: Customization) {
    const rebuildWing = c.wing !== this.cust.wing;
    const rebuildKit = c.kit !== this.cust.kit;
    const rebuildRim = c.rim !== this.cust.rim;
    this.cust = { ...c };
    this.applyFinish();
    this.rimMat.color.set(c.rimColor);
    const carbon = new THREE.MeshPhysicalMaterial({ map: carbonFiber(), roughness: 0.35, metalness: 0.3, clearcoat: 1 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.35, metalness: 0.6 });
    if (rebuildWing) this.buildWing(carbon, trim);
    if (rebuildKit) this.buildKit(carbon);
    if (rebuildRim) this.buildRims();
  }

  private clearGroup(g: THREE.Group) {
    for (const ch of [...g.children]) {
      g.remove(ch);
      ch.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); });
    }
  }

  private buildWing(carbon: THREE.Material, trim: THREE.Material) {
    this.clearGroup(this.wingGroup);
    const b = this.spec.body;
    const lvl = this.cust.wing >= 0 ? this.cust.wing : b.wing;
    if (lvl <= 0) return;
    const at = (t: number) => this.rearZ + t * b.length;
    const topAt = (t: number) => b.height * curve(b.top, t);
    const width = b.width * curve(b.plan, 0.06);
    if (lvl === 1) {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.92, 0.04, 0.16), this.paint);
      lip.position.set(0, topAt(0.03) + 0.02, at(0.035));
      lip.rotation.x = 0.25;
      this.wingGroup.add(lip);
      return;
    }
    const big = lvl >= 3;
    const h = big ? 0.42 : 0.24;
    const span = width * (big ? 1.0 : 0.86);
    const chord = big ? 0.34 : 0.26;
    const z = at(big ? 0.05 : 0.07);
    const y = topAt(0.06) + h;
    const shape = new THREE.Shape();
    shape.moveTo(-chord / 2, 0);
    shape.quadraticCurveTo(-chord * 0.2, 0.05, chord / 2, 0.012);
    shape.quadraticCurveTo(0, -0.012, -chord / 2, 0);
    const wingGeo = new THREE.ExtrudeGeometry(shape, { depth: span, bevelEnabled: false, steps: 1 });
    wingGeo.translate(0, 0, -span / 2);
    const wing = new THREE.Mesh(wingGeo, carbon);
    wing.rotation.y = Math.PI / 2;
    wing.rotation.z = big ? 0.12 : 0.08;
    wing.position.set(0, y, z);
    wing.castShadow = true;
    this.wingGroup.add(wing);
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, 0.1), trim);
      post.position.set(side * span * 0.28, y - h / 2, z);
      this.wingGroup.add(post);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.015, big ? 0.22 : 0.14, chord * 1.2), carbon);
      plate.position.set(side * span / 2, y + 0.01, z);
      this.wingGroup.add(plate);
    }
  }

  private buildKit(carbon: THREE.Material) {
    this.clearGroup(this.kitGroup);
    if (!this.cust.kit) return;
    const b = this.spec.body;
    const at = (t: number) => this.rearZ + t * b.length;
    const w = b.width * curve(b.plan, 0.97);
    const split = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.025, 0.32), carbon);
    split.position.set(0, b.clearance - 0.01, at(0.97));
    this.kitGroup.add(split);
    for (const side of [1, -1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, this.spec.wheelbase * 0.62), carbon);
      skirt.position.set(side * b.width * 0.5, b.clearance + 0.02, (this.spec.wheelbase * (1 - this.spec.frontWeight) - this.spec.wheelbase * this.spec.frontWeight) / 2);
      this.kitGroup.add(skirt);
      const canard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.12), carbon);
      canard.position.set(side * w * 0.47, b.clearance + 0.2, at(0.965));
      canard.rotation.z = side * 0.25;
      this.kitGroup.add(canard);
    }
  }

  private buildRims() {
    const R = this.spec.wheelRadius * 0.64;
    const style = this.cust.rim;
    for (const g of this.rimGroups) {
      this.clearGroup(g);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), this.rimMat);
      hub.rotation.z = Math.PI / 2;
      g.add(hub);
      const count = style === 0 ? 5 : style === 1 ? 10 : 6;
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2;
        const make = (len: number, width: number, angle: number, off = 0) => {
          const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, width, len), this.rimMat);
          const mid = off + len / 2;
          sp.position.set(0, Math.sin(angle) * mid, Math.cos(angle) * mid);
          sp.rotation.x = -angle;
          g.add(sp);
        };
        if (style === 0) make(R - 0.04, 0.07, a, 0.04);
        else if (style === 1) make(R - 0.04, 0.03, a, 0.04);
        else {
          make(R * 0.45, 0.05, a, 0.04);
          make(R * 0.55, 0.035, a + 0.18, R * 0.42);
          make(R * 0.55, 0.035, a - 0.18, R * 0.42);
        }
      }
    }
  }

  /** Dent the body around a local-space point. */
  deform(lx: number, ly: number, lz: number, strength: number) {
    const geo = this.bodyMesh.geometry as THREE.BufferGeometry;
    const p = geo.attributes.position as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    const r = 0.7;
    // Push vertices toward the car's centreline.
    for (let i = 0; i < arr.length; i += 3) {
      const dx = arr[i] - lx, dy = arr[i + 1] - ly, dz = arr[i + 2] - lz;
      const d = Math.hypot(dx, dy, dz);
      if (d > r) continue;
      const f = (1 - d / r) ** 2 * strength;
      const ox = this.origPositions[i], oz = this.origPositions[i + 2];
      arr[i] -= Math.sign(arr[i]) * f * 0.5;
      arr[i + 1] -= f * 0.15;
      arr[i + 2] -= Math.sign(arr[i + 2] - this.zc) * f * (Math.abs(lz - this.zc) > this.spec.body.length * 0.3 ? 1 : 0.2);
      // Never cave in more than 18 cm from the original shape.
      arr[i] = ox + Math.max(-0.18, Math.min(0.18, arr[i] - ox));
      arr[i + 2] = oz + Math.max(-0.18, Math.min(0.18, arr[i + 2] - oz));
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  }

  repair() {
    const geo = this.bodyMesh.geometry as THREE.BufferGeometry;
    (geo.attributes.position.array as Float32Array).set(this.origPositions);
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  update(s: CarVisualState, time: number) {
    for (let i = 0; i < 4; i++) {
      const pivot = this.wheelPivots[i];
      pivot.rotation.y = i < 2 ? s.steerAngle : 0;
      pivot.position.y = this.spec.wheelRadius + s.compress[i] * 0.4;
      this.wheelSpins[i].rotation.x = s.wheelSpin[i];
    }
    this.body.rotation.x = -s.pitch;
    this.body.rotation.z = s.roll;
    this.body.position.y = -(s.compress[0] + s.compress[1] + s.compress[2] + s.compress[3]) * 0.12;
    this.steeringWheel.rotation.z = s.steerAngle * 9;
    this.brakeMat.emissiveIntensity = s.braking ? 3.2 : s.headlights ? 1.1 : 0.45;
    this.reverseMat.emissiveIntensity = s.reverse ? 2.5 : 0;
    this.headMat.emissiveIntensity = s.headlights ? 6 : 0.15;
    const blink = Math.floor(time * 2.6) % 2 === 0;
    this.indMatL.emissiveIntensity = blink && (s.indicator === -1 || s.indicator === 2) ? 4 : 0;
    this.indMatR.emissiveIntensity = blink && (s.indicator === 1 || s.indicator === 2) ? 4 : 0;
    const f = s.nitro ? 0.55 + Math.random() * 0.35 : 0;
    this.flameMat.opacity = f;
    for (const fl of this.flames) fl.scale.set(1, 0.7 + Math.random() * 0.6, 1);
  }

  /** Paint the cockpit display. */
  drawDash(kmh: number, rpm: number, redline: number, gear: string) {
    if (!this.dashCanvas || !this.dashTexture) return;
    const ctx = this.dashCanvas.getContext("2d")!;
    const W = 256, H = 96;
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, W, H);
    const frac = Math.min(1, rpm / redline);
    for (let k = 0; k < 30; k++) {
      const on = k / 30 < frac;
      ctx.fillStyle = on ? (k > 24 ? "#ff3344" : k > 19 ? "#ffcc33" : "#33e0ff") : "#16202a";
      ctx.fillRect(10 + k * 7.8, 8, 6, 14);
    }
    ctx.fillStyle = "#e8f6ff";
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(Math.round(Math.abs(kmh))), 14, 74);
    ctx.font = "14px Arial, sans-serif";
    ctx.fillStyle = "#7d93a6";
    ctx.fillText("KM/H", 16, 90);
    ctx.font = "bold 52px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffcc33";
    ctx.fillText(gear, 240, 78);
    this.dashTexture.needsUpdate = true;
  }

  setDetail(visible: boolean) {
    this.detail.visible = visible;
    this.interior.visible = visible && this.interior.userData.allowed !== false;
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.paint.dispose();
    this.dashTexture?.dispose();
  }
}
