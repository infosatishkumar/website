import type { Metadata } from "next";
import { Chakra_Petch } from "next/font/google";
import RacingLoader from "./RacingLoader";

const race = Chakra_Petch({
  variable: "--font-race",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Velocity Rush — 3D Supercar Racing",
  description:
    "A browser-playable 3D supercar racing game with realistic driving physics, four environments, AI opponents and online multiplayer.",
};

export default function RacingPage() {
  return (
    <div className={race.variable}>
      <RacingLoader />
    </div>
  );
}
