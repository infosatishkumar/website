// Persisted settings and the local player profile (garage, career, records).

import { CARS, type Customization, type Upgrades } from "../shared/cars.ts";
import type { HandlingPreset } from "./vehicle.ts";
import type { Loadout } from "../shared/protocol.ts";

export type Quality = "low" | "medium" | "ultra";
export type CameraMode = "chase" | "far" | "hood" | "bumper" | "cockpit" | "cinematic";
export const CAMERA_MODES: CameraMode[] = ["chase", "far", "hood", "bumper", "cockpit", "cinematic"];
export type TouchScheme = "buttons" | "wheel" | "tilt";

export type Action =
  | "throttle" | "brake" | "left" | "right" | "handbrake" | "nitro" | "shiftUp" | "shiftDown"
  | "camera" | "pause" | "lookBack" | "reset" | "indLeft" | "indRight" | "hazard" | "lights" | "horn";

export const DEFAULT_KEYS: Record<Action, string[]> = {
  throttle: ["KeyW", "ArrowUp"],
  brake: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  handbrake: ["Space"],
  nitro: ["KeyN", "AltLeft"],
  shiftUp: ["ShiftLeft", "KeyE"],
  shiftDown: ["ControlLeft", "KeyQ"],
  camera: ["KeyC"],
  pause: ["Escape", "KeyP"],
  lookBack: ["KeyB"],
  reset: ["KeyR"],
  indLeft: ["KeyZ"],
  indRight: ["KeyX"],
  hazard: ["KeyH"],
  lights: ["KeyL"],
  horn: ["KeyG"],
};

export interface Settings {
  quality: Quality;
  adaptiveResolution: boolean;
  showFps: boolean;
  handling: HandlingPreset;
  abs: boolean;
  tc: boolean;
  esc: boolean;
  autoGear: boolean;
  camera: CameraMode;
  master: number;
  engine: number;
  effects: number;
  ambience: number;
  touchScheme: TouchScheme;
  touchSensitivity: number;
  touchSize: number;
  touchOpacity: number;
  leftHanded: boolean;
  haptics: boolean;
  units: "kmh" | "mph";
  keys: Record<Action, string[]>;
  server: string;
}

export interface PlayerProfile {
  name: string;
  avatar: number;
  xp: number;
  credits: number;
  owned: string[];
  selectedCar: string;
  upgrades: Record<string, Upgrades>;
  cust: Record<string, Customization>;
  bestLaps: Record<string, number>;
  career: Record<string, number>;
  achievements: string[];
  stats: { races: number; wins: number; distance: number; topSpeed: number; driftBest: number; dragBest: number };
  daily: { date: string; done: boolean };
  netToken: string;
}

const isMobile = () =>
  typeof navigator !== "undefined" && (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent)));

export function defaultSettings(): Settings {
  const mobile = isMobile();
  return {
    quality: mobile ? "low" : "medium",
    adaptiveResolution: true,
    showFps: false,
    handling: "sport",
    abs: true,
    tc: true,
    esc: false,
    autoGear: true,
    camera: "chase",
    master: 0.8,
    engine: 0.9,
    effects: 0.8,
    ambience: 0.6,
    touchScheme: "buttons",
    touchSensitivity: 1,
    touchSize: 1,
    touchOpacity: 0.8,
    leftHanded: false,
    haptics: true,
    units: "kmh",
    keys: structuredClone(DEFAULT_KEYS),
    server: "",
  };
}

export function defaultCust(carId: string): Customization {
  const c = CARS.find((x) => x.id === carId) ?? CARS[0];
  return { color: c.defaultColor, finish: "metallic", rim: 0, rimColor: "#c4c8cc", wing: -1, kit: 0 };
}

export function defaultProfile(): PlayerProfile {
  return {
    name: "",
    avatar: Math.floor(Math.random() * 12),
    xp: 0,
    credits: 25000,
    owned: ["vantor"],
    selectedCar: "vantor",
    upgrades: {},
    cust: {},
    bestLaps: {},
    career: {},
    achievements: [],
    stats: { races: 0, wins: 0, distance: 0, topSpeed: 0, driftBest: 0, dragBest: 0 },
    daily: { date: "", done: false },
    netToken: "",
  };
}

const SKEY = "vr.settings.v1";
const PKEY = "vr.profile.v1";

function load<T>(key: string, def: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def();
    const d = def() as Record<string, unknown>;
    const parsed = JSON.parse(raw);
    return { ...d, ...parsed } as T;
  } catch {
    return def();
  }
}

function store(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage may be unavailable (private mode) – settings stay in memory */
  }
}

export const loadSettings = () => {
  const s = load(SKEY, defaultSettings);
  s.keys = { ...DEFAULT_KEYS, ...s.keys };
  return s;
};
export const saveSettings = (s: Settings) => store(SKEY, s);
export const loadProfile = () => load(PKEY, defaultProfile);
export const saveProfile = (p: PlayerProfile) => store(PKEY, p);

export function upgradesFor(p: PlayerProfile, carId: string): Upgrades {
  return p.upgrades[carId] ?? { engine: 0, tires: 0, weight: 0 };
}
export function custFor(p: PlayerProfile, carId: string): Customization {
  return p.cust[carId] ?? defaultCust(carId);
}

export const AVATAR_COLORS = ["#ff5a36", "#ffb703", "#2ec4b6", "#3a86ff", "#8338ec", "#ff006e", "#06d6a0", "#ef476f", "#118ab2", "#f4a261", "#e9c46a", "#adb5bd"];

export const isTouchDevice = () => typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

export function loadoutFor(p: PlayerProfile, carId = p.selectedCar): Loadout {
  return { id: carId, cust: custFor(p, carId), up: upgradesFor(p, carId) };
}
