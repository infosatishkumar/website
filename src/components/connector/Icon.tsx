import type { ReactNode } from "react";

/** Outline icon set (24px grid, 1.8 stroke) drawn for Social Media Connector. */
const paths: Record<string, ReactNode> = {
  send: <path d="M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17M8 14h2M14 14h2M8 17h2" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  analytics: (
    <>
      <path d="M4 18 9 12l4 3 7-8" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="13" cy="15" r="1.6" />
      <circle cx="20" cy="7" r="1.6" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />,
  starPlus: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="m12 7.5 1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4L12 7.5Z" />
    </>
  ),
  chat: <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4A8 8 0 1 1 20 12ZM9 11h6M9 14h4" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </>
  ),
  userPlus: (
    <>
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.3-1.6-1.3-2.8 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7.5" r="1" />
      <circle cx="14.5" cy="7.5" r="1" />
    </>
  ),
  report: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2.5" />
      <path d="M9 3.5h6v2.5H9zM9 11h6M9 14.5h6M9 18h3" />
    </>
  ),
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />,
  layers: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5" />,
  library: (
    <>
      <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="16" rx="1.5" />
      <path d="m16.5 5.5 3.6-.9 3 15-3.6.9z" />
    </>
  ),
  sparkles: (
    <path d="M10 3.5 11.6 8a3 3 0 0 0 1.9 1.9L18 11.5l-4.5 1.6a3 3 0 0 0-1.9 1.9L10 19.5 8.4 15a3 3 0 0 0-1.9-1.9L2 11.5l4.5-1.6A3 3 0 0 0 8.4 8L10 3.5ZM18 2.5v4M20 4.5h-4M19 16v3M20.5 17.5h-3" />
  ),
  robot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 4v4M9 13v1.5M15 13v1.5M2 13v3M22 13v3" />
      <circle cx="12" cy="3.5" r="1" />
    </>
  ),
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  megaphone: <path d="M3 10v4a1 1 0 0 0 1 1h3l8 5V4L7 9H4a1 1 0 0 0-1 1ZM19 9a4 4 0 0 1 0 6M7 15v4.5" />,
  puzzle: (
    <path d="M9 4.5a2 2 0 1 1 4 0V6h4a1 1 0 0 1 1 1v4h1.5a2 2 0 1 1 0 4H18v4a1 1 0 0 1-1 1h-4v-1.5a2 2 0 1 0-4 0V20H5a1 1 0 0 1-1-1v-4h1.5a2 2 0 1 0 0-4H4V7a1 1 0 0 1 1-1h4V4.5Z" />
  ),
  globeSearch: (
    <>
      <path d="M20.5 11A8.5 8.5 0 1 0 11 20.5M3 11h17M11 2.5c-2.5 2.5-3.5 5.3-3.5 8.5s1 6 3.5 8.5M11 2.5c2 2 3.2 4.5 3.4 7.4" />
      <circle cx="17.5" cy="17.5" r="2.8" />
      <path d="m19.6 19.6 2 2" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  refresh: <path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.5l1.7-2M20 20v-4.5h-4.5" />,
  plug: <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4" />,
  home: <path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5" />,
  rocket: (
    <>
      <path d="M14 4c3-1 6-1 6-1s0 3-1 6l-6 6-4-4 5-7ZM9 11l-4 1-2 3 4 1M13 15l-1 4-3 2-1-4" />
      <circle cx="15.5" cy="8.5" r="1.4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.1-7-11.5a7 7 0 1 1 14 0C19 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  sliders: <path d="M6 3v6M6 13v8M12 3v10M12 17v4M18 3v3M18 10v11M3.5 11h5M9.5 15h5M15.5 8h5" />,
  crown: <path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7Z" />,
  play: <path d="M7 4.5v15l13-7.5-13-7.5Z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  bell: <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9ZM10 20a2 2 0 0 0 4 0" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.3a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 3.7M12 17h.01" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  inbox: <path d="M3.5 13 6 5h12l2.5 8M3.5 13v5.5a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V13M3.5 13H8l1.5 2.5h5L16 13h4.5" />,
  tag: (
    <>
      <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l8 8a1.5 1.5 0 0 1 0 2.1l-6.9 6.9a1.5 1.5 0 0 1-2.1 0l-8.1-7.9Z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3.6-3.6a4 4 0 0 0-5.7-5.7L12 6.4M14 10a4 4 0 0 0-5.7 0l-3.6 3.6a4 4 0 0 0 5.7 5.7l1.6-1.6" />,
  hash: <path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18" />,
  rss: (
    <>
      <path d="M5 11a8 8 0 0 1 8 8M5 4.5A14.5 14.5 0 0 1 19.5 19" />
      <circle cx="6" cy="18" r="1.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  filter: <path d="M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m20.5 16-5-5-8.5 8.5" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7" />,
  edit: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4" />,
  eye: (
    <>
      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.4M6.6 6.6C3.9 8.4 2.5 12 2.5 12s3.5 7 9.5 7c1.9 0 3.6-.7 5-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </>
  ),
  heart: <path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20Z" />,
  share: (
    <>
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>
  ),
  sms: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2.5" />
      <path d="m16 10.5 5-3v9l-5-3" />
    </>
  ),
  presentation: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="m7 12 3-3 2.5 2L17 7M12 16v4M8.5 20h7" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  cap: <path d="M2.5 9 12 4.5 21.5 9 12 13.5 2.5 9ZM6.5 11v5c3 2.7 8 2.7 11 0v-5M21.5 9v5" />,
  newspaper: (
    <>
      <path d="M4 5h12v14.5a1.5 1.5 0 0 0 1.5 1.5H5.5A1.5 1.5 0 0 1 4 19.5V5ZM16 9h3.5v10.5A1.5 1.5 0 0 1 18 21" />
      <path d="M7.5 9h5M7.5 12.5h5M7.5 16h3" />
    </>
  ),
  sortAZ: <path d="M4 10 6.5 3 9 10M4.8 8h3.4M4 14h5l-5 7h5M17 4v16M14 17l3 3 3-3" />,
  layout: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M3.5 9h17M9 9v11.5" />
    </>
  ),
  calendarCheck: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" />
    </>
  ),
  book: <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7h6" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  logout: <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 8l-4 4 4 4M6 12h10" />,
  copy: (
    <>
      <rect x="8" y="8" width="12.5" height="12.5" rx="2.5" />
      <path d="M16 8V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9.5A1.5 1.5 0 0 0 5 16h3" />
    </>
  ),
  at: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8" />
    </>
  ),
  trendUp: <path d="m3 17 6-6 4 4 8-8M15 7h6v6" />,
  shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3ZM9 12l2 2 4-4" />,
  zap: <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />,
  folder: <path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4.5l2 2.5H19A1.5 1.5 0 0 1 20.5 9.5v9A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5V7Z" />,
  compare: <path d="M8 4v16M16 4v16M3 8h5M16 8h5M3 16h5M16 16h5M11 12h2" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-2.5 2.5-3.7 5.5-3.7 9s1.2 6.5 3.7 9M12 3c2.5 2.5 3.7 5.5 3.7 9s-1.2 6.5-3.7 9" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M3 12.5h18" />
    </>
  ),
  store: <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5 11.5V20h14v-8.5M10 20v-4.5h4V20" />,
  camera: (
    <>
      <path d="M4 7.5h3.2L9 5h6l1.8 2.5H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h2.5l2.2 11h10.6L20.5 7.5H6.4" />
      <circle cx="9" cy="19.5" r="1.3" />
      <circle cx="17" cy="19.5" r="1.3" />
    </>
  ),
  wrench: <path d="M14.5 6.5a4 4 0 0 0 5.2 5.2l-8.4 8.4a2.4 2.4 0 0 1-3.4-3.4l8.4-8.4a4 4 0 0 1-1.8-1.8ZM14.7 6.3 17 4l3 3-2.3 2.3" />,
  snowflake: <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5" />,
  scale: <path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6a3 3 0 0 0 5 0L5 7ZM19 7l-2.5 6a3 3 0 0 0 5 0L19 7Z" />,
  stethoscope: (
    <>
      <path d="M6 3.5H5v5a4.5 4.5 0 0 0 9 0v-5h-1M9.5 13v2.5a4.5 4.5 0 0 0 9 0V13" />
      <circle cx="18.5" cy="11" r="2" />
    </>
  ),
  utensils: <path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v18M17 21V3c-2 1-3 3.5-3 6.5V13h3" />,
  faucet: <path d="M4 10h9a4 4 0 0 1 4 4v1M8 10V7M5 7h6M17 18.5c0 1-.7 1.8-1.5 1.8S14 19.5 14 18.5s1.5-3 1.5-3 1.5 2 1.5 3ZM4 14h6" />,
  handHeart: <path d="M12 12.5s-4-2.4-4-5.3A2.2 2.2 0 0 1 12 6a2.2 2.2 0 0 1 4 1.2c0 2.9-4 5.3-4 5.3ZM3 15h3l4 2h4a1.5 1.5 0 0 1 0 3H9M14 18.5l5-2.5a1.6 1.6 0 0 1 1.7 2.6L15.5 22H6l-3-1.5" />,
  building: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.5" />
      <path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15M10.5 21v-2.5h3V21" />
    </>
  ),
  dollar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9.2A2.8 2.8 0 0 0 12.2 8h-.6a2.1 2.1 0 0 0 0 4.2h.8a2.1 2.1 0 0 1 0 4.2h-.7a2.8 2.8 0 0 1-2.6-1.4M12 6.5v11" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" />
    </>
  ),
  dots: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  mouse: <path d="M4 4l6.5 16 2.3-6.7L19.5 11 4 4Z" />,
  emoji: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export default function Icon({
  name,
  size = 20,
  className = "",
  strokeWidth = 1.8,
}: {
  name: IconName | string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const filled = name === "play";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] ?? paths.dots}
    </svg>
  );
}

/** Icon inside a lavender tile — the house style for menu & feature icons. */
export function IconTile({
  name,
  size = "md",
  tone = "primary",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: "primary" | "dark" | "white";
}) {
  const box = { sm: "h-8 w-8 rounded-lg", md: "h-11 w-11 rounded-xl", lg: "h-14 w-14 rounded-2xl" }[size];
  const icon = { sm: 16, md: 22, lg: 28 }[size];
  const colors = {
    primary: "bg-primary-tint text-primary",
    dark: "bg-primary text-white",
    white: "bg-white/10 text-white",
  }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${box} ${colors}`}>
      <Icon name={name} size={icon} />
    </span>
  );
}
