// One WebGL renderer shared by the menus and the race. Applies the quality
// preset (pixel ratio cap, shadows, post-processing), runs adaptive
// resolution, and tracks FPS.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { Quality } from "./settings.ts";

const HazeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, time: { value: 0 }, amount: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float amount; varying vec2 vUv;
    void main(){
      float band = smoothstep(0.30, 0.47, vUv.y) * (1.0 - smoothstep(0.47, 0.6, vUv.y));
      vec2 uv = vUv;
      uv.x += sin(uv.y * 420.0 + time * 6.0) * 0.0009 * band * amount;
      uv.y += cos(uv.x * 300.0 + time * 4.0) * 0.0006 * band * amount;
      gl_FragColor = texture2D(tDiffuse, uv);
    }`,
};

export class RenderCore {
  renderer: THREE.WebGLRenderer;
  quality: Quality;
  adaptive = true;
  scale = 1;
  fps = 60;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private haze: ShaderPass | null = null;
  private frameAvg = 1 / 60;
  private slowTime = 0;
  private fastTime = 0;
  private width = 1;
  private height = 1;
  hazeAmount = 0;
  onScaleChange: ((s: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", alpha: false, stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.quality = quality;
    this.applyQuality();
  }

  get maxRatio() {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    return Math.min(dpr, this.quality === "low" ? 1 : this.quality === "medium" ? 1.5 : 2);
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.scale = 1;
    this.applyQuality();
  }

  private applyQuality() {
    const r = this.renderer;
    r.shadowMap.enabled = this.quality !== "low";
    r.shadowMap.type = this.quality === "ultra" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    r.setPixelRatio(this.maxRatio * this.scale);
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    if (this.quality === "ultra") {
      const size = r.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(r, rt);
      this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
      this.composer.addPass(this.renderPass);
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 0.88);
      this.composer.addPass(this.bloom);
      this.haze = new ShaderPass(HazeShader);
      this.composer.addPass(this.haze);
      this.composer.addPass(new OutputPass());
    }
    this.resize(this.width, this.height);
  }

  resize(w: number, h: number) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.renderer.setPixelRatio(this.maxRatio * this.scale);
    this.renderer.setSize(this.width, this.height, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.maxRatio * this.scale);
      this.composer.setSize(this.width, this.height);
    }
  }

  get drawHeight() {
    return this.height * this.renderer.getPixelRatio();
  }

  render(scene: THREE.Scene, camera: THREE.Camera, time = 0) {
    if (this.composer && this.renderPass) {
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
      if (this.haze) {
        this.haze.enabled = this.hazeAmount > 0;
        this.haze.uniforms.time.value = time;
        this.haze.uniforms.amount.value = this.hazeAmount;
      }
      this.composer.render();
    } else {
      this.renderer.render(scene, camera);
    }
  }

  /** Feed the frame time; lowers / raises the resolution scale to hold ~55+ fps. */
  adapt(dt: number) {
    this.frameAvg = this.frameAvg * 0.95 + dt * 0.05;
    this.fps = 1 / this.frameAvg;
    if (!this.adaptive) return;
    if (this.frameAvg > 1 / 48) { this.slowTime += dt; this.fastTime = 0; }
    else if (this.frameAvg < 1 / 58) { this.fastTime += dt; this.slowTime = 0; }
    else { this.slowTime = 0; this.fastTime = 0; }
    if (this.slowTime > 1.5 && this.scale > 0.5) {
      this.scale = Math.max(0.5, this.scale - 0.1);
      this.slowTime = 0;
      this.resize(this.width, this.height);
      this.onScaleChange?.(this.scale);
    } else if (this.fastTime > 4 && this.scale < 1) {
      this.scale = Math.min(1, this.scale + 0.05);
      this.fastTime = 0;
      this.resize(this.width, this.height);
      this.onScaleChange?.(this.scale);
    }
  }

  dispose() {
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
