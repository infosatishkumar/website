import type { CSSProperties, ReactNode } from "react";
import { type Brand, type ViolationId, fontVar, hex, inkOn } from "./engine";
import { Lockup, Mark } from "./Logo";

const ROGUE_FONT = "'Comic Sans MS','Comic Sans','Chalkboard SE','Comic Neue',cursive";
const BUSY_BG = "repeating-conic-gradient(from 10deg,#ff006e 0 12deg,#3a86ff 0 24deg,#ffbe0b 0 36deg,#8338ec 0 48deg)";

/** Everything a mockup needs, with one rule optionally broken. */
function kit(b: Brand, v?: ViolationId) {
  const p = b.palette!;
  const primary = v === "offcolor" ? hex({ h: (p.primary.h + 160) % 360, s: 95, l: 55 }) : hex(p.primary);
  const k = {
    primary,
    secondary: hex(p.secondary),
    accent: hex(p.accent),
    dark: hex(p.dark),
    light: hex(p.light),
    heading: v === "font" ? ROGUE_FONT : fontVar(b.pairing!.heading),
    body: fontVar(b.pairing!.body),
    weight: b.pairing!.headingWeight,
    logo: {
      display: "inline-block",
      transform: v === "stretch" ? "scaleX(1.7) scaleY(0.8)" : v === "rotate" ? "rotate(-22deg)" : undefined,
      filter: v === "effects" ? "drop-shadow(3px 3px 0 #ff00d4) drop-shadow(0 0 8px #fff200)" : undefined,
    } as CSSProperties,
    headline: {
      fontFamily: v === "font" ? ROGUE_FONT : fontVar(b.pairing!.heading),
      fontWeight: v === "font" ? 700 : b.pairing!.headingWeight,
      letterSpacing: v === "tracking" ? "0.45em" : "-0.01em",
      opacity: v === "contrast" ? 0.16 : 1,
      lineHeight: 1.05,
    } as CSSProperties,
    busy: v === "busy",
  };
  return k;
}

const Frame = ({ children, style, className = "" }: { children: ReactNode; style?: CSSProperties; className?: string }) => (
  <div className={`@container relative h-full w-full overflow-hidden ${className}`} style={style}>
    {children}
  </div>
);

export function SocialPost({ b, v }: { b: Brand; v?: ViolationId }) {
  const k = kit(b, v);
  const ink = inkOn(k.primary, k.dark, k.light);
  return (
    <Frame className="flex flex-col justify-between p-[8%]" style={{ background: k.busy ? BUSY_BG : k.primary, color: ink }}>
      <span style={k.logo}>
        <Mark spec={b.logo!} name={b.brief.name} font={b.pairing!.heading} fg={ink} bg={k.primary} size={30} />
      </span>
      <div>
        <p className="text-[11cqw]" style={k.headline}>
          {b.brief.tagline}
        </p>
        <p className="mt-2 text-[10px] opacity-80" style={{ fontFamily: k.body }}>
          @{b.brief.name.toLowerCase()}
        </p>
      </div>
      <div className="absolute -right-6 -bottom-6 size-20 rounded-full" style={{ background: k.accent }} />
    </Frame>
  );
}

export function BizCard({ b, v }: { b: Brand; v?: ViolationId }) {
  const k = kit(b, v);
  return (
    <Frame className="flex flex-col justify-between p-[9%]" style={{ background: k.busy ? BUSY_BG : k.light, color: k.dark }}>
      <span style={k.logo}>
        <Lockup layout="horizontal" spec={b.logo!} name={b.brief.name} font={b.pairing!.heading} weight={b.pairing!.headingWeight} fg={k.primary} bg={k.light} wordColor={k.dark} height={24} />
      </span>
      <div style={{ fontFamily: k.body }}>
        <p className="text-[7cqw]" style={k.headline}>
          {b.brief.client} Rao
        </p>
        <p className="text-[9px] opacity-60">{b.brief.role}</p>
        <div className="mt-2 h-[3px] w-8" style={{ background: k.accent }} />
        <p className="mt-2 text-[9px] opacity-70">hello@{b.brief.name.toLowerCase()}.com</p>
      </div>
    </Frame>
  );
}

export function AppScreen({ b, v }: { b: Brand; v?: ViolationId }) {
  const k = kit(b, v);
  const onPrimary = inkOn(k.primary, k.dark, k.light);
  const onAccent = inkOn(k.accent, k.dark, k.light);
  return (
    <Frame className="flex flex-col" style={{ background: k.light, color: k.dark, fontFamily: k.body }}>
      <div className="flex items-center gap-2 p-[7%]" style={{ background: k.busy ? BUSY_BG : k.primary, color: onPrimary }}>
        <span style={k.logo}>
          <Mark spec={b.logo!} name={b.brief.name} font={b.pairing!.heading} fg={onPrimary} bg={k.primary} size={22} />
        </span>
        <span className="text-[11px] font-semibold" style={{ fontFamily: k.heading }}>
          {b.brief.name}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-[7%]">
        <p className="text-[11cqw]" style={k.headline}>
          Welcome back
        </p>
        <div className="h-2 w-3/4 rounded-full opacity-15" style={{ background: k.dark }} />
        <div className="h-2 w-1/2 rounded-full opacity-15" style={{ background: k.dark }} />
        <div className="mt-auto rounded-full py-2 text-center text-[10px] font-semibold" style={{ background: k.accent, color: onAccent }}>
          Get started
        </div>
      </div>
    </Frame>
  );
}

export function Poster({ b, v }: { b: Brand; v?: ViolationId }) {
  const k = kit(b, v);
  return (
    <Frame className="flex flex-col justify-between p-[8%]" style={{ background: k.busy ? BUSY_BG : k.dark, color: k.light }}>
      <div className="absolute top-[18%] -right-[20%] aspect-square w-[80%] rounded-full opacity-90" style={{ background: k.secondary }} />
      <div className="absolute top-[38%] right-[8%] aspect-square w-[34%] rounded-full" style={{ background: k.primary }} />
      <span className="relative" style={k.logo}>
        <Mark spec={b.logo!} name={b.brief.name} font={b.pairing!.heading} fg={k.accent} bg={k.dark} size={26} />
      </span>
      <div className="relative">
        <p className="text-[13cqw]" style={k.headline}>
          {b.brief.values[0]}.
        </p>
        <p className="text-[9px] opacity-70" style={{ fontFamily: k.body }}>
          {b.brief.product}
        </p>
      </div>
    </Frame>
  );
}

export const MOCKUPS = [
  { id: "social", label: "Social post", C: SocialPost, aspect: "aspect-square" },
  { id: "card", label: "Business card", C: BizCard, aspect: "aspect-[1.6/1]" },
  { id: "app", label: "App screen", C: AppScreen, aspect: "aspect-[3/4]" },
  { id: "poster", label: "Poster", C: Poster, aspect: "aspect-[3/4]" },
] as const;
