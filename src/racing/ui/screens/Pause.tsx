"use client";

import { useState } from "react";
import type { Game } from "../../engine/game";
import { CAMERA_MODES, type Settings } from "../../engine/settings";
import { AudioSettings, DrivingSettings, GraphicsSettings, Seg } from "./SettingsScreen";
import s from "../racing.module.css";

export default function Pause({ game, settings, updateSettings, onResume, onRestart, onEnd, onQuit }: {
  game: Game; settings: Settings; updateSettings: (p: Partial<Settings>) => void;
  onResume: () => void; onRestart: (() => void) | null; onEnd: (() => void) | null; onQuit: () => void;
}) {
  const [tab, setTab] = useState<"menu" | "driving" | "graphics" | "audio">("menu");
  const [hours, setHours] = useState(() => Math.round(game.worldHours * 2) / 2);
  const freeroam = game.cfg.mode === "freeroam";
  return (
    <div className={`${s.screen} ${s.screenDim}`} style={{ background: "rgba(7,8,10,0.72)" }}>
      <div className={s.kicker}>{game.cfg.online ? "Menu – the race continues online" : "Paused"}</div>
      <h1 className={s.title}>{game.cfg.label ?? game.track.def.name}</h1>
      {tab === "menu" ? (
        <nav className={s.menuCol} style={{ marginTop: 0 }}>
          <button className={s.menuItem} onClick={onResume}><span>Resume</span><small>Esc</small></button>
          {onRestart && <button className={s.menuItem} onClick={onRestart}><span>Restart</span></button>}
          {onEnd && <button className={s.menuItem} onClick={onEnd}><span>End session</span><small>see results</small></button>}
          <button className={s.menuItem} onClick={() => setTab("driving")}><span>Driving & camera</span></button>
          <button className={s.menuItem} onClick={() => setTab("graphics")}><span>Graphics</span></button>
          <button className={s.menuItem} onClick={() => setTab("audio")}><span>Audio</span></button>
          <button className={s.menuItem} onClick={onQuit}><span>{game.cfg.online ? "Leave race" : "Quit to menu"}</span></button>
        </nav>
      ) : (
        <div className={s.panel} style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 12 }}>
          {tab === "driving" && (
            <>
              <div className={s.field}>
                <span className={s.label}>Camera</span>
                <Seg value={game.rig.mode} options={CAMERA_MODES.map((m) => [m, m])} onChange={(m) => { game.setCamera(m); updateSettings({ camera: m }); }} />
              </div>
              <DrivingSettings settings={settings} update={updateSettings} />
            </>
          )}
          {tab === "graphics" && <GraphicsSettings settings={settings} update={updateSettings} />}
          {tab === "audio" && <AudioSettings settings={settings} update={updateSettings} />}
          <button className={s.btn} onClick={() => setTab("menu")}>Back</button>
        </div>
      )}
      {freeroam && tab === "menu" && (
        <div className={s.panel} style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 8 }}>
          <span className={s.label}>World – time {String(Math.floor(hours)).padStart(2, "0")}:00</span>
          <input type="range" className={s.slider} min={0} max={23.5} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          <div className={s.row}>
            <button className={s.btn} onClick={() => game.setWorld(hours, game.worldWeather)}>Apply time</button>
            <button className={s.btn} onClick={() => game.setWorld(game.worldHours, game.worldWeather === "rain" ? "dry" : "rain")}>Toggle rain</button>
          </div>
        </div>
      )}
    </div>
  );
}
