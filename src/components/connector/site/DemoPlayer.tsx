"use client";

import { useEffect, useState } from "react";
import Icon from "../Icon";
import SocialIcon, { type NetworkId } from "../SocialIcon";
import { LogoMark } from "../Logo";
import type { VideoItem } from "@/lib/connector/data";

const SCENE_ORDER: VideoItem["scene"][] = ["composer", "calendar", "analytics", "inbox", "listings"];

const captions: Record<VideoItem["scene"], string> = {
  composer: "Write once — tailor the caption for every network.",
  calendar: "Every brand, every post, one calendar.",
  analytics: "See what works and report it in a click.",
  inbox: "Comments, DMs and reviews in one inbox.",
  listings: "Keep every listing accurate, everywhere.",
};

const SCENE_MS = 5200;

/**
 * An animated product walkthrough that plays like a short video.
 * Starts on the requested scene and loops through the rest.
 */
export default function DemoPlayer({ start = "calendar" }: { start?: VideoItem["scene"] }) {
  const order = [start, ...SCENE_ORDER.filter((s) => s !== start)];
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((n) => (n + 1) % order.length), SCENE_MS);
    return () => clearTimeout(t);
  }, [i, paused, order.length]);

  const scene = order[i];

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-deep text-left">
      <div className="hero-glow absolute inset-0" />
      <div className="dot-grid absolute inset-0 opacity-60" />

      {/* window chrome */}
      <div className="absolute inset-x-[5%] top-[7%] bottom-[16%] overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex h-[9%] items-center gap-1.5 border-b border-line bg-canvas px-3">
          <span className="h-2 w-2 rounded-full bg-danger" />
          <span className="h-2 w-2 rounded-full bg-warning" />
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="ml-3 hidden text-[10px] font-medium text-muted sm:block">
            app.socialmediaconnector.com
          </span>
        </div>
        <div className="flex h-[91%]">
          <div className="flex w-[9%] flex-col items-center gap-2 bg-night py-2">
            <LogoMark size={18} />
            {["grid", "edit", "calendar", "analytics", "inbox", "globeSearch"].map((n) => (
              <span key={n} className="text-white/60">
                <Icon name={n} size={12} />
              </span>
            ))}
          </div>
          <div key={`${scene}-${i}`} className="relative flex-1 overflow-hidden p-[2.5%]">
            {scene === "composer" && <ComposerScene />}
            {scene === "calendar" && <CalendarScene />}
            {scene === "analytics" && <AnalyticsScene />}
            {scene === "inbox" && <InboxScene />}
            {scene === "listings" && <ListingsScene />}
          </div>
        </div>
      </div>

      {/* caption + controls */}
      <div className="absolute inset-x-[5%] bottom-[3%] flex items-center gap-3 text-white">
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? <Icon name="play" size={14} /> : <span className="flex gap-[3px]"><span className="h-3 w-[3px] bg-white" /><span className="h-3 w-[3px] bg-white" /></span>}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium sm:text-sm">{captions[scene]}</p>
          <div className="mt-1.5 flex gap-1">
            {order.map((s, n) => (
              <button
                key={s}
                type="button"
                onClick={() => setI(n)}
                className="h-1 flex-1 overflow-hidden rounded-full bg-white/20"
                aria-label={`Go to ${s}`}
              >
                <span
                  key={`${i}-${paused}`}
                  className="block h-full origin-left bg-white"
                  style={{
                    transform: n < i ? "scaleX(1)" : "scaleX(0)",
                    animation:
                      n === i && !paused ? `demo-progress ${SCENE_MS}ms linear forwards` : undefined,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComposerScene() {
  const nets: NetworkId[] = ["facebook", "instagram", "linkedin", "x", "threads"];
  return (
    <div className="flex h-full gap-[3%]">
      <div className="flex w-[30%] flex-col gap-1.5">
        <p className="text-[9px] font-bold text-ink sm:text-[11px]">Accounts</p>
        {nets.map((n, k) => (
          <div
            key={n}
            className="flex items-center gap-1.5 rounded border border-line p-1"
            style={{ animation: `demo-pop 0.6s ${k * 0.15}s both` }}
          >
            <span className="flex h-2.5 w-2.5 items-center justify-center rounded-sm bg-primary text-white">
              <Icon name="check" size={8} strokeWidth={3} />
            </span>
            <SocialIcon id={n} size={12} rounded="full" />
            <span className="h-1.5 flex-1 rounded bg-canvas" />
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-[9px] font-bold text-ink sm:text-[11px]">Create post</p>
        <div className="rounded border border-line p-2">
          <p className="overflow-hidden whitespace-nowrap text-[8px] text-ink-2 sm:text-[10px]" style={{ animation: "demo-type 2.4s steps(40) both" }}>
            Diwali offer: 20% off every order this week ✨ #FestiveSale
          </p>
        </div>
        <div className="flex gap-1.5">
          {["#c4b5fd", "#fde68a", "#a7f3d0"].map((c, k) => (
            <span key={c} className="aspect-square w-[18%] rounded" style={{ background: c, animation: `demo-pop 0.8s ${0.8 + k * 0.2}s both` }} />
          ))}
        </div>
        <div className="mt-auto flex items-center justify-end gap-2">
          <span className="rounded bg-primary-tint px-2 py-1 text-[8px] font-bold text-primary sm:text-[10px]">
            <Icon name="sparkles" size={9} className="mr-1 inline" />
            AI Pilot
          </span>
          <span className="rounded bg-primary px-2 py-1 text-[8px] font-bold text-white sm:text-[10px]" style={{ animation: "demo-pop 0.6s 2.8s both" }}>
            Schedule
          </span>
        </div>
      </div>
    </div>
  );
}

export function CalendarScene() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const posts: [number, number, NetworkId][] = [
    [0, 0, "x"], [2, 0, "instagram"], [4, 1, "youtube"], [1, 1, "facebook"], [3, 1, "linkedin"], [5, 0, "pinterest"], [6, 1, "facebook"], [5, 1, "threads"],
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[9px] font-bold text-ink sm:text-[11px]">Calendar</p>
        <div className="flex gap-0.5 text-[7px] sm:text-[9px]">
          {["Day", "Week", "Month"].map((v) => (
            <span key={v} className={`rounded px-1.5 py-0.5 ${v === "Week" ? "bg-primary text-white" : "bg-canvas text-muted"}`}>{v}</span>
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((d, col) => (
          <div key={d} className="flex flex-col gap-1 rounded bg-canvas p-1">
            <span className="text-center text-[7px] font-bold text-muted sm:text-[9px]">{d}</span>
            {posts.filter((p) => p[0] === col).map(([, row, n], k) => (
              <div key={k} className="rounded border border-line bg-white p-1" style={{ animation: `demo-pop 0.7s ${0.3 + (col + row) * 0.18}s both` }}>
                <SocialIcon id={n} size={10} rounded="full" />
                <span className="mt-1 block h-1 rounded bg-canvas" />
                <span className="mt-0.5 block h-1 w-2/3 rounded bg-canvas" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsScene() {
  const bars = [40, 62, 48, 75, 58, 90, 70, 96];
  return (
    <div className="flex h-full flex-col gap-2">
      <p className="text-[9px] font-bold text-ink sm:text-[11px]">Analytics · Instagram</p>
      <div className="grid grid-cols-3 gap-1.5">
        {[["Reach", "48.2K", "+12%"], ["Engagement", "6.4%", "+1.1%"], ["Followers", "12.9K", "+340"]].map(([l, v, d], k) => (
          <div key={l} className="rounded border border-line p-1.5" style={{ animation: `demo-pop 0.6s ${k * 0.2}s both` }}>
            <p className="text-[7px] text-muted sm:text-[9px]">{l}</p>
            <p className="text-[10px] font-bold text-ink sm:text-sm">{v}</p>
            <p className="text-[7px] font-bold text-success sm:text-[9px]">{d}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-1 items-end gap-[3%] rounded border border-line p-2">
        {bars.map((h, k) => (
          <span key={k} className="flex-1 origin-bottom rounded-t bg-primary" style={{ height: `${h}%`, opacity: 0.45 + k * 0.07, animation: `demo-bar 0.9s ${k * 0.12}s both cubic-bezier(.2,.8,.2,1)` }} />
        ))}
      </div>
    </div>
  );
}

export function InboxScene() {
  const msgs: [NetworkId, string][] = [
    ["instagram", "Love this! Is it available in blue?"],
    ["facebook", "What time do you open on Sunday?"],
    ["google", "★★★★★ Amazing service, thank you!"],
    ["linkedin", "Great post — sharing with my team."],
  ];
  return (
    <div className="flex h-full flex-col gap-1.5">
      <p className="text-[9px] font-bold text-ink sm:text-[11px]">Unified inbox</p>
      {msgs.map(([n, m], k) => (
        <div key={k} className="flex items-center gap-1.5 rounded border border-line p-1.5" style={{ animation: `demo-pop 0.6s ${k * 0.35}s both` }}>
          <SocialIcon id={n} size={14} rounded="full" />
          <span className="truncate text-[8px] text-ink-2 sm:text-[10px]">{m}</span>
          <span className="ml-auto rounded bg-success-tint px-1 text-[7px] font-bold text-success sm:text-[9px]" style={{ animation: `demo-pop 0.5s ${1.6 + k * 0.3}s both` }}>
            Replied
          </span>
        </div>
      ))}
    </div>
  );
}

export function ListingsScene() {
  const dirs = ["Google Business Profile", "Google Maps", "Apple Maps", "Bing Places", "Yelp"];
  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold text-ink sm:text-[11px]">Listings</p>
        <span className="rounded bg-success px-2 py-0.5 text-[7px] font-bold text-white sm:text-[9px]">
          <Icon name="refresh" size={8} className="mr-1 inline" />
          Sync all
        </span>
      </div>
      {dirs.map((d, k) => (
        <div key={d} className="flex items-center gap-2 rounded border border-line p-1.5">
          <Icon name="globeSearch" size={11} className="text-primary" />
          <span className="text-[8px] font-medium text-ink sm:text-[10px]">{d}</span>
          <span className="ml-auto h-1 w-[30%] overflow-hidden rounded bg-canvas">
            <span className="block h-full origin-left bg-success" style={{ animation: `demo-progress 0.9s ${0.3 + k * 0.35}s both` }} />
          </span>
          <span className="text-success" style={{ animation: `demo-pop 0.4s ${1.2 + k * 0.35}s both` }}>
            <Icon name="checkCircle" size={11} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** A single scene in a browser-style frame, for static feature illustrations. */
export function SceneFrame({ scene }: { scene: VideoItem["scene"] }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-primary-soft p-5 sm:p-8">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-tint" />
      <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-[#ffe1ef]" />
      <div className="relative overflow-hidden rounded-xl border border-line bg-white shadow-xl">
        <div className="flex h-7 items-center gap-1.5 border-b border-line bg-canvas px-3">
          <span className="h-2 w-2 rounded-full bg-danger" />
          <span className="h-2 w-2 rounded-full bg-warning" />
          <span className="h-2 w-2 rounded-full bg-success" />
        </div>
        <div className="aspect-[16/10] p-4">
          {scene === "composer" && <ComposerScene />}
          {scene === "calendar" && <CalendarScene />}
          {scene === "analytics" && <AnalyticsScene />}
          {scene === "inbox" && <InboxScene />}
          {scene === "listings" && <ListingsScene />}
        </div>
      </div>
    </div>
  );
}
