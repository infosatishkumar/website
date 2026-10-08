import {
  Archivo_Black,
  Baloo_2,
  Cormorant_Garamond,
  DM_Serif_Display,
  Fraunces,
  IBM_Plex_Mono,
  Inter,
  Lora,
  Manrope,
  Playfair_Display,
  Space_Grotesk,
  Syne,
} from "next/font/google";

// Every typeface the game can hand to a brand. Each exposes --bf-<id>,
// matching FontId in engine.ts.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--bf-playfair", style: ["normal", "italic"] });
const dmserif = DM_Serif_Display({ subsets: ["latin"], variable: "--bf-dmserif", weight: "400" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--bf-fraunces" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--bf-space" });
const syne = Syne({ subsets: ["latin"], variable: "--bf-syne" });
const archivo = Archivo_Black({ subsets: ["latin"], variable: "--bf-archivo", weight: "400" });
const inter = Inter({ subsets: ["latin"], variable: "--bf-inter" });
const lora = Lora({ subsets: ["latin"], variable: "--bf-lora" });
const manrope = Manrope({ subsets: ["latin"], variable: "--bf-manrope" });
const baloo = Baloo_2({ subsets: ["latin"], variable: "--bf-baloo" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], variable: "--bf-plex", weight: ["400", "600"] });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--bf-cormorant" });

export const fontVariables = [
  playfair,
  dmserif,
  fraunces,
  space,
  syne,
  archivo,
  inter,
  lora,
  manrope,
  baloo,
  plex,
  cormorant,
]
  .map((f) => f.variable)
  .join(" ");
