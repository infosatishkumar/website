// Input: keyboard (rebindable), gamepads (with rumble), on-screen touch
// controls and optional gyroscope steering, merged into one Controls sample.

import type { Controls } from "./vehicle.ts";
import type { Action, Settings } from "./settings.ts";

export type EdgeAction = "camera" | "pause" | "reset" | "indLeft" | "indRight" | "hazard" | "lights" | "horn" | "shiftUp" | "shiftDown";
const EDGE_ACTIONS: EdgeAction[] = ["camera", "pause", "reset", "indLeft", "indRight", "hazard", "lights", "horn"];

export interface TouchState {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  nitro: boolean;
  shiftUp: boolean;
  shiftDown: boolean;
  lookBack: boolean;
  active: boolean;
}

export class Input {
  private keys = new Set<string>();
  private settings: Settings;
  private kbSteer = 0;
  touch: TouchState = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, shiftUp: false, shiftDown: false, lookBack: false, active: false };
  tiltSteer = 0;
  tiltEnabled = false;
  lastDevice: "keyboard" | "gamepad" | "touch" = "keyboard";
  onAction: ((a: EdgeAction) => void) | null = null;
  private padPrev: boolean[] = [];
  private listening = false;
  /** Set while the user is rebinding a key in settings. */
  captureNext: ((code: string) => void) | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  setSettings(s: Settings) {
    this.settings = s;
  }

  setTouch(patch: Partial<TouchState>) {
    Object.assign(this.touch, patch);
    if (patch.active !== false) this.lastDevice = "touch";
  }

  setCapture(cb: ((code: string) => void) | null) {
    this.captureNext = cb;
  }

  attach() {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("deviceorientation", this.onOrient);
  }

  detach() {
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("deviceorientation", this.onOrient);
  }

  private bound(action: Action, code: string) {
    return this.settings.keys[action]?.includes(code);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.captureNext) {
      e.preventDefault();
      const cb = this.captureNext;
      this.captureNext = null;
      cb(e.code);
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
    const gameKey = Object.values(this.settings.keys).some((arr) => arr.includes(e.code));
    if (gameKey) e.preventDefault();
    this.lastDevice = "keyboard";
    if (e.repeat) return;
    this.keys.add(e.code);
    for (const a of EDGE_ACTIONS) if (this.bound(a, e.code)) this.onAction?.(a);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
  };

  private onOrient = (e: DeviceOrientationEvent) => {
    if (!this.tiltEnabled || e.beta === null || e.gamma === null) return;
    const angle = (screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) as number;
    // In landscape the steering axis is the device's beta rotation.
    let v = 0;
    if (angle === 90) v = e.beta;
    else if (angle === 270 || angle === -90) v = -e.beta;
    else v = e.gamma;
    this.tiltSteer = Math.max(-1, Math.min(1, (v / 28) * this.settings.touchSensitivity));
  };

  async enableTilt(): Promise<boolean> {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (DOE && typeof DOE.requestPermission === "function") {
      try {
        const res = await DOE.requestPermission();
        if (res !== "granted") return false;
      } catch {
        return false;
      }
    }
    this.tiltEnabled = true;
    return true;
  }

  isDown(a: Action) {
    const codes = this.settings.keys[a];
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  private gamepad() {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  rumble(strong: number, weak: number, ms: number) {
    const p = this.gamepad() as (Gamepad & { vibrationActuator?: { playEffect: (t: string, o: object) => Promise<unknown> } }) | null;
    if (p?.vibrationActuator) {
      void p.vibrationActuator.playEffect("dual-rumble", { duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }).catch(() => {});
    } else if (this.settings.haptics && this.lastDevice === "touch" && navigator.vibrate) {
      navigator.vibrate(Math.min(200, ms));
    }
  }

  sample(dt: number, out: Controls) {
    // Keyboard
    const left = this.isDown("left"), right = this.isDown("right");
    const want = (right ? 1 : 0) - (left ? 1 : 0);
    const rate = want === 0 || Math.sign(want) !== Math.sign(this.kbSteer) ? 7 : 3.4;
    this.kbSteer += Math.max(-rate * dt, Math.min(rate * dt, want - this.kbSteer));
    let throttle = this.isDown("throttle") ? 1 : 0;
    let brake = this.isDown("brake") ? 1 : 0;
    let steer = this.kbSteer;
    let analog = false;
    let handbrake = this.isDown("handbrake");
    let nitro = this.isDown("nitro");
    let shiftUp = this.isDown("shiftUp");
    let shiftDown = this.isDown("shiftDown");
    let lookBack = this.isDown("lookBack");
    // Gamepad
    const p = this.gamepad();
    if (p) {
      const b = (i: number) => p.buttons[i]?.pressed ?? false;
      const v = (i: number) => p.buttons[i]?.value ?? 0;
      const ax = p.axes[0] ?? 0;
      const dz = 0.12;
      const sx = Math.abs(ax) < dz ? 0 : Math.sign(ax) * ((Math.abs(ax) - dz) / (1 - dz)) ** 1.4;
      const rt = v(7), lt = v(6);
      const used = Math.abs(sx) > 0 || rt > 0.05 || lt > 0.05 || p.buttons.some((x) => x.pressed);
      if (used) this.lastDevice = "gamepad";
      if (Math.abs(sx) > Math.abs(steer)) { steer = sx; analog = true; }
      throttle = Math.max(throttle, rt);
      brake = Math.max(brake, lt);
      handbrake ||= b(0);
      nitro ||= b(2);
      shiftUp ||= b(5);
      shiftDown ||= b(4);
      lookBack ||= b(13);
      // Edge-triggered gamepad actions
      const edges: [number, EdgeAction][] = [[3, "camera"], [9, "pause"], [8, "reset"], [14, "indLeft"], [15, "indRight"], [12, "lights"], [11, "horn"]];
      for (const [i, a] of edges) {
        const now = b(i);
        if (now && !this.padPrev[i]) this.onAction?.(a);
        this.padPrev[i] = now;
      }
    }
    // Touch
    const t = this.touch;
    if (t.active) {
      throttle = Math.max(throttle, t.throttle);
      brake = Math.max(brake, t.brake);
      handbrake ||= t.handbrake;
      nitro ||= t.nitro;
      shiftUp ||= t.shiftUp;
      shiftDown ||= t.shiftDown;
      lookBack ||= t.lookBack;
      const ts = this.settings.touchScheme === "tilt" && this.tiltEnabled ? this.tiltSteer : t.steer;
      if (Math.abs(ts) > Math.abs(steer)) { steer = ts; analog = this.settings.touchScheme !== "buttons"; }
    }
    out.throttle = throttle;
    out.brake = brake;
    out.steer = Math.max(-1, Math.min(1, steer));
    out.handbrake = handbrake;
    out.nitro = nitro;
    out.shiftUp = shiftUp;
    out.shiftDown = shiftDown;
    out.analog = analog;
    return lookBack;
  }
}
