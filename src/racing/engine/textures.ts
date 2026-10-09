// Procedurally generated textures (no external image assets are needed).
// Everything is drawn on canvases at load time and cached.

import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Tileable value noise on a period-`p` lattice. */
function vnoise(x: number, y: number, p: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (a: number) => ((a % p) + p) % p;
  const a = hash(w(xi), w(yi), seed), b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed), d = hash(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, period: number, octaves: number, seed = 1) {
  let amp = 0.5, f = 1, sum = 0, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(x * f, y * f, period * f, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

function canvas(w: number, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c: HTMLCanvasElement, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Build colour / roughness / normal maps from a height function in one pass. */
function pbrSet(
  key: string, size: number,
  fn: (u: number, v: number) => { h: number; r: number; g: number; b: number; rough: number },
  normalStrength = 2,
) {
  const hit = cache.get(key + ":c");
  if (hit) return { map: hit, roughnessMap: cache.get(key + ":r")!, normalMap: cache.get(key + ":n")! };
  const cc = canvas(size), rc = canvas(size), nc = canvas(size);
  const cctx = cc.getContext("2d")!, rctx = rc.getContext("2d")!, nctx = nc.getContext("2d")!;
  const ci = cctx.createImageData(size, size), ri = rctx.createImageData(size, size), ni = nctx.createImageData(size, size);
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = fn(x / size, y / size);
      const i = y * size + x;
      H[i] = o.h;
      ci.data[i * 4] = o.r; ci.data[i * 4 + 1] = o.g; ci.data[i * 4 + 2] = o.b; ci.data[i * 4 + 3] = 255;
      const rv = Math.max(0, Math.min(255, o.rough * 255));
      ri.data[i * 4] = rv; ri.data[i * 4 + 1] = rv; ri.data[i * 4 + 2] = rv; ri.data[i * 4 + 3] = 255;
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = H[y * size + ((x - 1 + size) % size)], r = H[y * size + ((x + 1) % size)];
      const u = H[((y - 1 + size) % size) * size + x], d = H[((y + 1) % size) * size + x];
      let nx = (l - r) * normalStrength, ny = (u - d) * normalStrength, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      ni.data[i] = (nx * 0.5 + 0.5) * 255; ni.data[i + 1] = (ny * 0.5 + 0.5) * 255; ni.data[i + 2] = (nz * 0.5 + 0.5) * 255; ni.data[i + 3] = 255;
    }
  }
  cctx.putImageData(ci, 0, 0);
  rctx.putImageData(ri, 0, 0);
  nctx.putImageData(ni, 0, 0);
  const map = toTexture(cc), roughnessMap = toTexture(rc, false), normalMap = toTexture(nc, false);
  cache.set(key + ":c", map);
  cache.set(key + ":r", roughnessMap);
  cache.set(key + ":n", normalMap);
  return { map, roughnessMap, normalMap };
}

/** Asphalt with aggregate, patches, cracks and (optionally) puddles. */
export function asphalt(size: number, wet: boolean, tone = 0.17) {
  return pbrSet(`asphalt${size}${wet}${tone}`, size, (u, v) => {
    const big = fbm(u * 3, v * 3, 3, 4, 3);
    const mid = fbm(u * 24, v * 24, 24, 2, 5);
    const grain = hash(Math.floor(u * size), Math.floor(v * size), 7);
    const patch = fbm(u * 2, v * 2, 2, 3, 11) > 0.66 ? -0.02 : 0;
    let c = tone + (big - 0.5) * 0.035 + (mid - 0.5) * 0.03 + (grain - 0.5) * 0.06 + patch;
    const stones = grain > 0.95 ? 0.05 : grain < 0.03 ? -0.04 : 0;
    c += stones;
    let rough = 0.86 + (grain - 0.5) * 0.16 - stones;
    const puddleN = fbm(u * 3, v * 3, 3, 4, 41);
    if (wet) {
      c *= 0.6;
      rough = 0.32 + (grain - 0.5) * 0.12;
      if (puddleN > 0.6) { rough = 0.03; c *= 0.7; }
    }
    const g = Math.max(0, Math.min(1, c)) * 255;
    return { h: big * 0.3 + mid * 0.3 + grain * 0.6 + (wet && puddleN > 0.6 ? -0.4 : 0), r: g, g: g, b: g * 1.02, rough };
  }, 2.2);
}

export function grass(size: number, dry = false) {
  return pbrSet(`grass${size}${dry}`, size, (u, v) => {
    const n = fbm(u * 8, v * 8, 8, 5, 5);
    const blade = hash(Math.floor(u * size), Math.floor(v * size), 9);
    const base = dry ? [150, 140, 85] : [58, 92, 38];
    const k = 0.75 + n * 0.5 + (blade - 0.5) * 0.25;
    return { h: n + blade * 0.3, r: base[0] * k, g: base[1] * k, b: base[2] * k, rough: 0.95 };
  }, 2);
}

export function sand(size: number) {
  return pbrSet(`sand${size}`, size, (u, v) => {
    const ripple = Math.sin((u * 18 + fbm(u * 3, v * 3, 3, 3, 2) * 4) * Math.PI * 2) * 0.5 + 0.5;
    const n = fbm(u * 10, v * 10, 10, 4, 8);
    const g = hash(Math.floor(u * size), Math.floor(v * size), 4);
    const k = 0.85 + n * 0.2 + (g - 0.5) * 0.1;
    return { h: ripple * 0.5 + n * 0.4, r: 214 * k, g: 176 * k, b: 128 * k, rough: 0.92 };
  }, 2.5);
}

export function rock(size: number) {
  return pbrSet(`rock${size}`, size, (u, v) => {
    const n = fbm(u * 5, v * 5, 5, 6, 13);
    const strata = Math.sin((v * 12 + n * 3) * Math.PI) * 0.5 + 0.5;
    const k = 0.55 + n * 0.5 + strata * 0.12;
    return { h: n * 1.4 + strata * 0.3, r: 122 * k, g: 112 * k, b: 100 * k, rough: 0.9 };
  }, 4);
}

export function concrete(size: number) {
  return pbrSet(`concrete${size}`, size, (u, v) => {
    const n = fbm(u * 6, v * 6, 6, 5, 23);
    const g = hash(Math.floor(u * size), Math.floor(v * size), 2);
    const k = 0.7 + n * 0.25 + (g - 0.5) * 0.06;
    return { h: n + g * 0.2, r: 182 * k, g: 180 * k, b: 172 * k, rough: 0.88 };
  }, 1.5);
}

export function carbonFiber() {
  const key = "carbon";
  const hit = cache.get(key);
  if (hit) return hit;
  const s = 128;
  const c = canvas(s);
  const ctx = c.getContext("2d")!;
  const cell = 8;
  for (let y = 0; y < s; y += cell) {
    for (let x = 0; x < s; x += cell) {
      const horiz = ((x / cell + y / cell) % 4) < 2;
      const g = ctx.createLinearGradient(x, y, horiz ? x : x + cell, horiz ? y + cell : y);
      g.addColorStop(0, "#0c0c0e");
      g.addColorStop(0.5, "#2b2c30");
      g.addColorStop(1, "#0c0c0e");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cell, cell);
    }
  }
  const t = toTexture(c);
  t.repeat.set(6, 6);
  cache.set(key, t);
  return t;
}

export function tireSidewall() {
  const key = "tire";
  const hit = cache.get(key);
  if (hit) return hit;
  const s = 256;
  const c = canvas(s, 64);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#151515";
  ctx.fillRect(0, 0, s, 64);
  for (let x = 0; x < s; x += 8) {
    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(x, 0, 4, 64);
  }
  const t = toTexture(c);
  cache.set(key, t);
  return t;
}

/** Facade with lit / unlit windows; emissive version for night. */
export function facade(variant: number, night: boolean) {
  const key = `facade${variant}${night}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 256, H = 512;
  const c = canvas(W, H);
  const ctx = c.getContext("2d")!;
  const palettes = [["#5d6670", "#8b98a5"], ["#3c4450", "#6e7d8e"], ["#6b5d52", "#a39282"], ["#28313b", "#47566a"]];
  const [base, glass] = palettes[variant % palettes.length];
  ctx.fillStyle = night ? "#000000" : base;
  ctx.fillRect(0, 0, W, H);
  const cols = 8, rows = 16;
  const cw = W / cols, rh = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const h = hash(k, r, variant * 31);
      if (night) {
        if (h > 0.55) {
          const warm = h > 0.8;
          ctx.fillStyle = warm ? `rgba(255,${190 + h * 50},${120 + h * 60},${0.55 + h * 0.4})` : `rgba(${150 + h * 60},${200 + h * 40},255,${0.35 + h * 0.4})`;
          ctx.fillRect(k * cw + 3, r * rh + 4, cw - 6, rh - 8);
        }
      } else {
        const g = ctx.createLinearGradient(0, r * rh, 0, (r + 1) * rh);
        g.addColorStop(0, glass);
        g.addColorStop(1, base);
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(k * cw + 3, r * rh + 4, cw - 6, rh - 8);
        ctx.globalAlpha = 1;
      }
    }
  }
  const t = toTexture(c);
  cache.set(key, t);
  return t;
}

/** Original, fictional brand signage (no real trademarks). */
export const SIGN_WORDS = ["NOVA", "KINETIC", "ORBITAL", "HALCYON", "VOLTA", "ZENITH", "PULSE", "AURA FUEL", "LUMEN", "CIRRUS", "VELOCITY", "MERIDIAN"];

export function signTexture(text: string, color: string, bg = "#08080c", w = 512, h = 128, neon = false) {
  const key = `sign${text}${color}${bg}${w}${h}${neon}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = canvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.font = `800 ${Math.floor(h * 0.56)}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (neon) {
    ctx.shadowColor = color;
    ctx.shadowBlur = h * 0.25;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 2);
  if (!neon) {
    ctx.fillRect(w * 0.06, h * 0.84, w * 0.88, h * 0.05);
  }
  const t = toTexture(c, true, false);
  cache.set(key, t);
  return t;
}

export function radialSprite(key: string, inner: string, outer: string, size = 64) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = canvas(size);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = toTexture(c, true, false);
  cache.set(key, t);
  return t;
}

export function smokeSprite() {
  const key = "smoke";
  const hit = cache.get(key);
  if (hit) return hit;
  const s = 128;
  const c = canvas(s);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (x - s / 2) / (s / 2), dy = (y - s / 2) / (s / 2);
      const r = Math.hypot(dx, dy);
      const n = fbm(x / 32, y / 32, 4, 4, 77);
      const a = Math.max(0, 1 - r) ** 1.5 * (0.5 + n * 0.8);
      const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 235;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = toTexture(c, true, false);
  cache.set(key, t);
  return t;
}

/** Skid-mark strip: dark with soft edges, used on a ribbon mesh. */
export function skidTexture() {
  const key = "skid";
  const hit = cache.get(key);
  if (hit) return hit;
  const c = canvas(32, 64);
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 32, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.25, "rgba(0,0,0,0.9)");
  g.addColorStop(0.75, "rgba(0,0,0,0.9)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 64);
  for (let y = 0; y < 64; y += 3) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(4, y, 24, 1);
  }
  const t = toTexture(c, true, true);
  cache.set(key, t);
  return t;
}

/** Pre-baked rubber marks for the road surface along braking zones. */
export function rubberTexture() {
  const key = "rubber";
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 64, H = 256;
  const c = canvas(W, H);
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  for (let k = 0; k < 26; k++) {
    const x = 6 + hash(k, 1, 5) * (W - 12);
    const w = 1 + hash(k, 2, 5) * 3;
    const a = 0.08 + hash(k, 3, 5) * 0.22;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(0,0,0,0)`);
    g.addColorStop(0.2 + hash(k, 4, 5) * 0.3, `rgba(5,5,5,${a})`);
    g.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, H);
  }
  const t = toTexture(c, true, true);
  cache.set(key, t);
  return t;
}

export function checkerTexture() {
  const key = "checker";
  const hit = cache.get(key);
  if (hit) return hit;
  const c = canvas(64, 16);
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) {
    ctx.fillStyle = (x + y) % 2 ? "#111" : "#f4f4f4";
    ctx.fillRect(x * 8, y * 8, 8, 8);
  }
  const t = toTexture(c);
  t.magFilter = THREE.NearestFilter;
  cache.set(key, t);
  return t;
}

/** Crowd texture for grandstands: rows of coloured specks. */
export function crowdTexture() {
  const key = "crowd";
  const hit = cache.get(key);
  if (hit) return hit;
  const W = 512, H = 128;
  const c = canvas(W, H);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2a2d33";
  ctx.fillRect(0, 0, W, H);
  const colors = ["#e63946", "#f1faee", "#a8dadc", "#457b9d", "#ffb703", "#fb8500", "#2a9d8f", "#e9c46a", "#264653", "#ffffff"];
  for (let row = 0; row < 8; row++) {
    for (let x = 0; x < W; x += 6) {
      if (hash(x, row, 3) < 0.15) continue;
      ctx.fillStyle = colors[Math.floor(hash(x, row, 8) * colors.length)];
      const y = row * 16 + 4 + hash(x, row, 1) * 3;
      ctx.fillRect(x + hash(x, row, 2) * 2, y, 4, 7);
      ctx.fillStyle = "#d9a77c";
      ctx.fillRect(x + 1 + hash(x, row, 2) * 2, y - 3, 2.5, 3);
    }
  }
  const t = toTexture(c);
  cache.set(key, t);
  return t;
}

/** Runway markings / numbers drawn into a tile. */
export function runwayNumberTexture(text: string) {
  const key = `rwy${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = canvas(256, 512);
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 512);
  ctx.fillStyle = "rgba(240,240,240,0.92)";
  ctx.font = "bold 300px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.save();
  ctx.translate(128, 256);
  ctx.scale(0.8, 1.6);
  ctx.fillText(text, 0, 0);
  ctx.restore();
  const t = toTexture(c, true, false);
  cache.set(key, t);
  return t;
}

/** Normal map for animated water. */
export function waterNormals() {
  const key = "waterN";
  const hit = cache.get(key);
  if (hit) return hit;
  const s = 256;
  const { normalMap } = pbrSet("waterbase", s, (u, v) => {
    const n = fbm(u * 8, v * 8, 8, 5, 91);
    return { h: n, r: 0, g: 0, b: 0, rough: 0 };
  }, 6);
  cache.set(key, normalMap);
  return normalMap;
}

export function disposeTextureCache() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
