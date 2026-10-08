"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AXES, AXIS_LABELS, type Vec, dealCards, dot, fit, vecFromPicks } from "../engine";
import type { LevelProps } from "../game";
import { Btn, FitMeter, StageTitle, TimerBar, VisualTile, useCountdown } from "../ui";

const SECONDS = 6;

export default function Personality({ game }: LevelProps) {
  const { brief } = game.brand;
  const cards = useMemo(() => dealCards(brief.seed), [brief.seed]);
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<Vec[]>([]);
  const [flash, setFlash] = useState<null | { side: "a" | "b" | null; good: boolean }>(null);
  const [finished, setFinished] = useState(false);
  const fast = useRef(0);
  const shownAt = useRef(0);
  const card = cards[i];

  useEffect(() => {
    shownAt.current = performance.now();
  }, [i]);

  const answer = (side: "a" | "b" | null) => {
    if (flash || finished) return;
    const elapsed = (performance.now() - shownAt.current) / 1000;
    const da = dot(card.a.vec, brief.target);
    const db = dot(card.b.vec, brief.target);
    const good = side !== null && (Math.abs(da - db) < 0.05 || (side === "a" ? da > db : db > da));
    const speed = side ? Math.max(0, 1 - elapsed / SECONDS) : 0;
    game.award({ points: good ? Math.round(100 + 50 * speed) : 0, max: 150, correct: good, label: good ? "On brief" : "Off brief" });
    if (good && elapsed < 2) fast.current++;
    if (fast.current >= 5) game.unlock("speed");
    if (side) setPicks((p) => [...p, card[side].vec]);
    setFlash({ side, good });
    setTimeout(() => {
      setFlash(null);
      if (i + 1 >= cards.length) setFinished(true);
      else setI(i + 1);
    }, 650);
  };

  const left = useCountdown(SECONDS, i, !flash && !finished, () => answer(null));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") answer("a");
      if (e.key === "ArrowRight" || e.key === "d") answer("b");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const brandVec = useMemo(() => vecFromPicks(picks), [picks]);

  if (finished) {
    const alignment = fit(brandVec, brief.target);
    return (
      <Result
        alignment={alignment}
        vec={brandVec}
        target={brief.target}
        onNext={() => {
          game.award({ points: Math.round(alignment * 500), max: 500, label: "Alignment bonus" });
          if (alignment >= 0.9) game.unlock("mindreader");
          game.update({ vec: brandVec });
          game.done();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <StageTitle
          kicker={`Level 1 · Personality · ${i + 1}/${cards.length}`}
          title={card.prompt}
          sub={
            <>
              Read the brief: <span className="text-paper">{brief.keywords.join(", ")}</span>. Pick the side that
              fits. Fast answers score more. <span className="hidden sm:inline">Keys: ← / →</span>
            </>
          }
        />
      </div>
      <TimerBar left={left} total={SECONDS} />
      <div key={i} className="grid grid-cols-2 gap-3 sm:gap-5">
        {(["a", "b"] as const).map((side) => {
          const opt = card[side];
          const state =
            flash && flash.side === side ? (flash.good ? "ring-4 ring-[#7CF29A]" : "ring-4 ring-accent") : flash ? "opacity-40" : "";
          return (
            <button
              key={side}
              onClick={() => answer(side)}
              className={`bf-card-in group flex aspect-[4/5] flex-col items-center justify-between rounded-3xl bg-paper p-5 text-ink transition hover:-translate-y-1 hover:rotate-[-1deg] sm:aspect-[5/4] sm:p-8 ${state}`}
              style={{ animationDelay: side === "b" ? "70ms" : "0ms" }}
            >
              <span className="text-[10px] font-semibold tracking-[0.2em] text-ink/40 uppercase">
                {side === "a" ? "← This" : "That →"}
              </span>
              <span className="flex flex-1 items-center justify-center">
                <VisualTile visual={opt.visual} />
              </span>
              <span className="text-sm font-semibold sm:text-base">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <blockquote className="rounded-2xl border border-paper/10 p-4 text-sm text-paper/60 italic">
        “{brief.quote}” — {brief.client}, {brief.role}
      </blockquote>
    </div>
  );
}

function Result({ alignment, vec, target, onNext }: { alignment: number; vec: Vec; target: Vec; onNext: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <StageTitle kicker="Level 1 complete" title="Your brand has a personality." sub="White marker = what the client asked for. Orange = what you built." />
      <div className="grid gap-4 rounded-3xl bg-paper/5 p-5 sm:p-8">
        {AXES.map((a) => (
          <PersonalityBar key={a} axis={a} value={vec[a]} target={target[a]} />
        ))}
      </div>
      <FitMeter value={alignment} />
      <div>
        <Btn onClick={onNext}>Lock personality →</Btn>
      </div>
    </div>
  );
}

export function PersonalityBar({ axis, value, target, light }: { axis: (typeof AXES)[number]; value: number; target?: number; light?: boolean }) {
  const [lo, hi] = AXIS_LABELS[axis];
  return (
    <div>
      <div className={`flex justify-between text-xs ${light ? "text-ink/60" : "text-paper/60"}`}>
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
      <div className={`relative mt-2 h-2 rounded-full ${light ? "bg-ink/10" : "bg-paper/10"}`}>
        <div className={`absolute top-1/2 left-1/2 h-4 w-px -translate-y-1/2 ${light ? "bg-ink/20" : "bg-paper/20"}`} />
        {target !== undefined && (
          <div
            className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper"
            style={{ left: `${((target + 1) / 2) * 100}%` }}
          />
        )}
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_4px_rgba(255,90,54,0.25)]"
          style={{ left: `${((value + 1) / 2) * 100}%`, transition: "left 800ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </div>
    </div>
  );
}
