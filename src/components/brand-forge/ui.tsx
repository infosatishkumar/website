"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { type Visual, fontVar } from "./engine";
import { sfx } from "./fx";

/** Counts down from `seconds` while `running`; calls onExpire once at 0. Reset by changing `resetKey`. */
export function useCountdown(seconds: number, resetKey: unknown, running: boolean, onExpire: () => void) {
  const [left, setLeft] = useState(seconds);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  const [prevKey, setPrevKey] = useState(resetKey);
  if (prevKey !== resetKey) {
    setPrevKey(resetKey);
    setLeft(seconds);
  }
  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    const startLeft = left;
    let fired = false;
    let lastWhole = Math.ceil(startLeft);
    const id = setInterval(() => {
      const next = Math.max(0, startLeft - (performance.now() - started) / 1000);
      setLeft(next);
      const whole = Math.ceil(next);
      if (whole !== lastWhole && whole <= 3 && whole > 0) sfx.tick();
      lastWhole = whole;
      if (next <= 0 && !fired) {
        fired = true;
        clearInterval(id);
        expire.current();
      }
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only on key/run changes
  }, [resetKey, running]);
  return left;
}

export function TimerBar({ left, total }: { left: number; total: number }) {
  const pct = Math.max(0, Math.min(1, left / total));
  const hot = pct < 0.3;
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-paper/10">
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${hot ? "bg-accent" : "bg-paper/70"}`}
        style={{ width: `${pct * 100}%`, transition: "width 60ms linear" }}
      />
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "light";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-accent text-ink hover:brightness-110 shadow-[0_6px_0_0_rgba(0,0,0,0.35)] active:translate-y-[3px] active:shadow-[0_3px_0_0_rgba(0,0,0,0.35)]",
    ghost: "border border-paper/25 text-paper hover:bg-paper/10",
    light: "bg-paper text-ink hover:bg-white shadow-[0_6px_0_0_rgba(0,0,0,0.35)] active:translate-y-[3px] active:shadow-[0_3px_0_0_rgba(0,0,0,0.35)]",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={() => {
        sfx.click();
        onClick?.();
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold tracking-wide transition disabled:pointer-events-none disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold tracking-[0.25em] text-accent uppercase">{children}</p>;
}

export function StageTitle({ kicker, title, sub }: { kicker: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="bf-pop">
      <Kicker>{kicker}</Kicker>
      <h2 className="mt-2 font-display text-4xl leading-none sm:text-5xl">{title}</h2>
      {sub && <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper/60">{sub}</p>}
    </div>
  );
}

export function FitMeter({ value, label = "Brief fit" }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#7CF29A" : pct >= 55 ? "#FFD25A" : "#FF5A36";
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-paper/60">
        <span>{label}</span>
        <span style={{ color }} className="font-semibold tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color, transition: "width 700ms cubic-bezier(.2,.8,.2,1)" }}
        />
      </div>
    </div>
  );
}

export function Feedback({ good, children }: { good: boolean; children: ReactNode }) {
  return (
    <div
      className={`bf-pop rounded-2xl px-4 py-3 text-sm ${good ? "bg-[#7CF29A]/15 text-[#A8F7BC]" : "bg-accent/15 text-[#FF9F87]"}`}
    >
      {children}
    </div>
  );
}

/** Renders the abstract stimuli used on personality cards. */
export function VisualTile({ visual }: { visual: Visual }) {
  switch (visual.kind) {
    case "shape":
      return (
        <svg viewBox="0 0 100 100" className="h-24 w-24 sm:h-28 sm:w-28" aria-hidden>
          {visual.shape === "circle" && <circle cx="50" cy="50" r="38" fill="currentColor" />}
          {visual.shape === "triangle" && <path d="M50 10L92 88H8Z" fill="currentColor" />}
          {visual.shape === "slab" && <rect x="8" y="28" width="84" height="44" fill="currentColor" />}
          {visual.shape === "ring" && <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="1.2" />}
          {visual.shape === "squiggle" && (
            <path d="M6 50C16 20 26 80 38 50S60 20 70 50S88 80 94 50" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
          )}
          {visual.shape === "line" && <line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="4" />}
          {visual.shape === "blob" && <path d="M52 8C76 8 94 24 92 50C90 78 72 94 48 92C22 90 8 72 10 48C12 24 30 8 52 8Z" fill="currentColor" />}
          {visual.shape === "star" && <path d="M50 6L62 38L96 40L70 60L80 94L50 74L20 94L30 60L4 40L38 38Z" fill="currentColor" />}
        </svg>
      );
    case "type":
      return (
        <span
          className="text-7xl leading-none sm:text-8xl"
          style={{ fontFamily: fontVar(visual.font), fontWeight: visual.weight ?? 600, fontStyle: visual.italic ? "italic" : "normal" }}
        >
          {visual.text ?? "Aa"}
        </span>
      );
    case "word":
      return (
        <span
          className="text-center text-3xl leading-tight sm:text-4xl"
          style={{ fontFamily: visual.font ? fontVar(visual.font) : undefined, fontWeight: 600 }}
        >
          {visual.text}
        </span>
      );
    case "color":
      return (
        <div className="flex h-24 w-32 overflow-hidden rounded-2xl sm:h-28 sm:w-40">
          {visual.colors.map((c) => (
            <div key={c} className="flex-1" style={{ background: c }} />
          ))}
        </div>
      );
    case "pattern":
      return <div className={`bf-pattern bf-pattern-${visual.pattern} h-24 w-32 rounded-2xl sm:h-28 sm:w-40`} />;
  }
}

export function Hearts({ lives, max }: { lives: number; max: number }) {
  return (
    <div className="flex gap-1" aria-label={`${lives} lives left`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`text-lg transition ${i < lives ? "text-accent" : "scale-75 text-paper/20"}`}>
          ♥
        </span>
      ))}
    </div>
  );
}
