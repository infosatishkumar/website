import type { AchievementId, Brand } from "./engine";

export type Award = {
  /** Points earned before the combo multiplier. */
  points: number;
  /** Points that were possible. Drives the accuracy grade. */
  max: number;
  /** Counts toward (or breaks) the combo streak. Omit for neutral choices. */
  correct?: boolean;
  label?: string;
};

export type GameApi = {
  brand: Brand;
  update: (patch: Partial<Brand>) => void;
  award: (a: Award) => void;
  unlock: (id: AchievementId) => void;
  /** Finish the current level. */
  done: () => void;
};

export type LevelProps = { game: GameApi };
