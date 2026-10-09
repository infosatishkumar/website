"use client";

import dynamic from "next/dynamic";

// The game is WebGL / Web Audio only, so it is never rendered on the server.
const RacingApp = dynamic(() => import("@/racing/ui/RacingApp"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "#07080a",
        color: "#8b939e",
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-race), sans-serif",
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        fontSize: 13,
      }}
    >
      Loading Velocity Rush…
    </div>
  ),
});

export default function RacingLoader() {
  return <RacingApp />;
}
