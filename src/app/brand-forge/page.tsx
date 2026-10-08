import type { Metadata } from "next";
import BrandForge from "@/components/brand-forge/BrandForge";
import { fontVariables } from "@/components/brand-forge/fonts";

export const metadata: Metadata = {
  title: "Brand Forge — a design game by Satish Kumar",
  description:
    "Play six design mini-games and walk away with a complete brand guideline: logo, colour, type, voice and usage rules.",
};

export default function BrandForgePage() {
  return (
    <div className={fontVariables}>
      <BrandForge />
    </div>
  );
}
