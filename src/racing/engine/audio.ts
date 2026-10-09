// Fully synthesized spatial audio (Web Audio API) – no sample assets needed.
// Each car gets an engine voice whose harmonics follow its cylinder count and
// rpm, with turbo whistle, blow-off, overrun crackle, hybrid whine and gear
// shift cuts. Plus tyre squeal, wind, road/gravel rumble, collisions,
// ambience per environment, rain/thunder and tunnel reverb.

import type { EngineSound } from "../shared/cars.ts";
import type { Environment } from "../shared/tracks.ts";

let sharedNoise: AudioBuffer | null = null;
function noiseBuffer(ctx: AudioContext) {
  if (sharedNoise && sharedNoise.sampleRate === ctx.sampleRate) return sharedNoise;
  const len = ctx.sampleRate * 2;
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  sharedNoise = b;
  return b;
}

function noiseSrc(ctx: AudioContext) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = true;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  return s;
}

function distortionCurve(amount: number) {
  const n = 1024;
  const c = new Float32Array(n);
  const k = amount * 40 + 1;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

export interface EngineInput {
  rpm: number;
  redline: number;
  throttle: number;
  speed: number;
  shift: number;
  nitro: boolean;
  limiter: boolean;
}

export class EngineVoice {
  out: GainNode;
  panner: PannerNode | null;
  private ctx: AudioContext;
  private s: EngineSound;
  private oscA: OscillatorNode;
  private oscB: OscillatorNode;
  private oscC: OscillatorNode;
  private rasp: BiquadFilterNode;
  private raspGain: GainNode;
  private lp: BiquadFilterNode;
  private body: GainNode;
  private turbo: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private whine: OscillatorNode | null = null;
  private whineGain: GainNode | null = null;
  private popGain: GainNode;
  private popFilter: BiquadFilterNode;
  private bovGain: GainNode;
  private lastThrottle = 0;
  private boost = 0;
  private popTimer = 0;
  private sources: AudioScheduledSourceNode[] = [];

  constructor(ctx: AudioContext, dest: AudioNode, s: EngineSound, spatial: boolean, hrtf: boolean) {
    this.ctx = ctx;
    this.s = s;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    if (spatial) {
      this.panner = ctx.createPanner();
      this.panner.panningModel = hrtf ? "HRTF" : "equalpower";
      this.panner.distanceModel = "inverse";
      this.panner.refDistance = 6;
      this.panner.maxDistance = 400;
      this.panner.rolloffFactor = 1.4;
      this.out.connect(this.panner).connect(dest);
    } else {
      this.panner = null;
      this.out.connect(dest);
    }
    const mix = ctx.createGain();
    this.oscA = ctx.createOscillator();
    this.oscA.type = "sawtooth";
    this.oscB = ctx.createOscillator();
    this.oscB.type = s.cylinders <= 6 ? "square" : "triangle";
    this.oscC = ctx.createOscillator();
    this.oscC.type = "sawtooth";
    const gA = ctx.createGain(); gA.gain.value = 0.5;
    const gB = ctx.createGain(); gB.gain.value = s.cylinders === 8 ? 0.5 : 0.28;
    const gC = ctx.createGain(); gC.gain.value = s.cylinders >= 10 ? 0.35 : 0.18;
    this.oscA.connect(gA).connect(mix);
    this.oscB.connect(gB).connect(mix);
    this.oscC.connect(gC).connect(mix);
    // Raspy combustion noise band
    const n = noiseSrc(ctx);
    this.rasp = ctx.createBiquadFilter();
    this.rasp.type = "bandpass";
    this.rasp.Q.value = 1.8;
    this.raspGain = ctx.createGain();
    this.raspGain.gain.value = 0;
    n.connect(this.rasp).connect(this.raspGain).connect(mix);
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(0.2 + s.rasp * 0.6);
    shaper.oversample = "2x";
    this.lp = ctx.createBiquadFilter();
    this.lp.type = "lowpass";
    this.lp.Q.value = 0.9;
    this.body = ctx.createGain();
    this.body.gain.value = 0.25;
    mix.connect(shaper).connect(this.lp).connect(this.body).connect(this.out);
    // Overrun crackle
    const pn = noiseSrc(ctx);
    this.popFilter = ctx.createBiquadFilter();
    this.popFilter.type = "bandpass";
    this.popFilter.frequency.value = 900;
    this.popFilter.Q.value = 0.7;
    this.popGain = ctx.createGain();
    this.popGain.gain.value = 0;
    pn.connect(this.popFilter).connect(this.popGain).connect(this.out);
    // Blow-off valve hiss
    const bn = noiseSrc(ctx);
    const bf = ctx.createBiquadFilter();
    bf.type = "bandpass";
    bf.frequency.value = 2600;
    bf.Q.value = 1.2;
    this.bovGain = ctx.createGain();
    this.bovGain.gain.value = 0;
    bn.connect(bf).connect(this.bovGain).connect(this.out);
    this.sources.push(this.oscA, this.oscB, this.oscC, n, pn, bn);
    if (s.turbo) {
      this.turbo = ctx.createOscillator();
      this.turbo.type = "sine";
      this.turboGain = ctx.createGain();
      this.turboGain.gain.value = 0;
      this.turbo.connect(this.turboGain).connect(this.out);
      this.sources.push(this.turbo);
    }
    if (s.hybridWhine) {
      this.whine = ctx.createOscillator();
      this.whine.type = "sine";
      this.whineGain = ctx.createGain();
      this.whineGain.gain.value = 0;
      this.whine.connect(this.whineGain).connect(this.out);
      this.sources.push(this.whine);
    }
    for (const src of this.sources) src.start();
  }

  update(e: EngineInput, dt: number, volume: number) {
    const now = this.ctx.currentTime;
    const s = this.s;
    const f = (e.rpm / 60) * (s.cylinders / 2) * 0.5 * s.pitch;
    const tc = 0.03;
    this.oscA.frequency.setTargetAtTime(f, now, tc);
    this.oscB.frequency.setTargetAtTime(f * 0.5, now, tc);
    this.oscC.frequency.setTargetAtTime(f * 2.01, now, tc);
    this.rasp.frequency.setTargetAtTime(Math.min(8000, f * 3.2), now, tc);
    const load = e.shift > 0 ? 0.15 : e.throttle;
    const frac = Math.min(1, e.rpm / e.redline);
    this.raspGain.gain.setTargetAtTime((0.05 + load * 0.5) * (0.3 + s.rasp), now, 0.05);
    this.lp.frequency.setTargetAtTime(500 + load * 3800 + frac * 2400, now, 0.05);
    const bodyGain = (0.22 + load * 0.55 + frac * 0.2) * (e.limiter ? 0.6 + Math.random() * 0.4 : 1);
    this.body.gain.setTargetAtTime(bodyGain, now, 0.04);
    this.out.gain.setTargetAtTime(volume, now, 0.1);
    // Turbo spool and blow-off
    const lifted = this.lastThrottle > 0.6 && e.throttle < 0.2;
    if (this.turbo && this.turboGain) {
      const target = e.throttle * Math.min(1, frac * 1.6);
      this.boost += (target - this.boost) * Math.min(1, dt * (target > this.boost ? 1.8 : 6));
      this.turbo.frequency.setTargetAtTime(1800 + this.boost * 4200, now, 0.05);
      this.turboGain.gain.setTargetAtTime(this.boost * 0.035, now, 0.05);
      if (lifted && this.boost > 0.4) {
        this.bovGain.gain.cancelScheduledValues(now);
        this.bovGain.gain.setValueAtTime(0.22 * this.boost, now);
        this.bovGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      }
    }
    if (this.whine && this.whineGain) {
      this.whine.frequency.setTargetAtTime(400 + e.speed * 42, now, 0.05);
      this.whineGain.gain.setTargetAtTime(Math.min(0.05, e.speed * 0.0008) * (0.4 + e.throttle), now, 0.1);
    }
    // Overrun crackle: random pops after lifting at high rpm.
    if (lifted && frac > 0.55) this.popTimer = 0.9;
    if (this.popTimer > 0) {
      this.popTimer -= dt;
      if (Math.random() < dt * 14) {
        this.popGain.gain.cancelScheduledValues(now);
        this.popGain.gain.setValueAtTime(0.35 + Math.random() * 0.4, now);
        this.popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05 + Math.random() * 0.05);
        this.popFilter.frequency.setValueAtTime(500 + Math.random() * 900, now);
      }
    }
    if (e.shift !== 0) {
      this.body.gain.cancelScheduledValues(now);
      this.body.gain.setValueAtTime(0.08, now);
      this.body.gain.setTargetAtTime(bodyGain, now + 0.08, 0.04);
    }
    this.lastThrottle = e.throttle;
  }

  setPosition(x: number, y: number, z: number) {
    if (!this.panner) return;
    const t = this.ctx.currentTime;
    this.panner.positionX.setTargetAtTime(x, t, 0.02);
    this.panner.positionY.setTargetAtTime(y, t, 0.02);
    this.panner.positionZ.setTargetAtTime(z, t, 0.02);
  }

  stop() {
    const now = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(0, now, 0.05);
    for (const s of this.sources) {
      try { s.stop(now + 0.3); } catch { /* already stopped */ }
    }
    setTimeout(() => { this.out.disconnect(); this.panner?.disconnect(); }, 500);
  }
}

export interface MixLevels {
  master: number;
  engine: number;
  effects: number;
  ambience: number;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  engineBus!: GainNode;
  private fxBus!: GainNode;
  private ambBus!: GainNode;
  private reverbSend!: GainNode;
  private squealGain!: GainNode;
  private squealFilter!: BiquadFilterNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private rumbleGain!: GainNode;
  private gravelGain!: GainNode;
  private rainGain!: GainNode;
  private ambGain!: GainNode;
  private ambFilter!: BiquadFilterNode;
  private ambLfo!: OscillatorNode;
  private levels: MixLevels = { master: 0.8, engine: 0.9, effects: 0.8, ambience: 0.6 };
  hrtf = false;
  private nitroGain!: GainNode;

  /** Must be called from a user gesture (browsers block autoplay). */
  start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    this.engineBus = ctx.createGain();
    this.fxBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.engineBus.connect(this.master);
    this.fxBus.connect(this.master);
    this.ambBus.connect(this.master);
    // Tunnel reverb
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    conv.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0;
    this.engineBus.connect(this.reverbSend).connect(conv).connect(this.master);
    // Tyre squeal
    const sq = noiseSrc(ctx);
    this.squealFilter = ctx.createBiquadFilter();
    this.squealFilter.type = "bandpass";
    this.squealFilter.frequency.value = 900;
    this.squealFilter.Q.value = 9;
    this.squealGain = ctx.createGain();
    this.squealGain.gain.value = 0;
    sq.connect(this.squealFilter).connect(this.squealGain).connect(this.fxBus);
    // Wind
    const wn = noiseSrc(ctx);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wn.connect(this.windFilter).connect(this.windGain).connect(this.fxBus);
    // Road rumble + gravel
    const rn = noiseSrc(ctx);
    const rf = ctx.createBiquadFilter();
    rf.type = "lowpass";
    rf.frequency.value = 140;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    rn.connect(rf).connect(this.rumbleGain).connect(this.fxBus);
    const gn = noiseSrc(ctx);
    const gf = ctx.createBiquadFilter();
    gf.type = "bandpass";
    gf.frequency.value = 420;
    gf.Q.value = 0.6;
    this.gravelGain = ctx.createGain();
    this.gravelGain.gain.value = 0;
    gn.connect(gf).connect(this.gravelGain).connect(this.fxBus);
    // Nitro hiss
    const nn = noiseSrc(ctx);
    const nf = ctx.createBiquadFilter();
    nf.type = "highpass";
    nf.frequency.value = 1800;
    this.nitroGain = ctx.createGain();
    this.nitroGain.gain.value = 0;
    nn.connect(nf).connect(this.nitroGain).connect(this.fxBus);
    // Rain
    const rain = noiseSrc(ctx);
    const rainF = ctx.createBiquadFilter();
    rainF.type = "highpass";
    rainF.frequency.value = 1200;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rainF).connect(this.rainGain).connect(this.ambBus);
    // Environment ambience bed (crowd / city / surf / desert wind)
    const amb = noiseSrc(ctx);
    this.ambFilter = ctx.createBiquadFilter();
    this.ambFilter.type = "bandpass";
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 0;
    this.ambLfo = ctx.createOscillator();
    this.ambLfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    this.ambLfo.connect(lfoGain).connect(this.ambGain.gain);
    amb.connect(this.ambFilter).connect(this.ambGain).connect(this.ambBus);
    for (const s of [sq, wn, rn, gn, nn, rain, amb, this.ambLfo]) s.start();
    this.setLevels(this.levels);
  }

  setLevels(l: MixLevels) {
    this.levels = l;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(l.master, t, 0.05);
    this.engineBus.gain.setTargetAtTime(l.engine, t, 0.05);
    this.fxBus.gain.setTargetAtTime(l.effects, t, 0.05);
    this.ambBus.gain.setTargetAtTime(l.ambience, t, 0.05);
  }

  setEnvironment(env: Environment | null, rain: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const cfg: Record<Environment, [number, number, number]> = {
      circuit: [700, 0.6, 0.12],
      city: [180, 0.5, 0.16],
      coast: [380, 0.35, 0.22],
      desert: [260, 0.4, 0.1],
    };
    if (!env) {
      this.ambGain.gain.setTargetAtTime(0, t, 0.3);
      this.rainGain.gain.setTargetAtTime(0, t, 0.3);
      return;
    }
    const [freq, q, gain] = cfg[env];
    this.ambFilter.frequency.value = freq;
    this.ambFilter.Q.value = q;
    this.ambGain.gain.setTargetAtTime(gain, t, 0.5);
    this.rainGain.gain.setTargetAtTime(rain ? 0.12 : 0, t, 0.5);
  }

  createEngine(s: EngineSound, spatial: boolean) {
    if (!this.ctx) return null;
    return new EngineVoice(this.ctx, this.engineBus, s, spatial, this.hrtf);
  }

  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(x, t, 0.02);
      l.positionY.setTargetAtTime(y, t, 0.02);
      l.positionZ.setTargetAtTime(z, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02);
      l.forwardY.setTargetAtTime(fy, t, 0.02);
      l.forwardZ.setTargetAtTime(fz, t, 0.02);
    }
  }

  updateVehicle(o: { speed: number; slide: number; offroad: number; nitro: boolean; tunnel: number; wet: boolean }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const sl = Math.min(1, o.slide) * Math.min(1, o.speed / 6);
    this.squealGain.gain.setTargetAtTime(o.wet ? sl * 0.05 : sl * 0.28, t, 0.05);
    this.squealFilter.frequency.setTargetAtTime(700 + Math.random() * 120 + sl * 300, t, 0.05);
    const v = o.speed / 90;
    this.windGain.gain.setTargetAtTime(Math.min(0.5, v * v * 0.5), t, 0.1);
    this.windFilter.frequency.setTargetAtTime(300 + o.speed * 14, t, 0.1);
    this.rumbleGain.gain.setTargetAtTime(Math.min(0.35, o.speed * 0.006) * (o.wet ? 1.3 : 1), t, 0.1);
    this.gravelGain.gain.setTargetAtTime(o.offroad * Math.min(0.5, o.speed * 0.03), t, 0.05);
    this.nitroGain.gain.setTargetAtTime(o.nitro ? 0.12 : 0, t, 0.05);
    this.reverbSend.gain.setTargetAtTime(o.tunnel * 0.9, t, 0.15);
  }

  /** Impact: low thump + crunch scaled by speed. */
  impact(strength: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const a = Math.min(1, strength / 20);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6 * a, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g).connect(this.fxBus);
    osc.start(t);
    osc.stop(t + 0.4);
    const n = noiseSrc(ctx);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1200 + Math.random() * 1500;
    f.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5 * a, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18 + a * 0.25);
    n.connect(f).connect(ng).connect(this.fxBus);
    n.start(t);
    n.stop(t + 0.5);
  }

  thunder(delay: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const n = noiseSrc(ctx);
    n.playbackRate.value = 0.25;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 160;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    n.connect(f).connect(g).connect(this.ambBus);
    n.start(t);
    n.stop(t + 3.6);
  }

  beep(high: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = high ? 1046 : 523;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (high ? 0.7 : 0.25));
    o.connect(g).connect(this.fxBus);
    o.start(t);
    o.stop(t + 0.8);
  }

  horn() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (const fr of [415, 520]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = fr;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, t);
      g.gain.setValueAtTime(0.08, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(f).connect(g).connect(this.fxBus);
      o.start(t);
      o.stop(t + 0.5);
    }
  }

  click() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
  }

  suspend() {
    void this.ctx?.suspend();
  }
  resume() {
    void this.ctx?.resume();
  }
  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
