"use client";

import { useMemo, useRef, useState } from "react";
import {
  HARMONIES,
  type HSL,
  type Harmony,
  type Palette,
  buildPalette,
  colorFit,
  contrastPair,
  deltaE,
  fit,
  hex,
  inkOn,
  primaryCandidates,
  randomTarget,
  rngFrom,
} from "../engine";
import type { LevelProps } from "../game";
import { Btn, Feedback, FitMeter, StageTitle, TimerBar, useCountdown } from "../ui";

type Stage = "hunt" | "primary" | "harmony" | "contrast" | "summary";
const HUNT_ROUNDS = 3;
const HUNT_SECONDS = 15;
const CLASH_ROUNDS = 6;
const CLASH_SECONDS = 5;

export default function ColorLab({ game }: LevelProps) {
  const [stage, setStage] = useState<Stage>("hunt");
  const palette = game.brand.palette;

  return (
    <div className="flex flex-col gap-6">
      <StageProgress stage={stage} />
      {stage === "hunt" && <HueHunt game={game} onDone={() => setStage("primary")} />}
      {stage === "primary" && <PrimaryPick game={game} onDone={() => setStage("harmony")} />}
      {stage === "harmony" && <HarmonyPick game={game} onDone={() => setStage("contrast")} />}
      {stage === "contrast" && <ContrastClash game={game} onDone={() => setStage("summary")} />}
      {stage === "summary" && palette && (
        <div className="flex flex-col gap-6">
          <StageTitle kicker="Level 2 complete" title="Palette locked." sub="This is the colour system that goes into your guideline." />
          <PaletteStrip palette={palette} />
          <div>
            <Btn onClick={game.done}>On to typography →</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function StageProgress({ stage }: { stage: Stage }) {
  const steps: [Stage, string][] = [
    ["hunt", "Hue Hunt"],
    ["primary", "Primary"],
    ["harmony", "Harmony"],
    ["contrast", "Contrast Clash"],
  ];
  const idx = steps.findIndex(([s]) => s === stage);
  return (
    <div className="flex flex-wrap gap-2 text-[11px] tracking-wider uppercase">
      {steps.map(([s, label], i) => (
        <span
          key={s}
          className={`rounded-full px-3 py-1 ${
            i === idx ? "bg-accent text-ink" : i < idx || idx === -1 ? "bg-paper/15 text-paper/70" : "bg-paper/5 text-paper/30"
          }`}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/* ---------------- Hue Hunt ---------------- */

function HueHunt({ game, onDone }: LevelProps & { onDone: () => void }) {
  const seed = game.brand.brief.seed;
  const targets = useMemo(() => {
    const r = rngFrom(seed + ":hunt");
    return Array.from({ length: HUNT_ROUNDS }, () => randomTarget(r));
  }, [seed]);
  const [round, setRound] = useState(0);
  const [mix, setMix] = useState<HSL>({ h: 180, s: 50, l: 50 });
  const [result, setResult] = useState<number | null>(null);
  const target = targets[round];

  const lock = () => {
    if (result !== null) return;
    const d = deltaE(mix, target);
    const pts = Math.max(0, Math.round(100 - d * 3.2));
    game.award({ points: pts, max: 100, correct: d < 12, label: d < 3 ? "Pixel perfect!" : d < 8 ? "Great eye" : d < 15 ? "Close" : "Way off" });
    if (d < 3) game.unlock("pixeleye");
    setResult(d);
  };
  const next = () => {
    if (round + 1 >= HUNT_ROUNDS) onDone();
    else {
      setRound(round + 1);
      setResult(null);
      setMix({ h: Math.round(Math.random() * 360), s: 50, l: 50 });
    }
  };
  const left = useCountdown(HUNT_SECONDS, round, result === null, lock);

  return (
    <>
      <StageTitle
        kicker={`Level 2 · Colour Lab · Hue Hunt ${round + 1}/${HUNT_ROUNDS}`}
        title="Match the swatch."
        sub="Train your eye before you pick a palette. Mix hue, saturation and lightness to match the target."
      />
      <TimerBar left={left} total={HUNT_SECONDS} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid grid-cols-2 overflow-hidden rounded-3xl">
          <div className="flex aspect-square items-end p-4 text-xs font-semibold" style={{ background: hex(target), color: inkOn(hex(target), "#16140f", "#f5f2eb") }}>
            Target {result !== null && hex(target)}
          </div>
          <div className="flex aspect-square items-end p-4 text-xs font-semibold" style={{ background: hex(mix), color: inkOn(hex(mix), "#16140f", "#f5f2eb") }}>
            Your mix {result !== null && hex(mix)}
          </div>
        </div>
        <div className="flex flex-col justify-center gap-5">
          <Slider label="Hue" value={mix.h} max={360} disabled={result !== null} onChange={(h) => setMix({ ...mix, h })}
            track="linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" />
          <Slider label="Saturation" value={mix.s} max={100} disabled={result !== null} onChange={(s) => setMix({ ...mix, s })}
            track={`linear-gradient(90deg,${hex({ ...mix, s: 0 })},${hex({ ...mix, s: 100 })})`} />
          <Slider label="Lightness" value={mix.l} max={100} disabled={result !== null} onChange={(l) => setMix({ ...mix, l })}
            track={`linear-gradient(90deg,#000,${hex({ ...mix, l: 50 })},#fff)`} />
          {result === null ? (
            <div>
              <Btn onClick={lock}>Lock it in</Btn>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Feedback good={result < 12}>
                ΔE {result.toFixed(1)} — {result < 3 ? "Indistinguishable. Incredible eye." : result < 8 ? "Very close. A client would never notice." : result < 15 ? "Noticeable difference, but in the family." : "Different colour entirely. Keep training!"}
              </Feedback>
              <div>
                <Btn onClick={next}>{round + 1 >= HUNT_ROUNDS ? "Choose your primary →" : "Next swatch →"}</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Slider({ label, value, max, onChange, track, disabled }: { label: string; value: number; max: number; onChange: (v: number) => void; track: string; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs text-paper/60">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bf-range mt-2 w-full"
        style={{ background: track }}
      />
    </label>
  );
}

/* ---------------- Primary pick ---------------- */

function PrimaryPick({ game, onDone }: LevelProps & { onDone: () => void }) {
  const { brief } = game.brand;
  const [round, setRound] = useState(0);
  const options = useMemo(() => primaryCandidates(brief.seed, round), [brief.seed, round]);
  const [chosen, setChosen] = useState<HSL | null>(null);
  const best = useMemo(() => Math.max(...options.map((o) => colorFit(o, brief.target))), [options, brief.target]);

  const choose = (c: HSL) => {
    if (chosen) return;
    setChosen(c);
    const f = colorFit(c, brief.target);
    const rel = best > 0 ? f / best : 0;
    game.award({ points: Math.round(rel * 300), max: 300, correct: rel > 0.85, label: rel > 0.95 ? "Perfect hue!" : rel > 0.85 ? "Great fit" : "Hmm, off-mood" });
    game.update({ palette: buildPalette(c, "analogous") });
  };

  return (
    <>
      <StageTitle
        kicker="Level 2 · Colour Lab · Primary"
        title="Choose the hero colour."
        sub={<>The brief says <span className="text-paper">{brief.keywords.join(", ")}</span>. Which colour carries that feeling?</>}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((c, i) => {
          const isChosen = chosen === c;
          const f = colorFit(c, brief.target);
          return (
            <button
              key={i}
              onClick={() => choose(c)}
              disabled={!!chosen}
              className={`bf-card-in relative flex aspect-[4/3] flex-col justify-end rounded-3xl p-4 text-left transition hover:-translate-y-1 ${isChosen ? "ring-4 ring-paper" : chosen ? "opacity-50" : ""}`}
              style={{ background: hex(c), color: inkOn(hex(c), "#16140f", "#f5f2eb"), animationDelay: `${i * 50}ms` }}
            >
              <span className="text-sm font-semibold">{hex(c)}</span>
              {chosen && <span className="text-xs opacity-80">Fit {Math.round(f * 100)}%</span>}
            </button>
          );
        })}
      </div>
      {chosen ? (
        <div className="flex flex-col gap-4">
          <FitMeter value={colorFit(chosen, brief.target)} />
          <div>
            <Btn onClick={onDone}>Build the palette →</Btn>
          </div>
        </div>
      ) : (
        round < 2 && (
          <button onClick={() => setRound(round + 1)} className="self-start text-sm text-paper/50 underline-offset-4 hover:text-paper hover:underline">
            Shuffle swatches ({2 - round} left)
          </button>
        )
      )}
    </>
  );
}

/* ---------------- Harmony ---------------- */

function HarmonyPick({ game, onDone }: LevelProps & { onDone: () => void }) {
  const primary = game.brand.palette!.primary;
  const target = game.brand.brief.target;
  const [chosen, setChosen] = useState<Harmony | null>(null);
  const best = Math.max(...HARMONIES.map((h) => fit(h.vec, target)));

  const choose = (h: (typeof HARMONIES)[number]) => {
    if (chosen) return;
    setChosen(h.id);
    const rel = fit(h.vec, target) / best;
    game.award({ points: Math.round(rel * 200), max: 200, correct: rel > 0.9, label: rel > 0.97 ? "Textbook harmony" : rel > 0.9 ? "Nice harmony" : "Bit of a stretch" });
    game.update({ palette: buildPalette(primary, h.id) });
  };

  return (
    <>
      <StageTitle kicker="Level 2 · Colour Lab · Harmony" title="Pick a colour harmony." sub="Each scheme builds a secondary and accent from your primary. Match the brief's energy." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HARMONIES.map((h, i) => {
          const p = buildPalette(primary, h.id);
          return (
            <button
              key={h.id}
              disabled={!!chosen}
              onClick={() => choose(h)}
              className={`bf-card-in rounded-3xl bg-paper/5 p-4 text-left transition hover:-translate-y-1 hover:bg-paper/10 ${chosen === h.id ? "ring-4 ring-accent" : chosen ? "opacity-40" : ""}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex h-16 overflow-hidden rounded-2xl">
                {[p.primary, p.secondary, p.accent, p.dark, p.light].map((c, j) => (
                  <div key={j} className={j === 0 ? "flex-[2]" : "flex-1"} style={{ background: hex(c) }} />
                ))}
              </div>
              <p className="mt-3 font-semibold">{h.label}</p>
              <p className="text-xs text-paper/50">{h.blurb}</p>
              {chosen && <p className="mt-2 text-xs text-accent">Fit {Math.round(fit(h.vec, target) * 100)}%</p>}
            </button>
          );
        })}
      </div>
      {chosen && (
        <div>
          <Btn onClick={onDone}>Contrast Clash →</Btn>
        </div>
      )}
    </>
  );
}

/* ---------------- Contrast Clash ---------------- */

function ContrastClash({ game, onDone }: LevelProps & { onDone: () => void }) {
  const palette = game.brand.palette;
  const seed = game.brand.brief.seed;
  const pairs = useMemo(() => {
    const r = rngFrom(seed + ":clash");
    return Array.from({ length: CLASH_ROUNDS }, () => contrastPair(r, palette));
  }, [seed, palette]);
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState<null | { said: boolean | null; good: boolean }>(null);
  const allRight = useRef(true);
  const pair = pairs[round];
  const passes = pair.ratio >= 4.5;

  const say = (pass: boolean | null) => {
    if (answer) return;
    const good = pass === passes;
    if (!good) allRight.current = false;
    game.award({ points: good ? 100 : 0, max: 100, correct: good, label: good ? "Sharp!" : "Missed it" });
    setAnswer({ said: pass, good });
  };
  const next = () => {
    if (round + 1 >= CLASH_ROUNDS) {
      if (allRight.current) game.unlock("ally");
      onDone();
    } else {
      setRound(round + 1);
      setAnswer(null);
    }
  };
  const left = useCountdown(CLASH_SECONDS, round, !answer, () => say(null));

  return (
    <>
      <StageTitle
        kicker={`Level 2 · Contrast Clash ${round + 1}/${CLASH_ROUNDS}`}
        title="Does it pass WCAG AA?"
        sub="Body text needs a contrast ratio of at least 4.5:1. Trust your eyes — quickly."
      />
      <TimerBar left={left} total={CLASH_SECONDS} />
      <div key={round} className="bf-card-in grid min-h-56 place-items-center rounded-3xl p-8" style={{ background: pair.bg, color: pair.fg }}>
        <div className="max-w-md text-center">
          <p className="text-3xl font-semibold sm:text-4xl">Readable?</p>
          <p className="mt-3 text-base">The quick brown fox jumps over the lazy dog. Accessibility is part of the brand.</p>
        </div>
      </div>
      {answer ? (
        <div className="flex flex-col gap-3">
          <Feedback good={answer.good}>
            Ratio {pair.ratio.toFixed(2)}:1 — {passes ? "passes" : "fails"} AA.
            {answer.said === null && " Time ran out!"}
          </Feedback>
          <div>
            <Btn onClick={next}>{round + 1 >= CLASH_ROUNDS ? "See palette →" : "Next pair →"}</Btn>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Btn variant="light" onClick={() => say(true)}>✓ Passes</Btn>
          <Btn variant="ghost" onClick={() => say(false)}>✕ Fails</Btn>
        </div>
      )}
    </>
  );
}

export function PaletteStrip({ palette, light, compact }: { palette: Palette; light?: boolean; compact?: boolean }) {
  const swatches: [string, HSL][] = [
    ["Primary", palette.primary],
    ["Secondary", palette.secondary],
    ["Accent", palette.accent],
    ["Ink", palette.dark],
    ["Paper", palette.light],
  ];
  return (
    <div className={`grid grid-cols-5 overflow-hidden rounded-3xl ${light ? "ring-1 ring-ink/10" : ""}`}>
      {swatches.map(([name, c]) => (
        <div key={name} title={`${name} ${hex(c)}`} className={compact ? "h-12" : "flex aspect-[3/4] flex-col justify-end p-3 text-[11px] sm:p-4 sm:text-xs"} style={{ background: hex(c), color: inkOn(hex(c), "#16140f", "#f5f2eb") }}>
          {!compact && (
            <>
              <span className="font-semibold">{name}</span>
              <span className="opacity-80">{hex(c)}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
