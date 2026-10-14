"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import Icon from "../Icon";
import SocialIcon, { networkMeta, type NetworkId } from "../SocialIcon";
import AccountPicker from "./AccountPicker";
import { Card, DemoNote, PageHeader } from "./ui";
import { APP } from "@/lib/connector/data";
import { uploadImage } from "@/lib/connector/api";
import { addPost, type PostStatus, reportError, useLive, useWorkspace, type QueueSlot } from "@/lib/connector/store";

const limits: Record<NetworkId, number> = {
  x: 280, bluesky: 300, threads: 500, pinterest: 500, google: 1500, instagram: 2200,
  tiktok: 2200, linkedin: 3000, youtube: 5000, facebook: 63206, whatsapp: 4096,
};

const tones = ["Friendly", "Professional", "Witty", "Bold"] as const;
const ideas = ["World Mental Health Day", "Diwali sale", "Behind the scenes", "Customer shout-out", "New product launch"];

/** Template-based caption drafts — swap for a real model call when an AI backend is connected. */
function draftCaptions(idea: string, tone: (typeof tones)[number]) {
  const topic = idea.trim() || "our latest update";
  const tag = `#${topic.replace(/[^a-z0-9]+/gi, "")}`;
  const openers: Record<(typeof tones)[number], string[]> = {
    Friendly: ["Hey friends! 👋", "Guess what? 💜", "Big smiles today!"],
    Professional: ["Announcement:", "We're pleased to share:", "Update:"],
    Witty: ["Plot twist:", "Not to brag, but…", "Breaking (news, not hearts):"],
    Bold: ["🚀 Here it is.", "No more waiting.", "This changes everything."],
  };
  return openers[tone].map((o, k) =>
    [
      `${o} ${topic} is here.`,
      ["Tap the link in bio to learn more.", "Tell us what you think in the comments!", "Save this for later and share it with a friend."][k],
      `${tag} #SocialMediaConnector`,
    ].join(" "),
  );
}

function nextQueueSlot(queue: QueueSlot[], taken: string[]) {
  const now = new Date();
  for (let d = 0; d < 21; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const dow = (day.getDay() + 6) % 7;
    const slots = queue.filter((q) => q.day === dow).map((q) => q.time).sort();
    for (const t of slots) {
      const [h, m] = t.split(":").map(Number);
      const at = new Date(day);
      at.setHours(h, m, 0, 0);
      if (at > now && !taken.includes(at.toISOString())) return at;
    }
  }
  const fallback = new Date(now.getTime() + 3600_000);
  return fallback;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function toThumb(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, 320 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.75);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Composer() {
  const ws = useWorkspace();
  const { status: liveStatus } = useLive();
  const live = !!liveStatus?.loggedIn;
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState(params.get("text") ?? "");
  const [media, setMedia] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 2 * 3600_000)));
  const [idea, setIdea] = useState("");
  const [tone, setTone] = useState<(typeof tones)[number]>("Friendly");
  const [drafts, setDrafts] = useState<string[]>([]);
  const [preview, setPreview] = useState<NetworkId | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const nets = useMemo(
    () => Array.from(new Set(ws.accounts.filter((a) => selected.includes(a.id)).map((a) => a.network))),
    [ws.accounts, selected],
  );
  const activePreview = preview && nets.includes(preview) ? preview : nets[0] ?? null;
  const previewAccount = ws.accounts.find((a) => selected.includes(a.id) && a.network === activePreview);
  const over = nets.filter((n) => text.length > limits[n]);
  const canSubmit = selected.length > 0 && text.trim().length > 0 && over.length === 0;

  const insert = (snippet: string) => {
    const el = textRef.current;
    if (!el) return setText((t) => t + snippet);
    const { selectionStart: s, selectionEnd: e } = el;
    setText((t) => t.slice(0, s) + snippet + t.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = s + snippet.length;
    });
  };

  const submit = async (status: PostStatus, mode: "now" | "time" | "queue" | "draft") => {
    if ((!canSubmit && status !== "draft") || busy) return;
    if (live && status !== "draft" && nets.includes("instagram") && media.length === 0) {
      reportError(new Error("Instagram needs at least one image."));
      return;
    }
    let at = new Date();
    if (mode === "time") at = new Date(when);
    if (mode === "queue") at = nextQueueSlot(ws.queue, ws.posts.map((p) => p.scheduledAt));
    setBusy(true);
    try {
      const created = await addPost({ text, accountIds: selected, scheduledAt: at.toISOString(), status, tagIds, media, author: "You" });
      const errors = Object.values(created.result ?? {}).filter((r) => !r.ok).map((r) => r.error);
      const label =
        created.status === "failed"
          ? `Publishing failed: ${errors.join("; ")}`
          : status === "published"
            ? errors.length ? `Published, with errors: ${errors.join("; ")}` : "Published"
            : status === "draft"
              ? "Saved as draft"
              : status === "pending"
                ? "Sent for approval"
                : `Scheduled for ${at.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`;
      setSaved(label);
      setText("");
      setMedia([]);
      setTagIds([]);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Create post" sub="Write once, then tailor for every network." actions={<Link href={`${APP}/posts/calendar`} className="btn btn-outline btn-sm"><Icon name="calendar" size={16} /> Calendar</Link>} />

      {saved && (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-success-tint px-4 py-3 text-sm font-medium text-ink">
          <Icon name="checkCircle" className="text-success" />
          <span className="flex-1">{saved}.</span>
          <button type="button" className="font-bold text-primary" onClick={() => router.push(`${APP}/posts/calendar`)}>View in calendar</button>
          <button type="button" onClick={() => setSaved(null)} aria-label="Dismiss"><Icon name="close" size={16} /></button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[300px_1fr_340px]">
        <Card title="Accounts" className="xl:sticky xl:top-24 xl:self-start">
          {ws.accounts.length === 0 ? (
            <p className="text-sm text-ink-2">No accounts yet. <Link className="font-bold text-primary" href={`${APP}/accounts/create`}>Connect one</Link></p>
          ) : (
            <AccountPicker selected={selected} onChange={setSelected} />
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Media">
            <div className="flex flex-wrap gap-3">
              {media.map((m, k) => (
                <span key={k} className="group relative h-24 w-24 overflow-hidden rounded-xl ring-1 ring-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setMedia(media.filter((_, i) => i !== k))} className="absolute right-1 top-1 rounded-full bg-night/70 p-1 text-white" aria-label="Remove image">
                    <Icon name="close" size={12} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-24 min-w-24 flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-sm text-muted hover:border-primary hover:text-primary"
              >
                <Icon name="upload" />
                Drag and drop or <span className="font-bold text-primary">upload from device</span>
                <span className="text-xs">PNG, JPG, GIF, WEBP</span>
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
                  try {
                    // Live: upload to the server so networks can fetch a public URL.
                    const urls = await Promise.all(files.map(live ? uploadImage : toThumb));
                    setMedia((m) => [...m, ...urls].slice(0, 10));
                  } catch (err) {
                    reportError(err);
                  }
                }}
              />
            </div>
          </Card>

          <Card title="Caption">
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              className="field resize-y"
              placeholder="Write your caption, then customise it for each network or generate one with AI Pilot ✨"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select className="field w-auto py-1.5 text-xs" value="" onChange={(e) => e.target.value && insert(e.target.value)} aria-label="Insert from library">
                <option value="">Insert from library…</option>
                {ws.library.map((l) => <option key={l.id} value={l.value}>{l.title}</option>)}
              </select>
              <select className="field w-auto py-1.5 text-xs" value="" onChange={(e) => e.target.value && insert(e.target.value)} aria-label="Insert custom field">
                <option value="">Custom field…</option>
                {ws.customFields.map((f) => <option key={f.id} value={`{{${f.title}}}`}>{`{{${f.title}}}`}</option>)}
              </select>
              <select className="field w-auto py-1.5 text-xs" value="" onChange={(e) => e.target.value && insert(` ${e.target.value}`)} aria-label="Insert mention group">
                <option value="">Mention group…</option>
                {ws.mentionGroups.map((f) => <option key={f.id} value={f.value}>{f.title}</option>)}
              </select>
              {["😀", "🚀", "💜", "🎉"].map((em) => (
                <button key={em} type="button" onClick={() => insert(em)} className="rounded-lg px-1.5 py-1 hover:bg-canvas">{em}</button>
              ))}
            </div>
            {nets.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {nets.map((n) => {
                  const bad = text.length > limits[n];
                  return (
                    <span key={n} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${bad ? "bg-danger-tint text-danger" : "bg-canvas text-ink-2"}`}>
                      <SocialIcon id={n} size={14} rounded="full" /> {text.length}/{limits[n]}
                    </span>
                  );
                })}
              </div>
            )}
            {ws.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <span className="text-sm font-medium text-ink-2"><Icon name="tag" size={16} className="mr-1 inline" />Tags</span>
                {ws.tags.map((t) => {
                  const on = tagIds.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => setTagIds(on ? tagIds.filter((x) => x !== t.id) : [...tagIds, t.id])}
                      className="rounded-full px-3 py-1 text-xs font-bold ring-1 transition-colors"
                      style={on ? { background: t.color, color: "#fff", borderColor: t.color } : { color: t.color, boxShadow: `inset 0 0 0 1px ${t.color}` }}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Publish">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm font-medium text-ink">
                Schedule for
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="field mt-1.5" />
              </label>
              <button type="button" disabled={!canSubmit || busy} onClick={() => submit("scheduled", "time")} className="btn btn-primary disabled:opacity-40">
                <Icon name="calendar" size={18} /> Schedule
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              <button type="button" disabled={!canSubmit || busy} onClick={() => submit("scheduled", "queue")} className="btn btn-outline btn-sm disabled:opacity-40"><Icon name="clock" size={16} /> Add to queue</button>
              <button type="button" disabled={!canSubmit || busy} onClick={() => submit("published", "now")} className="btn btn-outline btn-sm disabled:opacity-40"><Icon name="send" size={16} /> Post now</button>
              <button type="button" disabled={!canSubmit || busy} onClick={() => submit("pending", "time")} className="btn btn-outline btn-sm disabled:opacity-40"><Icon name="checkCircle" size={16} /> Send for approval</button>
              <button type="button" disabled={!text.trim() || busy} onClick={() => submit("draft", "draft")} className="btn btn-ghost btn-sm disabled:opacity-40"><Icon name="doc" size={16} /> Save draft</button>
            </div>
            {!canSubmit && (
              <p className="mt-3 text-xs text-muted">
                {selected.length === 0 ? "Select at least one account. " : ""}
                {!text.trim() ? "Write a caption. " : ""}
                {over.length > 0 ? `Caption is too long for ${over.map((n) => networkMeta[n].name).join(", ")}.` : ""}
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={<span className="flex items-center gap-2"><Icon name="sparkles" size={18} className="text-primary" />AI Pilot</span>}>
            <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={2} className="field" placeholder="Share your idea, audience and goal…" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tones.map((t) => (
                <button key={t} type="button" onClick={() => setTone(t)} className={`rounded-full px-3 py-1 text-xs font-bold ${tone === t ? "bg-primary text-white" : "bg-canvas text-ink-2"}`}>{t}</button>
              ))}
            </div>
            <button type="button" onClick={() => setDrafts(draftCaptions(idea, tone))} className="btn btn-primary btn-sm mt-3 w-full">Generate</button>
            <p className="mt-4 text-xs font-bold text-muted"><Icon name="zap" size={14} className="mr-1 inline" />Ideas</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ideas.map((i) => (
                <button key={i} type="button" onClick={() => { setIdea(i); setDrafts(draftCaptions(i, tone)); }} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-primary hover:text-primary">{i}</button>
              ))}
            </div>
            {drafts.length > 0 && (
              <ul className="mt-4 space-y-2">
                {drafts.map((d) => (
                  <li key={d} className="rounded-xl bg-primary-soft p-3 text-sm text-ink">
                    {d}
                    <button type="button" onClick={() => setText(d)} className="mt-2 block text-xs font-bold text-primary">Use this caption</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Preview">
            {nets.length === 0 ? (
              <p className="text-sm text-muted">Select accounts to see a preview.</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {nets.map((n) => (
                    <button key={n} type="button" onClick={() => setPreview(n)} className={`rounded-lg p-1 ${activePreview === n ? "ring-2 ring-primary" : ""}`} aria-label={`Preview ${networkMeta[n].name}`}>
                      <SocialIcon id={n} size={24} />
                    </button>
                  ))}
                </div>
                <div className="rounded-xl border border-line">
                  <div className="flex items-center gap-2 p-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-tint text-sm font-bold text-primary">{previewAccount?.name[0] ?? "?"}</span>
                    <span>
                      <span className="block text-sm font-bold text-ink">{previewAccount?.name}</span>
                      <span className="block text-xs text-muted">Just now · {activePreview && networkMeta[activePreview].name}</span>
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap px-3 pb-3 text-sm text-ink">{text || <span className="text-muted">Your caption will appear here.</span>}</p>
                  {media[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={media[0]} alt="" className="aspect-square w-full object-cover" />
                  )}
                  <div className="flex gap-5 border-t border-line p-3 text-muted">
                    <Icon name="heart" size={18} /><Icon name="chat" size={18} /><Icon name="share" size={18} />
                  </div>
                </div>
              </>
            )}
          </Card>
          {!live && <DemoNote>Demo mode: posts are saved to this browser only. On your Hostinger site with the backend set up, they publish for real.</DemoNote>}
        </div>
      </div>
    </>
  );
}
