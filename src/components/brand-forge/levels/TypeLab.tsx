"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FONT_NAMES, type FontId, type Pairing, SCALES, dealPairings, fit, fontVar, rngFrom, range } from "../engine";
import type { LevelProps } from "../game";
import { Btn, Feedback, FitMeter, StageTitle } from "../ui";

type Stage = "pair" | "kern" | "scale" | "summary";

export default function TypeLab({ game }: LevelProps) {
  const [stage, setStage] = useState<Stage>("pair");
  const [kernRound, setKernRound] = useState(0);
  const { brief, pairing } = game.brand;
  const words = [brief.name.toUpperCase(), brief.values[0].toUpperCase()];

  return (
    <div className="flex flex-col gap-6">
      {stage === "pair" && <PairPick game={game} onDone={() => setStage("kern")} />}
      {stage === "kern" && pairing && (
        <KernIt
          key={kernRound}
          game={game}
          word={words[kernRound]}
          font={pairing.heading}
          weight={pairing.headingWeight}
          round={kernRound}
          onDone={() => (kernRound + 1 < words.length ? setKernRound(kernRound + 1) : setStage("scale"))}
        />
      )}
      {stage === "scale" && pairing && <ScalePick game={game} onDone={() => setStage("summary")} />}
      {stage === "summary" && pairing && (
        <>
          <StageTitle kicker="Level 3 complete" title="Type system set." />
          <TypeSpecimen pairing={pairing} scale={game.brand.scale} name={brief.name} tagline={brief.tagline} />
          <div>
            <Btn onClick={game.done}>Forge the logo →</Btn>
          </div>
        </>
      )}
    </div>
  );
}

function PairPick({ game, onDone }: LevelProps & { onDone: () => void }) {
  const { brief } = game.brand;
  const options = useMemo(() => dealPairings(brief.seed, brief.target), [brief.seed, brief.target]);
  const best = Math.max(...options.map((p) => fit(p.vec, brief.target)));
  const [chosen, setChosen] = useState<Pairing | null>(null);

  const choose = (p: Pairing) => {
    if (chosen) return;
    setChosen(p);
    const rel = fit(p.vec, brief.target) / best;
    game.award({ points: Math.round(rel * 300), max: 300, correct: rel > 0.9, label: rel > 0.98 ? "Perfect pairing!" : rel > 0.9 ? "Great pairing" : "Doesn't quite fit" });
    game.update({ pairing: p });
  };

  return (
    <>
      <StageTitle
        kicker="Level 3 · Type Lab · Pairing"
        title="Find the voice in the letters."
        sub={<>Pick the heading + body pairing that sounds like <span className="text-paper">{brief.keywords.join(", ")}</span>.</>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((p, i) => (
          <button
            key={p.id}
            disabled={!!chosen}
            onClick={() => choose(p)}
            className={`bf-card-in flex flex-col gap-3 rounded-3xl bg-paper p-5 text-left text-ink transition hover:-translate-y-1 ${chosen?.id === p.id ? "ring-4 ring-accent" : chosen ? "opacity-40" : ""}`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="text-[10px] font-semibold tracking-[0.2em] text-ink/40 uppercase">{p.name}</span>
            <span className="text-4xl leading-none" style={{ fontFamily: fontVar(p.heading), fontWeight: p.headingWeight }}>
              {brief.name}
            </span>
            <span className="text-sm leading-relaxed text-ink/70" style={{ fontFamily: fontVar(p.body) }}>
              {brief.tagline} We make {brief.product} for {brief.audience}.
            </span>
            {chosen && <span className="text-xs font-semibold text-accent">Fit {Math.round(fit(p.vec, brief.target) * 100)}%</span>}
          </button>
        ))}
      </div>
      {chosen && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-paper/60">{chosen.note}</p>
          <div>
            <Btn onClick={onDone}>Kern It →</Btn>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Kern It ---------------- */

const GAP = 0.06;

function KernIt({ game, word, font, weight, round, onDone }: LevelProps & { word: string; font: FontId; weight: number; round: number; onDone: () => void }) {
  const letters = word.split("");
  const n = letters.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const measureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [widths, setWidths] = useState<number[] | null>(null);
  const [xs, setXs] = useState<number[]>([]);
  const [fontSize, setFontSize] = useState(88);
  const [score, setScore] = useState<number | null>(null);
  const drag = useRef<{ i: number; startX: number; startPos: number } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const resize = () => setFontSize(Math.max(40, Math.min(110, (el.clientWidth / (n * 0.85)) * 0.95)));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [n]);

  useEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      const ws = measureRefs.current.map((s) => (s ? s.getBoundingClientRect().width / 100 : 0.6));
      const r = rngFrom(word + font);
      let x = 0;
      const ideal = ws.map((w) => {
        const pos = x;
        x += w + GAP;
        return pos;
      });
      // Nudge each middle letter off its even position without letting glyph boxes collide.
      const scrambled = [...ideal];
      for (let i = 1; i < n - 1; i++) {
        const want = ideal[i] + (r() > 0.5 ? 1 : -1) * range(r, 0.05, 0.14);
        const lo = scrambled[i - 1] + ws[i - 1] - 0.01;
        const hi = ideal[i + 1] - ws[i] - 0.01;
        scrambled[i] = Math.max(lo, Math.min(hi, want));
      }
      setWidths(ws);
      setXs(scrambled);
    });
    return () => {
      cancelled = true;
    };
  }, [word, font, n]);

  const total = widths ? xs[n - 1] + widths[n - 1] : 0;
  const idealGap = widths ? (xs[n - 1] - xs[0] - widths.slice(0, -1).reduce((a, b) => a + b, 0)) / (n - 1) : 0;
  const ideal = useMemo(() => {
    if (!widths) return [];
    let x = xs[0];
    return widths.map((w) => {
      const p = x;
      x += w + idealGap;
      return p;
    });
  }, [widths, xs, idealGap]);

  const onDown = (i: number) => (e: React.PointerEvent) => {
    if (score !== null || i === 0 || i === n - 1) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { i, startX: e.clientX, startPos: xs[i] };
    setDragging(i);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !widths) return;
    const raw = d.startPos + (e.clientX - d.startX) / fontSize;
    const lo = xs[d.i - 1] + widths[d.i - 1] - 0.08;
    const hi = xs[d.i + 1] - widths[d.i] + 0.08;
    const next = [...xs];
    next[d.i] = Math.max(lo, Math.min(hi, raw));
    setXs(next);
  };
  const onUp = () => {
    drag.current = null;
    setDragging(null);
  };

  const submit = () => {
    if (!widths) return;
    const gaps = xs.slice(0, -1).map((x, i) => xs[i + 1] - (x + widths[i]));
    const err = gaps.reduce((s, g) => s + Math.abs(g - idealGap), 0) / gaps.length;
    const s = Math.max(0, Math.min(1, 1 - err / 0.09));
    setScore(s);
    game.award({ points: Math.round(s * 300), max: 300, correct: s > 0.75, label: s > 0.95 ? "Kern Whisperer!" : s > 0.8 ? "Tight!" : s > 0.6 ? "Not bad" : "Wobbly" });
    if (s >= 0.95) game.unlock("kern");
  };

  return (
    <>
      <StageTitle
        kicker={`Level 3 · Kern It ${round + 1}/2`}
        title="Fix the letterspacing."
        sub="Drag the middle letters left or right until the spaces between them feel even. First and last letters are locked."
      />
      <div
        ref={stageRef}
        className="relative overflow-hidden rounded-3xl bg-paper text-ink"
        style={{ height: fontSize * 2.1, touchAction: "none" }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* measuring row */}
        <div aria-hidden className="pointer-events-none absolute -top-[999px] whitespace-nowrap" style={{ fontFamily: fontVar(font), fontWeight: weight, fontSize: 100 }}>
          {letters.map((l, i) => (
            <span key={i} ref={(el) => { measureRefs.current[i] = el; }} className="inline-block">
              {l}
            </span>
          ))}
        </div>
        {widths && (
          <div className="absolute top-1/2 left-1/2" style={{ transform: `translate(${(-total * fontSize) / 2}px, -50%)`, fontFamily: fontVar(font), fontWeight: weight, fontSize, lineHeight: 1 }}>
            <div className="relative" style={{ height: "1em" }}>
              {score !== null &&
                letters.map((l, i) => (
                  <span key={`g${i}`} className="absolute top-0 text-accent/35" style={{ left: `${ideal[i]}em` }}>
                    {l}
                  </span>
                ))}
              {letters.map((l, i) => {
                const locked = i === 0 || i === n - 1;
                return (
                  <span
                    key={i}
                    onPointerDown={onDown(i)}
                    data-cursor
                    className={`absolute top-0 select-none ${locked ? "opacity-100" : "cursor-ew-resize hover:text-accent"}`}
                    style={{ left: `${xs[i]}em`, transition: dragging === i ? "none" : "color 150ms" }}
                  >
                    {l}
                    {!locked && score === null && <span className="absolute -bottom-3 left-1/2 h-1 w-3 -translate-x-1/2 rounded-full bg-ink/20" style={{ fontSize: 16 }} />}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {score === null ? (
        <div>
          <Btn onClick={submit} disabled={!widths}>Submit spacing</Btn>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Feedback good={score > 0.75}>
            Spacing accuracy {Math.round(score * 100)}%. The orange ghost shows mathematically even spacing — real kerning also trusts the eye.
          </Feedback>
          <div>
            <Btn onClick={onDone}>{round === 0 ? "One more word →" : "Choose a type scale →"}</Btn>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Scale ---------------- */

function ScalePick({ game, onDone }: LevelProps & { onDone: () => void }) {
  const { brief, pairing } = game.brand;
  const [chosen, setChosen] = useState<number | null>(null);
  const best = Math.max(...SCALES.map((s) => fit(s.vec, brief.target)));

  return (
    <>
      <StageTitle kicker="Level 3 · Type scale" title="Set the rhythm." sub="A modular scale multiplies each heading size by a ratio. Bigger ratios feel louder." />
      <div className="grid gap-3 sm:grid-cols-5">
        {SCALES.map((s) => (
          <button
            key={s.ratio}
            disabled={chosen !== null}
            onClick={() => {
              setChosen(s.ratio);
              const rel = fit(s.vec, brief.target) / best;
              game.award({ points: Math.round(rel * 150), max: 150, label: s.name });
              game.update({ scale: s.ratio });
            }}
            className={`flex flex-col items-start gap-2 rounded-3xl bg-paper/5 p-4 text-left transition hover:bg-paper/10 ${chosen === s.ratio ? "ring-4 ring-accent" : chosen !== null ? "opacity-40" : ""}`}
          >
            <span className="text-xs text-paper/50">{s.name}</span>
            <span className="text-2xl font-semibold tabular-nums">{s.ratio}</span>
            <span className="flex items-end gap-1" style={{ fontFamily: pairing ? fontVar(pairing.heading) : undefined }}>
              {[3, 2, 1, 0].map((k) => (
                <span key={k} style={{ fontSize: 10 * Math.pow(s.ratio, k) }} className="leading-none">
                  A
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
      {chosen !== null && (
        <div className="flex flex-col gap-4">
          <FitMeter value={fit(SCALES.find((s) => s.ratio === chosen)!.vec, brief.target)} />
          <div>
            <Btn onClick={onDone}>See type system →</Btn>
          </div>
        </div>
      )}
    </>
  );
}

export function TypeSpecimen({ pairing, scale, name, tagline, light }: { pairing: Pairing; scale: number; name: string; tagline: string; light?: boolean }) {
  const sizes = [4, 3, 2, 1, 0].map((k) => Math.round(16 * Math.pow(scale, k)));
  const labels = ["Display", "H1", "H2", "H3", "Body"];
  return (
    <div className={`grid gap-6 rounded-3xl p-5 sm:p-8 lg:grid-cols-[1fr_1.2fr] ${light ? "bg-white/60 ring-1 ring-ink/10" : "bg-paper text-ink"}`}>
      <div>
        <p className="text-xs tracking-widest text-ink/50 uppercase">Heading — {fontLabel(pairing.heading)}</p>
        <p className="mt-2 text-7xl leading-none" style={{ fontFamily: fontVar(pairing.heading), fontWeight: pairing.headingWeight }}>
          Aa
        </p>
        <p className="mt-6 text-xs tracking-widest text-ink/50 uppercase">Body — {fontLabel(pairing.body)}</p>
        <p className="mt-2 text-sm leading-relaxed" style={{ fontFamily: fontVar(pairing.body) }}>
          ABCDEFGHIJKLMNOPQRSTUVWXYZ
          <br />
          abcdefghijklmnopqrstuvwxyz
          <br />
          0123456789 &amp;!?@
        </p>
      </div>
      <div className="flex flex-col gap-3 overflow-hidden">
        {sizes.map((px, i) => (
          <div key={px} className="flex items-baseline gap-4 border-b border-ink/10 pb-2">
            <span className="w-16 shrink-0 text-[10px] text-ink/50 tabular-nums">
              {labels[i]} {px}px
            </span>
            <span
              className="truncate leading-tight"
              style={{ fontSize: Math.min(px, 64), fontFamily: fontVar(i < 4 ? pairing.heading : pairing.body), fontWeight: i < 4 ? pairing.headingWeight : 400 }}
            >
              {i === 0 ? name : tagline}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const fontLabel = (id: FontId) => FONT_NAMES[id];
