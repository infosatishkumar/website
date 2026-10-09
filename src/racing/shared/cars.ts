// Vehicle catalogue. All cars are original designs – no real manufacturer
// names, logos or proprietary models are used. Specs are realistic for their
// class and drive the physics model directly.

export type CarClass = "Exotic" | "Supercar" | "Hypercar" | "Track" | "Tuned";
export type Drivetrain = "RWD" | "AWD" | "FWD";

export interface BodyShape {
  length: number;
  width: number;
  /** Height of the shoulder line / deck. */
  height: number;
  /** [t (0 rear → 1 front), relative height] keyframes of the body top line. */
  top: [number, number][];
  /** [t, relative half width] keyframes. */
  plan: [number, number][];
  /** Cabin start/end (t) and height above the deck. */
  cabin: [number, number, number];
  /** How far forward the cabin's peak sits (0..1 within cabin). */
  cabinPeak: number;
  /** Factory wing: 0 none, 1 lip, 2 wing. */
  wing: number;
  /** Ground clearance. */
  clearance: number;
}

export interface EngineSound {
  cylinders: number;
  /** 0..1 – smooth/turbine-like to raw/raspy. */
  rasp: number;
  turbo: boolean;
  /** Base pitch multiplier. */
  pitch: number;
  hybridWhine?: boolean;
}

export interface CarSpec {
  id: string;
  name: string;
  cls: CarClass;
  blurb: string;
  layout: string;
  price: number;
  unlockLevel: number;
  mass: number;
  /** Peak engine torque (Nm) and the rpm where it peaks. */
  torque: number;
  torqueRpm: number;
  idleRpm: number;
  redline: number;
  gears: number[];
  finalDrive: number;
  drivetrain: Drivetrain;
  /** Fraction of drive torque to the front axle (AWD only). */
  frontSplit: number;
  wheelbase: number;
  /** Fraction of static weight on the front axle. */
  frontWeight: number;
  cgHeight: number;
  track: number;
  wheelRadius: number;
  tireGrip: number;
  brakeForce: number;
  brakeBias: number;
  cdA: number;
  clA: number;
  aeroBalance: number;
  /** Max road-wheel steering angle (rad). */
  steerLock: number;
  /** Approximate top speed in km/h, used for display and server validation. */
  topSpeed: number;
  sound: EngineSound;
  body: BodyShape;
  defaultColor: string;
}

const deg = Math.PI / 180;

export const CARS: CarSpec[] = [
  {
    id: "vantor",
    name: "Vantor GT",
    cls: "Exotic",
    blurb: "Front-engined grand tourer. Long legs, playful rear, forgiving at the limit.",
    layout: "Front V8 twin-turbo · RWD",
    price: 0,
    unlockLevel: 1,
    mass: 1620,
    torque: 760,
    torqueRpm: 3500,
    idleRpm: 850,
    redline: 7200,
    gears: [3.4, 2.3, 1.72, 1.32, 1.04, 0.84, 0.68],
    finalDrive: 3.2,
    drivetrain: "RWD",
    frontSplit: 0,
    wheelbase: 2.75,
    frontWeight: 0.51,
    cgHeight: 0.48,
    track: 1.66,
    wheelRadius: 0.35,
    tireGrip: 1.08,
    brakeForce: 17000,
    brakeBias: 0.62,
    cdA: 0.72,
    clA: 0.35,
    aeroBalance: 0.45,
    steerLock: 34 * deg,
    topSpeed: 318,
    sound: { cylinders: 8, rasp: 0.55, turbo: true, pitch: 1 },
    defaultColor: "#1f4fff",
    body: {
      length: 4.65, width: 1.98, height: 1.0,
      top: [[0, 0.7], [0.05, 0.86], [0.25, 0.88], [0.45, 0.84], [0.7, 0.74], [0.88, 0.6], [0.97, 0.46], [1, 0.36]],
      plan: [[0, 0.86], [0.08, 0.97], [0.22, 1], [0.5, 0.94], [0.78, 1], [0.94, 0.95], [1, 0.8]],
      cabin: [0.2, 0.6, 0.36], cabinPeak: 0.55, wing: 1, clearance: 0.12,
    },
  },
  {
    id: "strada",
    name: "Strada RS Tuned",
    cls: "Tuned",
    blurb: "Street-built turbo four with all-wheel drive. Explosive launches, rally-like grip.",
    layout: "Front I4 turbo · AWD",
    price: 42000,
    unlockLevel: 1,
    mass: 1420,
    torque: 560,
    torqueRpm: 4200,
    idleRpm: 950,
    redline: 7800,
    gears: [3.6, 2.4, 1.78, 1.38, 1.1, 0.9],
    finalDrive: 3.9,
    drivetrain: "AWD",
    frontSplit: 0.4,
    wheelbase: 2.65,
    frontWeight: 0.58,
    cgHeight: 0.52,
    track: 1.58,
    wheelRadius: 0.33,
    tireGrip: 1.1,
    brakeForce: 15500,
    brakeBias: 0.64,
    cdA: 0.78,
    clA: 0.4,
    aeroBalance: 0.45,
    steerLock: 36 * deg,
    topSpeed: 268,
    sound: { cylinders: 4, rasp: 0.8, turbo: true, pitch: 1.12 },
    defaultColor: "#f2f2f2",
    body: {
      length: 4.4, width: 1.86, height: 1.12,
      top: [[0, 0.8], [0.06, 0.9], [0.3, 0.9], [0.55, 0.84], [0.8, 0.76], [0.93, 0.64], [1, 0.42]],
      plan: [[0, 0.9], [0.1, 1], [0.5, 0.97], [0.85, 1], [1, 0.86]],
      cabin: [0.16, 0.66, 0.44], cabinPeak: 0.45, wing: 2, clearance: 0.13,
    },
  },
  {
    id: "aurion",
    name: "Aurion S",
    cls: "Supercar",
    blurb: "Mid-engined V10 supercar. Sharp turn-in, screaming top end.",
    layout: "Mid V10 NA · RWD",
    price: 95000,
    unlockLevel: 3,
    mass: 1480,
    torque: 600,
    torqueRpm: 6500,
    idleRpm: 1000,
    redline: 8700,
    gears: [3.1, 2.2, 1.68, 1.33, 1.08, 0.9, 0.75],
    finalDrive: 3.6,
    drivetrain: "RWD",
    frontSplit: 0,
    wheelbase: 2.65,
    frontWeight: 0.42,
    cgHeight: 0.42,
    track: 1.68,
    wheelRadius: 0.34,
    tireGrip: 1.16,
    brakeForce: 19000,
    brakeBias: 0.58,
    cdA: 0.66,
    clA: 0.75,
    aeroBalance: 0.42,
    steerLock: 32 * deg,
    topSpeed: 325,
    sound: { cylinders: 10, rasp: 0.7, turbo: false, pitch: 1.05 },
    defaultColor: "#f5a300",
    body: {
      length: 4.5, width: 2.0, height: 0.86,
      top: [[0, 0.84], [0.06, 0.98], [0.3, 1], [0.5, 0.92], [0.75, 0.68], [0.92, 0.52], [1, 0.34]],
      plan: [[0, 0.9], [0.12, 1], [0.32, 1], [0.55, 0.9], [0.8, 0.98], [1, 0.78]],
      cabin: [0.36, 0.74, 0.42], cabinPeak: 0.62, wing: 1, clearance: 0.1,
    },
  },
  {
    id: "kaiju",
    name: "Kaiju X Hybrid",
    cls: "Hypercar",
    blurb: "1,200 hp petrol-electric hypercar. Brutal torque fill, enormous grip and speed.",
    layout: "Mid V8 hybrid · AWD",
    price: 240000,
    unlockLevel: 6,
    mass: 1590,
    torque: 1050,
    torqueRpm: 5000,
    idleRpm: 1000,
    redline: 8500,
    gears: [3.0, 2.15, 1.65, 1.32, 1.08, 0.9, 0.76, 0.64],
    finalDrive: 3.3,
    drivetrain: "AWD",
    frontSplit: 0.32,
    wheelbase: 2.72,
    frontWeight: 0.43,
    cgHeight: 0.4,
    track: 1.72,
    wheelRadius: 0.35,
    tireGrip: 1.24,
    brakeForce: 23000,
    brakeBias: 0.57,
    cdA: 0.7,
    clA: 1.3,
    aeroBalance: 0.43,
    steerLock: 31 * deg,
    topSpeed: 372,
    sound: { cylinders: 8, rasp: 0.4, turbo: true, pitch: 1.1, hybridWhine: true },
    defaultColor: "#c8102e",
    body: {
      length: 4.7, width: 2.05, height: 0.82,
      top: [[0, 0.92], [0.05, 1], [0.3, 1], [0.52, 0.9], [0.75, 0.62], [0.92, 0.46], [1, 0.3]],
      plan: [[0, 0.92], [0.1, 1], [0.3, 1], [0.55, 0.86], [0.8, 0.98], [1, 0.72]],
      cabin: [0.36, 0.76, 0.4], cabinPeak: 0.65, wing: 2, clearance: 0.09,
    },
  },
  {
    id: "apexrs",
    name: "Apex RS-T",
    cls: "Track",
    blurb: "Lightweight circuit weapon with a huge rear wing. Brakes late, corners flat.",
    layout: "Mid flat-6 NA · RWD",
    price: 160000,
    unlockLevel: 4,
    mass: 1250,
    torque: 520,
    torqueRpm: 6800,
    idleRpm: 1100,
    redline: 9200,
    gears: [3.2, 2.35, 1.82, 1.46, 1.2, 1.0],
    finalDrive: 3.9,
    drivetrain: "RWD",
    frontSplit: 0,
    wheelbase: 2.5,
    frontWeight: 0.4,
    cgHeight: 0.38,
    track: 1.64,
    wheelRadius: 0.33,
    tireGrip: 1.3,
    brakeForce: 18500,
    brakeBias: 0.6,
    cdA: 0.82,
    clA: 2.1,
    aeroBalance: 0.4,
    steerLock: 30 * deg,
    topSpeed: 288,
    sound: { cylinders: 6, rasp: 0.9, turbo: false, pitch: 1.18 },
    defaultColor: "#11b37d",
    body: {
      length: 4.3, width: 1.96, height: 0.84,
      top: [[0, 0.9], [0.06, 1], [0.28, 0.98], [0.5, 0.88], [0.74, 0.66], [0.92, 0.48], [1, 0.32]],
      plan: [[0, 0.92], [0.1, 1], [0.3, 0.98], [0.55, 0.88], [0.8, 0.97], [1, 0.76]],
      cabin: [0.34, 0.72, 0.42], cabinPeak: 0.55, wing: 3, clearance: 0.08,
    },
  },
];

/** Civilian body used by free-roam traffic. */
export const TRAFFIC_CAR: CarSpec = {
  ...CARS[1],
  id: "traffic",
  name: "Sedan",
  cls: "Tuned",
  mass: 1450,
  torque: 260,
  redline: 6200,
  tireGrip: 0.95,
  topSpeed: 190,
  sound: { cylinders: 4, rasp: 0.2, turbo: false, pitch: 0.9 },
  body: {
    length: 4.6, width: 1.8, height: 1.05,
    top: [[0, 0.88], [0.1, 0.92], [0.3, 0.92], [0.55, 0.9], [0.8, 0.86], [1, 0.72]],
    plan: [[0, 0.92], [0.1, 1], [0.9, 1], [1, 0.9]],
    cabin: [0.18, 0.72, 0.5], cabinPeak: 0.45, wing: 0, clearance: 0.15,
  },
};

export function getCar(id: string): CarSpec {
  return CARS.find((c) => c.id === id) ?? CARS[0];
}

/** Performance upgrade levels 0..3 for engine, tyres, weight. */
export interface Upgrades {
  engine: number;
  tires: number;
  weight: number;
}

export interface Customization {
  color: string;
  finish: "metallic" | "gloss" | "matte" | "pearl";
  rim: number; // style index 0..2
  rimColor: string;
  wing: number; // -1 factory, 0 none, 1 lip, 2 wing, 3 big wing
  kit: number; // 0 stock, 1 aero kit
}

export const UPGRADE_COST = [0, 8000, 18000, 32000];

export function applyUpgrades(spec: CarSpec, up: Upgrades, cust?: Customization): CarSpec {
  const wing = cust && cust.wing >= 0 ? cust.wing : spec.body.wing;
  const aeroGain = (wing - spec.body.wing) * 0.25 + (cust?.kit ? 0.2 : 0);
  return {
    ...spec,
    torque: spec.torque * (1 + 0.07 * up.engine),
    tireGrip: spec.tireGrip * (1 + 0.035 * up.tires),
    mass: spec.mass * (1 - 0.03 * up.weight),
    clA: Math.max(0.1, spec.clA + aeroGain),
    cdA: spec.cdA + Math.max(0, aeroGain) * 0.04,
    topSpeed: spec.topSpeed * (1 + 0.025 * up.engine),
  };
}

/** Upper bound on any car's speed in m/s, used by the server's anti-cheat check (with nitro + downhill margin). */
export const MAX_LEGAL_SPEED = (Math.max(...CARS.map((c) => c.topSpeed)) * 1.15 * 1.25) / 3.6;
