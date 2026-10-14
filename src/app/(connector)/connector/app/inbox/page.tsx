"use client";

import { useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon, { networkMeta } from "@/components/connector/SocialIcon";
import { Card, PageHeader } from "@/components/connector/app/ui";
import { uid, update, useWorkspace } from "@/lib/connector/store";

const saved = ["Thank you so much! 💜", "We're open 10 AM – 11 PM every day.", "Please DM us your order number and we'll sort it out."];

export default function InboxPage() {
  const ws = useWorkspace();
  const [filter, setFilter] = useState<"all" | "comment" | "dm" | "review">("all");
  const [openId, setOpenId] = useState<string | null>(ws.inbox[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const list = ws.inbox.filter((c) => filter === "all" || c.kind === filter);
  const convo = ws.inbox.find((c) => c.id === openId);

  const open = (id: string) => {
    setOpenId(id);
    update((s) => ({ ...s, inbox: s.inbox.map((c) => (c.id === id ? { ...c, read: true } : c)) }));
  };

  const send = () => {
    if (!convo || !reply.trim()) return;
    update((s) => ({
      ...s,
      inbox: s.inbox.map((c) => (c.id === convo.id ? { ...c, messages: [...c.messages, { id: uid(), from: "You", text: reply.trim(), at: new Date().toISOString(), mine: true }] } : c)),
    }));
    setReply("");
  };

  return (
    <>
      <PageHeader title="Inbox" sub="Comments, messages and reviews from every connected account." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card
          title={
            <span className="flex flex-wrap gap-1">
              {(["all", "comment", "dm", "review"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1 text-xs font-bold capitalize ${filter === f ? "bg-primary text-white" : "text-ink-2 hover:bg-canvas"}`}>
                  {f === "dm" ? "DMs" : f}
                </button>
              ))}
            </span>
          }
        >
          <ul className="-mx-2 space-y-1">
            {list.map((c) => {
              const last = c.messages[c.messages.length - 1];
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => open(c.id)} className={`flex w-full items-start gap-3 rounded-xl p-2 text-left ${openId === c.id ? "bg-primary-soft" : "hover:bg-canvas"}`}>
                    <span className="relative">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-tint font-bold text-primary">{c.name[0]}</span>
                      <span className="absolute -bottom-1 -right-1"><SocialIcon id={c.network} size={16} rounded="full" /></span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-sm ${c.read ? "font-medium text-ink-2" : "font-bold text-ink"}`}>{c.name}</span>
                        {!c.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </span>
                      <span className="block truncate text-xs text-muted">{last.mine ? "You: " : ""}{last.text}</span>
                    </span>
                    <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-bold uppercase text-muted">{c.kind}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title={convo ? <span className="flex items-center gap-2"><SocialIcon id={convo.network} size={20} />{convo.name} <span className="text-sm font-medium text-muted">· {networkMeta[convo.network].name}</span></span> : "Conversation"}>
          {!convo ? (
            <p className="text-muted">Select a conversation.</p>
          ) : (
            <div className="flex h-[520px] flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-canvas p-4">
                {convo.messages.map((m) => (
                  <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
                    <p className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.mine ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-white text-ink ring-1 ring-line"}`}>{m.text}</p>
                    <span className="mt-1 text-[11px] text-muted">{new Date(m.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {saved.map((s) => (
                  <button key={s} type="button" onClick={() => setReply(s)} className="rounded-full border border-line px-3 py-1 text-xs text-ink-2 hover:border-primary hover:text-primary">{s}</button>
                ))}
              </div>
              <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <input value={reply} onChange={(e) => setReply(e.target.value)} className="field" placeholder={convo.kind === "review" ? "Write a public reply…" : "Write a reply…"} />
                <button type="submit" className="btn btn-primary"><Icon name="send" size={18} /> Send</button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
