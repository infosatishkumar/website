"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon from "@/components/connector/SocialIcon";
import { Card, PageHeader, StatusBadge, Toggle } from "@/components/connector/app/ui";
import { get, post, uploadImage } from "@/lib/connector/api";
import { APP } from "@/lib/connector/data";
import { publishNow, refreshLive, reportError, setAutopublishLocal, useLive, useWorkspace } from "@/lib/connector/store";

type Turn = { role: "user" | "assistant"; text: string; images?: string[]; postIds?: string[]; at: string };

const starters = [
  "Diwali offer ke liye Facebook aur Instagram post bana do",
  "Is hafte ke liye 3 post ideas do",
  "Meri last posts ka status batao",
];

export default function AgentPage() {
  const { status } = useLive();
  const live = !!status?.loggedIn;
  const ws = useWorkspace();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!live) return;
    get<{ transcript: Turn[] }>("agent_thread").then((r) => setTurns(r.transcript), reportError);
  }, [live]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  const send = async (message = text) => {
    if (!message.trim() || busy) return;
    const pending: Turn = { role: "user", text: message, images, at: new Date().toISOString() };
    setTurns((t) => [...t, pending]);
    setText("");
    setImages([]);
    setBusy(true);
    try {
      const r = await post<{ transcript: Turn[] }>("agent_message", { text: message, images: pending.images });
      setTurns(r.transcript);
      await refreshLive();
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", text: `⚠️ ${e instanceof Error ? e.message : "Something went wrong"}`, at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  };

  if (!live) {
    return (
      <>
        <PageHeader title="AI Agent" sub="Chat to plan, write and publish posts." />
        <Card>
          <div className="flex flex-col items-center py-12 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-tint text-primary">
              <Icon name="sparkles" size={30} />
            </span>
            <p className="mt-4 text-lg font-bold text-ink">The AI Agent runs on your Hostinger server</p>
            <p className="mt-1 max-w-md text-ink-2">
              It uses your Claude API key, which must stay on the server. Upload the site with the backend, fill in
              smc-config.php and log in — the agent will appear here.
            </p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="AI Agent"
        sub="Tell it what to post. It writes the captions and sends them to your accounts."
        actions={
          <>
            <label className="card flex items-center gap-3 px-4 py-2 text-sm font-medium text-ink">
              Auto-publish
              <Toggle
                label="Auto-publish"
                on={!!status?.autopublish}
                onChange={(on) =>
                  post<{ autopublish: boolean }>("agent_settings", { autopublish: on }).then((r) => setAutopublishLocal(r.autopublish), reportError)
                }
              />
            </label>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => confirm("Start a new conversation?") && post("agent_reset").then(() => setTurns([]), reportError)}
            >
              <Icon name="plus" size={16} /> New chat
            </button>
          </>
        }
      />

      {!status?.configured.anthropic && (
        <p className="mb-4 rounded-xl bg-danger-tint px-4 py-3 text-sm font-medium text-danger">
          Add your Claude API key (anthropic_api_key) to smc-config.php to use the agent.
        </p>
      )}
      {ws.accounts.length === 0 && (
        <p className="mb-4 rounded-xl bg-[#fff3d1] px-4 py-3 text-sm font-medium text-ink">
          No accounts connected yet. <Link href={`${APP}/accounts/create`} className="font-bold text-primary">Connect Facebook &amp; Instagram</Link> so the agent can post.
        </p>
      )}
      <p className="mb-4 text-sm text-ink-2">
        {status?.autopublish
          ? "Auto-publish is ON — when you ask the agent to post, it publishes straight away."
          : "Auto-publish is OFF — posts the agent creates wait for your approval below."}
      </p>

      <div className="card flex h-[calc(100vh-300px)] min-h-[480px] flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {turns.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
                <Icon name="sparkles" size={26} />
              </span>
              <p className="mt-4 text-lg font-bold text-ink">Kya post karna hai?</p>
              <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-2">
                {starters.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line px-4 py-2 text-sm text-ink-2 hover:border-primary hover:text-primary">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, k) => (
            <div key={k} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] ${t.role === "user" ? "items-end" : "items-start"} flex flex-col gap-2`}>
                {t.images && t.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {t.images.map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={src} src={src} alt="" className="h-24 w-24 rounded-xl object-cover ring-1 ring-line" />
                    ))}
                  </div>
                )}
                <p className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${t.role === "user" ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-canvas text-ink"}`}>
                  {t.text}
                </p>
                {t.postIds?.map((id) => <AgentPostCard key={id} id={id} />)}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </span>
              Agent is working… (can take up to a minute)
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {images.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {images.map((src) => (
                <span key={src} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  <button type="button" onClick={() => setImages(images.filter((x) => x !== src))} className="absolute -right-1 -top-1 rounded-full bg-night p-0.5 text-white" aria-label="Remove image">
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg p-2.5 text-muted hover:bg-canvas hover:text-primary" aria-label="Attach image" disabled={uploading}>
              <Icon name={uploading ? "clock" : "image"} size={22} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 6);
                e.target.value = "";
                setUploading(true);
                try {
                  const urls = await Promise.all(files.map(uploadImage));
                  setImages((x) => [...x, ...urls].slice(0, 10));
                } catch (err) {
                  reportError(err);
                } finally {
                  setUploading(false);
                }
              }}
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              className="field max-h-40 min-h-11 resize-none"
              placeholder="Message the agent… (Shift+Enter for a new line)"
            />
            <button type="submit" disabled={busy || !text.trim()} className="btn btn-primary disabled:opacity-40">
              <Icon name="send" size={18} />
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function AgentPostCard({ id }: { id: string }) {
  const ws = useWorkspace();
  const [busy, setBusy] = useState(false);
  const p = ws.posts.find((x) => x.id === id);
  if (!p) return null;
  const errors = Object.values(p.result ?? {}).filter((r) => !r.ok);
  const canPublish = !["published", "publishing"].includes(p.status);
  return (
    <div className="w-full max-w-md rounded-xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {p.accountIds.map((aid) => {
          const a = ws.accounts.find((x) => x.id === aid);
          return a ? <SocialIcon key={aid} id={a.network} size={20} rounded="full" /> : null;
        })}
        <span className="text-xs text-muted">Post #{p.id}</span>
        <span className="ml-auto"><StatusBadge status={p.status} /></span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{p.text}</p>
      {p.media.length > 0 && (
        <div className="mt-2 flex gap-2">
          {p.media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m} src={m} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ))}
        </div>
      )}
      {errors.length > 0 && <p className="mt-2 rounded-lg bg-danger-tint px-3 py-2 text-xs text-danger">{errors.map((r) => r.error).join("; ")}</p>}
      {canPublish && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              publishNow(p.id).catch(reportError).finally(() => setBusy(false));
            }}
            className="btn btn-primary btn-sm disabled:opacity-50"
          >
            <Icon name="send" size={14} /> {busy ? "Publishing…" : "Approve & publish now"}
          </button>
          <Link href={`${APP}/posts/calendar`} className="btn btn-ghost btn-sm">Edit / schedule</Link>
        </div>
      )}
    </div>
  );
}
