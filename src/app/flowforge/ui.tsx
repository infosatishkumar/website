"use client";

import { useState } from "react";
import { appByKey } from "@/lib/flowforge/catalog";
import type { OAuthProvider } from "@/lib/flowforge/catalog";
import type { PublicConnection, Run, Workflow } from "@/lib/flowforge/types";

export type ClientWorkflow = Workflow & { hookUrl: string };

export interface AppState {
  workflows: ClientWorkflow[];
  runs: Run[];
  connections: PublicConnection[];
  providers: Record<OAuthProvider, { configured: boolean; redirectUri: string }>;
  system: { appUrl: string; store: "supabase" | "file"; openAccess: boolean; cronSecret: boolean; cronUrl: string };
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(`/api/flowforge/${path}`, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export function AppIcon({ app, size = 34 }: { app: string; size?: number }) {
  const def = appByKey(app);
  return (
    <div className="appicon" style={{ background: def?.color ?? "#fff", width: size, height: size }}>
      {def?.icon ?? "?"}
    </div>
  );
}

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modalback" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function Json({ value }: { value: unknown }) {
  if (value === undefined) return <pre className="json">—</pre>;
  return <pre className="json">{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre>;
}

export function CopyField({ value, onCopied }: { value: string; onCopied?: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <div className="copyrow">
      <input readOnly value={value} className="mono" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="secondary"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setDone(true);
          onCopied?.();
          setTimeout(() => setDone(false), 1500);
        }}
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls = status === "success" ? "on" : status === "error" ? "failed" : "draft";
  const label = status === "success" ? "✓ Success" : status === "error" ? "× Failed" : status === "filtered" ? "⑂ Filtered" : status;
  return <span className={`pill ${cls}`}>{label}</span>;
}

export const when = (iso: string) => {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  return d.toLocaleString();
};

/** Flattens sample data into {{path}} references for the variable picker. */
export function flattenPaths(value: unknown, prefix: string, depth = 0, out: { path: string; preview: string }[] = []) {
  if (out.length > 60) return out;
  if (value && typeof value === "object" && depth < 4) {
    const entries = Array.isArray(value) ? value.slice(0, 3).map((v, i) => [String(i), v] as const) : Object.entries(value);
    for (const [k, v] of entries) flattenPaths(v, `${prefix}.${k}`, depth + 1, out);
  } else if (value !== undefined) {
    const s = typeof value === "string" ? value : JSON.stringify(value);
    out.push({ path: prefix, preview: (s ?? "").slice(0, 60) });
  }
  return out;
}
