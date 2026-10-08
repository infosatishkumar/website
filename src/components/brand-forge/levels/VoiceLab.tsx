"use client";

import { useMemo, useRef, useState } from "react";
import { SCENARIOS, TONES, type ToneId, fill, fontVar, hex, inkOn, rngFrom, shuffle, toneRanking } from "../engine";
import type { LevelProps } from "../game";
import { Mark } from "../Logo";
import { Btn, Feedback, StageTitle, TimerBar, useCountdown } from "../ui";

const ROUNDS = 6;
const SECONDS = 12;

export default function VoiceLab({ game }: LevelProps) {
  const { brief, palette, pairing, logo } = game.brand;
  const ranking = useMemo(() => toneRanking(brief.target), [brief.target]);
  const rounds = useMemo(() => {
    const r = rngFrom(brief.seed + ":voice");
    return shuffle(r, SCENARIOS)
      .slice(0, ROUNDS)
      .map((s) => ({ scenario: s, order: shuffle(r, Object.keys(TONES) as ToneId[]) }));
  }, [brief.seed]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<ToneId | "timeout" | null>(null);
  const picks = useRef<{ tone: ToneId; label: string; text: string }[]>([]);
  const perfect = useRef(true);
  const [finished, setFinished] = useState(false);
  const { scenario, order } = rounds[i];

  const choose = (t: ToneId | null) => {
    if (picked) return;
    const rank = t ? ranking.indexOf(t) : 3;
    const pts = [200, 80, 20, 0][rank];
    if (rank !== 0) perfect.current = false;
    game.award({ points: pts, max: 200, correct: rank === 0, label: rank === 0 ? "On voice!" : rank === 1 ? "Close" : "Off-voice" });
    if (t) picks.current.push({ tone: t, label: scenario.label, text: fill(scenario.lines[t], brief.name) });
    setPicked(t ?? "timeout");
  };
  const next = () => {
    if (i + 1 >= rounds.length) {
      if (perfect.current) game.unlock("wordsmith");
      const counts = new Map<ToneId, number>();
      for (const p of picks.current) counts.set(p.tone, (counts.get(p.tone) ?? 0) + 1);
      const tone = [...counts.entries()].sort((a, b) => b[1] - a[1] || ranking.indexOf(a[0]) - ranking.indexOf(b[0]))[0]?.[0] ?? ranking[0];
      game.update({ voice: { tone, samples: picks.current.map(({ label, text }) => ({ label, text })) } });
      setFinished(true);
    } else {
      setI(i + 1);
      setPicked(null);
    }
  };
  const left = useCountdown(SECONDS, i, !picked && !finished, () => choose(null));

  const p = palette!;
  const primary = hex(p.primary);
  const onPrimary = inkOn(primary, hex(p.dark), hex(p.light));

  if (finished) {
    const tone = game.brand.voice?.tone ?? ranking[0];
    const t = TONES[tone];
    return (
      <div className="flex flex-col gap-6">
        <StageTitle kicker="Level 5 complete" title={<>Your voice is <em className="text-accent">{t.label.toLowerCase()}</em>.</>} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl bg-paper/5 p-5">
            <p className="text-xs tracking-widest text-paper/50 uppercase">We are</p>
            <p className="mt-2 font-display text-3xl">{t.weAre.join(" · ")}</p>
          </div>
          <div className="rounded-3xl bg-paper/5 p-5">
            <p className="text-xs tracking-widest text-paper/50 uppercase">We are not</p>
            <p className="mt-2 font-display text-3xl text-paper/50 line-through decoration-accent">{t.weAreNot.join(" · ")}</p>
          </div>
        </div>
        <div>
          <Btn onClick={game.done}>Final boss: Client Review →</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StageTitle
        kicker={`Level 5 · Tone Duel ${i + 1}/${rounds.length}`}
        title={scenario.label}
        sub={<>Which line sounds like a <span className="text-paper">{brief.keywords.join(", ")}</span> brand?</>}
      />
      <TimerBar left={left} total={SECONDS} />
      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div key={i} className="grid gap-3">
          {order.map((t, k) => {
            const rank = ranking.indexOf(t);
            const reveal = picked !== null;
            const ring = reveal ? (rank === 0 ? "ring-2 ring-[#7CF29A]" : picked === t ? "ring-2 ring-accent" : "opacity-40") : "";
            return (
              <button
                key={t}
                disabled={reveal}
                onClick={() => choose(t)}
                className={`bf-card-in flex items-start gap-3 rounded-2xl bg-paper/5 p-4 text-left transition hover:bg-paper/10 ${ring}`}
                style={{ animationDelay: `${k * 60}ms` }}
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-paper/10 text-xs">{k + 1}</span>
                <span className="text-base" style={{ fontFamily: fontVar(pairing!.body) }}>
                  {fill(scenario.lines[t], brief.name)}
                  {reveal && <span className="ml-2 text-xs text-paper/40">— {TONES[t].label}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="hidden rounded-3xl p-5 lg:block" style={{ background: hex(p.light), color: hex(p.dark) }}>
          <div className="flex items-center gap-2">
            <Mark spec={logo!} name={brief.name} font={pairing!.heading} fg={primary} bg={hex(p.light)} size={28} />
            <span className="text-sm font-semibold" style={{ fontFamily: fontVar(pairing!.heading) }}>
              {brief.name}
            </span>
          </div>
          <div className="mt-6 rounded-2xl rounded-tl-sm p-4 text-sm" style={{ background: primary, color: onPrimary, fontFamily: fontVar(pairing!.body) }}>
            {picked && picked !== "timeout" ? fill(scenario.lines[picked], brief.name) : "…"}
          </div>
          <p className="mt-3 text-[11px] opacity-50">Live preview</p>
        </div>
      </div>
      {picked && (
        <div className="flex flex-col gap-3">
          <Feedback good={picked === ranking[0]}>
            {picked === "timeout" ? "Too slow! " : ""}The brief calls for a <strong>{TONES[ranking[0]].label.toLowerCase()}</strong> voice here.
          </Feedback>
          <div>
            <Btn onClick={next}>{i + 1 >= rounds.length ? "Reveal your voice →" : "Next line →"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
