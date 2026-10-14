import type { Metadata } from "next";
import Shell from "@/components/connector/app/Shell";

export const metadata: Metadata = { title: "Dashboard" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
