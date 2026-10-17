import type { Metadata } from "next";
import "./flowforge.css";

export const metadata: Metadata = {
  title: "FlowForge — Workflow Automation",
  description: "Connect your apps and social accounts and automate posting, leads and notifications.",
  robots: { index: false },
};

export default function FlowForgeLayout({ children }: { children: React.ReactNode }) {
  return <div className="ff">{children}</div>;
}
