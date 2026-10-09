"use client";

import Link from "next/link";
import { getCar } from "../../shared/cars";
import { levelFromXp, xpForLevel } from "../../shared/progress";
import { AVATAR_COLORS, type PlayerProfile } from "../../engine/settings";
import { totalStars, CAREER } from "../../engine/progression";
import type { Screen } from "../RacingApp";
import s from "../racing.module.css";

export function ProfileChip({ profile }: { profile: PlayerProfile }) {
  const lvl = levelFromXp(profile.xp);
  const a = xpForLevel(lvl), b = xpForLevel(lvl + 1);
  const pct = Math.round(((profile.xp - a) / (b - a)) * 100);
  return (
    <div className={s.row}>
      <span className={s.chip}>
        <span className={s.avatar} style={{ background: AVATAR_COLORS[profile.avatar % AVATAR_COLORS.length] }}>{(profile.name || "D")[0].toUpperCase()}</span>
        <span>{profile.name || "Driver"}</span>
        <span className={s.tag}>LV {lvl}</span>
        <span className={s.statBar} style={{ width: 60 }}><i style={{ width: `${pct}%` }} /></span>
      </span>
      <span className={s.chip}>¢ {profile.credits.toLocaleString()}</span>
    </div>
  );
}

export default function MainMenu({ profile, onNav, error, clearError }: {
  profile: PlayerProfile; onNav: (s: Screen) => void; error: string | null; clearError: () => void;
}) {
  const car = getCar(profile.selectedCar);
  const items: [Screen, string, string][] = [
    ["career", "Career", `${totalStars(profile)} / ${CAREER.length * 3} stars`],
    ["play", "Quick Race", "Race · sprint · drift · drag · free roam"],
    ["online", "Online", "Real players · ranked · private rooms"],
    ["garage", "Garage", "Cars · paint · upgrades"],
    ["records", "Records", "Leaderboards · achievements"],
    ["settings", "Settings", "Graphics · controls · audio"],
  ];
  return (
    <div className={s.screen}>
      <div className={s.topBar}>
        <div className={s.brand}>
          <div className={s.brandMark} style={{ fontSize: "clamp(26px, 3.6vw, 44px)" }}>Velocity<span>/</span>Rush</div>
        </div>
        <ProfileChip profile={profile} />
      </div>
      {error && (
        <div className={`${s.notice} ${s.error}`} role="alert" style={{ maxWidth: 520 }}>
          {error} <button className={s.btn} style={{ marginLeft: 8, padding: "4px 10px" }} onClick={clearError}>OK</button>
        </div>
      )}
      <nav className={s.menuCol} aria-label="Main menu">
        {items.map(([id, label, sub]) => (
          <button key={id} className={s.menuItem} onClick={() => onNav(id)}>
            <span>{label}</span>
            <small>{sub}</small>
          </button>
        ))}
      </nav>
      <div className={`${s.row} ${s.spread}`}>
        <div>
          <div className={s.tag}>{car.cls} · {car.layout}</div>
          <div className={s.h2}>{car.name}</div>
        </div>
        <Link href="/" className={s.btn} style={{ textDecoration: "none" }}>Exit to site</Link>
      </div>
    </div>
  );
}
