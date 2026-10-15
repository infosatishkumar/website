"use client";

import { useEffect, type ReactNode } from "react";
import Icon from "../Icon";
import SocialIcon from "../SocialIcon";
import type { Account } from "@/lib/connector/store";

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-bold text-ink">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Person placing a card on a board — the shared empty-state drawing. */
export function EmptyArt({ icon = "doc" }: { icon?: string }) {
  return (
    <svg viewBox="0 0 260 200" className="h-44 w-auto" aria-hidden="true">
      <rect x="20" y="22" width="120" height="150" rx="12" fill="var(--hp-surface-2)" stroke="var(--hp-line)" strokeWidth="2" />
      {[48, 84, 120].map((y) => (
        <g key={y}>
          <rect x="36" y={y} width="20" height="20" rx="4" fill="var(--hp-line)" />
          <rect x="64" y={y + 4} width="58" height="5" rx="2.5" fill="var(--hp-line)" />
          <rect x="64" y={y + 13} width="40" height="5" rx="2.5" fill="var(--hp-line)" />
        </g>
      ))}
      <g transform="rotate(4 150 110)">
        <rect x="96" y="70" width="112" height="76" rx="10" fill="var(--hp-surface)" stroke="var(--hp-line)" strokeWidth="2" />
        <rect x="110" y="84" width="22" height="22" rx="4" fill="#673DE6" />
        <rect x="140" y="88" width="54" height="5" rx="2.5" fill="var(--hp-line)" />
        <rect x="110" y="114" width="84" height="5" rx="2.5" fill="var(--hp-line)" />
        <rect x="110" y="124" width="70" height="5" rx="2.5" fill="var(--hp-line)" />
        <rect x="110" y="134" width="56" height="5" rx="2.5" fill="var(--hp-line)" />
      </g>
      {/* person */}
      <circle cx="214" cy="66" r="9" fill="#1D1E20" />
      <path d="M206 64c2-8 14-9 17-1" fill="#1D1E20" />
      <path d="M204 80c3-6 17-6 20 0l4 46h-28z" fill="#673DE6" />
      <path d="M205 86c-6 10-10 22-12 30" stroke="#673DE6" strokeWidth="7" strokeLinecap="round" />
      <path d="M204 126l-4 52M220 126l3 52" stroke="var(--hp-ink)" strokeWidth="8" strokeLinecap="round" />
      <path d="M195 180h12M218 180h12" stroke="var(--hp-ink)" strokeWidth="5" strokeLinecap="round" />
      <line x1="180" y1="186" x2="246" y2="186" stroke="var(--hp-ink)" strokeWidth="2" />
      <circle cx="240" cy="30" r="14" fill="var(--hp-primary-tint)" />
      <g transform="translate(231 21) scale(0.75)" color="var(--hp-accent)">
        <Icon name={icon} size={24} />
      </g>
    </svg>
  );
}

export function Empty({ icon, title, sub, action }: { icon: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-8 px-4 py-12 text-center md:flex-row md:justify-center md:text-left">
      <div className="max-w-sm">
        <p className="text-2xl font-bold leading-tight text-ink sm:text-3xl">{title}</p>
        {sub && <p className="mt-3 text-ink-2">{sub}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
      <EmptyArt icon={icon} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-night/60 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`menu-in max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-surface shadow-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-canvas" aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: "bg-primary-tint text-primary",
    published: "bg-success-tint text-success",
    draft: "bg-canvas text-muted",
    pending: "bg-warn-tint text-warn-ink",
    rejected: "bg-danger-tint text-danger",
    failed: "bg-danger-tint text-danger",
    publishing: "bg-primary-tint text-primary",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${map[status] ?? map.draft}`}>{status}</span>;
}

export function AccountChip({ account, small = false }: { account: Account; small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative">
        <span className={`flex items-center justify-center rounded-full bg-primary-tint font-bold text-primary ${small ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm"}`}>
          {account.name[0]}
        </span>
        <span className="absolute -bottom-1 -right-1">
          <SocialIcon id={account.network} size={small ? 13 : 16} rounded="full" />
        </span>
      </span>
      <span className="min-w-0">
        <span className={`block truncate font-medium text-ink ${small ? "text-xs" : "text-sm"}`}>{account.name}</span>
        {!small && <span className="block truncate text-xs text-muted">@{account.handle}</span>}
      </span>
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className="mb-5 flex items-start gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm text-ink-2 ring-1 ring-primary-tint">
      <Icon name="sparkles" size={18} className="mt-0.5 shrink-0 text-primary" />
      <span>{children}</span>
    </p>
  );
}
