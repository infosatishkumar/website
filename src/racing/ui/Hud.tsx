"use client";

import { useEffect, useRef } from "react";
import type { HudState } from "../engine/game";
import { fmt } from "../engine/game";
import type { TrackData } from "../shared/trackGeom";
import s from "./racing.module.css";

function Minimap({ hud, track }: { hud: HudState; track: TrackData }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bounds = useRef<{ cx: number; cz: number; scale: number } | null>(null);
  useEffect(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < track.n; i++) {
      minX = Math.min(minX, track.px[i]); maxX = Math.max(maxX, track.px[i]);
      minZ = Math.min(minZ, track.pz[i]); maxZ = Math.max(maxZ, track.pz[i]);
    }
    bounds.current = { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, scale: 0.8 / Math.max(maxX - minX, maxZ - minZ) };
  }, [track]);
  useEffect(() => {
    const c = ref.current, b = bounds.current;
    if (!c || !b) return;
    const size = c.clientWidth * (window.devicePixelRatio || 1);
    if (c.width !== size) { c.width = size; c.height = size; }
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    // Map +x right, +z down (top-down view with north up).
    const map = (x: number, z: number): [number, number] => [size / 2 + (x - b.cx) * b.scale * size, size / 2 + (z - b.cz) * b.scale * size];
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i <= track.n; i += 3) {
      const k = i % track.n;
      const [x, y] = map(track.px[k], track.pz[k]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = size * 0.05;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = size * 0.016;
    ctx.stroke();
    const [sx, sy] = map(track.px[0], track.pz[0]);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(sx - size * 0.012, sy - size * 0.03, size * 0.024, size * 0.06);
    const sorted = [...hud.cars].sort((a, b2) => Number(a.player) - Number(b2.player));
    for (const car of sorted) {
      const [x, y] = map(car.x, car.z);
      ctx.beginPath();
      ctx.arc(x, y, size * (car.player ? 0.04 : 0.028), 0, Math.PI * 2);
      ctx.fillStyle = car.player ? "#ff5a36" : car.color;
      ctx.fill();
      ctx.lineWidth = size * 0.008;
      ctx.strokeStyle = car.player ? "#fff" : "rgba(0,0,0,0.8)";
      ctx.stroke();
    }
  }, [hud, track]);
  return <canvas ref={ref} className={s.minimap} aria-label="Track map" />;
}

function Speedo({ hud, units }: { hud: HudState; units: "kmh" | "mph" }) {
  const frac = Math.min(1, hud.rpm / (hud.redline * 1.05));
  const start = 135, sweep = 270;
  const R = 44;
  const arc = (from: number, to: number) => {
    const a0 = ((start + from * sweep) * Math.PI) / 180, a1 = ((start + to * sweep) * Math.PI) / 180;
    const x0 = 50 + Math.cos(a0) * R, y0 = 50 + Math.sin(a0) * R, x1 = 50 + Math.cos(a1) * R, y1 = 50 + Math.sin(a1) * R;
    return `M ${x0} ${y0} A ${R} ${R} 0 ${(to - from) * sweep > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const redStart = 0.9 / 1.05;
  const shift = hud.rpm > hud.redline * 0.95 && hud.manual;
  const speed = Math.abs(units === "mph" ? hud.speed * 0.621371 : hud.speed);
  const ticks = [];
  for (let k = 0; k <= 10; k++) {
    const a = ((start + (k / 10) * sweep) * Math.PI) / 180;
    ticks.push(<line key={k} x1={50 + Math.cos(a) * 38} y1={50 + Math.sin(a) * 38} x2={50 + Math.cos(a) * 41} y2={50 + Math.sin(a) * 41} stroke="rgba(255,255,255,0.5)" strokeWidth={0.8} />);
  }
  return (
    <div className={s.speedo}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r="49" fill="rgba(8,9,12,0.55)" />
        <path d={arc(0, 1)} stroke="rgba(255,255,255,0.12)" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d={arc(redStart, 1)} stroke="rgba(255,77,94,0.45)" strokeWidth="5" fill="none" />
        {frac > 0.001 && <path d={arc(0, frac)} stroke={frac > redStart ? "#ff4d5e" : "#29d3ff"} strokeWidth="5" fill="none" strokeLinecap="round" />}
        {ticks}
      </svg>
      <div className={s.speedoCenter}>
        <div className={s.speedNum}>{Math.round(speed)}</div>
        <div className={s.hudSmall}>{units === "mph" ? "mph" : "km/h"}</div>
        <div className={`${s.gearBox} ${shift ? s.gearShift : ""}`}>{hud.gear}</div>
      </div>
    </div>
  );
}

export default function Hud({ hud, track, units, showFps, touch, onPause }: {
  hud: HudState; track: TrackData; units: "kmh" | "mph"; showFps: boolean; touch: boolean; onPause: () => void;
}) {
  const racingMode = hud.mode === "race" || hud.mode === "online" || hud.mode === "sprint" || hud.mode === "drag";
  const lapMode = hud.laps > 0;
  const big = hud.messages.filter((m) => m.kind === "big").slice(-1);
  const small = hud.messages.filter((m) => m.kind !== "big").slice(-3);
  return (
    <div className={s.hud}>
      <div className={s.hudTL}>
        {racingMode && hud.total > 1 && (
          <div className={s.hudBlock}>
            <div className={s.hudSmall}>Position</div>
            <div className={s.hudBig}>{hud.position}<sup>/{hud.total}</sup></div>
          </div>
        )}
        {lapMode && (
          <div className={s.hudBlock}>
            <div className={s.hudSmall}>Lap</div>
            <div className={s.hudBig}>{Math.max(1, hud.lap)}<sup>/{hud.laps}</sup></div>
          </div>
        )}
        {hud.mode !== "freeroam" && (
          <div className={s.hudBlock}>
            <div className={s.hudTimes}>
              <span>TIME</span><span>{fmt(hud.raceTime)}</span>
              {(lapMode || hud.mode === "timetrial") && <><span>LAP</span><span>{fmt(hud.lapTime)}</span></>}
              {hud.bestLap !== null && <><span>BEST</span><span>{fmt(hud.bestLap)}</span></>}
              {hud.lastLap !== null && <><span>LAST</span><span>{fmt(hud.lastLap)}</span></>}
              {hud.timeLeft !== null && <><span>LEFT</span><span>{hud.timeLeft.toFixed(1)}s</span></>}
              {hud.distanceLeft !== null && <><span>TO GO</span><span>{Math.round(hud.distanceLeft)} m</span></>}
              {hud.ping !== null && <><span>PING</span><span>{hud.ping} ms</span></>}
            </div>
          </div>
        )}
        {hud.mode === "freeroam" && (
          <div className={s.hudBlock}>
            <div className={s.hudSmall}>Free roam</div>
            <div className={s.hudTimes}>
              <span>CLOCK</span><span>{String(Math.floor(hud.hours)).padStart(2, "0")}:{String(Math.floor((hud.hours % 1) * 60)).padStart(2, "0")}</span>
              <span>WEATHER</span><span>{hud.weather === "rain" ? "Rain" : "Clear"}</span>
            </div>
          </div>
        )}
        {racingMode && hud.standings.length > 1 && (
          <div className={s.standings}>
            {hud.standings.slice(0, 8).map((st, i) => (
              <div key={i} className={st.player ? s.standMe : undefined}>
                <b>{i + 1}</b>
                <span>{st.name}</span>
                {st.finished && <span style={{ marginLeft: "auto" }}>🏁</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={s.hudTR}>
        <Minimap hud={hud} track={track} />
        {showFps && <div className={s.fps}>{hud.fps} fps · {Math.round(hud.scale * 100)}% res</div>}
      </div>
      <div className={s.hudCenter}>
        {hud.phase === "countdown" && (
          <div className={s.lights} aria-label={`Start lights ${hud.lights} of 5`}>
            {[0, 1, 2, 3, 4].map((k) => <div key={k} className={`${s.light} ${k < hud.lights ? s.lightOn : ""}`} />)}
          </div>
        )}
        {hud.go && (
          <div className={s.lights}>
            {[0, 1, 2, 3, 4].map((k) => <div key={k} className={`${s.light} ${s.lightGo}`} />)}
          </div>
        )}
        {big.map((m) => <div key={m.id} className={`${s.msg} ${s.msgBig}`}>{m.text}</div>)}
        {hud.wrongWay && <div className={s.wrongWay}>Wrong way</div>}
        {hud.drift && (
          <div className={s.driftBox}>
            <div className={s.hudSmall}>Drift score</div>
            <div className={s.driftScore}>{hud.drift.score.toLocaleString()}</div>
            {hud.drift.current > 0 && <div className={s.driftCurrent}>+{hud.drift.current.toLocaleString()} ×{hud.drift.combo}</div>}
          </div>
        )}
        {hud.trap !== null && hud.mode === "speed" && <div className={`${s.msg} ${s.msgGood}`}>Trap {Math.round(hud.trap)} km/h</div>}
        {small.map((m) => (
          <div key={m.id} className={`${s.msg} ${m.kind === "good" ? s.msgGood : m.kind === "warn" ? s.msgWarn : ""}`}>{m.text}</div>
        ))}
        {hud.phase === "replay" && <div className={`${s.msg} ${s.msgWarn}`}>Replay</div>}
        {hud.spectating && <div className={s.msg}>Spectating – you will join the next race</div>}
      </div>
      {hud.netStatus && hud.netStatus !== "online" && <div className={s.netBanner}>Connection: {hud.netStatus}…</div>}
      <div className={s.hudBR} style={touch ? { right: "auto", left: "50%", transform: "translateX(-50%) scale(0.72)", transformOrigin: "bottom center" } : undefined}>
        <div className={s.assists}>
          <span className={hud.abs ? s.on : ""}>ABS</span>
          <span className={hud.tc ? s.on : ""}>TC</span>
          <span className={hud.esc ? s.on : ""}>ESC</span>
          <span>{hud.manual ? "MAN" : "AUTO"}</span>
        </div>
        <Speedo hud={hud} units={units} />
        <div className={`${s.meter} ${s.meterNitro}`}>NOS<div><i style={{ width: `${hud.nitro * 100}%` }} /></div></div>
        <div className={`${s.meter} ${s.meterDamage}`}>DMG<div><i style={{ width: `${hud.damage * 100}%` }} /></div></div>
      </div>
      {!touch && hud.raceTime < 12 && hud.phase !== "replay" && (
        <div className={s.hudBL}>
          <div><span className={s.kbd}>W</span><span className={s.kbd}>A</span><span className={s.kbd}>S</span><span className={s.kbd}>D</span> drive · <span className={s.kbd}>Space</span> handbrake · <span className={s.kbd}>N</span> nitro</div>
          <div><span className={s.kbd}>Shift</span>/<span className={s.kbd}>Ctrl</span> gears · <span className={s.kbd}>C</span> camera · <span className={s.kbd}>R</span> reset · <span className={s.kbd}>Esc</span> pause</div>
        </div>
      )}
      {touch && (
        <button className={s.pauseBtn} onClick={onPause} aria-label="Pause">II</button>
      )}
    </div>
  );
}
