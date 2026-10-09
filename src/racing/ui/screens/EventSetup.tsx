"use client";

import { useState } from "react";
import { TRACKS, type TimeOfDay, type Weather } from "../../shared/tracks";
import { getCar } from "../../shared/cars";
import type { GameMode, SessionConfig } from "../../engine/game";
import type { Skill } from "../../engine/ai";
import type { PlayerProfile } from "../../engine/settings";
import { ProfileChip } from "./MainMenu";
import s from "../racing.module.css";

const MODES: { id: GameMode; name: string; desc: string }[] = [
  { id: "race", name: "Circuit Race", desc: "Lap race against AI drivers" },
  { id: "sprint", name: "Sprint", desc: "Point-to-point dash, 90% of a lap" },
  { id: "timetrial", name: "Time Trial", desc: "Solo hot laps with your best-lap ghost" },
  { id: "drift", name: "Drift Challenge", desc: "90 s, score angle × speed × combo" },
  { id: "drag", name: "Drag Race", desc: "402 m head-to-head on the runway" },
  { id: "speed", name: "Speed Trap", desc: "Fastest speed through the trap" },
  { id: "freeroam", name: "Free Roam", desc: "Traffic, day/night cycle, changing weather" },
];

export default function EventSetup({ profile, onStart, onBack, onGarage }: {
  profile: PlayerProfile;
  onStart: (cfg: Omit<SessionConfig, "car" | "playerName">) => void;
  onBack: () => void;
  onGarage: () => void;
}) {
  const [mode, setMode] = useState<GameMode>("race");
  const [track, setTrack] = useState("apex");
  const [laps, setLaps] = useState(3);
  const [opponents, setOpponents] = useState(5);
  const [skill, setSkill] = useState<Skill>("pro");
  const [time, setTime] = useState<TimeOfDay | "default">("default");
  const [weather, setWeather] = useState<Weather | "default">("default");
  const [traffic, setTraffic] = useState(true);
  const [dynamic, setDynamic] = useState(true);
  const runwayOnly = mode === "drag" || mode === "speed";
  const trackId = runwayOnly ? "runway" : track;
  const def = TRACKS.find((t) => t.id === trackId)!;
  const car = getCar(profile.selectedCar);

  const start = () => {
    onStart({
      mode, track: trackId, laps: mode === "timetrial" ? 0 : laps, opponents, skill,
      time: time === "default" ? def.defaultTime : time,
      weather: weather === "default" ? def.defaultWeather : weather,
      dynamicTime: mode === "freeroam" && dynamic, dynamicWeather: mode === "freeroam" && dynamic,
      traffic: mode === "freeroam" && traffic,
      duration: mode === "drift" ? 90 : undefined,
      label: `${MODES.find((m) => m.id === mode)!.name} · ${def.name}`,
    });
  };

  return (
    <div className={`${s.screen} ${s.screenDim}`}>
      <div className={s.topBar}>
        <div>
          <div className={s.kicker}>Quick race</div>
          <h1 className={s.title}>Event setup</h1>
        </div>
        <ProfileChip profile={profile} />
      </div>
      <div>
        <span className={s.label}>Mode</span>
        <div className={s.grid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {MODES.map((m) => (
            <button key={m.id} className={`${s.card} ${mode === m.id ? s.cardActive : ""}`} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}>
              <span className={s.cardTitle}>{m.name}</span>
              <span className={s.muted} style={{ fontSize: 12 }}>{m.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className={s.label}>Location {runwayOnly && "(this mode runs on the airfield)"}</span>
        <div className={s.grid}>
          {TRACKS.map((t) => (
            <button key={t.id} disabled={runwayOnly && t.id !== "runway"} className={`${s.card} ${trackId === t.id ? s.cardActive : ""} ${runwayOnly && t.id !== "runway" ? s.cardLocked : ""}`} onClick={() => setTrack(t.id)} aria-pressed={trackId === t.id}>
              <span className={s.cardTitle}>{t.name}</span>
              <span className={s.muted} style={{ fontSize: 12 }}>{t.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.row} style={{ gap: 22, alignItems: "flex-start" }}>
        {mode === "race" && (
          <div className={s.field}>
            <span className={s.label}>Laps</span>
            <div className={s.seg}>{[1, 2, 3, 5].map((n) => <button key={n} aria-pressed={laps === n} onClick={() => setLaps(n)}>{n}</button>)}</div>
          </div>
        )}
        {(mode === "race" || mode === "sprint") && (
          <div className={s.field}>
            <span className={s.label}>Opponents</span>
            <div className={s.seg}>{[1, 3, 5, 7].map((n) => <button key={n} aria-pressed={opponents === n} onClick={() => setOpponents(n)}>{n}</button>)}</div>
          </div>
        )}
        {(mode === "race" || mode === "sprint" || mode === "drag") && (
          <div className={s.field}>
            <span className={s.label}>AI skill</span>
            <div className={s.seg}>{(["rookie", "pro", "elite"] as const).map((n) => <button key={n} aria-pressed={skill === n} onClick={() => setSkill(n)}>{n}</button>)}</div>
          </div>
        )}
        <div className={s.field}>
          <span className={s.label}>Time of day</span>
          <div className={s.seg}>{(["default", "day", "sunset", "night"] as const).map((n) => <button key={n} aria-pressed={time === n} onClick={() => setTime(n)}>{n === "default" ? `Auto (${def.defaultTime})` : n}</button>)}</div>
        </div>
        <div className={s.field}>
          <span className={s.label}>Weather</span>
          <div className={s.seg}>{(["default", "dry", "rain"] as const).map((n) => <button key={n} aria-pressed={weather === n} onClick={() => setWeather(n)}>{n === "default" ? `Auto (${def.defaultWeather})` : n}</button>)}</div>
        </div>
        {mode === "freeroam" && (
          <div className={s.field}>
            <span className={s.label}>World</span>
            <label className={s.switch}><span>Traffic {def.traffic ? "" : "(street maps only)"}</span><input type="checkbox" checked={traffic} onChange={(e) => setTraffic(e.target.checked)} disabled={!def.traffic} /></label>
            <label className={s.switch}><span>Day/night cycle & weather changes</span><input type="checkbox" checked={dynamic} onChange={(e) => setDynamic(e.target.checked)} /></label>
          </div>
        )}
      </div>
      <div className={`${s.row} ${s.spread}`} style={{ marginTop: "auto" }}>
        <div className={s.row}>
          <div>
            <div className={s.tag}>Your car</div>
            <div className={s.cardTitle}>{car.name}</div>
          </div>
          <button className={s.btn} onClick={onGarage}>Change</button>
        </div>
        <div className={s.row}>
          <button className={s.btn} onClick={onBack}>Back</button>
          <button className={`${s.btn} ${s.primary}`} onClick={start}>Start</button>
        </div>
      </div>
    </div>
  );
}
