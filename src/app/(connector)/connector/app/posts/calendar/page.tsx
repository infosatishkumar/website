"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon from "@/components/connector/SocialIcon";
import { AccountChip, Modal, PageHeader, StatusBadge } from "@/components/connector/app/ui";
import { APP } from "@/lib/connector/data";
import { patchPost, removePost, type Post, useWorkspace, weekStart } from "@/lib/connector/store";

type View = "list" | "day" | "week" | "month";

const holidays: Record<string, string> = {
  "01-01": "New Year's Day", "01-26": "Republic Day", "02-14": "Valentine's Day", "03-08": "Women's Day",
  "04-22": "Earth Day", "05-01": "Labour Day", "06-21": "Yoga Day", "08-15": "Independence Day",
  "10-02": "Gandhi Jayanti", "10-10": "World Mental Health Day", "10-31": "Halloween", "11-08": "Diwali",
  "11-27": "Black Friday", "12-25": "Christmas", "12-31": "New Year's Eve",
};

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const holidayOf = (d: Date) => holidays[`${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`];
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

export default function CalendarPage() {
  const ws = useWorkspace();
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [account, setAccount] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const posts = useMemo(
    () =>
      ws.posts
        .filter((p) => (account === "all" || p.accountIds.includes(account)) && (status === "all" || p.status === status))
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [ws.posts, account, status],
  );
  const onDay = (d: Date) => posts.filter((p) => sameDay(new Date(p.scheduledAt), d));

  const range = useMemo(() => {
    if (view === "day") return [new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())];
    if (view === "month") {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const start = weekStart(first);
      return Array.from({ length: 42 }, (_, i) => addDays(start, i));
    }
    const start = weekStart(cursor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [view, cursor]);

  const step = (dir: number) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "day") d.setDate(d.getDate() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCursor(d);
  };

  const title =
    view === "month"
      ? cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : view === "day"
        ? cursor.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
        : `${range[0].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${range[6].toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;

  const moveTo = (id: string, day: Date) => {
    const p = ws.posts.find((x) => x.id === id);
    if (!p) return;
    const old = new Date(p.scheduledAt);
    const next = new Date(day);
    next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    patchPost(id, { scheduledAt: next.toISOString() });
  };

  const dropProps = (day: Date) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(day.toDateString());
    },
    onDragLeave: () => setDragOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      moveTo(e.dataTransfer.getData("text/plain"), day);
    },
  });

  const today = new Date();
  const listPosts = posts.filter((p) => {
    const d = new Date(p.scheduledAt);
    return d >= range[0] && d < addDays(range[range.length - 1], 1);
  });

  return (
    <>
      <PageHeader title="Calendar" sub="Drag a post to another day to reschedule it." actions={<Link href={`${APP}/posts`} className="btn btn-primary"><Icon name="plus" size={18} /> Create post</Link>} />

      <div className="card mb-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} className="rounded-lg border border-line p-2 hover:bg-canvas" aria-label="Previous"><Icon name="chevronLeft" size={18} /></button>
          <button type="button" onClick={() => setCursor(new Date())} className="btn btn-ghost btn-sm border border-line">Today</button>
          <button type="button" onClick={() => step(1)} className="rounded-lg border border-line p-2 hover:bg-canvas" aria-label="Next"><Icon name="chevronRight" size={18} /></button>
          <p className="ml-2 font-bold text-ink">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <select value={account} onChange={(e) => setAccount(e.target.value)} className="field w-auto py-2 text-sm" aria-label="Filter by account">
            <option value="all">All accounts</option>
            {ws.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="field w-auto py-2 text-sm" aria-label="Filter by status">
            <option value="all">All statuses</option>
            {["scheduled", "pending", "published", "draft"].map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          <div className="flex overflow-hidden rounded-lg border border-line">
            {(["list", "day", "week", "month"] as View[]).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} className={`px-3 py-2 text-sm font-bold capitalize ${view === v ? "bg-primary text-white" : "text-ink-2 hover:bg-canvas"}`}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      {view === "list" || view === "day" ? (
        <div className="card divide-y divide-line">
          {(view === "day" ? onDay(range[0]) : listPosts).length === 0 && <p className="p-8 text-center text-muted">No posts in this period.</p>}
          {(view === "day" ? onDay(range[0]) : listPosts).map((p) => (
            <button key={p.id} type="button" onClick={() => setOpenId(p.id)} className="flex w-full flex-col gap-2 p-4 text-left hover:bg-canvas sm:flex-row sm:items-center sm:gap-4">
              <span className="w-40 shrink-0 text-sm font-bold text-ink">
                {new Date(p.scheduledAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {time(p.scheduledAt)}
              </span>
              <span className="flex -space-x-1">
                {p.accountIds.map((id) => {
                  const a = ws.accounts.find((x) => x.id === id);
                  return a ? <SocialIcon key={id} id={a.network} size={22} rounded="full" /> : null;
                })}
              </span>
              <span className="flex-1 truncate text-sm text-ink-2">{p.text}</span>
              <StatusBadge status={p.status} />
            </button>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <div className="grid min-w-[840px] grid-cols-7">
            {range.slice(0, 7).map((d) => (
              <div key={`h-${d.toDateString()}`} className="border-b border-line p-3 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{d.toLocaleDateString("en-IN", { weekday: "short" })}</p>
                {view === "week" && (
                  <p className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${sameDay(d, today) ? "bg-primary text-white" : "text-ink"}`}>{d.getDate()}</p>
                )}
              </div>
            ))}
            {range.map((d) => {
              const list = onDay(d);
              const holiday = holidayOf(d);
              const outside = view === "month" && d.getMonth() !== cursor.getMonth();
              const shown = view === "month" ? list.slice(0, 3) : list;
              return (
                <div
                  key={d.toISOString()}
                  {...dropProps(d)}
                  className={`group/cell flex flex-col gap-1.5 border-b border-r border-line p-2 transition-colors ${view === "month" ? "min-h-32" : "min-h-[480px]"} ${outside ? "bg-canvas/60" : ""} ${dragOver === d.toDateString() ? "bg-primary-soft" : ""}`}
                >
                  {view === "month" && (
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${sameDay(d, today) ? "bg-primary text-white" : outside ? "text-muted" : "text-ink"}`}>{d.getDate()}</span>
                  )}
                  {holiday && (
                    <span className="flex items-center gap-1 rounded-md bg-success-tint px-2 py-1 text-[11px] font-bold text-success">
                      <Icon name="sparkles" size={12} /> {holiday}
                    </span>
                  )}
                  {shown.map((p) => <PostCard key={p.id} post={p} compact={view === "month"} onOpen={() => setOpenId(p.id)} />)}
                  {view === "month" && list.length > 3 && (
                    <button type="button" className="text-left text-xs font-bold text-primary" onClick={() => { setCursor(d); setView("day"); }}>+{list.length - 3} more</button>
                  )}
                  {view === "week" && (
                    <Link href={`${APP}/posts`} className="mt-auto flex items-center justify-center gap-1 rounded-md py-1 text-xs font-bold text-primary opacity-0 transition-opacity hover:bg-primary-soft focus:opacity-100 group-hover/cell:opacity-100">
                      <Icon name="plus" size={14} /> Post
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openId && <PostModal id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function PostCard({ post, compact, onOpen }: { post: Post; compact: boolean; onOpen: () => void }) {
  const ws = useWorkspace();
  const first = ws.accounts.find((a) => a.id === post.accountIds[0]);
  const tag = ws.tags.find((t) => post.tagIds.includes(t.id));
  return (
    <button
      type="button"
      draggable={post.status !== "published"}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", post.id)}
      onClick={onOpen}
      className="group w-full cursor-grab rounded-lg border border-line bg-white p-2 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
      style={tag ? { borderLeft: `3px solid ${tag.color}` } : undefined}
    >
      <span className="flex items-center gap-1.5">
        {first && <SocialIcon id={first.network} size={14} rounded="full" />}
        <span className="truncate text-[11px] font-bold text-ink">{first?.name ?? "Account removed"}</span>
        <span className="ml-auto shrink-0 text-[10px] text-muted">{time(post.scheduledAt)}</span>
      </span>
      {!compact && (
        <>
          <span className="mt-1.5 line-clamp-2 block text-[11px] leading-snug text-ink-2">{post.text}</span>
          {post.media[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.media[0]} alt="" className="mt-1.5 h-14 w-full rounded object-cover" />
          )}
          <span className="mt-1.5 flex items-center justify-between">
            <StatusBadge status={post.status} />
            {post.accountIds.length > 1 && <span className="text-[10px] text-muted">+{post.accountIds.length - 1}</span>}
          </span>
        </>
      )}
    </button>
  );
}

function PostModal({ id, onClose }: { id: string; onClose: () => void }) {
  const ws = useWorkspace();
  const post = ws.posts.find((p) => p.id === id);
  const [text, setText] = useState(post?.text ?? "");
  const [when, setWhen] = useState(() => {
    if (!post) return "";
    const d = new Date(post.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  if (!post) return null;
  const editable = post.status !== "published";
  return (
    <Modal title="Post details" onClose={onClose}>
      <div className="mb-4 flex flex-wrap gap-3">
        {post.accountIds.map((aid) => {
          const a = ws.accounts.find((x) => x.id === aid);
          return a ? <AccountChip key={aid} account={a} small /> : null;
        })}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={!editable} rows={5} className="field" />
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm font-medium text-ink">
          Scheduled for
          <input type="datetime-local" value={when} disabled={!editable} onChange={(e) => setWhen(e.target.value)} className="field mt-1.5" />
        </label>
        <StatusBadge status={post.status} />
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-2">
        <button type="button" className="btn btn-ghost text-danger" onClick={() => { if (confirm("Delete this post?")) { removePost(post.id); onClose(); } }}>
          <Icon name="trash" size={18} /> Delete
        </button>
        <div className="flex flex-wrap gap-2">
          {post.status === "pending" && (
            <button type="button" className="btn btn-outline" onClick={() => { patchPost(post.id, { status: "scheduled" }); onClose(); }}>Approve</button>
          )}
          {editable && (
            <button type="button" className="btn btn-primary" onClick={() => { patchPost(post.id, { text, scheduledAt: new Date(when).toISOString(), status: post.status === "draft" ? "scheduled" : post.status }); onClose(); }}>
              {post.status === "draft" ? "Schedule" : "Save changes"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
