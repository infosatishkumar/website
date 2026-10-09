"use client";

import { getCar } from "../../shared/cars";
import { fmt, type RaceResult } from "../../engine/game";
import { ACHIEVEMENTS, type CareerEvent, type RewardSummary } from "../../engine/progression";
import type { PlayerProfile } from "../../engine/settings";
import s from "../racing.module.css";

const ord = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

export default function Results({ result: r, rewards, event, onReplay, onRestart, onContinue, online }: {
  result: RaceResult; rewards: RewardSummary | null; profile: PlayerProfile; event?: CareerEvent;
  onReplay: () => void; onRestart: (() => void) | null; onContinue: () => void; online: boolean;
}) {
  const headline = (() => {
    switch (r.mode) {
      case "drift": return { big: (r.score ?? 0).toLocaleString(), sub: "drift points" };
      case "speed": return { big: `${Math.round(r.trap ?? 0)}`, sub: "km/h through the trap" };
      case "drag": return { big: r.won ? "WIN" : "LOSS", sub: r.time ? `${r.time.toFixed(3)} s · trap ${Math.round(r.trap ?? 0)} km/h${r.reaction !== null ? ` · reaction ${r.reaction.toFixed(3)} s` : ""}` : "did not finish" };
      case "timetrial": return { big: fmt(r.best), sub: "best lap" };
      case "freeroam": return { big: `${(r.distance / 1000).toFixed(1)} km`, sub: `driven · top speed ${r.topSpeed} km/h` };
      default: return { big: r.time === null && !r.online ? "DNF" : ord(r.place), sub: `of ${r.total}${r.time !== null ? ` · ${fmt(r.time)}` : ""}` };
    }
  })();
  const onlineRows = r.online?.rows;
  return (
    <div className={`${s.screen} ${s.screenDim}`}>
      <div className={s.kicker}>{r.label ?? (online ? "Online race" : "Results")}{r.online && r.online.raceIndex > 0 ? ` · race ${r.online.raceIndex + 1}` : ""}</div>
      <div className={s.resultsHero}>
        <div className={s.place}>{headline.big}</div>
        <div className={s.h2} style={{ paddingBottom: 12 }}>{headline.sub}</div>
      </div>
      <div className={s.row}>
        {rewards && (
          <>
            <div className={s.reward}><span className={s.tag}>XP</span><b>+{rewards.xp}</b></div>
            <div className={s.reward}><span className={s.tag}>Credits</span><b>¢ {rewards.credits.toLocaleString()}</b></div>
            {rewards.stars !== null && event && <div className={s.reward}><span className={s.tag}>{event.name}</span><b className={s.stars} style={{ fontSize: 26 }}>{"★".repeat(rewards.stars)}{"☆".repeat(3 - rewards.stars)}</b></div>}
            {rewards.levelUp && <div className={s.reward}><span className={s.tag}>Level up</span><b>LV {rewards.levelUp}</b></div>}
            {rewards.newBest && <div className={s.reward}><span className={s.tag}>Personal best</span><b>{fmt(r.best)}</b></div>}
            {rewards.dailyDone && <div className={s.reward}><span className={s.tag}>Daily</span><b>Complete</b></div>}
          </>
        )}
        <div className={s.reward}><span className={s.tag}>Top speed</span><b>{r.topSpeed} km/h</b></div>
        {r.best !== null && r.mode !== "timetrial" && <div className={s.reward}><span className={s.tag}>Best lap</span><b>{fmt(r.best)}</b></div>}
      </div>
      {rewards && rewards.newAchievements.length > 0 && (
        <div className={s.notice} style={{ maxWidth: 560 }}>
          Achievement{rewards.newAchievements.length > 1 ? "s" : ""} unlocked: {rewards.newAchievements.map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name).join(", ")}
        </div>
      )}
      {onlineRows ? (
        <div className={s.panel} style={{ maxWidth: 860 }}>
          <table className={s.table}>
            <thead><tr><th>Pos</th><th>Driver</th><th>Car</th><th>Time</th><th>Best lap</th><th>XP</th><th>Rating</th>{onlineRows.some((x) => x.seriesPoints) ? <th>Series pts</th> : null}</tr></thead>
            <tbody>
              {onlineRows.map((row) => (
                <tr key={row.id} className={row.place === r.place && row.name === r.rows.find((x) => x.player)?.name ? s.me : undefined}>
                  <td>{row.dnf ? "DNF" : row.place}</td><td>{row.name}</td><td>{getCar(row.car).name}</td>
                  <td>{row.time !== null ? fmt(row.time / 1000) : "—"}</td><td>{row.best !== null ? fmt(row.best / 1000) : "—"}</td>
                  <td>+{row.xp}</td><td>{row.ratingDelta > 0 ? `+${row.ratingDelta}` : row.ratingDelta || "—"}</td>
                  {onlineRows.some((x) => x.seriesPoints) ? <td>{row.seriesPoints} (+{row.points})</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.muted} style={{ marginTop: 10 }}>
            Results are decided by the race server. {r.online && !r.online.final ? "Next race of the tournament starts automatically." : "The room returns to the lobby shortly."}
          </div>
        </div>
      ) : r.rows.length > 1 ? (
        <div className={s.panel} style={{ maxWidth: 760 }}>
          <table className={s.table}>
            <thead><tr><th>Pos</th><th>Driver</th><th>Car</th><th>Time</th><th>Best lap</th></tr></thead>
            <tbody>
              {r.rows.map((row) => (
                <tr key={row.place} className={row.player ? s.me : undefined}>
                  <td>{row.dnf ? "DNF" : row.place}</td><td>{row.name}</td><td>{row.car}</td><td>{fmt(row.time)}</td><td>{fmt(row.best)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className={s.row} style={{ marginTop: "auto" }}>
        <button className={s.btn} onClick={onReplay}>Watch replay</button>
        {onRestart && <button className={s.btn} onClick={onRestart}>Restart</button>}
        <button className={`${s.btn} ${s.primary}`} onClick={onContinue}>{online ? "Back to lobby" : "Continue"}</button>
      </div>
    </div>
  );
}
