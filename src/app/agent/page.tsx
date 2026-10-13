import type { Metadata } from "next";
import AgentApp from "./AgentApp";

export const metadata: Metadata = {
  title: "Social Agent — Satish Kumar",
  description: "Private dashboard for managing social media with an AI agent.",
  robots: { index: false, follow: false },
};

export default function AgentPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:px-8">
      <AgentApp />
    </section>
  );
}
