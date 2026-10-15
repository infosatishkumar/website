"use client";

import Link from "next/link";
import Icon from "../Icon";
import Logo from "../Logo";
import { initLive, useLive } from "@/lib/connector/store";

/** Lists what is still missing on the server (from api/health.php). */
export function SetupProblems({ compact = false }: { compact?: boolean }) {
  const { health } = useLive();
  if (!health) {
    return (
      <div className="rounded-xl bg-warn-tint px-4 py-3 text-sm text-ink">
        <p className="font-bold">Backend not found on this site (no /api folder).</p>
        <p className="mt-1">
          This copy runs in demo mode. Upload the latest zip — it contains the <b>api</b> and <b>uploads</b> folders — and
          extract it inside public_html.
        </p>
      </div>
    );
  }
  if (health.problems.length === 0) return null;
  return (
    <div className="rounded-xl bg-danger-tint px-4 py-3 text-sm text-ink">
      <p className="font-bold text-danger">Server setup is not complete ({health.problems.length})</p>
      <ul className="mt-2 space-y-1.5">
        {health.problems.map((p) => (
          <li key={p} className="flex gap-2">
            <Icon name="close" size={16} className="mt-0.5 shrink-0 text-danger" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      {!compact && <p className="mt-2 text-xs text-muted">PHP {health.info.php}</p>}
    </div>
  );
}

/** Full-page screen when the backend exists but cannot start (e.g. config missing). */
export default function SetupScreen() {
  return (
    <div className="hero-glow flex min-h-screen items-center justify-center p-4">
      <div className="menu-in w-full max-w-xl rounded-2xl bg-surface p-8 shadow-2xl">
        <Logo href="/connector" />
        <h1 className="mt-6 text-2xl font-bold text-ink">Server check</h1>
        <p className="mt-1 text-sm text-ink-2">Fix these on Hostinger, then reload this page.</p>
        <div className="mt-5">
          <SetupProblems />
        </div>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={() => initLive(true)} className="btn btn-primary">
            <Icon name="refresh" size={18} /> Check again
          </button>
          <Link href="/connector/help" className="btn btn-ghost">Help</Link>
        </div>
      </div>
    </div>
  );
}
