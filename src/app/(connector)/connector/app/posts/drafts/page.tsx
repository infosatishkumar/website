"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon from "@/components/connector/SocialIcon";
import { Empty, Modal, PageHeader } from "@/components/connector/app/ui";
import { APP } from "@/lib/connector/data";
import { patchPost, removePost, reportError, useWorkspace } from "@/lib/connector/store";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DraftsPage() {
  const ws = useWorkspace();
  const [q, setQ] = useState("");
  const [account, setAccount] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const drafts = useMemo(
    () =>
      ws.posts
        .filter((p) => p.status === "draft")
        .filter((p) => account === "all" || p.accountIds.includes(account))
        .filter((p) => p.text.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    [ws.posts, account, q],
  );
  const allOn = drafts.length > 0 && drafts.every((d) => selected.includes(d.id));

  return (
    <>
      <PageHeader
        title="Drafts"
        sub="Ideas you’re still working on. Schedule them when they’re ready."
        actions={<Link href={`${APP}/posts`} className="btn btn-primary"><Icon name="plus" size={18} /> Create post</Link>}
      />
      <section className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <input type="checkbox" aria-label="Select all drafts" className="h-4 w-4 accent-[#673DE6]" checked={allOn} disabled={drafts.length === 0} onChange={() => setSelected(allOn ? [] : drafts.map((d) => d.id))} />
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a post" className="w-48 bg-transparent text-sm text-ink outline-none" />
            <Icon name="search" size={16} className="text-muted" />
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1 text-sm text-ink-2">
            <Icon name="filter" size={16} />
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="bg-transparent py-1 text-ink outline-none" aria-label="Filter by account">
              <option value="all">All accounts</option>
              {ws.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          {selected.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm ml-auto text-danger"
              onClick={async () => {
                if (!confirm(`Delete ${selected.length} draft(s)?`)) return;
                try {
                  for (const id of selected) await removePost(id);
                  setSelected([]);
                } catch (e) {
                  reportError(e);
                }
              }}
            >
              <Icon name="trash" size={16} /> Delete {selected.length}
            </button>
          )}
        </div>
        {drafts.length === 0 ? (
          <Empty
            icon="doc"
            title={q || account !== "all" ? "No drafts match" : "You have not created any drafts yet"}
            sub="Plan your social media campaigns by drafting your content ideas and editing them later."
            action={<Link href={`${APP}/posts`} className="btn btn-primary">Create a draft</Link>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <input
                  type="checkbox"
                  aria-label="Select draft"
                  className="h-4 w-4 accent-[#673DE6]"
                  checked={selected.includes(d.id)}
                  onChange={() => setSelected(selected.includes(d.id) ? selected.filter((x) => x !== d.id) : [...selected, d.id])}
                />
                <span className="flex -space-x-1">
                  {d.accountIds.map((id) => {
                    const a = ws.accounts.find((x) => x.id === id);
                    return a ? <SocialIcon key={id} id={a.network} size={24} rounded="full" /> : null;
                  })}
                </span>
                <p className="line-clamp-2 flex-1 text-sm text-ink">{d.text}</p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn btn-ghost btn-sm border border-line" onClick={() => setEditing({ id: d.id, text: d.text })}>
                    <Icon name="edit" size={15} /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setWhen(toLocalInput(new Date(Date.now() + 3600_000)));
                      setScheduling(d.id);
                    }}
                  >
                    <Icon name="calendar" size={15} /> Schedule
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {scheduling && (
        <Modal title="Schedule draft" onClose={() => setScheduling(null)}>
          <label className="block text-sm font-medium text-ink">
            Publish on
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="field mt-1.5" />
          </label>
          <button
            type="button"
            className="btn btn-primary mt-5 w-full"
            onClick={() =>
              patchPost(scheduling, { status: "scheduled", scheduledAt: new Date(when).toISOString() }).then(() => setScheduling(null), reportError)
            }
          >
            Schedule
          </button>
        </Modal>
      )}

      {editing && (
        <Modal title="Edit draft" onClose={() => setEditing(null)}>
          <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={7} className="field" />
          <button type="button" className="btn btn-primary mt-5 w-full" onClick={() => patchPost(editing.id, { text: editing.text }).then(() => setEditing(null), reportError)}>
            Save draft
          </button>
        </Modal>
      )}
    </>
  );
}
