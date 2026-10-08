// Core data + pure logic for Brand Forge. No React in here.

/* ------------------------------------------------------------------ */
/* Personality vectors                                                 */
/* ------------------------------------------------------------------ */

export const AXES = ["p", "b", "m", "w", "f"] as const;
export type Axis = (typeof AXES)[number];
export type Vec = Record<Axis, number>;

export const AXIS_LABELS: Record<Axis, [string, string]> = {
  p: ["Serious", "Playful"],
  b: ["Subtle", "Bold"],
  m: ["Classic", "Modern"],
  w: ["Cool", "Warm"],
  f: ["Exclusive", "Friendly"],
};

export const zero = (): Vec => ({ p: 0, b: 0, m: 0, w: 0, f: 0 });
export const vec = (v: Partial<Vec>): Vec => ({ ...zero(), ...v });
const clamp = (n: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, n));
export const clampVec = (v: Vec): Vec =>
  Object.fromEntries(AXES.map((a) => [a, clamp(v[a])])) as Vec;
export const dot = (a: Vec, b: Vec) => AXES.reduce((s, k) => s + a[k] * b[k], 0);

/** 0..1 — how close two personality vectors are. */
export function fit(a: Vec, b: Vec) {
  const diff = AXES.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0) / AXES.length;
  return clamp(1 - diff / 1.4, 0, 1);
}

/* ------------------------------------------------------------------ */
/* Seeded randomness                                                   */
/* ------------------------------------------------------------------ */

export type Rng = () => number;

export function rngFrom(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T,>(r: Rng, list: readonly T[]) => list[Math.floor(r() * list.length)];
export function shuffle<T>(r: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export const range = (r: Rng, lo: number, hi: number) => lo + r() * (hi - lo);

export function randomSeed() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function dailySeed(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `DAY-${y}${m}${day}`;
}

/* ------------------------------------------------------------------ */
/* Color math                                                          */
/* ------------------------------------------------------------------ */

export type HSL = { h: number; s: number; l: number };
export type RGB = [number, number, number];

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hh = (((h % 360) + 360) % 360) / 360;
  const ss = s / 100;
  const ll = l / 100;
  if (ss === 0) {
    const v = Math.round(ll * 255);
    return [v, v, v];
  }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(hh + 1 / 3), hue(hh), hue(hh - 1 / 3)].map((v) => Math.round(v * 255)) as RGB;
}

export const rgbToHex = (rgb: RGB) =>
  "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
export const hex = (c: HSL) => rgbToHex(hslToRgb(c));

export function hexToRgb(h: string): RGB {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lum([r, g, b]: RGB) {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrast(a: string, b: string) {
  const la = lum(hexToRgb(a));
  const lb = lum(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function cmyk([r, g, b]: RGB) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1) return [0, 0, 0, 100];
  return [
    (1 - rr - k) / (1 - k),
    (1 - gg - k) / (1 - k),
    (1 - bb - k) / (1 - k),
    k,
  ].map((v) => Math.round(v * 100));
}

function toLab([r, g, b]: RGB) {
  const lin = (v: number) => {
    const c = v / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 colour difference. < 2.3 is barely perceptible. */
export function deltaE(a: HSL, b: HSL) {
  const [l1, a1, b1] = toLab(hslToRgb(a));
  const [l2, a2, b2] = toLab(hslToRgb(b));
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Readable ink for a background. */
export const inkOn = (bg: string, dark: string, light: string) =>
  contrast(bg, dark) >= contrast(bg, light) ? dark : light;

/* ------------------------------------------------------------------ */
/* Briefs                                                              */
/* ------------------------------------------------------------------ */

type Industry = {
  name: string;
  vec: Partial<Vec>;
  audiences: string[];
  products: string[];
  values: string[];
};

const INDUSTRIES: Industry[] = [
  {
    name: "Specialty coffee roastery",
    vec: { w: 0.8, f: 0.5, m: -0.3, p: 0.1 },
    audiences: ["remote workers", "slow-morning people", "home baristas"],
    products: ["single-origin beans", "a neighbourhood café"],
    values: ["Craft", "Community", "Honesty"],
  },
  {
    name: "Fintech app",
    vec: { m: 0.9, p: -0.4, w: -0.6, f: 0.3, b: 0.3 },
    audiences: ["first-time investors", "freelancers", "Gen Z savers"],
    products: ["a zero-fee banking app", "a smart savings tool"],
    values: ["Clarity", "Trust", "Momentum"],
  },
  {
    name: "Kids' toy company",
    vec: { p: 1, f: 0.9, b: 0.6, w: 0.5 },
    audiences: ["curious 4–8 year olds", "busy parents"],
    products: ["wooden building blocks", "story-driven puzzles"],
    values: ["Wonder", "Safety", "Play"],
  },
  {
    name: "Luxury skincare house",
    vec: { f: -0.9, p: -0.7, b: -0.5, m: -0.2 },
    audiences: ["discerning professionals", "beauty connoisseurs"],
    products: ["botanical serums", "a nightly ritual set"],
    values: ["Ritual", "Purity", "Precision"],
  },
  {
    name: "Indie game studio",
    vec: { p: 0.8, b: 0.9, m: 0.7, w: -0.2 },
    audiences: ["hardcore gamers", "streamers", "pixel-art lovers"],
    products: ["a roguelike adventure", "cosy co-op games"],
    values: ["Imagination", "Rebellion", "Joy"],
  },
  {
    name: "Eco travel company",
    vec: { w: 0.5, f: 0.6, m: 0.1, b: -0.2 },
    audiences: ["conscious explorers", "weekend hikers"],
    products: ["carbon-neutral treks", "eco-lodge stays"],
    values: ["Respect", "Adventure", "Care"],
  },
  {
    name: "Boutique fitness studio",
    vec: { b: 1, m: 0.6, p: 0.2, f: 0.3 },
    audiences: ["early risers", "competitive amateurs"],
    products: ["high-intensity classes", "a training app"],
    values: ["Grit", "Energy", "Progress"],
  },
  {
    name: "Corporate law firm",
    vec: { p: -1, f: -0.6, m: -0.6, b: -0.1, w: -0.4 },
    audiences: ["founders", "growing enterprises"],
    products: ["startup legal counsel", "M&A advisory"],
    values: ["Integrity", "Rigour", "Discretion"],
  },
  {
    name: "Music festival",
    vec: { b: 1, p: 0.8, m: 0.5, w: 0.4, f: 0.5 },
    audiences: ["night owls", "music superfans"],
    products: ["a three-day open-air festival", "late-night club series"],
    values: ["Freedom", "Euphoria", "Togetherness"],
  },
  {
    name: "Artisan tea house",
    vec: { m: -0.8, b: -0.6, w: 0.3, p: -0.2 },
    audiences: ["mindful sippers", "gift buyers"],
    products: ["hand-blended teas", "a tasting room"],
    values: ["Calm", "Heritage", "Balance"],
  },
  {
    name: "AI research startup",
    vec: { m: 1, w: -0.7, b: 0.2, p: -0.3, f: 0.1 },
    audiences: ["engineering teams", "product leaders"],
    products: ["an AI assistant", "a developer platform"],
    values: ["Curiosity", "Safety", "Craft"],
  },
  {
    name: "Neighbourhood bakery",
    vec: { w: 1, f: 1, p: 0.4, m: -0.5 },
    audiences: ["families", "morning commuters"],
    products: ["sourdough & pastries", "custom celebration cakes"],
    values: ["Warmth", "Tradition", "Generosity"],
  },
  {
    name: "Streetwear label",
    vec: { b: 1, m: 0.8, f: -0.3, p: 0.3, w: -0.1 },
    audiences: ["sneakerheads", "skaters", "creatives"],
    products: ["limited drops", "heavyweight essentials"],
    values: ["Attitude", "Scarcity", "Culture"],
  },
  {
    name: "Pet wellness brand",
    vec: { f: 1, p: 0.6, w: 0.7, b: 0.1 },
    audiences: ["dog parents", "cat people"],
    products: ["fresh pet food", "vet-approved supplements"],
    values: ["Love", "Health", "Loyalty"],
  },
  {
    name: "Private healthcare clinic",
    vec: { p: -0.6, w: -0.3, f: 0.4, b: -0.6, m: 0.3 },
    audiences: ["young families", "busy professionals"],
    products: ["same-day appointments", "preventive care plans"],
    values: ["Care", "Expertise", "Calm"],
  },
  {
    name: "Independent bookstore",
    vec: { m: -0.7, w: 0.6, f: 0.6, p: 0.2, b: -0.3 },
    audiences: ["bookworms", "students", "collectors"],
    products: ["curated shelves", "author nights"],
    values: ["Curiosity", "Community", "Story"],
  },
];

const SYL_A = ["No", "Ka", "Ze", "Lu", "Ve", "Ori", "Mo", "Tal", "Ae", "Pi", "Ru", "Sol", "Fen", "Ixa", "Bo", "Qui", "Hal", "Vy", "Mer", "Du"];
const SYL_B = ["va", "ro", "lia", "x", "nto", "ra", "mi", "lo", "ve", "ko", "na", "sk", "ly", "th", "vo", "re", "ne", "um", "io", "ka"];

const CLIENTS = ["Priya", "Marcus", "Aiko", "Leila", "Tomás", "Grace", "Arjun", "Noor", "Elena", "Kwame", "Sana", "Felix"];
const ROLES = ["Founder", "CEO", "Head of Marketing", "Co-founder", "Brand Lead"];

const KEYWORDS: Record<Axis, [string[], string[]]> = {
  p: [["serious", "credible", "composed"], ["playful", "fun", "cheeky"]],
  b: [["understated", "quiet", "refined"], ["bold", "loud", "confident"]],
  m: [["timeless", "heritage", "classic"], ["cutting-edge", "modern", "fresh"]],
  w: [["cool", "crisp", "calm"], ["warm", "cosy", "sunny"]],
  f: [["exclusive", "premium", "elite"], ["friendly", "welcoming", "inclusive"]],
};

const QUOTES: Record<Axis, [string, string]> = {
  p: [
    "We need people to trust us with something important. No gimmicks.",
    "Honestly? We want people to smile the moment they see us.",
  ],
  b: [
    "We'd rather whisper and be noticed by the right people.",
    "When we walk into a room, we want everyone to turn around.",
  ],
  m: [
    "It should feel like we've been around forever — in a good way.",
    "We're building the future. It should look like it.",
  ],
  w: [
    "Clean, precise, calm. Think clear water, not campfire.",
    "It should feel like a hug on a cold morning.",
  ],
  f: [
    "Not everyone will get us, and that's the point.",
    "Everyone's invited. Grandma, students, everyone.",
  ],
};

export type Brief = {
  seed: string;
  name: string;
  industry: string;
  audience: string;
  product: string;
  values: string[];
  target: Vec;
  keywords: string[];
  client: string;
  role: string;
  quote: string;
  tagline: string;
};

const TAGLINES = [
  (v: string) => `${v} in every detail.`,
  (v: string) => `Made for ${v.toLowerCase()}.`,
  (v: string) => `Built on ${v.toLowerCase()}.`,
  (v: string) => `Where ${v.toLowerCase()} lives.`,
  (v: string) => `${v}, delivered.`,
];

export function makeBrief(seed: string): Brief {
  const r = rngFrom(seed);
  const ind = pick(r, INDUSTRIES);
  let name = pick(r, SYL_A) + pick(r, SYL_B);
  if (r() > 0.6) name += pick(r, SYL_B);
  name = name.slice(0, 8);
  name = name[0].toUpperCase() + name.slice(1).toLowerCase();

  const target = clampVec(
    Object.fromEntries(
      AXES.map((a) => [a, (ind.vec[a] ?? 0) + range(r, -0.3, 0.3)]),
    ) as Vec,
  );
  const strong = [...AXES]
    .sort((a, b) => Math.abs(target[b]) - Math.abs(target[a]))
    .slice(0, 3);
  const keywords = strong.map((a) => pick(r, KEYWORDS[a][target[a] >= 0 ? 1 : 0]));
  const quoteAxis = strong[0];
  const values = ind.values;

  return {
    seed,
    name,
    industry: ind.name,
    audience: pick(r, ind.audiences),
    product: pick(r, ind.products),
    values,
    target,
    keywords,
    client: pick(r, CLIENTS),
    role: pick(r, ROLES),
    quote: QUOTES[quoteAxis][target[quoteAxis] >= 0 ? 1 : 0],
    tagline: pick(r, TAGLINES)(pick(r, values)),
  };
}

/* ------------------------------------------------------------------ */
/* Level 1: personality cards                                          */
/* ------------------------------------------------------------------ */

export type Visual =
  | { kind: "shape"; shape: "circle" | "triangle" | "slab" | "ring" | "squiggle" | "line" | "blob" | "star" }
  | { kind: "type"; font: FontId; weight?: number; text?: string; italic?: boolean }
  | { kind: "word"; text: string; font?: FontId }
  | { kind: "color"; colors: string[] }
  | { kind: "pattern"; pattern: "dots" | "stripes" | "grid" | "blobs" | "waves" | "checks" };

export type Option = { label: string; visual: Visual; vec: Vec };
export type Card = { axis: Axis; prompt: string; a: Option; b: Option };

const CARDS: Card[] = [
  {
    axis: "p",
    prompt: "Pick a shape",
    a: { label: "Bouncy circle", visual: { kind: "shape", shape: "circle" }, vec: vec({ p: 0.8, f: 0.5 }) },
    b: { label: "Sharp triangle", visual: { kind: "shape", shape: "triangle" }, vec: vec({ p: -0.6, b: 0.4 }) },
  },
  {
    axis: "p",
    prompt: "Which letterform?",
    a: { label: "Rounded & chunky", visual: { kind: "type", font: "baloo", weight: 700 }, vec: vec({ p: 1, f: 0.6 }) },
    b: { label: "Sharp & formal", visual: { kind: "type", font: "cormorant", weight: 600 }, vec: vec({ p: -0.8, f: -0.5, m: -0.4 }) },
  },
  {
    axis: "p",
    prompt: "Pick a line",
    a: { label: "Squiggle", visual: { kind: "shape", shape: "squiggle" }, vec: vec({ p: 1 }) },
    b: { label: "Straight rule", visual: { kind: "shape", shape: "line" }, vec: vec({ p: -0.8, m: 0.2 }) },
  },
  {
    axis: "b",
    prompt: "Pick a weight",
    a: { label: "Heavy slab", visual: { kind: "shape", shape: "slab" }, vec: vec({ b: 1 }) },
    b: { label: "Hairline ring", visual: { kind: "shape", shape: "ring" }, vec: vec({ b: -1 }) },
  },
  {
    axis: "b",
    prompt: "Pick a palette",
    a: { label: "Electric neon", visual: { kind: "color", colors: ["#FF2E88", "#00F0FF", "#FFE600"] }, vec: vec({ b: 1, m: 0.4 }) },
    b: { label: "Muted earth", visual: { kind: "color", colors: ["#B9A68E", "#8C8574", "#D8D0C1"] }, vec: vec({ b: -0.9, w: 0.3 }) },
  },
  {
    axis: "b",
    prompt: "Which headline weight?",
    a: { label: "Black", visual: { kind: "type", font: "archivo", weight: 400 }, vec: vec({ b: 1, m: 0.3 }) },
    b: { label: "Light", visual: { kind: "type", font: "inter", weight: 200 }, vec: vec({ b: -0.9, m: 0.3 }) },
  },
  {
    axis: "m",
    prompt: "Which feels right?",
    a: { label: "Since 1924", visual: { kind: "word", text: "Since 1924", font: "dmserif" }, vec: vec({ m: -1 }) },
    b: { label: "Version 2.0", visual: { kind: "word", text: "v2.0", font: "space" }, vec: vec({ m: 1 }) },
  },
  {
    axis: "m",
    prompt: "Pick a typeface",
    a: { label: "Old-style serif", visual: { kind: "type", font: "playfair", weight: 600, italic: true }, vec: vec({ m: -1, p: -0.2 }) },
    b: { label: "Geometric grotesk", visual: { kind: "type", font: "space", weight: 600 }, vec: vec({ m: 1 }) },
  },
  {
    axis: "m",
    prompt: "Pick a texture",
    a: { label: "Pinstripes", visual: { kind: "pattern", pattern: "stripes" }, vec: vec({ m: -0.7, p: -0.4 }) },
    b: { label: "Tech grid", visual: { kind: "pattern", pattern: "grid" }, vec: vec({ m: 0.9 }) },
  },
  {
    axis: "w",
    prompt: "Pick a light",
    a: { label: "Golden hour", visual: { kind: "color", colors: ["#FF7A45", "#FFB347", "#FFD9A0"] }, vec: vec({ w: 1 }) },
    b: { label: "Arctic morning", visual: { kind: "color", colors: ["#2D5BFF", "#7FB2FF", "#DDEBFF"] }, vec: vec({ w: -1 }) },
  },
  {
    axis: "w",
    prompt: "Pick a material",
    a: { label: "Terracotta", visual: { kind: "color", colors: ["#C2593A", "#E08A5F", "#F3D2B8"] }, vec: vec({ w: 0.9, m: -0.3 }) },
    b: { label: "Brushed steel", visual: { kind: "color", colors: ["#4A5662", "#8C99A6", "#D3DAE0"] }, vec: vec({ w: -0.9, m: 0.4 }) },
  },
  {
    axis: "w",
    prompt: "Pick a rhythm",
    a: { label: "Soft blobs", visual: { kind: "pattern", pattern: "blobs" }, vec: vec({ w: 0.7, p: 0.5 }) },
    b: { label: "Clean waves", visual: { kind: "pattern", pattern: "waves" }, vec: vec({ w: -0.7, m: 0.3 }) },
  },
  {
    axis: "f",
    prompt: "How do you greet people?",
    a: { label: "Hey there!", visual: { kind: "word", text: "Hey there!", font: "manrope" }, vec: vec({ f: 1, p: 0.5 }) },
    b: { label: "Good evening.", visual: { kind: "word", text: "Good evening.", font: "cormorant" }, vec: vec({ f: -0.8, p: -0.5 }) },
  },
  {
    axis: "f",
    prompt: "The door policy?",
    a: { label: "Everyone welcome", visual: { kind: "word", text: "For everyone", font: "fraunces" }, vec: vec({ f: 1 }) },
    b: { label: "By invitation", visual: { kind: "word", text: "By invitation", font: "playfair" }, vec: vec({ f: -1 }) },
  },
  {
    axis: "f",
    prompt: "Pick a mood",
    a: { label: "Candy pop", visual: { kind: "color", colors: ["#FF8FB1", "#FFD36E", "#8FE3CF"] }, vec: vec({ f: 0.8, p: 0.8 }) },
    b: { label: "Black & gold", visual: { kind: "color", colors: ["#111111", "#C9A227", "#2B2B2B"] }, vec: vec({ f: -0.9, p: -0.5 }) },
  },
];

/** Two cards per axis, order shuffled, each card's sides shuffled. */
export function dealCards(seed: string): Card[] {
  const r = rngFrom(seed + ":cards");
  const out: Card[] = [];
  for (const axis of AXES) {
    out.push(...shuffle(r, CARDS.filter((c) => c.axis === axis)).slice(0, 2));
  }
  return shuffle(r, out).map((c) => (r() > 0.5 ? { ...c, a: c.b, b: c.a } : c));
}

export function vecFromPicks(picks: Vec[]): Vec {
  const sum = zero();
  const weight = zero();
  for (const v of picks)
    for (const a of AXES) {
      sum[a] += v[a];
      weight[a] += Math.abs(v[a]) > 0 ? 1 : 0;
    }
  return clampVec(
    Object.fromEntries(AXES.map((a) => [a, weight[a] ? (sum[a] / weight[a]) * 1.1 : 0])) as Vec,
  );
}

/* ------------------------------------------------------------------ */
/* Level 2: colour                                                     */
/* ------------------------------------------------------------------ */

export type Harmony = "analogous" | "complementary" | "split" | "triadic" | "mono";

export const HARMONIES: { id: Harmony; label: string; blurb: string; vec: Vec }[] = [
  { id: "mono", label: "Monochrome", blurb: "One hue, many shades. Calm and premium.", vec: vec({ b: -0.8, p: -0.5, f: -0.3 }) },
  { id: "analogous", label: "Analogous", blurb: "Neighbours on the wheel. Harmonious and natural.", vec: vec({ b: -0.3, w: 0.3, f: 0.3 }) },
  { id: "complementary", label: "Complementary", blurb: "Opposites attract. Maximum punch.", vec: vec({ b: 0.9, m: 0.3 }) },
  { id: "split", label: "Split complementary", blurb: "Contrast with a softer edge.", vec: vec({ b: 0.4, p: 0.3 }) },
  { id: "triadic", label: "Triadic", blurb: "Three evenly spaced hues. Vibrant and playful.", vec: vec({ p: 0.9, b: 0.6, f: 0.5 }) },
];

export type Palette = {
  primary: HSL;
  secondary: HSL;
  accent: HSL;
  dark: HSL;
  light: HSL;
  harmony: Harmony;
};

export function buildPalette(primary: HSL, harmony: Harmony): Palette {
  const { h, s, l } = primary;
  const rot = (d: number, ds = 0, dl = 0): HSL => ({
    h: (h + d + 360) % 360,
    s: Math.max(20, Math.min(95, s + ds)),
    l: Math.max(18, Math.min(82, l + dl)),
  });
  let secondary: HSL;
  let accent: HSL;
  switch (harmony) {
    case "mono":
      secondary = rot(0, -15, l > 50 ? -28 : 24);
      accent = rot(0, 10, l > 50 ? 22 : -18);
      break;
    case "analogous":
      secondary = rot(-32, -5, 6);
      accent = rot(34, 8, -4);
      break;
    case "complementary":
      secondary = rot(0, -20, l > 50 ? -26 : 26);
      accent = rot(180, 5, 4);
      break;
    case "split":
      secondary = rot(150, -10, 8);
      accent = rot(210, 5, 0);
      break;
    case "triadic":
      secondary = rot(120, -5, 4);
      accent = rot(240, 5, 2);
      break;
  }
  return {
    primary,
    secondary,
    accent,
    dark: { h, s: 22, l: 9 },
    light: { h, s: 30, l: 96 },
    harmony,
  };
}

/** How a colour expresses personality, -1..1 on warmth and boldness. */
export function colorVec(c: HSL): Vec {
  const warmth = Math.cos(((c.h - 35) * Math.PI) / 180);
  const bold = (c.s - 55) / 40 + (c.l < 30 || c.l > 75 ? -0.3 : 0.1);
  const playful = c.s > 70 && c.l > 50 ? 0.5 : c.s < 40 ? -0.4 : 0;
  return vec({ w: warmth, b: clamp(bold), p: playful });
}

export function colorFit(c: HSL, target: Vec) {
  const v = colorVec(c);
  const dw = Math.abs(v.w - target.w);
  const db = Math.abs(v.b - target.b);
  const dp = Math.abs(v.p - target.p);
  return clamp(1 - (dw * 0.5 + db * 0.35 + dp * 0.15) / 1.4, 0, 1);
}

export function primaryCandidates(seed: string, round: number): HSL[] {
  const r = rngFrom(`${seed}:primary:${round}`);
  const offset = r() * 60;
  return Array.from({ length: 6 }, (_, i) => {
    const bold = r();
    return {
      h: Math.round((offset + i * 60 + range(r, -12, 12) + 360) % 360),
      s: Math.round(30 + bold * 62),
      l: Math.round(range(r, 36, 58)),
    };
  });
}

export function randomTarget(r: Rng): HSL {
  return { h: Math.round(r() * 360), s: Math.round(range(r, 35, 90)), l: Math.round(range(r, 30, 70)) };
}

export function contrastPair(r: Rng, palette: Palette | null): { fg: string; bg: string; ratio: number } {
  for (let i = 0; i < 200; i++) {
    const pool = palette
      ? [palette.primary, palette.secondary, palette.accent, palette.dark, palette.light].map(hex)
      : [];
    const randomColor = () => hex({ h: r() * 360, s: range(r, 10, 90), l: range(r, 10, 92) });
    const fg = pool.length && r() > 0.5 ? pick(r, pool) : randomColor();
    const bg = pool.length && r() > 0.5 ? pick(r, pool) : randomColor();
    const ratio = contrast(fg, bg);
    if (ratio > 2.3 && ratio < 8.5 && Math.abs(ratio - 4.5) > 0.35) return { fg, bg, ratio };
  }
  return { fg: "#777777", bg: "#FFFFFF", ratio: contrast("#777777", "#FFFFFF") };
}

/* ------------------------------------------------------------------ */
/* Level 3: type                                                       */
/* ------------------------------------------------------------------ */

export type FontId =
  | "playfair"
  | "dmserif"
  | "fraunces"
  | "space"
  | "syne"
  | "archivo"
  | "inter"
  | "lora"
  | "manrope"
  | "baloo"
  | "plex"
  | "cormorant";

export const FONT_NAMES: Record<FontId, string> = {
  playfair: "Playfair Display",
  dmserif: "DM Serif Display",
  fraunces: "Fraunces",
  space: "Space Grotesk",
  syne: "Syne",
  archivo: "Archivo Black",
  inter: "Inter",
  lora: "Lora",
  manrope: "Manrope",
  baloo: "Baloo 2",
  plex: "IBM Plex Mono",
  cormorant: "Cormorant Garamond",
};

export const fontVar = (id: FontId) => `var(--bf-${id}), system-ui, sans-serif`;

export type Pairing = {
  id: string;
  name: string;
  heading: FontId;
  body: FontId;
  headingWeight: number;
  vec: Vec;
  note: string;
};

export const PAIRINGS: Pairing[] = [
  { id: "editorial", name: "Editorial", heading: "playfair", body: "lora", headingWeight: 700, vec: vec({ m: -0.9, p: -0.5, f: -0.2 }), note: "High-contrast serif display over a bookish text face." },
  { id: "luxe", name: "Luxe", heading: "cormorant", body: "manrope", headingWeight: 600, vec: vec({ f: -1, p: -0.6, b: -0.6, m: -0.2 }), note: "Whisper-thin elegance balanced by a clean geometric body." },
  { id: "tech", name: "Tech Forward", heading: "space", body: "inter", headingWeight: 700, vec: vec({ m: 1, p: -0.2, w: -0.4, b: 0.2 }), note: "Quirky grotesk details with a hyper-legible UI body." },
  { id: "loud", name: "Loud & Proud", heading: "archivo", body: "inter", headingWeight: 400, vec: vec({ b: 1, m: 0.4, p: 0.2 }), note: "Heavy, compact headlines that shout. Neutral body lets them." },
  { id: "gallery", name: "Gallery", heading: "syne", body: "manrope", headingWeight: 700, vec: vec({ m: 0.8, b: 0.5, f: -0.3, p: 0.2 }), note: "Art-school attitude with a friendly reading face." },
  { id: "storybook", name: "Storybook", heading: "fraunces", body: "lora", headingWeight: 700, vec: vec({ p: 0.6, w: 0.7, m: -0.4, f: 0.5 }), note: "Soft, wonky serif charm — warm and characterful." },
  { id: "bubbly", name: "Bubbly", heading: "baloo", body: "manrope", headingWeight: 700, vec: vec({ p: 1, f: 1, b: 0.3, w: 0.4 }), note: "Rounded, approachable and impossible not to like." },
  { id: "heritage", name: "Heritage", heading: "dmserif", body: "inter", headingWeight: 400, vec: vec({ m: -0.6, b: 0.4, p: -0.3 }), note: "Confident classic serif with a modern sans for balance." },
  { id: "terminal", name: "Terminal", heading: "plex", body: "inter", headingWeight: 600, vec: vec({ m: 0.8, p: -0.4, w: -0.7, f: -0.1 }), note: "Monospaced precision for builders and engineers." },
  { id: "modern", name: "Friendly Modern", heading: "manrope", body: "inter", headingWeight: 800, vec: vec({ f: 0.7, m: 0.5, b: -0.3, p: 0.2 }), note: "Neutral, open and warm. Works everywhere." },
];

export function dealPairings(seed: string, target: Vec): Pairing[] {
  const r = rngFrom(seed + ":type");
  const sorted = [...PAIRINGS].sort((a, b) => fit(b.vec, target) - fit(a.vec, target));
  const best = sorted[0];
  const rest = shuffle(r, sorted.slice(1)).slice(0, 5);
  return shuffle(r, [best, ...rest]);
}

export const SCALES = [
  { ratio: 1.2, name: "Minor Third", vec: vec({ b: -0.7, p: -0.3 }) },
  { ratio: 1.25, name: "Major Third", vec: vec({ b: -0.2 }) },
  { ratio: 1.333, name: "Perfect Fourth", vec: vec({ b: 0.3 }) },
  { ratio: 1.5, name: "Perfect Fifth", vec: vec({ b: 0.7, p: 0.3 }) },
  { ratio: 1.618, name: "Golden Ratio", vec: vec({ b: 1, p: 0.4 }) },
];

/* ------------------------------------------------------------------ */
/* Level 4: logo                                                       */
/* ------------------------------------------------------------------ */

export type ContainerId = "none" | "circle" | "squircle" | "square" | "hexagon" | "diamond" | "blob" | "arch";
export type SymbolId = "initial" | "spark" | "bolt" | "leaf" | "wave" | "sun" | "orbit" | "arrow" | "stack" | "drop" | "flower" | "monogram";
export type LogoStyle = "solid" | "outline" | "glyph";

export type LogoSpec = { container: ContainerId; symbol: SymbolId; style: LogoStyle; tilt: number };

export const CONTAINERS: Record<ContainerId, { label: string; vec: Vec }> = {
  none: { label: "Free", vec: vec({ m: 0.4, b: -0.2 }) },
  circle: { label: "Circle", vec: vec({ p: 0.5, f: 0.6, w: 0.2 }) },
  squircle: { label: "Squircle", vec: vec({ m: 0.7, f: 0.5, p: 0.3 }) },
  square: { label: "Square", vec: vec({ p: -0.6, b: 0.5, m: 0.2 }) },
  hexagon: { label: "Hexagon", vec: vec({ m: 0.8, w: -0.5, p: -0.3 }) },
  diamond: { label: "Diamond", vec: vec({ f: -0.7, b: 0.4, p: -0.2 }) },
  blob: { label: "Blob", vec: vec({ p: 1, w: 0.6, f: 0.6 }) },
  arch: { label: "Arch", vec: vec({ m: -0.5, w: 0.5, f: 0.2 }) },
};

export const SYMBOLS: Record<SymbolId, { label: string; vec: Vec }> = {
  initial: { label: "Initial", vec: vec({ m: -0.2, p: -0.3 }) },
  monogram: { label: "Monogram", vec: vec({ f: -0.6, m: -0.5, p: -0.4 }) },
  spark: { label: "Spark", vec: vec({ p: 0.4, m: 0.6, b: 0.3 }) },
  bolt: { label: "Bolt", vec: vec({ b: 1, m: 0.5, w: 0.2 }) },
  leaf: { label: "Leaf", vec: vec({ w: 0.6, f: 0.5, m: -0.2, b: -0.3 }) },
  wave: { label: "Wave", vec: vec({ w: -0.6, p: 0.3, b: -0.2 }) },
  sun: { label: "Sun", vec: vec({ w: 1, p: 0.6, f: 0.6 }) },
  orbit: { label: "Orbit", vec: vec({ m: 1, w: -0.4 }) },
  arrow: { label: "Arrow", vec: vec({ b: 0.7, m: 0.7, p: -0.2 }) },
  stack: { label: "Stack", vec: vec({ m: 0.6, p: -0.6, w: -0.3 }) },
  drop: { label: "Drop", vec: vec({ w: -0.4, b: -0.4, f: 0.3 }) },
  flower: { label: "Bloom", vec: vec({ p: 0.9, f: 0.8, w: 0.6 }) },
};

const STYLE_VEC: Record<LogoStyle, Vec> = {
  solid: vec({ b: 0.6 }),
  outline: vec({ b: -0.6, m: 0.3 }),
  glyph: vec({ b: -0.1 }),
};

export function logoVec(l: LogoSpec): Vec {
  const c = CONTAINERS[l.container].vec;
  const s = SYMBOLS[l.symbol].vec;
  const st = STYLE_VEC[l.style];
  return clampVec(
    Object.fromEntries(
      AXES.map((a) => [a, c[a] * 0.45 + s[a] * 0.45 + st[a] * 0.3 + (l.tilt ? (a === "p" ? 0.2 : 0) : 0)]),
    ) as Vec,
  );
}

export function dealLogos(seed: string, round: number): LogoSpec[] {
  const r = rngFrom(`${seed}:logo:${round}`);
  const containers = shuffle(r, Object.keys(CONTAINERS) as ContainerId[]);
  const symbols = shuffle(r, Object.keys(SYMBOLS) as SymbolId[]);
  return Array.from({ length: 6 }, (_, i) => {
    const container = containers[i % containers.length];
    const style: LogoStyle =
      container === "none" ? "glyph" : pick(r, ["solid", "solid", "outline"] as LogoStyle[]);
    return { container, symbol: symbols[i % symbols.length], style, tilt: r() > 0.8 ? -12 : 0 };
  });
}

/* ------------------------------------------------------------------ */
/* Level 5: voice                                                      */
/* ------------------------------------------------------------------ */

export type ToneId = "playful" | "refined" | "bold" | "warm";

export const TONES: Record<ToneId, { label: string; vec: Vec; weAre: string[]; weAreNot: string[] }> = {
  playful: {
    label: "Playful",
    vec: vec({ p: 1, f: 0.6, b: 0.2, m: 0.2, w: 0.3 }),
    weAre: ["Witty", "Light-hearted", "Surprising"],
    weAreNot: ["Silly", "Sarcastic", "Try-hard"],
  },
  refined: {
    label: "Refined",
    vec: vec({ p: -0.8, f: -0.8, b: -0.4, m: -0.4, w: -0.2 }),
    weAre: ["Precise", "Composed", "Considered"],
    weAreNot: ["Cold", "Stuffy", "Jargon-heavy"],
  },
  bold: {
    label: "Bold",
    vec: vec({ b: 1, m: 0.6, f: -0.2 }),
    weAre: ["Direct", "Confident", "Punchy"],
    weAreNot: ["Arrogant", "Aggressive", "Hype-driven"],
  },
  warm: {
    label: "Warm",
    vec: vec({ w: 1, f: 0.9, b: -0.5, p: 0.1, m: -0.2 }),
    weAre: ["Caring", "Human", "Reassuring"],
    weAreNot: ["Saccharine", "Vague", "Overly casual"],
  },
};

export type Scenario = { id: string; label: string; lines: Record<ToneId, string> };

export const SCENARIOS: Scenario[] = [
  {
    id: "welcome",
    label: "Welcome email subject line",
    lines: {
      playful: "Well hello there, you magnificent human 👋",
      refined: "Welcome to {name}. Your membership is now active.",
      bold: "You're in. Let's break things.",
      warm: "We're so glad you found us.",
    },
  },
  {
    id: "404",
    label: "404 page headline",
    lines: {
      playful: "Oops! This page wandered off to get snacks.",
      refined: "The page you requested could not be found.",
      bold: "Dead end. The good stuff's this way →",
      warm: "Looks like you got a little lost. Let's get you home.",
    },
  },
  {
    id: "stock",
    label: "Out-of-stock notice",
    lines: {
      playful: "Gone! Poof! Everyone wanted one. Back soon, promise.",
      refined: "Currently unavailable. Join the waitlist for priority access.",
      bold: "Sold out. Obviously.",
      warm: "We've run out for now — leave your email and we'll save you one.",
    },
  },
  {
    id: "price",
    label: "Price increase announcement",
    lines: {
      playful: "Okay, real talk: prices are going up a smidge.",
      refined: "Our pricing will be adjusted to reflect continued investment in quality.",
      bold: "New prices. Same no-compromise {name}. Here's why.",
      warm: "We wanted you to hear it from us first: prices are changing, and here's why.",
    },
  },
  {
    id: "launch",
    label: "Instagram launch caption",
    lines: {
      playful: "New drop just landed and honestly? We're obsessed.",
      refined: "Introducing the new collection. Crafted with intention.",
      bold: "It's here. And it changes everything.",
      warm: "Made with love, for everyone who's been with us from day one.",
    },
  },
  {
    id: "thanks",
    label: "Order confirmation",
    lines: {
      playful: "Order confirmed! Doing a tiny happy dance right now.",
      refined: "Thank you for your order. A confirmation has been sent to your inbox.",
      bold: "Locked in. It ships fast. You chose well.",
      warm: "Thank you — truly. Your support means the world to our little team.",
    },
  },
  {
    id: "sorry",
    label: "Reply to a complaint",
    lines: {
      playful: "Ugh, that's on us! Let's fix it — pinky promise.",
      refined: "We sincerely apologise and are resolving the matter promptly.",
      bold: "We messed up. Here's exactly what we're doing about it.",
      warm: "I'm really sorry this happened. I'll personally make sure it's put right.",
    },
  },
  {
    id: "cta",
    label: "Newsletter sign-up button",
    lines: {
      playful: "Join the fun club (we have cookies)",
      refined: "Subscribe for curated updates",
      bold: "Get in early. Stay ahead.",
      warm: "Stay close — we'll write you something nice",
    },
  },
  {
    id: "loading",
    label: "Loading message",
    lines: {
      playful: "Herding pixels…",
      refined: "Preparing your experience…",
      bold: "Almost there. Hold tight.",
      warm: "Just a moment, getting things ready for you…",
    },
  },
];

export function bestTone(v: Vec): ToneId {
  return (Object.keys(TONES) as ToneId[]).sort((a, b) => dot(TONES[b].vec, v) - dot(TONES[a].vec, v))[0];
}

export function toneRanking(v: Vec): ToneId[] {
  return (Object.keys(TONES) as ToneId[]).sort((a, b) => dot(TONES[b].vec, v) - dot(TONES[a].vec, v));
}

/* ------------------------------------------------------------------ */
/* Level 6: brand police                                               */
/* ------------------------------------------------------------------ */

export type ViolationId =
  | "stretch"
  | "rotate"
  | "offcolor"
  | "font"
  | "contrast"
  | "tracking"
  | "effects"
  | "busy";

export const VIOLATIONS: Record<ViolationId, { title: string; rule: string }> = {
  stretch: { title: "Stretched logo", rule: "Never stretch, squash or distort the logo." },
  rotate: { title: "Rotated logo", rule: "Never rotate the logo. It always sits level." },
  offcolor: { title: "Off-palette colour", rule: "Only use colours from the brand palette." },
  font: { title: "Rogue typeface", rule: "Never substitute the brand typefaces." },
  contrast: { title: "Low contrast", rule: "Text must meet WCAG AA contrast (4.5:1)." },
  tracking: { title: "Over-tracked headline", rule: "Don't letterspace headlines excessively." },
  effects: { title: "Logo effects", rule: "No drop shadows, glows or outlines on the logo." },
  busy: { title: "Busy background", rule: "Never place the logo on busy or clashing backgrounds." },
};

/* ------------------------------------------------------------------ */
/* Meta: ranks + achievements                                          */
/* ------------------------------------------------------------------ */

export const RANKS = [
  { xp: 0, title: "Design Intern" },
  { xp: 2500, title: "Junior Designer" },
  { xp: 7000, title: "Designer" },
  { xp: 14000, title: "Senior Designer" },
  { xp: 24000, title: "Art Director" },
  { xp: 38000, title: "Creative Director" },
  { xp: 60000, title: "Design Legend" },
];

export function rankFor(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i];
  const next = RANKS[i + 1];
  return {
    index: i,
    title: cur.title,
    next: next?.title,
    progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1,
    toNext: next ? next.xp - xp : 0,
  };
}

export type AchievementId =
  | "first"
  | "mindreader"
  | "pixeleye"
  | "ally"
  | "kern"
  | "flawless"
  | "combo"
  | "srank"
  | "noreroll"
  | "daily"
  | "factory"
  | "wordsmith"
  | "speed"
  | "legend";

export const ACHIEVEMENTS: Record<AchievementId, { icon: string; title: string; desc: string }> = {
  first: { icon: "✦", title: "First Brand", desc: "Ship your first brand guideline." },
  mindreader: { icon: "◎", title: "Mind Reader", desc: "Score 90%+ brief alignment." },
  pixeleye: { icon: "◉", title: "Pixel Eye", desc: "Match a colour within ΔE 3." },
  ally: { icon: "◐", title: "Accessibility Ally", desc: "Ace every Contrast Clash round." },
  kern: { icon: "↔", title: "Kern Whisperer", desc: "Hit 95%+ on Kern It." },
  flawless: { icon: "◆", title: "Brand Police", desc: "Finish Client Review without losing a life." },
  combo: { icon: "✸", title: "On Fire", desc: "Reach a ×8 combo streak." },
  srank: { icon: "S", title: "S-Rank", desc: "Earn an S grade on a brand." },
  noreroll: { icon: "①", title: "First Instinct", desc: "Pick a logo without rerolling." },
  daily: { icon: "☀", title: "Daily Devotee", desc: "Complete a Daily Brief." },
  factory: { icon: "▦", title: "Brand Factory", desc: "Build 5 brands." },
  wordsmith: { icon: "❝", title: "Wordsmith", desc: "Nail every Tone Duel." },
  speed: { icon: "⚡", title: "Speed Demon", desc: "Answer 5 personality cards in under 2s each." },
  legend: { icon: "♛", title: "Legend", desc: "Reach the rank of Creative Director." },
};

export function grade(pct: number) {
  if (pct >= 0.92) return "S";
  if (pct >= 0.8) return "A";
  if (pct >= 0.65) return "B";
  if (pct >= 0.5) return "C";
  return "D";
}

/* ------------------------------------------------------------------ */
/* Brand state                                                         */
/* ------------------------------------------------------------------ */

export type Brand = {
  brief: Brief;
  vec: Vec;
  palette: Palette | null;
  pairing: Pairing | null;
  scale: number;
  logo: LogoSpec | null;
  lockup: "horizontal" | "stacked";
  voice: { tone: ToneId; samples: { label: string; text: string }[] } | null;
  donts: ViolationId[];
  /** Arcade score, combo multipliers included. */
  score: number;
  /** Base points earned and possible — accuracy for the grade. */
  earned: number;
  maxScore: number;
  grade?: string;
};

export function newBrand(seed: string): Brand {
  return {
    brief: makeBrief(seed),
    vec: zero(),
    palette: null,
    pairing: null,
    scale: 1.25,
    logo: null,
    lockup: "horizontal",
    voice: null,
    donts: [],
    score: 0,
    earned: 0,
    maxScore: 0,
  };
}

export const fill = (s: string, name: string) => s.replaceAll("{name}", name);
