// XP / level curve shared by the client profile and the server profile.

export function levelFromXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 300)) + 1;
}

export function xpForLevel(level: number) {
  return (level - 1) * (level - 1) * 300;
}

/** Points awarded per finishing place in tournament series. */
export const SERIES_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0, 0];

export function raceXp(place: number, count: number, finished: boolean) {
  if (!finished) return 40;
  return 120 + Math.max(0, count - place) * 45 + (place === 1 && count > 1 ? 100 : 0);
}
