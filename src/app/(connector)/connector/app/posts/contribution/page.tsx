"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/connector/Icon";
import { AccountChip, Card, Empty, PageHeader, StatusBadge } from "@/components/connector/app/ui";
import { APP } from "@/lib/connector/data";
import { patchPost, reportError, useWorkspace } from "@/lib/connector/store";

export default function ApprovalsPage() {
  const ws = useWorkspace();
  const [tab, setTab] = useState<"pending" | "rejected">("pending");
  const list = ws.posts.filter((p) => p.status === tab).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const [invite, setInvite] = useState("");
  const [sent, setSent] = useState<string[]>([]);

  return (
    <>
      <PageHeader title="Approvals" sub="Review posts submitted by teammates and clients before they go live." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card
          title={
            <span className="flex gap-1">
              {(["pending", "rejected"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-lg px-3 py-1 text-sm capitalize ${tab === t ? "bg-primary text-white" : "text-ink-2 hover:bg-canvas"}`}>
                  {t} ({ws.posts.filter((p) => p.status === t).length})
                </button>
              ))}
            </span>
          }
        >
          {list.length === 0 ? (
            <Empty icon="checkCircle" title="All caught up" sub="Nothing is waiting for review." action={<Link href={`${APP}/posts`} className="btn btn-outline">Create post</Link>} />
          ) : (
            <ul className="space-y-4">
              {list.map((p) => (
                <li key={p.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {p.accountIds.map((id) => {
                      const a = ws.accounts.find((x) => x.id === id);
                      return a ? <AccountChip key={id} account={a} small /> : null;
                    })}
                    <span className="ml-auto text-sm text-muted">
                      {new Date(p.scheduledAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-3 text-ink">{p.text}</p>
                  <p className="mt-1 text-xs text-muted">Submitted by {p.author}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => patchPost(p.id, { status: "scheduled" }).catch(reportError)} className="btn btn-primary btn-sm"><Icon name="check" size={16} /> Approve</button>
                    {tab === "pending" && (
                      <button type="button" onClick={() => patchPost(p.id, { status: "rejected" }).catch(reportError)} className="btn btn-outline btn-sm">Request changes</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Invite a contributor">
          <p className="text-sm text-ink-2">Contributors can draft posts that land here for approval. Clients approve from a magic link — no login needed.</p>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (invite.trim()) { setSent([...sent, invite.trim()]); setInvite(""); } }}>
            <input type="email" required value={invite} onChange={(e) => setInvite(e.target.value)} className="field" placeholder="name@client.com" />
            <button type="submit" className="btn btn-primary btn-sm">Invite</button>
          </form>
          {sent.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm">
              {sent.map((s) => <li key={s} className="flex items-center gap-2 text-ink-2"><Icon name="mail" size={16} className="text-success" /> Invite sent to {s}</li>)}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
