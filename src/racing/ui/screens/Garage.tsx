"use client";

import { useMemo, useState } from "react";
import { CARS, getCar, applyUpgrades, UPGRADE_COST, type CarSpec, type Customization } from "../../shared/cars";
import { levelFromXp } from "../../shared/progress";
import { Vehicle } from "../../engine/vehicle";
import { custFor, upgradesFor, type PlayerProfile } from "../../engine/settings";
import { ProfileChip } from "./MainMenu";
import s from "../racing.module.css";

const PAINTS = ["#c8102e", "#ff5a36", "#f5a300", "#ffd60a", "#11b37d", "#0d8a5f", "#29d3ff", "#1f4fff", "#3a0ca3", "#8338ec", "#ff006e", "#f2f2f2", "#9aa3ad", "#3b3f45", "#111111", "#b08d57"];
const RIMS = ["#c4c8cc", "#1a1a1a", "#b08d57", "#ff5a36", "#f2f2f2", "#29d3ff"];

export function carStats(spec: CarSpec) {
  const v = new Vehicle(spec);
  let peakKw = 0;
  for (let rpm = spec.idleRpm; rpm <= spec.redline; rpm += 100) {
    peakKw = Math.max(peakKw, (spec.torque * v.torqueCurve(rpm) * rpm * 2 * Math.PI) / 60 / 1000);
  }
  const hp = peakKw * 1.341;
  return {
    hp: Math.round(hp),
    kg: Math.round(spec.mass),
    top: Math.round(spec.topSpeed),
    bars: {
      Speed: Math.min(1, spec.topSpeed / 390),
      Acceleration: Math.min(1, (hp / spec.mass) * 1.25),
      Handling: Math.min(1, (spec.tireGrip - 0.8) / 0.6 + spec.clA * 0.08),
      Braking: Math.min(1, spec.brakeForce / spec.mass / 15),
    },
  };
}

export default function Garage({ profile, carId, setCarId, updateProfile, onView, onBack }: {
  profile: PlayerProfile;
  carId: string;
  setCarId: (id: string) => void;
  updateProfile: (p: PlayerProfile) => void;
  onView: (v: "front" | "side" | "rear" | "top" | "wheel") => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"info" | "paint" | "parts" | "tune">("info");
  const spec = getCar(carId);
  const owned = profile.owned.includes(carId);
  const level = levelFromXp(profile.xp);
  const cust = custFor(profile, carId);
  const up = upgradesFor(profile, carId);
  const tuned = useMemo(() => applyUpgrades(spec, up, cust), [spec, up, cust]);
  const stats = useMemo(() => carStats(tuned), [tuned]);
  const base = useMemo(() => carStats(spec), [spec]);

  const setCust = (patch: Partial<Customization>) => {
    updateProfile({ ...profile, cust: { ...profile.cust, [carId]: { ...cust, ...patch } } });
  };
  const buy = () => {
    if (profile.credits < spec.price || level < spec.unlockLevel) return;
    updateProfile({ ...profile, credits: profile.credits - spec.price, owned: [...profile.owned, carId], selectedCar: carId });
  };
  const upgrade = (k: "engine" | "tires" | "weight") => {
    const lvl = up[k];
    if (lvl >= 3) return;
    const cost = UPGRADE_COST[lvl + 1];
    if (profile.credits < cost) return;
    const nu = { ...up, [k]: lvl + 1 };
    const np = { ...profile, credits: profile.credits - cost, upgrades: { ...profile.upgrades, [carId]: nu } };
    if (nu.engine === 3 && nu.tires === 3 && nu.weight === 3 && !np.achievements.includes("tuned")) np.achievements = [...np.achievements, "tuned"];
    updateProfile(np);
  };

  return (
    <div className={s.screen} style={{ pointerEvents: "none" }}>
      <div className={s.topBar} style={{ pointerEvents: "auto" }}>
        <div>
          <div className={s.kicker}>Garage</div>
          <h1 className={s.title}>{spec.name}</h1>
          <div className={s.tag}>{spec.cls} · {spec.layout}</div>
        </div>
        <ProfileChip profile={profile} />
      </div>
      <div className={s.split} style={{ pointerEvents: "none" }}>
        <div className={s.row} style={{ alignSelf: "end", pointerEvents: "auto" }}>
          {(["front", "side", "rear", "top", "wheel"] as const).map((v) => (
            <button key={v} className={`${s.btn} ${s.ghost}`} onClick={() => onView(v)}>{v}</button>
          ))}
          <span className={s.muted}>Drag to rotate · scroll to zoom</span>
        </div>
        <div className={`${s.panel} ${s.sidePanel}`} style={{ pointerEvents: "auto" }}>
          <div className={s.tabs} role="tablist">
            {(["info", "paint", "parts", "tune"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === "tune" ? "Upgrades" : t}</button>
            ))}
          </div>
          {tab === "info" && (
            <>
              <p className={s.muted}>{spec.blurb}</p>
              <div className={s.row} style={{ gap: 18 }}>
                <div><div className={s.tag}>Power</div><div className={s.h2}>{stats.hp} hp</div></div>
                <div><div className={s.tag}>Weight</div><div className={s.h2}>{stats.kg} kg</div></div>
                <div><div className={s.tag}>Top speed</div><div className={s.h2}>{stats.top} km/h</div></div>
              </div>
              {Object.entries(stats.bars).map(([k, v]) => (
                <div key={k} className={s.field}>
                  <div className={`${s.row} ${s.spread}`}><span className={s.tag}>{k}</span><span className={s.tag}>{Math.round(v * 100)}{v > base.bars[k as keyof typeof base.bars] + 0.005 ? " ▲" : ""}</span></div>
                  <div className={s.statBar}><i style={{ width: `${v * 100}%` }} /></div>
                </div>
              ))}
              <div className={s.tag}>Drivetrain {spec.drivetrain} · {spec.gears.length}-speed · {spec.sound.cylinders} cylinders{spec.sound.turbo ? " turbo" : ""}{spec.sound.hybridWhine ? " hybrid" : ""}</div>
            </>
          )}
          {tab === "paint" && (
            <>
              <span className={s.label}>Body colour</span>
              <div className={s.row}>
                {PAINTS.map((c) => (
                  <button key={c} className={s.swatch} style={{ background: c }} aria-label={`Paint ${c}`} aria-pressed={cust.color.toLowerCase() === c} onClick={() => setCust({ color: c })} />
                ))}
                <input type="color" aria-label="Custom colour" value={cust.color} onChange={(e) => setCust({ color: e.target.value })} style={{ width: 36, height: 32, background: "none", border: "none" }} />
              </div>
              <span className={s.label}>Finish</span>
              <div className={s.seg}>
                {(["metallic", "gloss", "matte", "pearl"] as const).map((f) => (
                  <button key={f} aria-pressed={cust.finish === f} onClick={() => setCust({ finish: f })}>{f}</button>
                ))}
              </div>
              <span className={s.label}>Rim colour</span>
              <div className={s.row}>
                {RIMS.map((c) => (
                  <button key={c} className={s.swatch} style={{ background: c }} aria-label={`Rims ${c}`} aria-pressed={cust.rimColor.toLowerCase() === c} onClick={() => setCust({ rimColor: c })} />
                ))}
              </div>
            </>
          )}
          {tab === "parts" && (
            <>
              <span className={s.label}>Wheels</span>
              <div className={s.seg}>
                {["5-spoke", "Mesh", "Y-spoke"].map((n, i) => (
                  <button key={n} aria-pressed={cust.rim === i} onClick={() => setCust({ rim: i })}>{n}</button>
                ))}
              </div>
              <span className={s.label}>Rear spoiler</span>
              <div className={s.seg}>
                {[[-1, "Factory"], [0, "None"], [1, "Lip"], [2, "Wing"], [3, "GT wing"]].map(([v, n]) => (
                  <button key={v} aria-pressed={cust.wing === v} onClick={() => setCust({ wing: v as number })}>{n}</button>
                ))}
              </div>
              <span className={s.label}>Body kit</span>
              <div className={s.seg}>
                {["Stock", "Aero kit"].map((n, i) => (
                  <button key={n} aria-pressed={cust.kit === i} onClick={() => setCust({ kit: i })}>{n}</button>
                ))}
              </div>
              <p className={s.muted}>Wings and the aero kit add real downforce (more grip at speed) at the cost of a little drag.</p>
            </>
          )}
          {tab === "tune" && (
            <>
              {!owned && <div className={s.notice}>Buy this car to upgrade it.</div>}
              {([["engine", "Engine", "+7% torque per stage"], ["tires", "Tyres", "+3.5% grip per stage"], ["weight", "Weight", "−3% mass per stage"]] as const).map(([k, n, d]) => (
                <div key={k} className={`${s.row} ${s.spread}`}>
                  <div>
                    <div className={s.cardTitle}>{n} <span className={s.stars}>{"■".repeat(up[k])}{"□".repeat(3 - up[k])}</span></div>
                    <div className={s.tag}>{d}</div>
                  </div>
                  <button className={s.btn} disabled={!owned || up[k] >= 3 || profile.credits < UPGRADE_COST[up[k] + 1]} onClick={() => upgrade(k)}>
                    {up[k] >= 3 ? "Maxed" : `¢ ${UPGRADE_COST[up[k] + 1].toLocaleString()}`}
                  </button>
                </div>
              ))}
            </>
          )}
          <div className={s.row} style={{ marginTop: "auto" }}>
            {owned ? (
              <button className={`${s.btn} ${s.primary}`} disabled={profile.selectedCar === carId} onClick={() => updateProfile({ ...profile, selectedCar: carId })}>
                {profile.selectedCar === carId ? "Selected" : "Select car"}
              </button>
            ) : (
              <button className={`${s.btn} ${s.primary}`} disabled={profile.credits < spec.price || level < spec.unlockLevel} onClick={buy}>
                {level < spec.unlockLevel ? `Unlocks at level ${spec.unlockLevel}` : `Buy ¢ ${spec.price.toLocaleString()}`}
              </button>
            )}
            <button className={s.btn} onClick={onBack}>Back</button>
          </div>
        </div>
      </div>
      <div className={s.carStrip} style={{ pointerEvents: "auto" }}>
        {CARS.map((c) => {
          const own = profile.owned.includes(c.id);
          return (
            <button key={c.id} className={`${s.card} ${c.id === carId ? s.cardActive : ""} ${!own && level < c.unlockLevel ? s.cardLocked : ""}`} onClick={() => setCarId(c.id)}>
              <span className={s.tag}>{c.cls}</span>
              <span className={s.cardTitle}>{c.name}</span>
              <span className={s.tag}>{own ? (profile.selectedCar === c.id ? "● Selected" : "Owned") : level < c.unlockLevel ? `Level ${c.unlockLevel}` : `¢ ${c.price.toLocaleString()}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
