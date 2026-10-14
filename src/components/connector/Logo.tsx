import Link from "next/link";

/**
 * Brand mark: an open "C" (Connector) wrapped around a share-graph —
 * one hub fanning out to two channels.
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  const id = "smc-logo-grad";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="4" y1="2" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8C85FF" />
          <stop offset="0.55" stopColor="#673DE6" />
          <stop offset="1" stopColor="#4A1FC4" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id})`} />
      <path
        d="M22.6 13.2A8.6 8.6 0 1 0 22.6 26.8"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M17 20 28.5 12.6M17 20l11.5 7.4"
        stroke="#fff"
        strokeOpacity="0.85"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="17" cy="20" r="3" fill="#fff" />
      <circle cx="29" cy="12.3" r="3.2" fill="#FFCD35" />
      <circle cx="29" cy="27.7" r="3.2" fill="#00D1A7" />
    </svg>
  );
}

export default function Logo({
  href = "/connector",
  light = false,
  compact = false,
}: {
  href?: string;
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Social Media Connector home">
      <LogoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={`text-[17px] font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}
          >
            Social Media
          </span>
          <span
            className={`text-[11px] font-bold uppercase tracking-[0.22em] ${
              light ? "text-meteorite" : "text-primary"
            }`}
          >
            Connector
          </span>
        </span>
      )}
    </Link>
  );
}
