"use client";

import { useMemo, useRef, useState } from "react";
import { VIOLATIONS, type ViolationId, rngFrom, shuffle } from "../engine";
import type { LevelProps } from "../game";
import { MOCKUPS } from "../Mockups";
import { Btn, Feedback, Hearts, StageTitle, TimerBar, useCountdown } from "../ui";

const LIVES = 3;

export default function ClientReview({ game }: LevelProps) {
  const seed = game.brand.brief.seed;
  const rounds = useMemo(() => {
    const r = rngFrom(seed + ":review");
    return shuffle(r, Object.keys(VIOLATIONS) as ViolationId[]).map((v) => ({
      v,
      order: shuffle(r, [0, 1, 2, 3]),
      culprit: Math.floor(r() * 4),
    }));
  }, [seed]);
  const [i, setI] = useState(-1);
  const [lives, setLives] = useState(LIVES);
  const [answer, setAnswer] = useState<null | { slot: number | null; good: boolean }>(null);
  const [over, setOver] = useState(false);
  const [caught, setCaught] = useState<ViolationId[]>([]);
  const shownAt = useRef(0);
  const seconds = Math.max(5, 10 - Math.max(i, 0) * 0.7);
  const round = rounds[Math.max(i, 0)];

  const pickSlot = (slot: number | null) => {
    if (answer || over || i < 0) return;
    const good = slot === round.culprit;
    const speed = Math.max(0, 1 - (performance.now() - shownAt.current) / 1000 / seconds);
    game.award({ points: good ? Math.round(150 + 100 * speed) : 0, max: 250, correct: good, label: good ? "Caught it!" : "Missed!" });
    if (good) setCaught((c) => [...c, round.v]);
    else setLives((l) => l - 1);
    setAnswer({ slot, good });
  };
  const next = () => {
    if (lives <= 0 || i + 1 >= rounds.length) {
      if (lives === LIVES) game.unlock("flawless");
      game.update({ donts: caught });
      setOver(true);
      return;
    }
    shownAt.current = performance.now();
    setI(i + 1);
    setAnswer(null);
  };
  const left = useCountdown(seconds, i, i >= 0 && !answer && !over, () => pickSlot(null));

  if (i < 0) {
    return (
      <div className="flex flex-col gap-6">
        <StageTitle
          kicker="Level 6 · Final boss"
          title={<>Client Review <span className="text-accent">⚠</span></>}
          sub={`${game.brand.brief.client} is reviewing the rollout. In every round, one of four mockups breaks the brand rules. Spot it before time runs out. Three strikes and the review ends.`}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.values(VIOLATIONS)
            .slice(0, 4)
            .map((x) => (
              <div key={x.title} className="rounded-2xl bg-paper/5 p-3 text-xs text-paper/60">
                <span className="text-paper">{x.title}</span> — {x.rule}
              </div>
            ))}
        </div>
        <div>
          <Btn onClick={next}>Start the review</Btn>
        </div>
      </div>
    );
  }

  if (over) {
    const n = caught.length;
    return (
      <div className="flex flex-col gap-6">
        <StageTitle
          kicker="Level 6 complete"
          title={lives > 0 ? "Client approved!" : "Review ended."}
          sub={`You caught ${n} of ${rounds.length} brand violations. Every rule goes into the “Don’t” section of your guideline.`}
        />
        <div>
          <Btn onClick={game.done}>Publish brand guideline ✦</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <StageTitle kicker={`Level 6 · Client Review ${i + 1}/${rounds.length}`} title="Spot the off-brand mockup." />
        <Hearts lives={lives} max={LIVES} />
      </div>
      <TimerBar left={left} total={seconds} />
      <div key={i} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {round.order.map((m, slot) => {
          const M = MOCKUPS[m];
          const isCulprit = slot === round.culprit;
          const ring = answer ? (isCulprit ? "ring-4 ring-[#7CF29A]" : answer.slot === slot ? "ring-4 ring-accent" : "opacity-40") : "hover:-translate-y-1";
          return (
            <button
              key={slot}
              disabled={!!answer}
              onClick={() => pickSlot(slot)}
              className={`bf-card-in aspect-[4/5] overflow-hidden rounded-2xl bg-paper/5 transition ${ring}`}
              style={{ animationDelay: `${slot * 60}ms` }}
              aria-label={M.label}
            >
              <M.C b={game.brand} v={isCulprit ? round.v : undefined} />
            </button>
          );
        })}
      </div>
      {answer && (
        <div className="flex flex-col gap-3">
          <Feedback good={answer.good}>
            <strong>{VIOLATIONS[round.v].title}.</strong> {VIOLATIONS[round.v].rule}
            {answer.slot === null && " (Time's up!)"}
          </Feedback>
          <div>
            <Btn onClick={next}>{lives <= 0 ? "End review" : i + 1 >= rounds.length ? "Finish review" : "Next round →"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
