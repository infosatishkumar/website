"use client";

import { useEffect, useState } from "react";
import { TRACKS } from "../../shared/tracks";
import { getCar } from "../../shared/cars";
import { ACHIEVEMENTS } from "../../engine/progression";
import { configuredServers, httpUrl } from "../../engine/net";
import { fmt } from "../../engine/game";
import type { PlayerProfile, Settings } from "../../engine/settings";
import { ProfileChip } from "./MainMenu";
import s from "../racing.module.css";

interface Lb {
  laps: { name: string; car: string; time: number; date: number }[];
  ratings: { name: string; rating: number; wins: number }[];
}

export default function Records({ profile, settings, onBack }: { profile: PlayerProfile; settings: Settings; onBack: () => void }) {
  const [tab, setTab] = useState<"global" | "local" | "achievements" | "stats">("global");
  const [track, setTrack] = useState("apex");
  const server = configuredServers(settings.server)[0];
  const key = server ? `${server.url}|${track}` : "";
  // Results are keyed by server+track so stale data never shows for another track.
  const [fetched, setFetched] = useState<{ key: string; data: Lb | null; err: string | null } | null>(null);
  const lb = fetched?.key === key ? fetched.data : null;
  const lbErr = !server ? "No race server configured – the global leaderboard lives on the multiplayer server." : fetched?.key === key ? fetched.err : null;

  useEffect(() => {
    if (tab !== "global" || !server) return;
    let alive = true;
    fetch(`${httpUrl(server.url)}/leaderboard?track=${track}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setFetched({ key, data: j, err: null }); })
      .catch(() => { if (alive) setFetched({ key, data: null, err: `Could not reach ${server.url}` }); });
    return () => { alive = false; };
  }, [tab, track, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const st = profile.stats;
  return (
    <div className={`${s.screen} ${s.screenDim}`}>
      <div className={s.topBar}>
        <div>
          <div className={s.kicker}>Records</div>
          <h1 className={s.title}>Hall of fame</h1>
        </div>
        <ProfileChip profile={profile} />
      </div>
      <div className={s.tabs} role="tablist">
        {(["global", "local", "achievements", "stats"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === "global" ? "Global leaderboard" : t === "local" ? "Personal bests" : t}</button>
        ))}
      </div>
      {tab === "global" && (
        <div className={s.split}>
          <div className={s.panel}>
            <div className={s.seg} style={{ marginBottom: 12 }}>{TRACKS.map((t) => <button key={t.id} aria-pressed={track === t.id} onClick={() => setTrack(t.id)}>{t.name}</button>)}</div>
            {lbErr && <div className={s.notice}>{lbErr}</div>}
            {!lbErr && !lb && <div className={s.muted}>Loading…</div>}
            {lb && (
              <table className={s.table}>
                <thead><tr><th>#</th><th>Driver</th><th>Car</th><th>Lap</th></tr></thead>
                <tbody>
                  {lb.laps.length === 0 && <tr><td colSpan={4} className={s.muted}>No validated laps yet. Set one in an online race or online time trial.</td></tr>}
                  {lb.laps.map((l, i) => (
                    <tr key={i} className={l.name === profile.name ? s.me : undefined}><td>{i + 1}</td><td>{l.name}</td><td>{getCar(l.car).name}</td><td>{fmt(l.time / 1000)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className={s.panel}>
            <div className={s.h2} style={{ marginBottom: 10 }}>Ranked ratings</div>
            {lb && (
              <table className={s.table}>
                <thead><tr><th>#</th><th>Driver</th><th>Rating</th><th>Wins</th></tr></thead>
                <tbody>
                  {lb.ratings.length === 0 && <tr><td colSpan={4} className={s.muted}>No ranked races yet.</td></tr>}
                  {lb.ratings.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.name}</td><td>{r.rating}</td><td>{r.wins}</td></tr>)}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      {tab === "local" && (
        <div className={s.panel} style={{ maxWidth: 640 }}>
          <table className={s.table}>
            <thead><tr><th>Track</th><th>Best lap</th></tr></thead>
            <tbody>
              {TRACKS.map((t) => <tr key={t.id}><td>{t.name}</td><td>{fmt(profile.bestLaps[t.id])}</td></tr>)}
              <tr><td>Drift best</td><td>{st.driftBest.toLocaleString()} pts</td></tr>
              <tr><td>Quarter mile</td><td>{st.dragBest ? `${st.dragBest.toFixed(3)} s` : "—"}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {tab === "achievements" && (
        <div className={s.grid}>
          {ACHIEVEMENTS.map((a) => {
            const got = profile.achievements.includes(a.id);
            return (
              <div key={a.id} className={`${s.card} ${got ? s.cardActive : s.cardLocked}`}>
                <span className={s.tag}>{got ? "Unlocked" : "Locked"}</span>
                <span className={s.cardTitle}>{a.name}</span>
                <span className={s.muted} style={{ fontSize: 13 }}>{a.desc}</span>
              </div>
            );
          })}
        </div>
      )}
      {tab === "stats" && (
        <div className={s.row} style={{ gap: 12 }}>
          {[
            ["Races", st.races], ["Wins", st.wins], ["Distance", `${(st.distance / 1000).toFixed(1)} km`],
            ["Top speed", `${st.topSpeed} km/h`], ["Cars owned", profile.owned.length], ["Credits", `¢ ${profile.credits.toLocaleString()}`],
          ].map(([k, v]) => (
            <div key={k as string} className={s.reward}><span className={s.tag}>{k}</span><b>{v}</b></div>
          ))}
        </div>
      )}
      <div className={s.row} style={{ marginTop: "auto" }}>
        <button className={s.btn} onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
