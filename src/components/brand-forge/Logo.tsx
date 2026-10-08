import type { CSSProperties } from "react";
import { type ContainerId, type FontId, type LogoSpec, type SymbolId, fontVar } from "./engine";

const CONTAINER_PATHS: Record<Exclude<ContainerId, "none">, string> = {
  circle: "M50 4a46 46 0 1 1 0 92a46 46 0 1 1 0-92Z",
  squircle: "M50 4C88 4 96 12 96 50S88 96 50 96S4 88 4 50S12 4 50 4Z",
  square: "M10 4H90A6 6 0 0 1 96 10V90A6 6 0 0 1 90 96H10A6 6 0 0 1 4 90V10A6 6 0 0 1 10 4Z",
  hexagon: "M50 3L91 26.5V73.5L50 97L9 73.5V26.5Z",
  diamond: "M50 2L98 50L50 98L2 50Z",
  blob: "M52 5C74 4 95 20 95 45C96 72 78 95 50 95C24 95 5 78 6 52C6 26 28 6 52 5Z",
  arch: "M8 96V46A42 42 0 0 1 92 46V96Z",
};

function rays() {
  let d = "M50 30a20 20 0 1 1 0 40a20 20 0 1 1 0-40Z";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const p = (r: number, o: number) =>
      `${(50 + Math.cos(a + o) * r).toFixed(2)} ${(50 + Math.sin(a + o) * r).toFixed(2)}`;
    d += `M${p(26, -0.13)}L${p(42, 0)}L${p(26, 0.13)}Z`;
  }
  return d;
}

function petals() {
  let d = "";
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const cx = 50 + Math.cos(a) * 20;
    const cy = 50 + Math.sin(a) * 20;
    d += `M${cx} ${cy - 17}a17 17 0 1 1 0 34a17 17 0 1 1 0-34Z`;
  }
  return d;
}

const SYMBOL_PATHS: Record<Exclude<SymbolId, "initial" | "monogram">, string> = {
  spark: "M50 8C53 38 62 47 92 50C62 53 53 62 50 92C47 62 38 53 8 50C38 47 47 38 50 8Z",
  bolt: "M58 6L20 56H46L38 94L80 40H54Z",
  leaf: "M16 84C16 42 42 16 86 14C86 58 60 84 16 84ZM24 76L64 36L68 40L28 80Z",
  wave: "M6 52C20 30 36 30 50 50C64 70 80 70 94 48V68C80 90 64 90 50 70C36 50 20 50 6 72Z",
  sun: rays(),
  orbit:
    "M50 14a36 36 0 1 1 0 72a36 36 0 1 1 0-72Zm0 10a26 26 0 1 0 0 52a26 26 0 1 0 0-52ZM80 10a9 9 0 1 1 0 18a9 9 0 1 1 0-18Z",
  arrow: "M20 72L58 34H36V20H82V66H68V44L30 82Z",
  stack: "M14 18H86V34H14ZM14 42H86V58H14ZM14 66H86V82H14Z",
  drop: "M50 6C50 6 82 44 82 63A32 32 0 0 1 18 63C18 44 50 6 50 6Z",
  flower: petals() + "M50 38a12 12 0 1 1 0 24a12 12 0 1 1 0-24Z",
};

type MarkProps = {
  spec: LogoSpec;
  name: string;
  font: FontId;
  fg: string;
  bg: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/** The logomark alone. `fg` is the brand colour, `bg` the surface it sits on. */
export function Mark({ spec, name, font, fg, bg, size = 80, className, style }: MarkProps) {
  const { container, symbol, style: st, tilt } = spec;
  const hasBox = container !== "none" && st !== "glyph";
  const solid = hasBox && st === "solid";
  const glyphColor = solid ? bg : fg;
  const scale = hasBox ? 0.56 : 0.92;
  const initials =
    symbol === "monogram" ? (name.slice(0, 1) + name.slice(-1)).toUpperCase() : name.slice(0, 1).toUpperCase();

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={style}
      role="img"
      aria-label={`${name} logo`}
    >
      {hasBox && (
        <path
          d={CONTAINER_PATHS[container as Exclude<ContainerId, "none">]}
          fill={solid ? fg : "none"}
          stroke={solid ? "none" : fg}
          strokeWidth={solid ? 0 : 5}
        />
      )}
      <g transform={`translate(50 50) rotate(${tilt}) scale(${scale}) translate(-50 -50)`}>
        {symbol === "initial" || symbol === "monogram" ? (
          <text
            x="50"
            y="53"
            textAnchor="middle"
            dominantBaseline="central"
            fill={glyphColor}
            style={{
              fontFamily: fontVar(font),
              fontWeight: 700,
              fontSize: symbol === "monogram" ? 54 : 84,
              letterSpacing: symbol === "monogram" ? "-0.06em" : 0,
            }}
          >
            {initials}
          </text>
        ) : (
          <path d={SYMBOL_PATHS[symbol]} fill={glyphColor} fillRule="evenodd" />
        )}
      </g>
    </svg>
  );
}

type LockupProps = Omit<MarkProps, "size"> & {
  layout: "horizontal" | "stacked";
  height?: number;
  weight?: number;
  wordColor?: string;
};

/** Mark + wordmark. */
export function Lockup({ layout, height = 56, weight = 700, wordColor, ...mark }: LockupProps) {
  const stacked = layout === "stacked";
  return (
    <div
      className={`inline-flex items-center ${stacked ? "flex-col gap-[0.25em]" : "flex-row gap-[0.35em]"} ${mark.className ?? ""}`}
      style={{ fontSize: height, ...mark.style }}
    >
      <Mark {...mark} className="" style={undefined} size={stacked ? height * 1.3 : height} />
      <span
        style={{
          fontFamily: fontVar(mark.font),
          fontWeight: weight,
          color: wordColor ?? mark.fg,
          fontSize: stacked ? "0.6em" : "0.72em",
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {mark.name}
      </span>
    </div>
  );
}
