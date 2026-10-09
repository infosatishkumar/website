// Studio scene for the main menu (slowly rotating hero car) and the garage
// (orbit-camera inspection while customising).

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CarModel } from "./carModel.ts";
import type { CarSpec, Customization } from "../shared/cars.ts";
import type { Quality } from "./settings.ts";

export class Showroom {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  car: CarModel | null = null;
  turntable = new THREE.Group();
  controls: OrbitControls | null = null;
  mode: "menu" | "garage" = "menu";
  private env: THREE.Texture;
  private time = 0;
  private quality: Quality;
  private spinSpeed = 0.18;

  constructor(renderer: THREE.WebGLRenderer, quality: Quality) {
    this.quality = quality;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    pmrem.dispose();
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.55;
    this.scene.background = new THREE.Color(0x07080a);
    this.scene.fog = new THREE.Fog(0x07080a, 14, 40);
    // Glossy floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(30, 64),
      new THREE.MeshPhysicalMaterial({ color: 0x0c0d10, roughness: 0.22, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.15 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    // Turntable disc with light ring
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.08, 96), new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.35, metalness: 0.7 }));
    disc.position.y = 0.04;
    disc.receiveShadow = true;
    this.turntable.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.66, 0.02, 8, 128), new THREE.MeshBasicMaterial({ color: 0xff5a36, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.085;
    this.turntable.add(ring);
    this.scene.add(this.turntable);
    // Lights: key, rim, top softbox strips
    const key = new THREE.SpotLight(0xffffff, 260, 30, 0.55, 0.6, 1.6);
    key.position.set(6, 9, 6);
    key.castShadow = quality !== "low";
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0002;
    this.scene.add(key);
    const rim = new THREE.SpotLight(0x9fc8ff, 160, 30, 0.6, 0.7, 1.6);
    rim.position.set(-7, 5, -6);
    this.scene.add(rim);
    const warm = new THREE.SpotLight(0xff8a5c, 90, 30, 0.7, 0.8, 1.6);
    warm.position.set(-6, 3, 7);
    this.scene.add(warm);
    for (let k = -1; k <= 1; k++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.25), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
      strip.position.set(0, 7, k * 1.4);
      strip.rotation.x = Math.PI / 2;
      this.scene.add(strip);
    }
    this.scene.add(new THREE.HemisphereLight(0x8090a0, 0x101010, 0.35));
    this.camera.position.set(6.2, 2.0, 6.8);
    this.camera.lookAt(0, 0.55, 0);
  }

  setCar(spec: CarSpec, cust: Customization) {
    if (this.car && this.car.spec.id === spec.id) {
      this.car.setCustomization(cust);
      return;
    }
    if (this.car) {
      this.turntable.remove(this.car.root);
      this.car.dispose();
    }
    this.car = new CarModel(spec, cust, { quality: this.quality });
    this.car.root.position.z = -this.car.zc;
    this.car.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.car.update({ steerAngle: 0.25, wheelSpin: [0, 0, 0, 0], compress: [0, 0, 0, 0], pitch: 0, roll: 0, braking: false, reverse: false, headlights: true, nitro: false, indicator: 0 }, 0);
    this.turntable.add(this.car.root);
  }

  setCustomization(c: Customization) {
    this.car?.setCustomization(c);
  }

  enterGarage(dom: HTMLElement) {
    this.mode = "garage";
    if (!this.controls) {
      this.controls = new OrbitControls(this.camera, dom);
      this.controls.enableDamping = true;
      this.controls.minDistance = 3.2;
      this.controls.maxDistance = 12;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
      this.controls.target.set(0, 0.55, 0);
      this.controls.enablePan = false;
    }
    this.controls.enabled = true;
    this.applyOffset();
  }

  exitGarage() {
    this.mode = "menu";
    if (this.controls) this.controls.enabled = false;
    this.applyOffset();
  }

  /** Move the camera to a preset view in the garage (front, side, rear, interior, wheel). */
  view(name: "front" | "side" | "rear" | "top" | "wheel") {
    const p: Record<string, [number, number, number]> = {
      front: [2.2, 1.4, 7.6], side: [8.6, 1.3, 0.3], rear: [-2.0, 1.7, -7.8], top: [0.1, 9.5, 0.8], wheel: [3.0, 0.7, 2.8],
    };
    this.camera.position.set(...p[name]);
    this.controls?.update();
  }

  private size = { w: 1, h: 1 };

  resize(w: number, h: number) {
    this.size = { w, h };
    this.camera.aspect = w / Math.max(1, h);
    this.applyOffset();
  }

  /** In the garage the side panel covers the right of the screen, so shift the car left. */
  private applyOffset() {
    const { w, h } = this.size;
    if (this.mode === "garage" && w > 760) this.camera.setViewOffset(w, h, w * 0.17, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  update(dt: number) {
    this.time += dt;
    if (this.mode === "menu") {
      this.turntable.rotation.y += dt * this.spinSpeed;
      const t = this.time * 0.08;
      this.camera.position.set(Math.sin(t) * 0.6 + 6.0, 1.9 + Math.sin(t * 1.3) * 0.15, 6.8);
      this.camera.lookAt(0, 0.55, 0);
    } else {
      this.controls?.update();
    }
    if (this.car) this.car.update({ steerAngle: 0.25, wheelSpin: [0, 0, 0, 0], compress: [0, 0, 0, 0], pitch: 0, roll: 0, braking: false, reverse: false, headlights: true, nitro: false, indicator: 0 }, this.time);
  }

  dispose() {
    this.controls?.dispose();
    this.car?.dispose();
    this.env.dispose();
  }
}
