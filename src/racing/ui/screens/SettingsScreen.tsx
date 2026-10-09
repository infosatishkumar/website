"use client";

import { useState } from "react";
import {
  AVATAR_COLORS, DEFAULT_KEYS, CAMERA_MODES, type Action, type PlayerProfile, type Settings,
} from "../../engine/settings";
import type { Input } from "../../engine/input";
import s from "../racing.module.css";

const ACTION_LABELS: Record<Action, string> = {
  throttle: "Accelerate", brake: "Brake / reverse", left: "Steer left", right: "Steer right", handbrake: "Handbrake",
  nitro: "Nitro", shiftUp: "Shift up", shiftDown: "Shift down", camera: "Change camera", pause: "Pause",
  lookBack: "Look back", reset: "Reset car", indLeft: "Left indicator", indRight: "Right indicator", hazard: "Hazards",
  lights: "Headlights", horn: "Horn",
};

const KEY_NAMES: Record<string, string> = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", ShiftLeft: "L-Shift", ShiftRight: "R-Shift",
  ControlLeft: "L-Ctrl", ControlRight: "R-Ctrl", AltLeft: "L-Alt", AltRight: "R-Alt", Escape: "Esc",
};
const keyName = (c: string) => KEY_NAMES[c] ?? c.replace(/^Key/, "").replace(/^Digit/, "");

export function Seg<T extends string | number | boolean>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className={s.seg}>
      {options.map(([v, l]) => <button key={String(v)} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function GraphicsSettings({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  return (
    <>
      <div className={s.field}>
        <span className={s.label}>Quality preset</span>
        <Seg value={settings.quality} options={[["low", "Low"], ["medium", "Medium"], ["ultra", "Ultra"]]} onChange={(q) => update({ quality: q })} />
        <span className={s.muted} style={{ fontSize: 12 }}>
          Low: no shadows, 1× resolution, fewer trees/particles. Medium: shadows, 1.5× cap. Ultra: soft 4K shadows, bloom, heat haze, HRTF audio, 2× cap.
          Changing the preset fully applies on the next track load.
        </span>
      </div>
      <label className={s.switch}><span>Adaptive resolution (holds frame rate)</span><input type="checkbox" checked={settings.adaptiveResolution} onChange={(e) => update({ adaptiveResolution: e.target.checked })} /></label>
      <label className={s.switch}><span>Show FPS</span><input type="checkbox" checked={settings.showFps} onChange={(e) => update({ showFps: e.target.checked })} /></label>
    </>
  );
}

export function DrivingSettings({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  return (
    <>
      <div className={s.field}>
        <span className={s.label}>Handling model</span>
        <Seg value={settings.handling} options={[["arcade", "Arcade"], ["sport", "Sport"], ["sim", "Simulation"]]} onChange={(h) => update({ handling: h })} />
        <span className={s.muted} style={{ fontSize: 12 }}>Arcade adds grip, steering help and forces all assists on. Simulation uses raw tyre grip and quicker steering.</span>
      </div>
      <label className={s.switch}><span>ABS (anti-lock brakes)</span><input type="checkbox" checked={settings.abs} onChange={(e) => update({ abs: e.target.checked })} /></label>
      <label className={s.switch}><span>Traction control</span><input type="checkbox" checked={settings.tc} onChange={(e) => update({ tc: e.target.checked })} /></label>
      <label className={s.switch}><span>Stability control (ESC)</span><input type="checkbox" checked={settings.esc} onChange={(e) => update({ esc: e.target.checked })} /></label>
      <label className={s.switch}><span>Automatic gearbox</span><input type="checkbox" checked={settings.autoGear} onChange={(e) => update({ autoGear: e.target.checked })} /></label>
      <div className={s.field}>
        <span className={s.label}>Default camera</span>
        <Seg value={settings.camera} options={CAMERA_MODES.map((m) => [m, m])} onChange={(c) => update({ camera: c })} />
      </div>
      <div className={s.field}>
        <span className={s.label}>Units</span>
        <Seg value={settings.units} options={[["kmh", "km/h"], ["mph", "mph"]]} onChange={(u) => update({ units: u })} />
      </div>
    </>
  );
}

export function AudioSettings({ settings, update }: { settings: Settings; update: (p: Partial<Settings>) => void }) {
  return (
    <>
      {(["master", "engine", "effects", "ambience"] as const).map((k) => (
        <div key={k} className={s.field}>
          <span className={s.label}>{k} {Math.round(settings[k] * 100)}%</span>
          <input type="range" className={s.slider} min={0} max={1} step={0.05} value={settings[k]} onChange={(e) => update({ [k]: Number(e.target.value) })} aria-label={`${k} volume`} />
        </div>
      ))}
    </>
  );
}

export default function SettingsScreen({ settings, updateSettings, profile, updateProfile, input, onBack }: {
  settings: Settings; updateSettings: (p: Partial<Settings>) => void; profile: PlayerProfile; updateProfile: (p: PlayerProfile) => void;
  input: Input | null; onBack: () => void;
}) {
  const [tab, setTab] = useState<"graphics" | "driving" | "audio" | "controls" | "touch" | "profile">("graphics");
  const [binding, setBinding] = useState<Action | null>(null);
  const rebind = (a: Action) => {
    if (!input) return;
    setBinding(a);
    input.setCapture((code) => {
      setBinding(null);
      if (code === "Escape" && a !== "pause") return;
      const keys = { ...settings.keys };
      // Remove the key from any other action, then make it the primary binding.
      for (const k of Object.keys(keys) as Action[]) keys[k] = keys[k].filter((c) => c !== code);
      keys[a] = [code, ...keys[a].filter((c) => c !== code)].slice(0, 2);
      updateSettings({ keys });
    });
  };
  return (
    <div className={`${s.screen} ${s.screenDim}`}>
      <div className={s.topBar}>
        <div>
          <div className={s.kicker}>Settings</div>
          <h1 className={s.title}>Setup</h1>
        </div>
        <button className={s.btn} onClick={() => { input?.setCapture(null); onBack(); }}>Done</button>
      </div>
      <div className={s.tabs} role="tablist">
        {(["graphics", "driving", "audio", "controls", "touch", "profile"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      <div className={s.panel} style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 12 }}>
        {tab === "graphics" && <GraphicsSettings settings={settings} update={updateSettings} />}
        {tab === "driving" && <DrivingSettings settings={settings} update={updateSettings} />}
        {tab === "audio" && <AudioSettings settings={settings} update={updateSettings} />}
        {tab === "controls" && (
          <>
            <p className={s.muted}>Click a binding, then press the new key. Gamepads: RT/LT throttle/brake, left stick steer, A handbrake, X nitro, RB/LB gears, Y camera, Start pause, Back reset.</p>
            {(Object.keys(ACTION_LABELS) as Action[]).map((a) => (
              <div key={a} className={s.bindRow}>
                <span>{ACTION_LABELS[a]}</span>
                <button className={s.btn} style={{ padding: "6px 12px", minWidth: 150 }} onClick={() => rebind(a)}>
                  {binding === a ? "Press a key…" : settings.keys[a].map(keyName).join(" / ")}
                </button>
              </div>
            ))}
            <button className={s.btn} onClick={() => updateSettings({ keys: structuredClone(DEFAULT_KEYS) })}>Reset to defaults</button>
          </>
        )}
        {tab === "touch" && (
          <>
            <div className={s.field}>
              <span className={s.label}>Steering</span>
              <Seg value={settings.touchScheme} options={[["buttons", "Buttons"], ["wheel", "Wheel"], ["tilt", "Tilt (gyro)"]]} onChange={(v) => update(v)} />
            </div>
            <div className={s.field}>
              <span className={s.label}>Sensitivity {settings.touchSensitivity.toFixed(1)}×</span>
              <input type="range" className={s.slider} min={0.5} max={2} step={0.1} value={settings.touchSensitivity} onChange={(e) => updateSettings({ touchSensitivity: Number(e.target.value) })} />
            </div>
            <div className={s.field}>
              <span className={s.label}>Button size {Math.round(settings.touchSize * 100)}%</span>
              <input type="range" className={s.slider} min={0.7} max={1.5} step={0.05} value={settings.touchSize} onChange={(e) => updateSettings({ touchSize: Number(e.target.value) })} />
            </div>
            <div className={s.field}>
              <span className={s.label}>Button opacity {Math.round(settings.touchOpacity * 100)}%</span>
              <input type="range" className={s.slider} min={0.3} max={1} step={0.05} value={settings.touchOpacity} onChange={(e) => updateSettings({ touchOpacity: Number(e.target.value) })} />
            </div>
            <label className={s.switch}><span>Left-handed layout (swap sides)</span><input type="checkbox" checked={settings.leftHanded} onChange={(e) => updateSettings({ leftHanded: e.target.checked })} /></label>
            <label className={s.switch}><span>Vibration / haptics</span><input type="checkbox" checked={settings.haptics} onChange={(e) => updateSettings({ haptics: e.target.checked })} /></label>
          </>
        )}
        {tab === "profile" && (
          <>
            <div className={s.field}>
              <span className={s.label}>Driver name</span>
              <input className={s.input} maxLength={16} value={profile.name} onChange={(e) => updateProfile({ ...profile, name: e.target.value })} />
            </div>
            <span className={s.label}>Avatar colour</span>
            <div className={s.row}>
              {AVATAR_COLORS.map((c, i) => (
                <button key={c} className={s.swatch} style={{ background: c }} aria-pressed={profile.avatar === i} aria-label={`Avatar ${i + 1}`} onClick={() => updateProfile({ ...profile, avatar: i })} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  function update(v: Settings["touchScheme"]) {
    updateSettings({ touchScheme: v });
    if (v === "tilt") void input?.enableTilt();
  }
}
