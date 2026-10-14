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

  return (
    <>
      <PageHeader title={title} sub={sub} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title={`${items.length} item${items.length === 1 ? "" : "s"}`}>
          {items.length === 0 ? (
            <Empty icon={icon} title={`No ${title.toLowerCase()} yet`} sub="Add your first one using the form." />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((it) => (
                <li key={it.id} className="flex items-start gap-4 py-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary">
                    <Icon name={icon} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink">{it.title}</span>
                    <span className="block break-words text-sm text-ink-2">{renderValue ? renderValue(it.value) : it.value}</span>
                  </span>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-primary"
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
                </li>
              ))}
            </ul>
          )}
        </Card>
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
