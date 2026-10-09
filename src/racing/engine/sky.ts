// Time of day, weather, sky dome (Preetham scattering + procedural clouds),
// stars and moon, sun/moon lighting with a camera-following shadow frustum,
// fog and the reflection environment map.

import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import type { Environment, Weather } from "../shared/tracks.ts";
import { radialSprite } from "./textures.ts";
import type { Quality } from "./settings.ts";

export const TIME_HOURS = { day: 13.2, sunset: 18.55, night: 23 };

export class SkySystem {
  sky = new Sky();
  sun = new THREE.DirectionalLight(0xffffff, 3);
  hemi = new THREE.HemisphereLight(0xbfd6ff, 0x4a4030, 0.8);
  sunDir = new THREE.Vector3(0, 1, 0);
  /** Direction towards the active light (sun by day, moon by night). */
  lightDir = new THREE.Vector3(0, 1, 0);
  hours = 13;
  weather: Weather = "dry";
  night = false;
  /** 0 (full night) .. 1 (full day). */
  daylight = 1;
  private stars: THREE.Points;
  private moon: THREE.Sprite;
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private envScene = new THREE.Scene();
  private envSky = new Sky();
  private envLights = new THREE.Group();
  private flash = 0;
  sunBase = 3;
  hemiBase = 0.8;
  private nextLightning = 8;
  get flashing() {
    return this.flash > 0;
  }
  onThunder: ((delay: number) => void) | null = null;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private env: Environment;
  private quality: Quality;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, env: Environment, quality: Quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.env = env;
    this.quality = quality;
    this.sky.scale.setScalar(5600);
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    scene.add(this.hemi);
    scene.add(this.sun);
    scene.add(this.sun.target);
    if (quality !== "low") {
      this.sun.castShadow = true;
      const size = quality === "ultra" ? 4096 : 2048;
      this.sun.shadow.mapSize.set(size, size);
      const ext = quality === "ultra" ? 75 : 55;
      const cam = this.sun.shadow.camera;
      cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext;
      cam.near = 10; cam.far = 600;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.03;
    }
    // Stars
    const n = 1800;
    const sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random(), v = Math.random() * 0.95 + 0.05;
      const th = u * Math.PI * 2, el = Math.asin(v);
      sp[i * 3] = Math.cos(el) * Math.cos(th) * 2500;
      sp[i * 3 + 1] = Math.sin(el) * 2500;
      sp[i * 3 + 2] = Math.cos(el) * Math.sin(th) * 2500;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite("moon", "rgba(240,244,255,1)", "rgba(160,180,255,0)", 128), fog: false, depthWrite: false }));
    this.moon.scale.setScalar(260);
    scene.add(this.moon);
    // Environment map scene
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envSky.scale.setScalar(1000);
    this.envScene.add(this.envSky);
    this.envScene.add(this.envLights);
  }

  setConditions(hours: number, weather: Weather, regenerateEnv = true) {
    this.hours = ((hours % 24) + 24) % 24;
    this.weather = weather;
    const rain = weather === "rain";
    // Sun path: rises 6:00, sets 19:00.
    const dayFrac = (this.hours - 6) / 13;
    const elev = Math.sin(Math.PI * dayFrac) * 62 * (Math.PI / 180);
    const az = Math.PI * 0.35 + dayFrac * Math.PI * 0.9;
    this.sunDir.setFromSphericalCoords(1, Math.PI / 2 - elev, az);
    const sunUp = Math.max(-1, Math.min(1, elev / (8 * Math.PI / 180)));
    this.daylight = THREE.MathUtils.clamp(sunUp * 0.5 + 0.5, 0, 1) ** 1.2;
    this.night = this.daylight < 0.35;
    const golden = THREE.MathUtils.clamp(1 - elev / (18 * Math.PI / 180), 0, 1) * (elev > -0.05 ? 1 : 0);
    for (const s of [this.sky, this.envSky]) {
      const u = s.material.uniforms;
      u.sunPosition.value.copy(this.sunDir);
      u.turbidity.value = rain ? 12 : this.env === "desert" ? 6 : 3 + golden * 4;
      u.rayleigh.value = rain ? 0.6 : this.night ? 0.4 : 1.2 + golden * 1.6;
      u.mieCoefficient.value = rain ? 0.012 : 0.005;
      u.mieDirectionalG.value = 0.82;
      u.cloudCoverage.value = rain ? 0.92 : this.env === "desert" ? 0.15 : 0.42;
      u.cloudDensity.value = rain ? 0.85 : 0.45;
      u.cloudElevation.value = 0.5;
    }
    // Lights
    const sunColor = new THREE.Color().setHSL(0.09 + 0.04 * (1 - golden), 0.9 * golden + 0.1, 0.5 + 0.45 * (1 - golden));
    const dayI = (rain ? 1.1 : 3.4) * THREE.MathUtils.clamp(sunUp, 0, 1);
    if (this.night) {
      // Moonlight
      const moonDir = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - 0.6, az + Math.PI);
      this.sun.color.set(0x9db4ff);
      this.sun.intensity = rain ? 0.12 : 0.32;
      this.lightDir.copy(moonDir);
      this.moon.visible = !rain;
      this.moon.position.copy(moonDir).multiplyScalar(2300);
    } else {
      this.sun.color.copy(sunColor);
      this.sun.intensity = Math.max(0.15, dayI);
      this.lightDir.copy(this.sunDir);
      this.moon.visible = false;
    }
    this.hemi.color.set(this.night ? (this.env === "city" ? 0x4a4f80 : 0x2a3550) : rain ? 0x9aa6b4 : 0xbfd6ff);
    this.hemi.groundColor.set(this.night ? 0x0b0b10 : this.env === "desert" ? 0x8a7050 : 0x3c3a30);
    this.hemi.intensity = this.night ? (this.env === "city" ? 0.95 : 0.4) : rain ? 0.9 : 0.55 + golden * 0.15;
    this.sunBase = this.sun.intensity;
    this.hemiBase = this.hemi.intensity;
    (this.stars.material as THREE.PointsMaterial).opacity = this.night && !rain ? 0.9 : 0;
    this.stars.visible = this.night && !rain;
    // Fog
    let fogColor: THREE.Color;
    if (this.night) fogColor = new THREE.Color(this.env === "city" ? 0x141222 : 0x070a12);
    else if (rain) fogColor = new THREE.Color(0x7d858d);
    else if (golden > 0.6) fogColor = new THREE.Color(0xd8a780);
    else if (this.env === "desert") fogColor = new THREE.Color(0xd9c7a8);
    else fogColor = new THREE.Color(0xb7c8d8);
    const base = this.quality === "low" ? 0.0016 : 0.0009;
    const density = rain ? base * 2.6 : this.night ? base * 1.4 : this.env === "desert" ? base * 0.8 : base;
    this.scene.fog = new THREE.FogExp2(fogColor, density);
    this.renderer.toneMappingExposure = this.night ? 1.3 : rain ? 0.85 : (this.env === "desert" ? 0.58 : 0.66) + golden * 0.14;
    if (regenerateEnv) this.updateEnvMap();
  }

  /** Re-render the reflection probe from the current sky (plus artificial lights at night). */
  updateEnvMap() {
    this.envSky.material.uniforms.showSunDisc.value = 0;
    this.envLights.clear();
    if (this.night) {
      // Give paint something to reflect at night: city glow or floodlights.
      const colors = this.env === "city" ? [0xff3fa4, 0x29d3ff, 0xffb347, 0x8a5cff, 0xffffff] : [0xfff2d0, 0xfff2d0, 0xdfe8ff];
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(90 + Math.random() * 120, 30 + Math.random() * 60),
          new THREE.MeshBasicMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide }),
        );
        (m.material as THREE.MeshBasicMaterial).color.multiplyScalar(this.env === "city" ? 0.9 : 0.6);
        m.position.set(Math.cos(a) * 400, 20 + Math.random() * 60, Math.sin(a) * 400);
        m.lookAt(0, 30, 0);
        this.envLights.add(m);
      }
      const ground = new THREE.Mesh(new THREE.CircleGeometry(800, 16), new THREE.MeshBasicMaterial({ color: 0x0a0a10 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -20;
      this.envLights.add(ground);
    } else {
      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(800, 16),
        new THREE.MeshBasicMaterial({ color: this.env === "desert" ? 0x9c8460 : this.weather === "rain" ? 0x2a2c2e : 0x3d4436 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -10;
      this.envLights.add(ground);
    }
    const rt = this.pmrem.fromScene(this.envScene, 0.02);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = this.night ? 1 : this.weather === "rain" ? 0.85 : 0.8;
  }

  update(dt: number, time: number, camPos: THREE.Vector3, focus: THREE.Vector3) {
    this.sky.position.copy(camPos);
    this.stars.position.copy(camPos);
    this.sky.material.uniforms.time.value = time;
    this.sky.material.uniforms.showSunDisc.value = this.weather === "rain" ? 0 : 1;
    // Keep the shadow frustum centred on the action.
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.lightDir, 250);
    // Lightning in storms
    if (this.weather === "rain") {
      this.nextLightning -= dt;
      if (this.nextLightning < 0) {
        this.nextLightning = 10 + Math.random() * 25;
        this.flash = 1;
        this.onThunder?.(0.6 + Math.random() * 2.5);
      }
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 3.5);
      const flick = this.flash > 0.4 && Math.random() > 0.4 ? 1 : 0.3;
      this.hemi.intensity = this.hemiBase + this.flash * 3 * flick;
    }
  }

  dispose() {
    this.envRT?.dispose();
    this.pmrem.dispose();
  }
}
