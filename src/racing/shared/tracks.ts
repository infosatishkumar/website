// Track definitions shared by the browser client and the multiplayer server.
// Tracks are closed loops described by a polygon of corners; each corner is
// rounded with a fillet radius and the result is smoothed and resampled into
// an evenly spaced centreline (see trackGeom.ts).

export type Environment = "circuit" | "city" | "coast" | "desert";
export type TimeOfDay = "day" | "sunset" | "night";
export type Weather = "dry" | "rain";

export interface Segment {
  /** Index of the corner the segment starts at. */
  seg: number;
  /** Fractions (0..1) along that segment where the feature starts / ends. */
  a: number;
  b: number;
}

export interface TrackDef {
  id: string;
  name: string;
  subtitle: string;
  environment: Environment;
  /** Road width in metres. */
  width: number;
  /** Extra run-off between the road edge and the barrier on each side. */
  runoff: number;
  laps: number;
  defaultTime: TimeOfDay;
  defaultWeather: Weather;
  /** [x, z, y(elevation), filletRadius] – a radius of 0 keeps the point as-is. */
  corners: [number, number, number, number][];
  tunnels?: Segment[];
  bridges?: Segment[];
  /** Distance in metres from s=0 to the drag strip finish (desert only). */
  dragDistance?: number;
  /** Speed trap position as s in metres (desert only). */
  speedTrapS?: number;
  /** Whether the free-roam traffic system populates this map. */
  traffic: boolean;
}

export const TRACKS: TrackDef[] = [
  {
    id: "apex",
    name: "Apex International",
    subtitle: "Professional race circuit · grandstands, pit lane, curbs",
    environment: "circuit",
    width: 15,
    runoff: 9,
    laps: 3,
    defaultTime: "day",
    defaultWeather: "dry",
    traffic: false,
    corners: [
      [0, 0, 0, 0],
      [350, 0, 0, 70],
      [500, 120, 1, 60],
      [440, 260, 4, 45],
      [300, 280, 6, 30],
      [200, 215, 6, 25],
      [110, 250, 5, 30],
      [60, 360, 4, 45],
      [-80, 405, 3, 60],
      [-260, 380, 2, 50],
      [-330, 300, 1, 35],
      [-290, 200, 0, 30],
      [-390, 120, 0, 40],
      [-470, 40, 0, 45],
      [-380, 0, 0, 45],
      [-200, 0, 0, 0],
    ],
  },
  {
    id: "harbor",
    name: "Neon Harbor",
    subtitle: "Night city street circuit · tunnel, waterfront, neon",
    environment: "city",
    width: 13,
    runoff: 2,
    laps: 3,
    defaultTime: "night",
    defaultWeather: "rain",
    traffic: true,
    corners: [
      [0, 0, 0, 0],
      [260, 0, 0, 28],
      [300, 140, 4, 32],
      [180, 200, 8, 18],
      [200, 330, 8, 26],
      [-60, 360, 4, 32],
      [-200, 260, 2, 24],
      [-160, 140, 1, 18],
      [-280, 60, 0, 26],
      [-260, 0, 0, 26],
    ],
    tunnels: [{ seg: 3, a: 0.12, b: 0.88 }],
  },
  {
    id: "serra",
    name: "Serra Coast",
    subtitle: "Coastal mountain pass · cliffs, bridge, tunnel, hairpins",
    environment: "coast",
    width: 12,
    runoff: 3,
    laps: 2,
    defaultTime: "sunset",
    defaultWeather: "dry",
    traffic: true,
    corners: [
      [0, 0, 10, 0],
      [200, -20, 12, 60],
      [330, 60, 9, 45],
      [360, 250, 14, 50],
      [300, 420, 24, 35],
      [180, 460, 32, 22],
      [240, 560, 40, 18],
      [80, 620, 46, 40],
      [-60, 540, 40, 30],
      [-20, 420, 32, 25],
      [-140, 330, 26, 30],
      [-100, 200, 20, 30],
      [-200, 100, 15, 40],
      [-120, 10, 11, 40],
    ],
    tunnels: [{ seg: 3, a: 0.25, b: 0.7 }],
    bridges: [{ seg: 10, a: 0.2, b: 0.8 }],
  },
  {
    id: "runway",
    name: "Mirage Airfield",
    subtitle: "Desert airport runway · drag strip, speed trap, heat haze",
    environment: "desert",
    width: 30,
    runoff: 14,
    laps: 2,
    defaultTime: "day",
    defaultWeather: "dry",
    traffic: false,
    corners: [
      [0, 0, 0, 0],
      [2100, 0, 0, 90],
      [2100, 260, 0, 90],
      [-150, 260, 0, 90],
      [-150, 0, 0, 90],
    ],
    dragDistance: 402,
    speedTrapS: 1500,
  },
];

export function getTrack(id: string): TrackDef {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}
