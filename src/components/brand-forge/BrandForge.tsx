"use client";

import { useEffect, useState } from "react";
import {
  ACHIEVEMENTS,
  type AchievementId,
  AXES,
  type Brand,
  FONT_NAMES,
  TONES,
  dailySeed,
  dealLogos,
  grade,
  hex,
  newBrand,
  primaryCandidates,
  randomSeed,
  rankFor,
} from "./engine";
import { confetti, load, save, setMuted, sfx } from "./fx";
import type { Award, GameApi } from "./game";
import Guideline, { GuidelineActions } from "./Guideline";
import ClientReview from "./levels/ClientReview";
import ColorLab, { PaletteStrip } from "./levels/ColorLab";
import LogoLab from "./levels/LogoLab";
import Personality, { PersonalityBar } from "./levels/Personality";
import TypeLab from "./levels/TypeLab";
import VoiceLab from "./levels/VoiceLab";
import { Lockup, Mark } from "./Logo";
import { Btn, Kicker } from "./ui";

const LEVELS = [
  { id: "personality", title: "Personality", game: "This or That", icon: "◎", C: Personality },
  { id: "color", title: "Colour", game: "Hue Hunt + Contrast Clash", icon: "●", C: ColorLab },
  { id: "type", title: "Typography", game: "Pairing + Kern It", icon: "Aa", C: TypeLab },
  { id: "logo", title: "Logo", game: "Logo Forge", icon: "✦", C: LogoLab },
  { id: "voice", title: "Voice", game: "Tone Duel", icon: "❝", C: VoiceLab },
  { id: "review", title: "Rules", game: "Client Review", icon: "⚠", C: ClientReview },
] as const;

type Phase = "title" | "brief" | "play" | "results" | "library";
type Popup = { id: number; text: string; good: boolean };
type Saved = Brand & { daily?: boolean };

let popupSeq = 0;

const K = {
  xp: "bf:xp",
  best: "bf:best",
  ach: "bf:achievements",
  brands: "bf:brands",
  daily: "bf:daily",
  muted: "bf:muted",
};

export default function BrandForge() {
  const [phase, setPhase] = useState<Phase>("title");
  const [brand, setBrand] = useState<Brand | null>(null);
  const [level, setLevel] = useState(0);
  const [combo, setCombo] = useState(0);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [best, setBest] = useState(0);
  const [achievements, setAchievements] = useState<AchievementId[]>([]);
  const [library, setLibrary] = useState<Saved[]>([]);
  const [daily, setDaily] = useState<{ seed: string; score: number } | null>(null);
  const [muted, setMutedState] = useState(false);
  const [isDaily, setIsDaily] = useState(false);
  const [runAch, setRunAch] = useState<AchievementId[]>([]);
  const [xpBefore, setXpBefore] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Restore saved progress once on mount.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage after mount */
    setXp(load(K.xp, 0));
    setBest(load(K.best, 0));
    setAchievements(load(K.ach, []));
    setLibrary(load(K.brands, []));
    setDaily(load(K.daily, null));
    const m = load(K.muted, false);
    setMutedState(m);
    setMuted(m);
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (loaded) save(K.ach, achievements);
  }, [loaded, achievements]);

  const scrollTop = () => document.getElementById("brand-forge")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const unlock = (id: AchievementId) => {
    if (achievements.includes(id)) return;
    setAchievements((cur) => (cur.includes(id) ? cur : [...cur, id]));
    setRunAch((r) => (r.includes(id) ? r : [...r, id]));
    setToast(`${ACHIEVEMENTS[id].icon}  Achievement: ${ACHIEVEMENTS[id].title}`);
    setTimeout(() => setToast(null), 2600);
  };

  const award = ({ points, max, correct, label }: Award) => {
    const streak = correct === true ? combo + 1 : correct === false ? 0 : combo;
    const mult = correct ? 1 + Math.min(streak - 1, 8) * 0.25 : 1;
    const gained = Math.round(points * mult);
    if (streak >= 8) unlock("combo");
    setCombo(streak);
    setBrand((b) => (b ? { ...b, score: b.score + gained, earned: b.earned + points, maxScore: b.maxScore + max } : b));
    if (correct === false) sfx.bad();
    else sfx.good(streak);
    const id = ++popupSeq;
    const text = `${gained > 0 ? "+" + gained : "0"}${mult > 1 ? `  ×${mult.toFixed(2).replace(/\.?0+$/, "")}` : ""}${label ? "  " + label : ""}`;
    setPopups((p) => [...p, { id, text, good: correct !== false }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== id)), 1400);
  };

  const start = (seed: string, daily = false) => {
    setBrand(newBrand(seed));
    setIsDaily(daily);
    setLevel(0);
    setCombo(0);
    setRunAch([]);
    setPhase("brief");
    scrollTop();
  };

  const finish = (b: Brand) => {
    const pct = b.maxScore ? b.earned / b.maxScore : 0;
    const g = grade(pct);
    const done: Saved = { ...b, grade: g, daily: isDaily };
    setBrand(done);
    const lib = [done, ...library.filter((x) => x.brief.seed !== done.brief.seed)].slice(0, 12);
    setLibrary(lib);
    save(K.brands, lib);
    setXpBefore(xp);
    const newXp = xp + b.score;
    setXp(newXp);
    save(K.xp, newXp);
    if (b.score > best) {
      setBest(b.score);
      save(K.best, b.score);
    }
    if (isDaily) {
      const d = { seed: b.brief.seed, score: Math.max(b.score, daily?.seed === b.brief.seed ? daily.score : 0) };
      setDaily(d);
      save(K.daily, d);
      unlock("daily");
    }
    unlock("first");
    if (lib.length >= 5) unlock("factory");
    if (g === "S") unlock("srank");
    if (rankFor(newXp).index >= 5) unlock("legend");
    setPhase("results");
    sfx.fanfare();
    const p = b.palette!;
    confetti([hex(p.primary), hex(p.secondary), hex(p.accent), "#ffffff"]);
    scrollTop();
  };

  const update = (patch: Partial<Brand>) => setBrand((b) => (b ? { ...b, ...patch } : b));

  const levelDone = () => {
    sfx.level();
    if (level + 1 >= LEVELS.length) {
      if (brand) finish(brand);
    } else {
      setLevel(level + 1);
      scrollTop();
    }
  };

  const game: GameApi | null = brand && { brand, update, award, unlock, done: levelDone };

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
    save(K.muted, !muted);
  };

  return (
    <div id="brand-forge" className="mx-auto w-full max-w-6xl scroll-mt-24 px-3 pt-6 pb-10 sm:px-8">
      {/* Toasts */}
      <div className="bf-no-print pointer-events-none fixed top-24 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        {toast && <div className="bf-pop rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink shadow-2xl">{toast}</div>}
        {popups.map((p) => (
          <div key={p.id} className={`bf-float rounded-full px-4 py-1.5 text-sm font-bold whitespace-nowrap shadow-xl ${p.good ? "bg-[#7CF29A] text-ink" : "bg-accent text-ink"}`}>
            {p.text}
          </div>
        ))}
      </div>

      {phase === "title" && (
        <TitleScreen
          xp={xp}
          best={best}
          achievements={achievements}
          library={library}
          daily={daily}
          muted={muted}
          onMute={toggleMute}
          onPlay={() => start(randomSeed())}
          onDaily={() => start(dailySeed(), true)}
          onCode={(c) => start(c)}
          onLibrary={() => setPhase("library")}
        />
      )}

      {phase === "library" && (
        <LibraryScreen
          library={library}
          onBack={() => setPhase("title")}
          onOpen={(b) => {
            setBrand(b);
            setRunAch([]);
            setXpBefore(xp);
            setPhase("results");
            scrollTop();
          }}
        />
      )}

      {phase === "brief" && brand && <BriefScreen brand={brand} isDaily={isDaily} onAccept={() => setPhase("play")} onBack={() => setPhase("title")} />}

      {phase === "play" && brand && game && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <section className="bf-stage relative min-h-[70vh] overflow-hidden rounded-[2rem] bg-ink p-5 text-paper sm:p-10">
            <Hud level={level} score={brand.score} combo={combo} muted={muted} onMute={toggleMute} onQuit={() => confirm("Quit this brand? Progress on it will be lost.") && setPhase("title")} />
            <div key={level} className="bf-level-in mt-8">
              {(() => {
                const L = LEVELS[level].C;
                return <L game={game} />;
              })()}
            </div>
          </section>
          <DraftPanel brand={brand} level={level} />
        </div>
      )}

      {phase === "results" && brand && brand.palette && brand.pairing && brand.logo && (
        <div className="flex flex-col gap-8">
          <Results brand={brand} xpBefore={xpBefore} xp={xp} runAch={runAch} onAgain={() => start(randomSeed())} onHome={() => setPhase("title")} />
          <GuidelineActions b={brand} />
          <Guideline b={brand} />
          <div className="bf-no-print flex flex-wrap justify-center gap-3">
            <Btn onClick={() => start(randomSeed())}>New client ↻</Btn>
            <Btn variant="ghost" className="!border-ink/20 !text-ink hover:!bg-ink/5" onClick={() => setPhase("title")}>
              Main menu
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Hud({ level, score, combo, muted, onMute, onQuit }: { level: number; score: number; combo: number; muted: boolean; onMute: () => void; onQuit: () => void }) {
  const mult = combo > 0 ? 1 + Math.min(combo - 1, 8) * 0.25 : 1;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-1.5">
        {LEVELS.map((l, i) => (
          <div
            key={l.id}
            title={l.title}
            className={`grid h-8 min-w-8 place-items-center rounded-full px-2 text-[11px] font-bold transition ${
              i < level ? "bg-paper/80 text-ink" : i === level ? "bg-accent text-ink" : "bg-paper/10 text-paper/40"
            }`}
          >
            {i < level ? "✓" : l.icon}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {combo >= 2 && (
          <span key={combo} className="bf-pop rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-accent">
            {combo} streak ×{mult.toFixed(2).replace(/\.?0+$/, "")}
          </span>
        )}
        <span className="font-display text-3xl tabular-nums">{score.toLocaleString()}</span>
        <button onClick={onMute} className="text-paper/50 hover:text-paper" aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button onClick={onQuit} className="text-xs text-paper/40 hover:text-paper">
          Quit
        </button>
      </div>
    </div>
  );
}

function TitleScreen({
  xp,
  best,
  achievements,
  library,
  daily,
  muted,
  onMute,
  onPlay,
  onDaily,
  onCode,
  onLibrary,
}: {
  xp: number;
  best: number;
  achievements: AchievementId[];
  library: Saved[];
  daily: { seed: string; score: number } | null;
  muted: boolean;
  onMute: () => void;
  onPlay: () => void;
  onDaily: () => void;
  onCode: (c: string) => void;
  onLibrary: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [code, setCode] = useState("");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTick((t) => t + 1), 1400);
    return () => clearInterval(id);
  }, []);
  const marks = dealLogos("TITLE", tick).concat(dealLogos("TITLE2", tick));
  const colors = primaryCandidates("TITLE", tick).concat(primaryCandidates("TITLE2", tick));
  const fonts = Object.keys(FONT_NAMES) as (keyof typeof FONT_NAMES)[];
  const letters = "BRANDFORGEXYZ";
  const rank = rankFor(xp);
  const todayDone = daily?.seed === dailySeed();

  return (
    <div className="flex flex-col gap-4">
      <section className="relative overflow-hidden rounded-[2rem] bg-ink p-6 text-paper sm:p-12">
        <div className="pointer-events-none absolute inset-0 grid grid-cols-4 gap-4 p-4 opacity-[0.16] sm:grid-cols-6" aria-hidden>
          {marks.map((m, i) => (
            <div key={i} className="grid aspect-square place-items-center transition-all duration-700" style={{ transform: `rotate(${(i % 3) * 4 - 4}deg)` }}>
              <Mark spec={m} name={letters[(i + tick) % letters.length]} font={fonts[(i + tick) % fonts.length]} fg={hex(colors[i % colors.length])} bg="#16140f" size={90} />
            </div>
          ))}
        </div>
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <Kicker>A design game · 6 levels · 1 brand book</Kicker>
            <button onClick={onMute} className="text-paper/50 hover:text-paper" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
          <h1 className="bf-title mt-6 font-display text-[18vw] leading-[0.85] tracking-tight sm:text-[10rem]">
            Brand
            <br />
            <em className="text-accent">Forge</em>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-paper/70 sm:text-lg">
            A client walks in with a brief. You read their mind, train your colour eye, kern type, forge a logo, find their
            voice and survive the review. Play well and you walk out with a <span className="text-paper">complete brand guideline</span> — ready to print.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Btn onClick={onPlay} className="!px-8 !py-4 !text-base">
              ▶ New client
            </Btn>
            <Btn variant="light" onClick={onDaily}>
              ☀ Daily brief {todayDone ? `· best ${daily!.score.toLocaleString()}` : ""}
            </Btn>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) onCode(code.trim().toUpperCase());
              }}
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Brief code"
                maxLength={16}
                className="w-32 rounded-full border border-paper/20 bg-transparent px-4 py-3 text-sm uppercase placeholder:text-paper/30 focus:border-accent focus:outline-none"
              />
              <Btn variant="ghost" type="submit" disabled={!code.trim()}>
                Go
              </Btn>
            </form>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[2rem] bg-paper-2 p-6">
          <Kicker>Your rank</Kicker>
          <p className="mt-2 font-display text-4xl">{rank.title}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-accent" style={{ width: `${rank.progress * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {xp.toLocaleString()} XP {rank.next ? `· ${rank.toNext.toLocaleString()} to ${rank.next}` : "· max rank"}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-ink-soft">Best score</p>
              <p className="font-display text-2xl">{best.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-ink-soft">Brands built</p>
              <p className="font-display text-2xl">{library.length}</p>
            </div>
          </div>
          {library.length > 0 && (
            <button onClick={onLibrary} className="mt-6 text-sm font-semibold underline-offset-4 hover:underline">
              Open brand library →
            </button>
          )}
        </div>

        <div className="rounded-[2rem] bg-paper-2 p-6 lg:col-span-2">
          <Kicker>The six levels</Kicker>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {LEVELS.map((l, i) => (
              <li key={l.id} className="rounded-2xl bg-paper p-4">
                <span className="grid size-9 place-items-center rounded-full bg-ink text-sm font-bold text-paper">{l.icon}</span>
                <p className="mt-3 text-xs text-ink-soft">Level {i + 1}</p>
                <p className="font-semibold">{l.title}</p>
                <p className="text-xs text-ink-soft">{l.game}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="rounded-[2rem] bg-paper-2 p-6">
        <div className="flex items-baseline justify-between">
          <Kicker>Achievements</Kicker>
          <span className="text-xs text-ink-soft">
            {achievements.length}/{Object.keys(ACHIEVEMENTS).length}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {(Object.keys(ACHIEVEMENTS) as AchievementId[]).map((id) => {
            const a = ACHIEVEMENTS[id];
            const got = achievements.includes(id);
            return (
              <div key={id} title={a.desc} className={`rounded-2xl p-3 transition ${got ? "bg-ink text-paper" : "bg-paper text-ink/35"}`}>
                <span className={`text-xl ${got ? "text-accent" : ""}`}>{got ? a.icon : "?"}</span>
                <p className="mt-1 text-xs font-semibold">{a.title}</p>
                <p className="text-[10px] leading-snug opacity-70">{a.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BriefScreen({ brand, isDaily, onAccept, onBack }: { brand: Brand; isDaily: boolean; onAccept: () => void; onBack: () => void }) {
  const b = brand.brief;
  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-ink p-6 text-paper sm:p-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Kicker>{isDaily ? "☀ Daily brief" : "Incoming brief"} · code {b.seed}</Kicker>
        <button onClick={onBack} className="text-xs text-paper/40 hover:text-paper">
          ← Back
        </button>
      </div>
      <div className="bf-paper-in mt-8 rotate-[-0.6deg] rounded-3xl bg-paper p-6 text-ink shadow-2xl sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 pb-6">
          <div>
            <p className="text-xs tracking-widest text-ink-soft uppercase">Client</p>
            <h2 className="mt-1 font-display text-6xl leading-none sm:text-7xl">{b.name}</h2>
            <p className="mt-2 text-ink-soft">{b.industry}</p>
          </div>
          <span className="rotate-6 rounded-lg border-2 border-accent px-3 py-1 text-xs font-bold tracking-widest text-accent uppercase">Confidential</span>
        </div>
        <dl className="mt-6 grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs tracking-widest text-ink-soft uppercase">What they make</dt>
            <dd className="mt-1 text-lg">{b.product}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-widest text-ink-soft uppercase">For</dt>
            <dd className="mt-1 text-lg">{b.audience}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-widest text-ink-soft uppercase">Values</dt>
            <dd className="mt-1 text-lg">{b.values.join(" · ")}</dd>
          </div>
        </dl>
        <div className="mt-8">
          <p className="text-xs tracking-widest text-ink-soft uppercase">The brand should feel</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {b.keywords.map((k) => (
              <span key={k} className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper">
                {k}
              </span>
            ))}
          </div>
        </div>
        <blockquote className="mt-8 border-l-4 border-accent pl-4 font-display text-2xl leading-snug italic sm:text-3xl">
          “{b.quote}”
          <footer className="mt-2 font-sans text-sm text-ink-soft not-italic">
            — {b.client}, {b.role}
          </footer>
        </blockquote>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Btn onClick={onAccept} className="!px-8 !py-4 !text-base">
          Accept the brief →
        </Btn>
        <p className="text-sm text-paper/50">Remember those keywords. Every level scores how well you read them.</p>
      </div>
    </section>
  );
}

function Slot({ level, n, title, ready, children }: { level: number; n: number; title: string; ready: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl p-4 transition ${ready ? "bf-pop bg-paper" : "border border-dashed border-ink/15"} ${level === n && !ready ? "!border-accent" : ""}`}>
      <p className="text-[10px] font-semibold tracking-widest text-ink-soft uppercase">
        0{n + 1} · {title}
      </p>
      <div className="mt-2">{ready ? children : <p className="text-xs text-ink/30">{level === n ? "Building now…" : "Locked"}</p>}</div>
    </div>
  );
}

function DraftPanel({ brand, level }: { brand: Brand; level: number }) {
  const { palette, pairing, logo, voice } = brand;
  return (
    <aside className="flex flex-col gap-2 rounded-[2rem] bg-paper-2 p-4 lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-baseline justify-between px-1">
        <p className="font-display text-2xl">Guideline draft</p>
        <span className="text-xs text-ink-soft">{brand.brief.name}</span>
      </div>
      <Slot level={level} n={0} title="Personality" ready={level > 0}>
        <div className="grid gap-2">
          {AXES.map((a) => (
            <PersonalityBar key={a} axis={a} value={brand.vec[a]} light />
          ))}
        </div>
      </Slot>
      <Slot level={level} n={1} title="Colour" ready={!!palette && level > 1}>
        {palette && <PaletteStrip palette={palette} light compact />}
      </Slot>
      <Slot level={level} n={2} title="Type" ready={!!pairing && level > 2}>
        {pairing && (
          <p className="text-2xl leading-none" style={{ fontFamily: `var(--bf-${pairing.heading})`, fontWeight: pairing.headingWeight }}>
            {brand.brief.name}
            <span className="mt-1 block text-xs" style={{ fontFamily: `var(--bf-${pairing.body})`, fontWeight: 400 }}>
              {FONT_NAMES[pairing.heading]} / {FONT_NAMES[pairing.body]}
            </span>
          </p>
        )}
      </Slot>
      <Slot level={level} n={3} title="Logo" ready={!!logo && level > 3}>
        {logo && palette && pairing && (
          <Lockup layout={brand.lockup} spec={logo} name={brand.brief.name} font={pairing.heading} weight={pairing.headingWeight} fg={hex(palette.primary)} bg="#f5f2eb" wordColor={hex(palette.dark)} height={32} />
        )}
      </Slot>
      <Slot level={level} n={4} title="Voice" ready={!!voice && level > 4}>
        {voice && <p className="text-sm">{TONES[voice.tone].weAre.join(" · ")}</p>}
      </Slot>
      <Slot level={level} n={5} title="Rules" ready={false}>
        {null}
      </Slot>
    </aside>
  );
}

function Results({ brand, xpBefore, xp, runAch, onAgain, onHome }: { brand: Brand; xpBefore: number; xp: number; runAch: AchievementId[]; onAgain: () => void; onHome: () => void }) {
  const pct = brand.maxScore ? brand.earned / brand.maxScore : 0;
  const g = brand.grade ?? grade(pct);
  const before = rankFor(xpBefore);
  const after = rankFor(xp);
  const promoted = after.index > before.index;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 1200);
      setShown(Math.round(brand.score * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [brand.score]);

  return (
    <section className="bf-no-print relative overflow-hidden rounded-[2rem] bg-ink p-6 text-paper sm:p-12">
      <div className="grid items-center gap-8 lg:grid-cols-[auto_1fr_auto]">
        <div className="bf-grade grid size-40 place-items-center rounded-full border-4 border-accent font-display text-8xl text-accent">{g}</div>
        <div>
          <Kicker>Brand shipped · {brand.brief.name}</Kicker>
          <p className="mt-2 font-display text-6xl tabular-nums sm:text-7xl">{shown.toLocaleString()}</p>
          <p className="mt-1 text-sm text-paper/60">
            Accuracy {Math.round(pct * 100)}% · +{brand.score.toLocaleString()} XP
          </p>
          <div className="mt-4 max-w-md">
            <div className="flex justify-between text-xs text-paper/60">
              <span>{after.title}</span>
              <span>{after.next ? `${after.toNext.toLocaleString()} XP to ${after.next}` : "Max rank"}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper/10">
              <div className="h-full rounded-full bg-accent transition-all duration-1000" style={{ width: `${after.progress * 100}%` }} />
            </div>
            {promoted && <p className="bf-pop mt-3 text-sm font-semibold text-accent">★ Promoted to {after.title}!</p>}
          </div>
          {runAch.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {runAch.map((id) => (
                <span key={id} className="bf-pop rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink">
                  {ACHIEVEMENTS[id].icon} {ACHIEVEMENTS[id].title}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <Btn onClick={onAgain}>Next client ↻</Btn>
          <Btn variant="ghost" onClick={onHome}>
            Main menu
          </Btn>
        </div>
      </div>
      <p className="mt-8 text-sm text-paper/50">Your brand guideline is below ↓ — save it as a PDF or grab the design tokens.</p>
    </section>
  );
}

function LibraryScreen({ library, onBack, onOpen }: { library: Saved[]; onBack: () => void; onOpen: (b: Saved) => void }) {
  return (
    <section className="rounded-[2rem] bg-ink p-6 text-paper sm:p-12">
      <div className="flex items-center justify-between">
        <div>
          <Kicker>Brand library</Kicker>
          <h2 className="mt-2 font-display text-5xl">Your brands</h2>
        </div>
        <Btn variant="ghost" onClick={onBack}>
          ← Back
        </Btn>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {library.map((b) =>
          b.palette && b.pairing && b.logo ? (
            <button key={b.brief.seed} onClick={() => onOpen(b)} className="group overflow-hidden rounded-3xl text-left transition hover:-translate-y-1">
              <div className="grid aspect-square place-items-center" style={{ background: hex(b.palette.primary) }}>
                <Mark spec={b.logo} name={b.brief.name} font={b.pairing.heading} fg={hex(b.palette.light)} bg={hex(b.palette.primary)} size={80} className="transition duration-500 group-hover:scale-110" />
              </div>
              <div className="flex items-center justify-between bg-paper p-3 text-ink">
                <div>
                  <p className="font-semibold">{b.brief.name}</p>
                  <p className="text-[11px] text-ink-soft">{b.brief.industry}</p>
                </div>
                <span className="font-display text-2xl text-accent">{b.grade}</span>
              </div>
            </button>
          ) : null,
        )}
      </div>
    </section>
  );
}
