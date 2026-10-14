"use client";

import { useState } from "react";
import Icon from "@/components/connector/Icon";
import { Card, PageHeader } from "@/components/connector/app/ui";
import { uid, update, useWorkspace } from "@/lib/connector/store";

const swatches = ["#673DE6", "#8C85FF", "#00B090", "#FEA419", "#FC5185", "#1D1E20", "#1185FE"];

export default function TagsPage() {
  const ws = useWorkspace();
  const [name, setName] = useState("");
  const [color, setColor] = useState(swatches[0]);
  return (
    <>
      <PageHeader title="Tags" sub="Label posts by campaign or content pillar and filter your calendar by them." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title={`${ws.tags.length} tags`}>
          <ul className="divide-y divide-line">
            {ws.tags.map((t) => {
              const count = ws.posts.filter((p) => p.tagIds.includes(t.id)).length;
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span className="h-4 w-4 rounded-full" style={{ background: t.color }} />
                  <span className="flex-1 font-bold text-ink">{t.name}</span>
                  <span className="text-sm text-muted">{count} post{count === 1 ? "" : "s"}</span>
                  <button
                    type="button"
                    aria-label={`Delete ${t.name}`}
                    className="rounded-lg p-2 text-muted hover:bg-danger-tint hover:text-danger"
                    onClick={() => update((s) => ({ ...s, tags: s.tags.filter((x) => x.id !== t.id), posts: s.posts.map((p) => ({ ...p, tagIds: p.tagIds.filter((x) => x !== t.id) })) }))}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="New tag">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              update((s) => ({ ...s, tags: [...s.tags, { id: uid(), name: name.trim(), color }] }));
              setName("");
            }}
          >
            <label className="block text-sm font-medium text-ink">
              Name
              <input required value={name} onChange={(e) => setName(e.target.value)} className="field mt-1.5" placeholder="e.g. Product launch" />
            </label>
            <div>
              <p className="text-sm font-medium text-ink">Colour</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {swatches.map((c) => (
                  <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} className={`h-8 w-8 rounded-full ring-offset-2 ${color === c ? "ring-2 ring-primary" : ""}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-full">Create tag</button>
          </form>
        </Card>
      </div>
    </>
  );
}
