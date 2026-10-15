"use client";

import { useState } from "react";
import Icon from "../Icon";
import { Card, Empty, PageHeader } from "./ui";
import { addListItem, removeListItem, type ListKey, useWorkspace } from "@/lib/connector/store";

/** CRUD screen for the workspace's simple title/value collections. */
export default function ListManager({
  listKey,
  title,
  sub,
  icon,
  titleLabel,
  valueLabel,
  titlePlaceholder,
  valuePlaceholder,
  multiline = false,
  renderValue,
}: {
  listKey: ListKey;
  title: string;
  sub: string;
  icon: string;
  titleLabel: string;
  valueLabel: string;
  titlePlaceholder?: string;
  valuePlaceholder?: string;
  multiline?: boolean;
  renderValue?: (v: string) => React.ReactNode;
}) {
  const ws = useWorkspace();
  const items = ws[listKey];
  const [t, setT] = useState("");
  const [v, setV] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "az">("new");
  const [view, setView] = useState<"grid" | "list">("grid");
  const shown = items
    .filter((it) => `${it.title} ${it.value}`.toLowerCase().includes(q.toLowerCase()))
    .slice()
    .sort((a, b) => (sort === "az" ? a.title.localeCompare(b.title) : 0));
  if (sort === "new") shown.reverse();

  return (
    <>
      <PageHeader title={title} sub={sub} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
              <Icon name="search" size={16} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-40 bg-transparent text-sm text-ink outline-none" />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink-2">
              <Icon name="sortAZ" size={16} />
              <select value={sort} onChange={(e) => setSort(e.target.value as "new" | "az")} className="bg-transparent py-0.5 text-ink outline-none" aria-label="Sort">
                <option value="new">Sort by: Newest</option>
                <option value="az">Sort by: Name A–Z</option>
              </select>
            </label>
            <span className="ml-auto text-sm text-muted">{shown.length} of {items.length}</span>
            <div className="flex overflow-hidden rounded-lg border border-line">
              {(["list", "grid"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} className={`p-2 ${view === v ? "bg-primary-tint text-accent" : "text-muted"}`} aria-label={`${v} view`}>
                  <Icon name={v === "list" ? "list" : "grid"} size={16} />
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {items.length === 0 ? (
              <Empty icon={icon} title={`You have not added any ${title.toLowerCase()} yet`} sub={sub} />
            ) : shown.length === 0 ? (
              <p className="py-8 text-center text-muted">Nothing matches “{q}”.</p>
            ) : (
              <ul className={view === "grid" ? "grid gap-3 sm:grid-cols-2" : "divide-y divide-line"}>
                {shown.map((it) => (
                  <li key={it.id} className={view === "grid" ? "flex flex-col rounded-xl border border-line bg-surface-2 p-4" : "flex items-start gap-4 py-3"}>
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-accent">
                        <Icon name={icon} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-ink">{it.title}</span>
                        <span className={`block break-words text-sm text-ink-2 ${view === "grid" ? "line-clamp-3" : ""}`}>{renderValue ? renderValue(it.value) : it.value}</span>
                      </span>
                    </div>
                    <div className={`flex gap-1 ${view === "grid" ? "mt-auto justify-end pt-3" : "ml-auto"}`}>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-muted hover:bg-surface hover:text-primary"
                        aria-label="Copy value"
                        onClick={() => {
                          navigator.clipboard?.writeText(it.value).catch(() => {});
                          setCopied(it.id);
                          setTimeout(() => setCopied(null), 1200);
                        }}
                      >
                        <Icon name={copied === it.id ? "check" : "copy"} size={18} />
                      </button>
                      <button type="button" className="rounded-lg p-2 text-muted hover:bg-danger-tint hover:text-danger" aria-label="Delete" onClick={() => removeListItem(listKey, it.id)}>
                        <Icon name="trash" size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <Card title="Add new">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!t.trim() || !v.trim()) return;
              addListItem(listKey, { title: t.trim(), value: v.trim() });
              setT("");
              setV("");
            }}
          >
            <label className="block text-sm font-medium text-ink">
              {titleLabel}
              <input required value={t} onChange={(e) => setT(e.target.value)} className="field mt-1.5" placeholder={titlePlaceholder} />
            </label>
            <label className="block text-sm font-medium text-ink">
              {valueLabel}
              {multiline ? (
                <textarea required rows={4} value={v} onChange={(e) => setV(e.target.value)} className="field mt-1.5" placeholder={valuePlaceholder} />
              ) : (
                <input required value={v} onChange={(e) => setV(e.target.value)} className="field mt-1.5" placeholder={valuePlaceholder} />
              )}
            </label>
            <button type="submit" className="btn btn-primary w-full"><Icon name="plus" size={18} /> Add</button>
          </form>
        </Card>
      </div>
    </>
  );
}
