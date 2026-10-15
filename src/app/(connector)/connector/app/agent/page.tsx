"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/connector/Icon";
import { LogoMark } from "@/components/connector/Logo";
import SocialIcon from "@/components/connector/SocialIcon";
import { SetupProblems } from "@/components/connector/app/SetupCheck";
import { Modal, StatusBadge, Toggle } from "@/components/connector/app/ui";
import { get, post, uploadImage } from "@/lib/connector/api";
import { APP } from "@/lib/connector/data";
import {
  publishNow,
  refreshLive,
  reportError,
  setAutopublishLocal,
  setCreditsLocal,
  useLive,
  useWorkspace,
} from "@/lib/connector/store";

type Turn = { role: "user" | "assistant"; text: string; images?: string[]; postIds?: string[]; at: string };
type Thread = { id: string; title: string; updatedAt: string };

const suggestions = [
  { icon: "sparkles", text: "Diwali offer ke liye Facebook aur Instagram post bana do" },
  { icon: "calendar", text: "Is hafte ke liye 3 post ideas do aur schedule karo" },
  { icon: "analytics", text: "Meri last posts ka status batao" },
  { icon: "megaphone", text: "Write a launch post for my new product" },
];

const INTRO_KEY = "smc-agent-intro-seen";

export default function AgentPage() {
  return (
    <Suspense>
      <Agent />
    </Suspense>
  );
}

function Agent() {
  const { status } = useLive();
  const live = !!status?.loggedIn;
  const params = useSearchParams();
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [intro, setIntro] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(INTRO_KEY) !== "1";
    } catch {
      return false;
    }
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  const loadThreads = useCallback(() => {
    if (!live) return;
    get<{ threads: Thread[]; credits: number }>("agent_threads").then((r) => {
      setThreads(r.threads);
      setCreditsLocal(r.credits);
    }, reportError);
  }, [live]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  const openThread = (id: string) => {
    setThreadId(id);
    get<{ transcript: Turn[] }>(`agent_thread&id=${id}`).then((r) => setTurns(r.transcript), reportError);
  };

  const newChat = () => {
    setThreadId(null);
    setTurns([]);
    setText("");
    setImages([]);
  };

  const send = useCallback(
    async (message: string) => {
      if (!message.trim() || busy || !live) return;
      const attached = images;
      setTurns((t) => [...t, { role: "user", text: message, images: attached, at: new Date().toISOString() }]);
      setText("");
      setImages([]);
      setBusy(true);
      try {
        const r = await post<{ threadId: string; transcript: Turn[]; credits: number }>("agent_message", { threadId, text: message, images: attached });
        setThreadId(r.threadId);
        setTurns(r.transcript);
        setCreditsLocal(r.credits);
        loadThreads();
        await refreshLive();
      } catch (e) {
        setTurns((t) => [...t, { role: "assistant", text: `⚠️ ${e instanceof Error ? e.message : "Something went wrong"}`, at: new Date().toISOString() }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, live, images, threadId, loadThreads],
  );

  // Prompt handed over from the Home page (?q=…) is sent once.
  useEffect(() => {
    const q = params.get("q");
    if (q && live && !autoSent.current) {
      autoSent.current = true;
      router.replace(`${APP}/agent/`);
      send(q);
    }
  }, [params, live, router, send]);

  const name = status?.user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="-m-4 flex h-[calc(100vh-64px)] gap-4 p-4 sm:-m-6 sm:p-6 lg:-m-8 lg:p-6">
      {/* chats panel */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-line bg-surface p-3 md:flex">
        <button type="button" onClick={newChat} className="btn btn-primary w-full">
          <Icon name="plus" size={18} /> New chat
        </button>
        <nav className="mt-4 space-y-0.5 text-sm">
          {[
            { href: `${APP}/posts/calendar`, icon: "calendar", label: "Calendar" },
            { href: `${APP}/posts/drafts`, icon: "doc", label: "Drafts" },
            { href: `${APP}/posts/contribution`, icon: "checkCircle", label: "Approvals" },
            { href: `${APP}/accounts`, icon: "users", label: "Accounts" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-lg px-3 py-2 text-ink-2 hover:bg-surface-2 hover:text-ink">
              <Icon name={l.icon} size={17} /> {l.label}
            </Link>
          ))}
        </nav>
        <p className="mt-5 px-3 text-xs font-bold uppercase tracking-wider text-muted">Chats</p>
        <ul className="mt-2 flex-1 space-y-0.5 overflow-y-auto">
          {threads.length === 0 && <li className="px-3 py-2 text-sm text-muted">No chats yet.</li>}
          {threads.map((t) => (
            <li key={t.id} className="group relative">
              <button
                type="button"
                onClick={() => openThread(t.id)}
                className={`w-full truncate rounded-lg px-3 py-2 pr-8 text-left text-sm ${threadId === t.id ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2"}`}
              >
                {t.title}
              </button>
              <button
                type="button"
                aria-label="Delete chat"
                className="absolute right-1.5 top-1.5 hidden rounded p-1 text-muted hover:text-danger group-hover:block"
                onClick={() =>
                  confirm("Delete this chat?") &&
                  post("agent_thread_delete", { id: t.id }).then(() => {
                    if (threadId === t.id) newChat();
                    loadThreads();
                  }, reportError)
                }
              >
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* conversation */}
      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-line px-4 py-3">
          <button type="button" onClick={newChat} className="btn btn-ghost btn-sm mr-auto md:hidden">
            <Icon name="plus" size={16} /> New chat
          </button>
          {live && (
            <>
              <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-bold text-ink-2" title="AI messages left today">
                <Icon name="zap" size={14} className="text-accent" /> {status?.credits ?? 0} credits
              </span>
              <label className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs font-bold text-ink-2">
                Auto-publish
                <Toggle
                  label="Auto-publish"
                  on={!!status?.autopublish}
                  onChange={(on) => post<{ autopublish: boolean }>("agent_settings", { autopublish: on }).then((r) => setAutopublishLocal(r.autopublish), reportError)}
                />
              </label>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          {!live && (
            <div className="mx-auto max-w-xl">
              <SetupProblems />
            </div>
          )}
          {live && turns.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <LogoMark size={56} />
              <p className="mt-4 text-2xl font-bold text-ink">Hi {name}</p>
              <p className="mt-1 text-ink-2">Where shall we begin?</p>
              <p className="mt-6 max-w-md text-sm text-muted">
                {status?.autopublish
                  ? "Auto-publish is ON — when you ask the agent to post, it publishes straight away."
                  : "Auto-publish is OFF — posts the agent creates wait for your approval."}
              </p>
            </div>
          )}
          <div className="mx-auto max-w-3xl space-y-5">
            {turns.map((t, k) => (
              <div key={k} className={`flex ${t.role === "user" ? "justify-end" : "justify-start gap-3"}`}>
                {t.role === "assistant" && (
                  <span className="mt-1 shrink-0">
                    <LogoMark size={28} />
                  </span>
                )}
                <div className={`flex max-w-[85%] flex-col gap-2 ${t.role === "user" ? "items-end" : "items-start"}`}>
                  {t.images && t.images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {t.images.map((src) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={src} src={src} alt="" className="h-24 w-24 rounded-xl object-cover ring-1 ring-line" />
                      ))}
                    </div>
                  )}
                  <p
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      t.role === "user" ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-surface-2 text-ink"
                    }`}
                  >
                    {t.text}
                  </p>
                  {t.postIds?.map((id) => <AgentPostCard key={id} id={id} />)}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-3 text-sm text-muted">
                <LogoMark size={28} />
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
        </div>

        <div className="px-4 pb-4 sm:px-8">
          {live && turns.length === 0 && (
            <ul className="mx-auto mb-3 max-w-3xl divide-y divide-line">
              {suggestions.map((s) => (
                <li key={s.text}>
                  <button type="button" onClick={() => send(s.text)} className="flex w-full items-center gap-3 px-2 py-3 text-left text-sm text-ink hover:text-accent">
                    <Icon name={s.icon} size={18} className="text-accent" /> {s.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface-2 p-3 transition-colors focus-within:border-primary"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            {images.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {images.map((src) => (
                  <span key={src} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-14 w-14 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((x) => x !== src))}
                      className="absolute -right-1 -top-1 rounded-full bg-night p-0.5 text-white"
                      aria-label="Remove image"
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              value={text}
              disabled={!live}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              rows={2}
              className="w-full resize-none bg-transparent px-1 text-sm text-ink outline-none focus-visible:outline-none placeholder:text-muted"
              placeholder={live ? "Tell the agent what to post… (Shift+Enter for a new line)" : "The agent needs the server set up first"}
            />
            <div className="mt-1 flex items-center justify-between">
              <button
                type="button"
                disabled={!live || uploading}
                onClick={() => fileRef.current?.click()}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-40"
                aria-label="Attach image"
                title="Attach image"
              >
                <Icon name={uploading ? "clock" : "plus"} size={20} />
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
              <button
                type="submit"
                disabled={busy || !text.trim() || !live}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition-opacity disabled:opacity-40"
                aria-label="Send"
              >
                <Icon name="arrowUpRight" size={18} className="-rotate-45" />
              </button>
            </div>
          </form>
          <p className="mt-2 text-center text-xs text-muted">AI can make mistakes. Double-check posts before publishing.</p>
        </div>
      </section>

      {intro && live && (
        <Modal
          title="Meet your AI Agent"
          onClose={() => {
            setIntro(false);
            try {
              localStorage.setItem(INTRO_KEY, "1");
            } catch {
              /* ignore */
            }
          }}
        >
          <div className="text-center">
            <span className="inline-flex"><LogoMark size={52} /></span>
            <p className="mt-3 text-ink-2">One chat for your whole social media workflow.</p>
          </div>
          <ul className="mt-6 space-y-4">
            {[
              { icon: "sparkles", t: "Writes your posts", d: "Captions in your language and tone, with hashtags" },
              { icon: "calendar", t: "Schedules and publishes", d: "Posts to Facebook and Instagram when you say so" },
              { icon: "checkCircle", t: "Waits for your approval", d: "Keep auto-publish off to review every post first" },
            ].map((f) => (
              <li key={f.t} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-accent">
                  <Icon name={f.icon} size={20} />
                </span>
                <span>
                  <span className="block font-bold text-ink">{f.t}</span>
                  <span className="text-sm text-ink-2">{f.d}</span>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-primary mt-6 w-full"
            onClick={() => {
              setIntro(false);
              try {
                localStorage.setItem(INTRO_KEY, "1");
              } catch {
                /* ignore */
              }
            }}
          >
            Start chatting
          </button>
        </Modal>
      )}
    </div>
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
    <div className="w-full max-w-md rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {p.accountIds.map((aid) => {
          const a = ws.accounts.find((x) => x.id === aid);
          return a ? <SocialIcon key={aid} id={a.network} size={20} rounded="full" /> : null;
        })}
        <span className="text-xs text-muted">Post #{p.id}</span>
        <span className="ml-auto">
          <StatusBadge status={p.status} />
        </span>
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
              publishNow(p.id)
                .catch(reportError)
                .finally(() => setBusy(false));
            }}
            className="btn btn-primary btn-sm disabled:opacity-50"
          >
            <Icon name="send" size={14} /> {busy ? "Publishing…" : "Approve & publish now"}
          </button>
          <Link href={`${APP}/posts/calendar`} className="btn btn-ghost btn-sm">
            Edit / schedule
          </Link>
        </div>
      )}
    </div>
  );
}
