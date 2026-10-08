"use client";

import { useMemo, useState } from "react";
import { CONTAINERS, type LogoSpec, SYMBOLS, dealLogos, fit, hex, logoVec } from "../engine";
import type { LevelProps } from "../game";
import { Lockup, Mark } from "../Logo";
import { Btn, FitMeter, StageTitle } from "../ui";

type Stage = "mark" | "lockup";
const REROLLS = 3;

export default function LogoLab({ game }: LevelProps) {
  const [stage, setStage] = useState<Stage>("mark");
  return (
    <div className="flex flex-col gap-6">
      {stage === "mark" && <MarkPick game={game} onDone={() => setStage("lockup")} />}
      {stage === "lockup" && <LockupPick game={game} />}
    </div>
  );
}

function MarkPick({ game, onDone }: LevelProps & { onDone: () => void }) {
  const { brief, palette, pairing } = game.brand;
  const [round, setRound] = useState(0);
  const options = useMemo(() => dealLogos(brief.seed, round), [brief.seed, round]);
  const [chosen, setChosen] = useState<LogoSpec | null>(null);
  const best = Math.max(...options.map((o) => fit(logoVec(o), brief.target)));
  const fg = hex(palette!.primary);
  const bg = hex(palette!.light);

  const choose = (spec: LogoSpec) => {
    if (chosen) return;
    setChosen(spec);
    const rel = fit(logoVec(spec), brief.target) / best;
    game.award({ points: Math.round(rel * 350), max: 350, correct: rel > 0.9, label: rel > 0.98 ? "Iconic!" : rel > 0.9 ? "Strong mark" : "Off-brand mark" });
    if (round === 0) game.unlock("noreroll");
    game.update({ logo: spec });
  };

  return (
    <>
      <StageTitle
        kicker="Level 4 · Logo Forge · Mark"
        title="Forge the mark."
        sub="Shapes carry meaning: curves feel friendly, angles feel driven, outlines feel light. Pick the mark that fits the brief."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((spec, i) => {
          const f = fit(logoVec(spec), brief.target);
          return (
            <button
              key={`${round}-${i}`}
              disabled={!!chosen}
              onClick={() => choose(spec)}
              className={`bf-card-in group flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl p-4 transition hover:-translate-y-1 ${chosen === spec ? "ring-4 ring-accent" : chosen ? "opacity-40" : ""}`}
              style={{ background: bg, animationDelay: `${i * 60}ms` }}
            >
              <Mark spec={spec} name={brief.name} font={pairing!.heading} fg={fg} bg={bg} size={96} className="transition duration-500 group-hover:scale-110 group-hover:rotate-3" />
              <span className="text-[11px] font-medium text-ink/50">
                {CONTAINERS[spec.container].label} · {SYMBOLS[spec.symbol].label}
                {chosen && <span className="ml-1 text-accent">{Math.round(f * 100)}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      {chosen ? (
        <div className="flex flex-col gap-4">
          <FitMeter value={fit(logoVec(chosen), brief.target)} />
          <div>
            <Btn onClick={onDone}>Build the lockup →</Btn>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Btn variant="ghost" disabled={round >= REROLLS} onClick={() => setRound(round + 1)}>
            ↻ Reroll marks ({REROLLS - round})
          </Btn>
          <span className="text-xs text-paper/40">Picking from the first deal unlocks “First Instinct”.</span>
        </div>
      )}
    </>
  );
}

function LockupPick({ game }: LevelProps) {
  const { brief, palette, pairing, logo } = game.brand;
  const [layout, setLayout] = useState<"horizontal" | "stacked" | null>(null);
  const p = palette!;
  const surfaces = [
    { name: "On paper", bg: hex(p.light), fg: hex(p.primary), word: hex(p.dark) },
    { name: "On primary", bg: hex(p.primary), fg: hex(p.light), word: hex(p.light) },
    { name: "On ink", bg: hex(p.dark), fg: hex(p.accent), word: hex(p.light) },
  ];

  return (
    <>
      <StageTitle kicker="Level 4 · Logo Forge · Lockup" title="Mark meets wordmark." sub="Choose how the symbol and name sit together. You'll see it on every brand surface." />
      <div className="grid gap-3 sm:grid-cols-2">
        {(["horizontal", "stacked"] as const).map((l) => (
          <button
            key={l}
            onClick={() => {
              if (layout) return;
              setLayout(l);
              game.award({ points: 100, max: 100, label: "Lockup set" });
              game.update({ lockup: l });
            }}
            className={`grid min-h-48 place-items-center rounded-3xl p-6 transition hover:-translate-y-1 ${layout === l ? "ring-4 ring-accent" : layout ? "opacity-40" : ""}`}
            style={{ background: surfaces[0].bg }}
          >
            <Lockup layout={l} spec={logo!} name={brief.name} font={pairing!.heading} weight={pairing!.headingWeight} fg={surfaces[0].fg} bg={surfaces[0].bg} wordColor={surfaces[0].word} height={56} />
            <span className="mt-3 text-xs font-medium text-ink/50 capitalize">{l}</span>
          </button>
        ))}
      </div>
      {layout && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {surfaces.map((s) => (
              <div key={s.name} className="bf-card-in grid aspect-video place-items-center rounded-3xl" style={{ background: s.bg }}>
                <Lockup layout={layout} spec={logo!} name={brief.name} font={pairing!.heading} weight={pairing!.headingWeight} fg={s.fg} bg={s.bg} wordColor={s.word} height={36} />
              </div>
            ))}
          </div>
          <div>
            <Btn onClick={game.done}>Find the brand voice →</Btn>
          </div>
        </>
      )}
    </>
  );
}
