"use client";

import { useEffect, useRef, useState } from "react";
import type { Credentials } from "@/lib/social/types";
import type { PendingAction } from "@/lib/social/actions";

type ChatFile = { id: string; name: string; mime: string; data: string; fileId: string; preview: string };
type CardStatus = "pending" | "running" | "done" | "error" | "rejected";
type Card = PendingAction & { status: CardStatus; result?: string };
type Entry = { role: "user" | "agent" | "error"; text: string; images?: string[]; cards?: Card[] };

const STORE = { creds: "sa.creds", chat: "sa.chat", auto: "sa.auto" };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked; the page still works for this visit
  }
}

const ACTION_LABELS: Record<string, string> = {
  fb_create_post: "Facebook par post",
  fb_upload_video: "Facebook par video",
  fb_comment: "Facebook comment / reply",
  fb_send_message: "Messenger message",
  ig_publish: "Instagram par post",
  ig_reply_comment: "Instagram comment ka reply",
  ig_comment: "Instagram comment",
  ig_send_message: "Instagram DM",
  yt_upload_video: "YouTube par video upload",
  yt_reply_comment: "YouTube comment ka reply",
  yt_comment: "YouTube comment",
  x_post: "X (Twitter) par post",
  x_send_dm: "X par DM",
  linkedin_post: "LinkedIn par post",
};
const EDITABLE = ["message", "text", "caption", "title", "description"];

type Field = { key: keyof Credentials; label: string; secret?: boolean; placeholder?: string };
type Section = { id: string; title: string; test?: string; required: (keyof Credentials)[]; fields: Field[]; steps: React.ReactNode[] };

const ext = (href: string, label: string) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline decoration-accent underline-offset-2">
    {label}
  </a>
);

const SECTIONS: Section[] = [
  {
    id: "anthropic",
    title: "Claude AI (zaroori)",
    required: ["anthropicKey"],
    fields: [{ key: "anthropicKey", label: "Anthropic API key", secret: true, placeholder: "sk-ant-..." }],
    steps: [
      <>{ext("https://console.anthropic.com/settings/keys", "console.anthropic.com")} par login karein.</>,
      <>&quot;Create Key&quot; dabayein, key copy karke yahan paste karein.</>,
      <>Billing me thode credits add karein. Har message ka chhota sa kharcha aata hai.</>,
    ],
  },
  {
    id: "meta",
    title: "Facebook Page + Instagram",
    test: "meta",
    required: ["fbPageId", "fbPageToken"],
    fields: [
      { key: "fbPageId", label: "Facebook Page ID", placeholder: "1234567890" },
      { key: "fbPageToken", label: "Page access token", secret: true, placeholder: "EAAG..." },
      { key: "igUserId", label: "Instagram account ID (optional)", placeholder: "1784..." },
    ],
    steps: [
      <>Instagram ko Professional (Business/Creator) account banayein aur apne Facebook Page se link karein.</>,
      <>{ext("https://developers.facebook.com/apps", "developers.facebook.com")} par &quot;Business&quot; type app banayein.</>,
      <>
        {ext("https://developers.facebook.com/tools/explorer", "Graph API Explorer")} me apna app aur Page chunein,
        permissions add karein: pages_show_list, pages_read_engagement, pages_manage_posts,
        pages_manage_engagement, pages_messaging, instagram_basic, instagram_content_publish,
        instagram_manage_comments, instagram_manage_messages.
      </>,
      <>
        &quot;Generate Access Token&quot; dabayein, phir {ext("https://developers.facebook.com/tools/debug/accesstoken", "Token Debugger")} me
        &quot;Extend&quot; karke long-lived token banayein. Page token yahan paste karein.
      </>,
      <>Explorer me <code>me/accounts</code> chalayein, wahan Page ID milega. Instagram ID ke liye <code>{"{page-id}?fields=instagram_business_account"}</code>.</>,
    ],
  },
  {
    id: "youtube",
    title: "YouTube",
    test: "youtube",
    required: ["ytClientId", "ytClientSecret", "ytRefreshToken"],
    fields: [
      { key: "ytClientId", label: "Google OAuth Client ID" },
      { key: "ytClientSecret", label: "Client secret", secret: true },
      { key: "ytRefreshToken", label: "Refresh token", secret: true },
    ],
    steps: [
      <>{ext("https://console.cloud.google.com/apis/library/youtube.googleapis.com", "Google Cloud")} me YouTube Data API v3 enable karein.</>,
      <>OAuth client banayein (type: Web application), redirect URI me <code>https://developers.google.com/oauthplayground</code> daalein.</>,
      <>
        {ext("https://developers.google.com/oauthplayground", "OAuth Playground")} me settings (⚙️) me apna client daalein, scopes
        <code> youtube.force-ssl</code> aur <code>youtube.upload</code> chunein, apne channel se login karein, refresh token copy karein.
      </>,
    ],
  },
  {
    id: "x",
    title: "X (Twitter)",
    test: "x",
    required: ["xAccessToken"],
    fields: [{ key: "xAccessToken", label: "OAuth 2.0 user access token", secret: true }],
    steps: [
      <>{ext("https://developer.x.com/en/portal/dashboard", "developer.x.com")} par app banayein, User authentication (OAuth 2.0) on karein.</>,
      <>Scopes: tweet.read tweet.write users.read media.write dm.read dm.write offline.access. User access token yahan paste karein.</>,
      <>Mentions aur DMs ke liye X ka paid API plan lagta hai.</>,
    ],
  },
  {
    id: "linkedin",
    title: "LinkedIn",
    test: "linkedin",
    required: ["linkedinToken", "linkedinAuthorUrn"],
    fields: [
      { key: "linkedinToken", label: "Access token", secret: true },
      { key: "linkedinAuthorUrn", label: "Author URN", placeholder: "urn:li:person:abc123" },
    ],
    steps: [
      <>{ext("https://www.linkedin.com/developers/apps", "LinkedIn Developers")} par app banayein, &quot;Share on LinkedIn&quot; aur &quot;Sign In with LinkedIn&quot; products add karein.</>,
      <>{ext("https://www.linkedin.com/developers/tools/oauth/token-generator", "Token generator")} se openid, profile, w_member_social scopes ke saath token banayein.</>,
      <>Token yahan daal kar &quot;Test&quot; dabayein. Author URN = <code>urn:li:person:</code> + aapki LinkedIn id (userinfo ka &quot;sub&quot;).</>,
    ],
  },
];

const connected = (creds: Credentials, s: Section) => s.required.every((k) => creds[k]?.trim());

/** Shrinks big photos so uploads stay fast; GIFs are kept as they are. */
async function prepareImage(file: File): Promise<{ name: string; mime: string; data: string; preview: string }> {
  const readDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  if (file.type === "image/gif") {
    if (file.size > 4_000_000) throw new Error("GIF 4MB se chhota hona chahiye");
    const url = await readDataUrl(file);
    return { name: file.name, mime: file.type, data: url.split(",")[1], preview: url };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.88);
  return { name: file.name.replace(/\.\w+$/, "") + ".jpg", mime: "image/jpeg", data: url.split(",")[1], preview: url };
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
  if (!res.ok && data.ok === undefined) throw new Error(data.error ?? `Server error ${res.status}`);
  return data;
}

export default function AgentApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"chat" | "settings">("chat");
  const [creds, setCreds] = useState<Credentials>({});
  const [autoApprove, setAutoApprove] = useState(false);
  const [history, setHistory] = useState<unknown[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [counter, setCounter] = useState(0);
  const [files, setFiles] = useState<Record<string, ChatFile>>({});
  const [draft, setDraft] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Restore what this browser saved last time (localStorage is only readable after mount).
    const c = load<Credentials>(STORE.creds, {});
    setCreds(c);
    setAutoApprove(load(STORE.auto, false));
    const chat = load<{ history: unknown[]; entries: Entry[]; counter: number; notes: string[] }>(STORE.chat, {
      history: [],
      entries: [],
      counter: 0,
      notes: [],
    });
    setHistory(chat.history);
    setEntries(chat.entries);
    setCounter(chat.counter);
    setNotes(chat.notes ?? []);
    if (!c.anthropicKey) setTab("settings");
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(STORE.creds, creds);
  }, [creds, ready]);
  useEffect(() => {
    if (ready) save(STORE.auto, autoApprove);
  }, [autoApprove, ready]);
  useEffect(() => {
    if (ready) save(STORE.chat, { history, entries, counter, notes });
  }, [history, entries, counter, notes, ready]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, busy]);

  const updateCard = (id: string, patch: Partial<Card>) =>
    setEntries((all) =>
      all.map((e) => (e.cards ? { ...e, cards: e.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) } : e)),
    );

  async function approve(card: Card, input: Record<string, unknown>) {
    updateCard(card.id, { status: "running", input });
    const imageId = typeof input.image_id === "string" ? input.image_id : undefined;
    const file = imageId ? files[imageId] : undefined;
    try {
      const res = await postJson("/api/agent/execute", {
        creds,
        name: card.name,
        input,
        files: file ? [{ id: file.id, name: file.name, mime: file.mime, data: file.data }] : [],
      });
      const label = ACTION_LABELS[card.name] ?? card.name;
      if (res.ok) {
        const result = typeof res.result === "string" ? res.result : JSON.stringify(res.result);
        updateCard(card.id, { status: "done", result });
        setNotes((n) => [...n, `- ${label} (${card.name}): APPROVED and done. Result: ${result.slice(0, 300)}`]);
      } else {
        updateCard(card.id, { status: "error", result: res.error });
        setNotes((n) => [...n, `- ${label} (${card.name}): approved but FAILED: ${String(res.error).slice(0, 300)}`]);
      }
    } catch (err) {
      updateCard(card.id, { status: "error", result: (err as Error).message });
    }
  }

  function reject(card: Card) {
    updateCard(card.id, { status: "rejected" });
    setNotes((n) => [...n, `- ${ACTION_LABELS[card.name] ?? card.name} (${card.name}): REJECTED by the owner, not sent.`]);
  }

  async function attach(list: FileList | null) {
    if (!list?.length) return;
    if (!creds.anthropicKey) {
      setTab("settings");
      return;
    }
    setUploading(true);
    let n = counter;
    try {
      for (const f of Array.from(list).slice(0, 6)) {
        if (!f.type.startsWith("image/")) continue;
        const img = await prepareImage(f);
        const { fileId } = await postJson("/api/agent/upload", { anthropicKey: creds.anthropicKey, ...img });
        n += 1;
        const id = `img_${n}`;
        setFiles((all) => ({ ...all, [id]: { id, fileId, ...img } }));
        setDraft((d) => [...d, id]);
      }
    } catch (err) {
      setEntries((all) => [...all, { role: "error", text: `Image upload nahi hui: ${(err as Error).message}` }]);
    } finally {
      setCounter(n);
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send() {
    const message = input.trim();
    if ((!message && !draft.length) || busy) return;
    if (!creds.anthropicKey) {
      setTab("settings");
      return;
    }
    const images = draft.map((id) => files[id]).filter(Boolean);
    const text = notes.length ? `[Action results]\n${notes.join("\n")}\n\n${message}` : message;
    setEntries((all) => [...all, { role: "user", text: message, images: draft }]);
    setInput("");
    setBusy(true);
    try {
      const res = await postJson("/api/agent", {
        creds,
        history,
        text,
        images: images.map((f) => ({ id: f.id, name: f.name, fileId: f.fileId })),
      });
      const cards: Card[] = res.pending.map((p: PendingAction) => ({ ...p, status: "pending" }));
      setHistory(res.history);
      setNotes([]);
      setDraft([]);
      setEntries((all) => [...all, { role: "agent", text: res.replies.join("\n\n"), cards }]);
      if (autoApprove) for (const c of cards) void approve(c, c.input);
    } catch (err) {
      setEntries((all) => [...all, { role: "error", text: (err as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    if (!confirm("Nayi chat shuru karein? Purani baatcheet mit jayegi.")) return;
    setHistory([]);
    setEntries([]);
    setNotes([]);
    setDraft([]);
  }

  if (!ready) return <p className="py-20 text-center text-ink-soft">Loading…</p>;

  const connectedNames = SECTIONS.filter((s) => s.id !== "anthropic" && connected(creds, s)).map((s) => s.title);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">
            Social Agent<span className="text-accent">.</span>
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {connectedNames.length ? `Connected: ${connectedNames.join(", ")}` : "Abhi koi platform connected nahi hai"}
          </p>
        </div>
        <div className="flex rounded-full border border-line p-1 text-sm">
          {(["chat", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 transition-colors ${tab === t ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
            >
              {t === "chat" ? "💬 Chat" : "⚙️ Settings"}
            </button>
          ))}
        </div>
      </header>

      {tab === "settings" ? (
        <Settings creds={creds} setCreds={setCreds} />
      ) : (
        <div className="flex flex-col overflow-hidden rounded-3xl border border-line bg-paper-2/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 text-sm sm:px-5">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="accent-[var(--accent)]" />
              Bina pooche post karo (auto-approve)
            </label>
            <button onClick={newChat} className="text-ink-soft hover:text-ink">
              + Nayi chat
            </button>
          </div>

          <div ref={listRef} data-lenis-prevent className="flex h-[58vh] min-h-[360px] flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-5">
            {!entries.length && <Welcome onPick={setInput} />}
            {entries.map((e, i) => (
              <Bubble key={i} entry={e} files={files} onApprove={approve} onReject={reject} />
            ))}
            {busy && <p className="animate-pulse text-sm text-ink-soft">Agent kaam kar raha hai…</p>}
          </div>

          {(draft.length > 0 || uploading) && (
            <div className="flex flex-wrap gap-2 border-t border-line px-4 pt-3 sm:px-5">
              {draft.map((id) => (
                <div key={id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={files[id]?.preview} alt={files[id]?.name} className="size-16 rounded-xl object-cover" />
                  <button
                    onClick={() => setDraft((d) => d.filter((x) => x !== id))}
                    aria-label="Remove image"
                    className="absolute -right-1.5 -top-1.5 size-6 rounded-full bg-ink text-xs text-paper"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {uploading && <span className="self-center text-sm text-ink-soft">Image upload ho rahi hai…</span>}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-end gap-2 border-t border-line p-3 sm:p-4"
          >
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void attach(e.target.files)} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Image attach karein"
              title="Image attach karein"
              className="grid size-12 shrink-0 place-items-center rounded-full border border-line text-xl transition-colors hover:border-ink disabled:opacity-50"
            >
              🖼️
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="Kya karna hai, likhiye…"
              className="max-h-40 min-h-12 flex-1 resize-none rounded-3xl border border-line bg-paper px-4 py-3 outline-none focus:border-ink"
            />
            <button
              type="submit"
              disabled={busy || uploading || (!input.trim() && !draft.length)}
              className="h-12 shrink-0 rounded-full bg-ink px-6 text-paper transition-colors hover:bg-accent disabled:opacity-40"
            >
              Bhejo
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Welcome({ onPick }: { onPick: (s: string) => void }) {
  const ideas = [
    "Mere Facebook page ke latest posts dikhao",
    "Instagram ke last post ke comments dikhao aur sabka reply draft karo",
    "Is photo ke liye caption likho aur Instagram, Facebook, X teeno pe post karo",
    "Messenger me kisne message kiya hai?",
    "YouTube ke naye comments ka reply karo",
  ];
  return (
    <div className="m-auto max-w-md text-center">
      <p className="font-display text-3xl">Namaste 👋</p>
      <p className="mt-2 text-sm text-ink-soft">
        Mujhe batayein kya karna hai. Photo attach karne ke liye 🖼️ dabayein. Kuch bhi post ya send karne se pehle main aapse
        Approve karwaunga.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        {ideas.map((i) => (
          <button key={i} onClick={() => onPick(i)} className="rounded-2xl border border-line px-4 py-2.5 text-left text-sm hover:border-ink">
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

function Bubble({
  entry,
  files,
  onApprove,
  onReject,
}: {
  entry: Entry;
  files: Record<string, ChatFile>;
  onApprove: (c: Card, input: Record<string, unknown>) => void;
  onReject: (c: Card) => void;
}) {
  if (entry.role === "user") {
    return (
      <div className="ml-auto flex max-w-[85%] flex-col items-end gap-2">
        {!!entry.images?.length && (
          <div className="flex flex-wrap justify-end gap-2">
            {entry.images.map((id) =>
              files[id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={files[id].preview} alt={files[id].name} className="h-28 rounded-2xl object-cover" />
              ) : (
                <span key={id} className="rounded-xl border border-line px-3 py-2 text-xs text-ink-soft">
                  🖼️ {id}
                </span>
              ),
            )}
          </div>
        )}
        {entry.text && <p className="whitespace-pre-wrap rounded-3xl rounded-br-md bg-ink px-4 py-2.5 text-paper">{entry.text}</p>}
      </div>
    );
  }
  if (entry.role === "error") {
    return <p className="max-w-[85%] rounded-2xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm">⚠️ {entry.text}</p>;
  }
  return (
    <div className="flex max-w-[92%] flex-col gap-3">
      {entry.text && <p className="whitespace-pre-wrap rounded-3xl rounded-bl-md bg-paper px-4 py-2.5 shadow-sm">{entry.text}</p>}
      {entry.cards?.map((c) => <ApprovalCard key={c.id} card={c} files={files} onApprove={onApprove} onReject={onReject} />)}
    </div>
  );
}

function ApprovalCard({
  card,
  files,
  onApprove,
  onReject,
}: {
  card: Card;
  files: Record<string, ChatFile>;
  onApprove: (c: Card, input: Record<string, unknown>) => void;
  onReject: (c: Card) => void;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(card.input);
  const open = card.status === "pending";
  const image = typeof draft.image_id === "string" ? files[draft.image_id] : undefined;
  const badge: Record<CardStatus, string> = {
    pending: "Aapki approval chahiye",
    running: "Bhej rahe hain…",
    done: "✅ Ho gaya",
    error: "❌ Nahi hua",
    rejected: "Cancel kiya",
  };

  return (
    <div className={`rounded-2xl border bg-paper p-4 ${open ? "border-accent" : "border-line opacity-90"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{ACTION_LABELS[card.name] ?? card.name}</p>
        <span className="text-xs text-ink-soft">{badge[card.status]}</span>
      </div>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.preview} alt={image.name} className="mt-3 h-32 rounded-xl object-cover" />
      )}
      <div className="mt-3 flex flex-col gap-2 text-sm">
        {Object.entries(draft).map(([k, v]) =>
          k === "image_id" ? null : EDITABLE.includes(k) && typeof v === "string" ? (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-xs text-ink-soft">{k}</span>
              <textarea
                value={v}
                disabled={!open}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                rows={Math.min(8, Math.max(2, v.split("\n").length + 1))}
                className="resize-y rounded-xl border border-line bg-paper-2/40 px-3 py-2 outline-none focus:border-ink disabled:opacity-80"
              />
            </label>
          ) : (
            <p key={k} className="break-all">
              <span className="text-ink-soft">{k}: </span>
              {typeof v === "string" ? v : JSON.stringify(v)}
            </p>
          ),
        )}
      </div>
      {open && (
        <div className="mt-4 flex gap-2">
          <button onClick={() => onApprove(card, draft)} className="whitespace-nowrap rounded-full bg-ink px-5 py-2 text-sm text-paper hover:bg-accent">
            ✓ Approve, bhej do
          </button>
          <button onClick={() => onReject(card)} className="whitespace-nowrap rounded-full border border-line px-5 py-2 text-sm hover:border-ink">
            ✕ Cancel
          </button>
        </div>
      )}
      {card.result && card.status !== "pending" && (
        <p className="mt-3 break-all text-xs text-ink-soft">{card.result.slice(0, 400)}</p>
      )}
    </div>
  );
}

function Settings({ creds, setCreds }: { creds: Credentials; setCreds: (c: Credentials) => void }) {
  const [tests, setTests] = useState<Record<string, string>>({});

  async function test(section: Section) {
    setTests((t) => ({ ...t, [section.id]: "Check ho raha hai…" }));
    try {
      const res = await postJson("/api/agent/test", { creds, platform: section.test });
      setTests((t) => ({
        ...t,
        [section.id]: res.ok ? `✅ ${Object.values(res.result as Record<string, string>).join(" · ")}` : `❌ ${res.error}`,
      }));
    } catch (err) {
      setTests((t) => ({ ...t, [section.id]: `❌ ${(err as Error).message}` }));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-line bg-paper-2/40 p-5 text-sm leading-relaxed">
        <p className="font-medium">🔒 Password kyun nahi maanga jaata?</p>
        <p className="mt-1 text-ink-soft">
          Facebook, Instagram, YouTube, X aur LinkedIn kisi bhi app ko aapke password se login nahi karne dete. Aisa karne par
          account block bhi ho sakta hai. Isliye har platform ek <b>access token</b> deta hai. Ye password ki tarah kaam karta
          hai, lekin sirf utni permission deta hai jitni aap chunte ho, aur aap use kabhi bhi cancel kar sakte ho. Neeche har
          platform ke steps diye hain.
        </p>
        <p className="mt-2 text-ink-soft">Saari keys sirf isi browser me save hoti hain. Website ke server par kuch save nahi hota.</p>
      </div>

      {SECTIONS.map((s) => (
        <div key={s.id} className="rounded-3xl border border-line p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl">{s.title}</h2>
            <span className={`text-xs ${connected(creds, s) ? "text-green-700" : "text-ink-soft"}`}>
              {connected(creds, s) ? "● Connected" : "○ Not connected"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {s.fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                <span className="text-ink-soft">{f.label}</span>
                <input
                  type={f.secret ? "password" : "text"}
                  value={creds[f.key] ?? ""}
                  placeholder={f.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value.trim() })}
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-ink"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {s.test && (
              <button
                onClick={() => void test(s)}
                disabled={!connected(creds, s)}
                className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-ink disabled:opacity-40"
              >
                Test connection
              </button>
            )}
            {tests[s.id] && <span className="break-all text-sm">{tests[s.id]}</span>}
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink-soft hover:text-ink">Ye keys kahaan se milengi?</summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-ink-soft">
              {s.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </details>
        </div>
      ))}

      <button
        onClick={() => confirm("Saari keys is browser se hata dein?") && setCreds({})}
        className="self-start text-sm text-ink-soft underline hover:text-accent"
      >
        Saari keys hatao
      </button>
    </div>
  );
}
