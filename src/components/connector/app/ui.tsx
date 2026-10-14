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

export function Empty({ icon, title, sub, action }: { icon: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-tint text-primary">
        <Icon name={icon} size={30} />
      </span>
      <p className="mt-4 text-lg font-bold text-ink">{title}</p>
      {sub && <p className="mt-1 max-w-sm text-ink-2">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
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
      <div className={`menu-in max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
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
    pending: "bg-[#fff3d1] text-[#9a6b00]",
    rejected: "bg-danger-tint text-danger",
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
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
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
