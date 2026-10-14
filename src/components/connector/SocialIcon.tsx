import type { ReactNode } from "react";

export type NetworkId =
  | "facebook"
  | "instagram"
  | "x"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "threads"
  | "bluesky"
  | "google"
  | "whatsapp";

export const networkMeta: Record<NetworkId, { name: string; color: string }> = {
  facebook: { name: "Facebook", color: "#1877F2" },
  instagram: { name: "Instagram", color: "#E1306C" },
  x: { name: "X (Twitter)", color: "#111111" },
  linkedin: { name: "LinkedIn", color: "#0A66C2" },
  tiktok: { name: "TikTok", color: "#111111" },
  youtube: { name: "YouTube", color: "#FF0033" },
  pinterest: { name: "Pinterest", color: "#E60023" },
  threads: { name: "Threads", color: "#111111" },
  bluesky: { name: "Bluesky", color: "#1185FE" },
  google: { name: "Google Business", color: "#4285F4" },
  whatsapp: { name: "WhatsApp", color: "#25D366" },
};

export const networkIds = Object.keys(networkMeta) as NetworkId[];

/* Simplified glyphs drawn in white on a 24px grid. */
const glyphs: Record<NetworkId, ReactNode> = {
  facebook: (
    <path
      fill="#fff"
      d="M13.4 20v-6.6h2.2l.4-2.7h-2.6V9c0-.8.3-1.4 1.4-1.4H16V5.3c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5v2h-2.3v2.7h2.3V20h2.8Z"
    />
  ),
  instagram: (
    <g fill="none" stroke="#fff" strokeWidth="1.8">
      <rect x="5" y="5" width="14" height="14" rx="4" />
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="16.3" cy="7.7" r=".6" fill="#fff" stroke="none" />
    </g>
  ),
  x: (
    <path
      fill="#fff"
      d="M16.6 5h2.3l-5 5.8 5.9 7.9h-4.6l-3.6-4.8-4.2 4.8H5.1l5.4-6.2L4.9 5h4.7l3.3 4.4L16.6 5Zm-.8 12.3h1.3L8.3 6.3H6.9l8.9 11Z"
    />
  ),
  linkedin: (
    <g fill="#fff">
      <rect x="5.5" y="9.5" width="2.6" height="8.5" rx=".4" />
      <circle cx="6.8" cy="6.8" r="1.5" />
      <path d="M10.3 9.5h2.5v1.2c.4-.7 1.4-1.4 2.8-1.4 2.6 0 3 1.7 3 3.9V18h-2.6v-4.2c0-1 0-2.2-1.4-2.2s-1.6 1-1.6 2.1V18h-2.7V9.5Z" />
    </g>
  ),
  tiktok: (
    <path
      fill="#fff"
      d="M15.6 4.5c.3 1.9 1.4 3.1 3.3 3.3v2.6c-1.2 0-2.3-.3-3.3-1v5a4.6 4.6 0 1 1-4-4.6v2.7a2 2 0 1 0 1.3 1.9V4.5h2.7Z"
    />
  ),
  youtube: (
    <g>
      <rect x="4" y="6.5" width="16" height="11" rx="3.2" fill="#fff" />
      <path d="m10.5 9.4 4.3 2.6-4.3 2.6V9.4Z" fill="#FF0033" />
    </g>
  ),
  pinterest: (
    <path
      fill="#fff"
      d="M12.2 4.5c-4.3 0-6.4 3-6.4 5.6 0 1.6.6 2.9 1.9 3.4.2.1.4 0 .4-.2l.2-.7c0-.2 0-.3-.1-.5-.4-.5-.6-1.1-.6-1.9 0-2.5 1.8-4.6 4.8-4.6 2.6 0 4 1.6 4 3.7 0 2.8-1.2 5.1-3 5.1-1 0-1.8-.8-1.6-1.9.3-1.2.9-2.6.9-3.5 0-.8-.4-1.5-1.3-1.5-1 0-1.9 1.1-1.9 2.5 0 .9.3 1.5.3 1.5l-1.2 5.2c-.3 1.5 0 3.4 0 3.6 0 .1.2.2.2 0 .1-.1 1.4-1.7 1.8-3.3l.7-2.7c.4.7 1.4 1.3 2.5 1.3 3.3 0 5.5-3 5.5-7 0-3-2.6-5.9-6.4-5.9Z"
    />
  ),
  threads: (
    <path
      fill="none"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinecap="round"
      d="M15.6 11.2c-.4-2-1.8-3-3.6-3-1.6 0-2.7.8-3.1 1.9M15.4 11.5c-2.6-.6-5.8-.1-5.8 2.1 0 1.2 1 1.9 2.3 1.9 2.2 0 3.6-1.5 3.6-4.2v-.3m0 .5c1.6.6 2.5 1.8 2.5 3.3 0 2.3-2.3 4.2-5.9 4.2-3.9 0-6.4-2.6-6.4-7s2.5-7 6.4-7c3.3 0 5.4 1.8 6.1 4.6"
    />
  ),
  bluesky: (
    <path
      fill="#fff"
      d="M8 6.6c1.6 1.2 3.4 3.7 4 5 .6-1.3 2.4-3.8 4-5 1.2-.9 3.1-1.6 3.1.6 0 .4-.3 3.7-.4 4.3-.5 1.9-2.4 2.4-4.1 2.1 3 .5 3.7 2.2 2.1 3.9-3.1 3.2-4.4-.8-4.7-1.8V15.3c-.1 1.2-1.6 5-4.7 1.8-1.6-1.7-.9-3.4 2.1-3.9-1.7.3-3.6-.2-4.1-2.1-.1-.6-.4-3.9-.4-4.3 0-2.2 1.9-1.5 3.1-.6Z"
    />
  ),
  google: (
    <path
      fill="none"
      stroke="#fff"
      strokeWidth="2.2"
      strokeLinecap="round"
      d="M18 11.9h-5.6M18.2 11.9A6.2 6.2 0 1 1 16.4 7.6"
    />
  ),
  whatsapp: (
    <g fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round">
      <path d="M5.2 18.8 6.2 15.4A7 7 0 1 1 8.8 18Z" />
      <path
        fill="#fff"
        stroke="none"
        d="M9.6 8.8c.2-.3.4-.3.6-.3h.4c.1 0 .3 0 .4.3l.6 1.4c.1.2 0 .4-.1.5l-.4.5c-.1.1-.1.3 0 .4.5.9 1.2 1.6 2.1 2.1.2.1.3.1.4 0l.5-.6c.1-.2.3-.2.5-.1l1.4.7c.2.1.3.2.2.4 0 .6-.4 1.2-1 1.4-.7.2-1.6.1-3.2-.9-1.4-.9-2.4-2.3-2.7-3-.4-.8-.3-1.6.3-2.1Z"
      />
    </g>
  ),
};

export default function SocialIcon({
  id,
  size = 28,
  rounded = "lg",
}: {
  id: NetworkId;
  size?: number;
  rounded?: "full" | "lg";
}) {
  const bg =
    id === "instagram"
      ? "linear-gradient(135deg,#FEDA75 0%,#FA7E1E 25%,#D62976 55%,#962FBF 80%,#4F5BD5 100%)"
      : networkMeta[id].color;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${
        rounded === "full" ? "rounded-full" : "rounded-[28%]"
      }`}
      style={{ width: size, height: size, background: bg }}
      title={networkMeta[id].name}
    >
      <svg width={size * 0.78} height={size * 0.78} viewBox="0 0 24 24" aria-hidden="true">
        {glyphs[id]}
      </svg>
    </span>
  );
}
