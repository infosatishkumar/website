"use client";

import { TRACKS } from "../../shared/tracks";
import { CAREER, dailyChallenge, totalStars, todayKey, type CareerEvent } from "../../engine/progression";
import type { PlayerProfile } from "../../engine/settings";
import { fmt } from "../../engine/game";
import { ProfileChip } from "./MainMenu";
import s from "../racing.module.css";

function targetText(ev: CareerEvent) {
  if (!ev.targets) return ev.mode === "drag" ? "Win the duel" : "Finish 1st / 2nd / 3rd for 3 / 2 / 1 stars";
  const [b, si, g] = ev.targets;
  if (ev.mode === "timetrial") return `Gold ${fmt(g)} · Silver ${fmt(si)} · Bronze ${fmt(b)}`;
  if (ev.mode === "speed") return `Gold ${g} · Silver ${si} · Bronze ${b} km/h`;
  return `Gold ${g.toLocaleString()} · Silver ${si.toLocaleString()} · Bronze ${b.toLocaleString()}`;
}

export default function Career({ profile, onStart, onBack }: { profile: PlayerProfile; onStart: (ev: CareerEvent, daily: boolean) => void; onBack: () => void }) {
  const stars = totalStars(profile);
  const daily = dailyChallenge();
  const dailyDone = profile.daily.date === todayKey() && profile.daily.done;
  return (
    <div className={`${s.screen} ${s.screenDim}`}>
      <div className={s.topBar}>
        <div>
          <div className={s.kicker}>Career · {stars} stars</div>
          <h1 className={s.title}>Championship road</h1>
        </div>
        <ProfileChip profile={profile} />
      </div>
      <button className={`${s.card} ${s.cardActive}`} onClick={() => onStart(daily, true)} style={{ maxWidth: 640 }}>
        <span className={s.tag}>Daily challenge · {dailyDone ? "completed today" : `reward ¢ ${daily.reward.toLocaleString()}`}</span>
        <span className={s.cardTitle}>{daily.name}</span>
        <span className={s.muted} style={{ fontSize: 13 }}>{daily.blurb}</span>
      </button>
      <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
        {CAREER.map((ev, i) => {
          const locked = stars < ev.requires;
          const got = profile.career[ev.id] ?? 0;
          const track = TRACKS.find((t) => t.id === ev.track)!;
          return (
            <button key={ev.id} className={`${s.card} ${locked ? s.cardLocked : ""}`} disabled={locked} onClick={() => onStart(ev, false)}>
              <span className={s.tag}>Event {i + 1} · {track.name} · {ev.time}{ev.weather === "rain" ? " · rain" : ""}</span>
              <span className={s.cardTitle}>{ev.name}</span>
              <span className={s.muted} style={{ fontSize: 13 }}>{ev.blurb}</span>
              <span className={s.tag}>{targetText(ev)}</span>
              <span className={`${s.row} ${s.spread}`}>
                <span className={s.stars}>{"★".repeat(got)}{"☆".repeat(3 - got)}</span>
                <span className={s.tag}>{locked ? `🔒 ${ev.requires} stars` : `¢ ${ev.reward.toLocaleString()} first clear`}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className={s.row}>
        <button className={s.btn} onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
