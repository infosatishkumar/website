// Career events, daily challenges, achievements and reward application.

import { levelFromXp } from "../shared/progress.ts";
import type { TimeOfDay, Weather } from "../shared/tracks.ts";
import type { Skill } from "./ai.ts";
import type { GameMode, RaceResult } from "./game.ts";
import type { PlayerProfile } from "./settings.ts";

export interface CareerEvent {
  id: string;
  name: string;
  blurb: string;
  mode: GameMode;
  track: string;
  laps: number;
  opponents: number;
  skill: Skill;
  time: TimeOfDay;
  weather: Weather;
  /** Stars needed (from all events) to unlock. */
  requires: number;
  /** For score / time based events: [bronze, silver, gold]. Lower is better for times. */
  targets?: [number, number, number];
  duration?: number;
  reward: number;
}

export const CAREER: CareerEvent[] = [
  { id: "c1", name: "Rookie Cup", blurb: "Two laps of Apex International against rookie drivers.", mode: "race", track: "apex", laps: 2, opponents: 5, skill: "rookie", time: "day", weather: "dry", requires: 0, reward: 4000 },
  { id: "c2", name: "Hot Lap", blurb: "Set a lap time at Apex International. Beat the target times.", mode: "timetrial", track: "apex", laps: 3, opponents: 0, skill: "rookie", time: "day", weather: "dry", requires: 1, targets: [80, 74, 69], reward: 3000 },
  { id: "c3", name: "Harbor Lights", blurb: "Night street race through Neon Harbor.", mode: "race", track: "harbor", laps: 2, opponents: 5, skill: "rookie", time: "night", weather: "dry", requires: 2, reward: 5000 },
  { id: "c4", name: "Quarter Mile", blurb: "402 m drag race at Mirage Airfield. Shift on the beep.", mode: "drag", track: "runway", laps: 1, opponents: 1, skill: "pro", time: "day", weather: "dry", requires: 3, reward: 4500 },
  { id: "c5", name: "Sideways Serra", blurb: "90 seconds of drifting on the coastal pass.", mode: "drift", track: "serra", laps: 1, opponents: 0, skill: "rookie", time: "sunset", weather: "dry", requires: 4, targets: [8000, 18000, 32000], duration: 90, reward: 5000 },
  { id: "c6", name: "Coastal Sprint", blurb: "Point-to-point sprint along Serra Coast against pros.", mode: "sprint", track: "serra", laps: 1, opponents: 5, skill: "pro", time: "sunset", weather: "dry", requires: 6, reward: 7000 },
  { id: "c7", name: "Top Speed", blurb: "Hit the Mirage speed trap as fast as possible.", mode: "speed", track: "runway", laps: 1, opponents: 0, skill: "rookie", time: "day", weather: "dry", requires: 8, targets: [250, 285, 320], reward: 6000 },
  { id: "c8", name: "Monsoon Night", blurb: "Three wet laps of Neon Harbor against pro drivers.", mode: "race", track: "harbor", laps: 3, opponents: 7, skill: "pro", time: "night", weather: "rain", requires: 10, reward: 10000 },
  { id: "c9", name: "Elite Grand Prix", blurb: "Three laps at Apex against the elite field.", mode: "race", track: "apex", laps: 3, opponents: 7, skill: "elite", time: "day", weather: "dry", requires: 13, reward: 16000 },
  { id: "c10", name: "Hypercar Showdown", blurb: "Mirage Airfield, elite opponents, no mercy.", mode: "race", track: "runway", laps: 2, opponents: 7, skill: "elite", time: "sunset", weather: "dry", requires: 16, reward: 22000 },
];

export function starsFor(ev: CareerEvent, r: RaceResult): number {
  if (ev.mode === "race" || ev.mode === "sprint") return r.time === null ? 0 : r.place === 1 ? 3 : r.place === 2 ? 2 : r.place === 3 ? 1 : 0;
  if (ev.mode === "drag") return r.won ? 3 : 0;
  const t = ev.targets!;
  if (ev.mode === "timetrial") {
    const v = r.best ?? Infinity;
    return v <= t[2] ? 3 : v <= t[1] ? 2 : v <= t[0] ? 1 : 0;
  }
  const v = ev.mode === "drift" ? r.score ?? 0 : r.trap ?? 0;
  return v >= t[2] ? 3 : v >= t[1] ? 2 : v >= t[0] ? 1 : 0;
}

export function totalStars(p: PlayerProfile) {
  return Object.values(p.career).reduce((a, b) => a + b, 0);
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Deterministic daily challenge derived from the date. */
export function dailyChallenge(): CareerEvent {
  const key = todayKey();
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const templates: CareerEvent[] = [
    { id: "daily", name: "Daily: Midnight Run", blurb: "Win a night race at Neon Harbor.", mode: "race", track: "harbor", laps: 2, opponents: 5, skill: "pro", time: "night", weather: "dry", requires: 0, reward: 6000 },
    { id: "daily", name: "Daily: Wet Apex", blurb: "Lap Apex International in the rain under 1:18.", mode: "timetrial", track: "apex", laps: 3, opponents: 0, skill: "rookie", time: "day", weather: "rain", requires: 0, targets: [90, 84, 78], reward: 6000 },
    { id: "daily", name: "Daily: Drift King", blurb: "Score 20,000 drift points on Serra Coast.", mode: "drift", track: "serra", laps: 1, opponents: 0, skill: "rookie", time: "sunset", weather: "dry", requires: 0, targets: [10000, 15000, 20000], duration: 90, reward: 6000 },
    { id: "daily", name: "Daily: Runway Duel", blurb: "Win a quarter-mile drag race.", mode: "drag", track: "runway", laps: 1, opponents: 1, skill: "elite", time: "day", weather: "dry", requires: 0, reward: 6000 },
    { id: "daily", name: "Daily: Sunset Sprint", blurb: "Win the Serra Coast sprint.", mode: "sprint", track: "serra", laps: 1, opponents: 5, skill: "pro", time: "sunset", weather: "dry", requires: 0, reward: 6000 },
  ];
  return templates[h % templates.length];
}

export const ACHIEVEMENTS: { id: string; name: string; desc: string }[] = [
  { id: "first_win", name: "First Blood", desc: "Win a race" },
  { id: "podium", name: "Podium Finish", desc: "Finish a race in the top 3" },
  { id: "300", name: "300 Club", desc: "Reach 300 km/h" },
  { id: "drift10k", name: "Sideways", desc: "Score 10,000 in a drift challenge" },
  { id: "online_win", name: "Online Victor", desc: "Win an online race" },
  { id: "online_race", name: "Connected", desc: "Finish an online race" },
  { id: "collector", name: "Collector", desc: "Own 3 cars" },
  { id: "night_win", name: "Night Rider", desc: "Win a race at night" },
  { id: "rain_win", name: "Rain Master", desc: "Win a race in the rain" },
  { id: "marathon", name: "Marathon", desc: "Drive 100 km in total" },
  { id: "elite_win", name: "Giant Slayer", desc: "Beat elite AI drivers" },
  { id: "tuned", name: "Fully Tuned", desc: "Max out every upgrade on a car" },
  { id: "career3", name: "Career Star", desc: "Earn 3 stars on any career event" },
];

export interface RewardSummary {
  xp: number;
  credits: number;
  levelUp: number | null;
  stars: number | null;
  newAchievements: string[];
  newBest: boolean;
  dailyDone: boolean;
}

export function applyResult(
  p: PlayerProfile, r: RaceResult, ctx: { event?: CareerEvent; daily?: boolean; time: TimeOfDay; weather: Weather },
): { profile: PlayerProfile; summary: RewardSummary } {
  const np: PlayerProfile = structuredClone(p);
  const before = levelFromXp(np.xp);
  let credits = r.credits;
  let stars: number | null = null;
  let dailyDone = false;
  if (ctx.event && ctx.event.id !== "daily") {
    stars = starsFor(ctx.event, r);
    const prev = np.career[ctx.event.id] ?? 0;
    if (stars > prev) {
      np.career[ctx.event.id] = stars;
      if (prev === 0 && stars > 0) credits += ctx.event.reward;
    }
  }
  if (ctx.daily && ctx.event) {
    stars = starsFor(ctx.event, r);
    const passed = ctx.event.mode === "race" || ctx.event.mode === "sprint" || ctx.event.mode === "drag" ? r.won : stars >= 3;
    if (passed && !(np.daily.date === todayKey() && np.daily.done)) {
      np.daily = { date: todayKey(), done: true };
      credits += ctx.event.reward;
      dailyDone = true;
    }
  }
  np.xp += r.xp;
  np.credits += credits;
  np.stats.distance += r.distance;
  np.stats.topSpeed = Math.max(np.stats.topSpeed, r.topSpeed);
  if (r.mode === "race" || r.mode === "sprint" || r.mode === "online") {
    np.stats.races++;
    if (r.won) np.stats.wins++;
  }
  if (r.mode === "drift" && r.score) np.stats.driftBest = Math.max(np.stats.driftBest, r.score);
  if (r.mode === "drag" && r.time) np.stats.dragBest = np.stats.dragBest ? Math.min(np.stats.dragBest, r.time) : r.time;
  let newBest = false;
  if (r.best && r.mode !== "drag" && r.mode !== "speed" && r.mode !== "drift") {
    const prev = np.bestLaps[r.track];
    if (!prev || r.best < prev) { np.bestLaps[r.track] = r.best; newBest = true; }
  }
  const gained: string[] = [];
  const give = (id: string, cond: boolean) => {
    if (cond && !np.achievements.includes(id)) { np.achievements.push(id); gained.push(id); }
  };
  const raced = r.mode === "race" || r.mode === "sprint" || r.mode === "online";
  give("first_win", raced && r.won);
  give("podium", raced && r.time !== null && r.place <= 3);
  give("300", np.stats.topSpeed >= 300);
  give("drift10k", (r.score ?? 0) >= 10000 && r.mode === "drift");
  give("online_win", r.mode === "online" && r.won);
  give("online_race", r.mode === "online" && r.time !== null);
  give("collector", np.owned.length >= 3);
  give("night_win", raced && r.won && ctx.time === "night");
  give("rain_win", raced && r.won && ctx.weather === "rain");
  give("marathon", np.stats.distance >= 100000);
  give("elite_win", raced && r.won && r.skill === "elite" && r.mode !== "online");
  give("career3", Object.values(np.career).some((s) => s >= 3));
  const after = levelFromXp(np.xp);
  return { profile: np, summary: { xp: r.xp, credits, levelUp: after > before ? after : null, stars, newAchievements: gained, newBest, dailyDone } };
}
