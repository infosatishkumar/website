// Wire protocol between the browser client and the authoritative race server.
// Messages are JSON objects with a `t` (type) field.

import type { Customization, Upgrades } from "./cars.ts";
import type { TimeOfDay, Weather } from "./tracks.ts";

export const PROTOCOL_VERSION = 1;
export const MAX_PLAYERS = 12;
export const SNAPSHOT_HZ = 20;
export const STATE_HZ = 20;

export interface Loadout {
  id: string;
  cust: Customization;
  up: Upgrades;
}

export interface RoomSettings {
  track: string;
  laps: number;
  maxPlayers: number;
  /** Number of races in a tournament series (1 = single race). */
  series: number;
  time: TimeOfDay;
  weather: Weather;
  collisions: boolean;
}

export type RoomPhase = "lobby" | "countdown" | "race" | "results";
export type RoomKind = "public" | "private" | "timetrial";

export interface LobbyPlayer {
  id: string;
  name: string;
  avatar: number;
  car: Loadout;
  ready: boolean;
  ping: number;
  connected: boolean;
  rating: number;
  level: number;
  points: number;
}

export interface Profile {
  name: string;
  avatar: number;
  xp: number;
  level: number;
  rating: number;
  races: number;
  wins: number;
}

/**
 * Car state as sent by clients and relayed in snapshots:
 * [x, y, z, yaw, pitch, roll, vx, vz, steer, rpm, gear, flags, damage]
 * flags bit 0 brake, 1 reverse, 2 headlights, 3 nitro, 4 left ind, 5 right ind, 6 sliding
 */
export type CarState = number[];
export const STATE_LEN = 13;

export interface ResultRow {
  id: string;
  name: string;
  car: string;
  place: number;
  time: number | null;
  best: number | null;
  laps: number;
  dnf: boolean;
  xp: number;
  ratingDelta: number;
  points: number;
  seriesPoints: number;
}

export type ClientMsg =
  | { t: "hello"; v: number; name: string; avatar: number; token?: string }
  | { t: "ping"; c: number; rtt?: number }
  | { t: "quick"; car: Loadout }
  | { t: "create"; settings: RoomSettings; car: Loadout }
  | { t: "join"; code: string; car: Loadout }
  | { t: "timetrial"; track: string; car: Loadout }
  | { t: "leave" }
  | { t: "ready"; ready: boolean }
  | { t: "car"; car: Loadout }
  | { t: "settings"; settings: RoomSettings }
  | { t: "start" }
  | { t: "state"; s: CarState }
  | { t: "respawn" }
  | { t: "lb"; track: string };

export type ServerMsg =
  | { t: "welcome"; id: string; token: string; profile: Profile; region: string; serverTime: number }
  | { t: "pong"; c: number; s: number }
  | {
      t: "room";
      code: string;
      kind: RoomKind;
      hostId: string;
      settings: RoomSettings;
      phase: RoomPhase;
      players: LobbyPlayer[];
      raceIndex: number;
      autoStartAt: number | null;
    }
  | { t: "start"; startAt: number; settings: RoomSettings; grid: { id: string; slot: number }[]; kind: RoomKind }
  | { t: "snap"; time: number; p: [string, CarState, number, number, number, number][] } // id, state, lap, nextCp, finished, position
  | { t: "lap"; id: string; lap: number; time: number; best: number }
  | { t: "finish"; id: string; place: number; time: number }
  | { t: "results"; rows: ResultRow[]; final: boolean; raceIndex: number }
  | { t: "correct"; x: number; y: number; z: number; yaw: number; reason: string }
  | { t: "profile"; profile: Profile }
  | { t: "lbdata"; track: string; laps: { name: string; car: string; time: number; date: number }[]; ratings: { name: string; rating: number; wins: number }[] }
  | { t: "left"; reason: string }
  | { t: "error"; msg: string };
