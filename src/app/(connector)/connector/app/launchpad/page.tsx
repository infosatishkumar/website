"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon, { networkMeta } from "@/components/connector/SocialIcon";
import { Card, StatusBadge } from "@/components/connector/app/ui";
import VideoTrigger, { VideoThumb } from "@/components/connector/site/VideoModal";
import { APP, videos } from "@/lib/connector/data";
import { useLive, useWorkspace } from "@/lib/connector/store";

export default function Home() {
  const ws = useWorkspace();
  const { status } = useLive();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [now] = useState(() => Date.now());
  const name = status?.user?.name?.split(" ")[0] ?? "there";

  const upcoming = ws.posts
    .filter((p) => p.status === "scheduled" && new Date(p.scheduledAt).getTime() > now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 5);

  const steps = [
    { done: ws.accounts.length > 0, label: "Connect a social account", href: `${APP}/accounts/create`, icon: "plug" },
    { done: ws.posts.some((p) => p.status === "scheduled" || p.status === "published"), label: "Schedule your first post", href: `${APP}/posts`, icon: "send" },
    { done: ws.groups.length > 0, label: "Group accounts by client", href: `${APP}/groups/create`, icon: "folder" },
    { done: ws.queue.length > 0, label: "Set your queue times", href: `${APP}/queue-templates`, icon: "clock" },
  ];
  const done = steps.filter((s) => s.done).length;

  const stats = [
    { label: "Scheduled", value: ws.posts.filter((p) => p.status === "scheduled").length, icon: "calendar", href: `${APP}/posts/calendar` },
    { label: "Awaiting approval", value: ws.posts.filter((p) => p.status === "pending").length, icon: "checkCircle", href: `${APP}/posts/contribution` },
    { label: "Published", value: ws.posts.filter((p) => p.status === "published").length, icon: "send", href: `${APP}/posts/calendar` },
    { label: "AI credits today", value: status?.loggedIn ? status.credits : "—", icon: "zap", href: `${APP}/agent` },
  ];

  const ask = (text: string) => {
    if (!text.trim()) return;
    router.push(`${APP}/agent/?q=${encodeURIComponent(text.trim())}`);
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* hero */}
      <section className="pb-10 pt-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Hi, {name}! How can I help you today?</h1>
        <form
          className="mx-auto mt-7 flex max-w-2xl items-center gap-2 rounded-full border border-line bg-surface py-2 pl-5 pr-2 shadow-sm transition-colors focus-within:border-primary"
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
        >
          <Icon name="sparkles" size={20} className="shrink-0 text-accent" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-ink outline-none placeholder:text-muted focus-visible:outline-none"
            placeholder="Ask the agent: “Write a Diwali offer post for Instagram”"
          />
          <Link href={`${APP}/posts`} className="hidden rounded-full p-2 text-ink-2 hover:bg-surface-2 sm:block" aria-label="Create post" title="Create post">
            <Icon name="plus" size={20} />
          </Link>
          <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white" aria-label="Ask agent">
            <Icon name="arrowUpRight" size={18} className="-rotate-45" />
          </button>
        </form>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {["Plan this week’s posts", "Write a festive offer post", "What did I post recently?"].map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-2 hover:border-primary hover:text-ink">
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* your business */}
      <h2 className="mb-4 text-xl font-bold text-ink">Your business</h2>
      <div className="space-y-3">
        {ws.accounts.length === 0 ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-tint text-accent">
              <Icon name="plug" size={22} />
            </span>
            <div className="flex-1">
              <p className="font-bold text-ink">Connect your first social account</p>
              <p className="text-sm text-ink-2">Link Facebook, Instagram, LinkedIn, X, YouTube, TikTok and more to start publishing.</p>
            </div>
            <Link href={`${APP}/accounts/create`} className="btn btn-primary">Connect account</Link>
          </div>
        ) : (
          ws.accounts.slice(0, 6).map((a) => (
            <div key={a.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
              <SocialIcon id={a.network} size={42} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">{a.name}</p>
                <p className="text-sm text-muted">
                  {networkMeta[a.network].name}
                  {a.handle ? ` · @${a.handle}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`${APP}/analytics/${a.network === "google" ? "gmb" : a.network}`} className="btn btn-ghost btn-sm border border-line">
                  <Icon name="analytics" size={16} /> Analytics
                </Link>
                <Link href={`${APP}/posts`} className="btn btn-outline btn-sm">Create post</Link>
              </div>
            </div>
          ))
        )}
        {ws.accounts.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-line bg-surface-2 p-4 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-accent">
              <Icon name="plus" size={20} />
            </span>
            <p className="flex-1 text-sm text-ink">Connect more pages, profiles and channels and manage everything in one place.</p>
            <Link href={`${APP}/accounts/create`} className="btn btn-primary btn-sm">Connect</Link>
          </div>
        )}
      </div>

      {/* stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary">
            <Icon name={s.icon} size={20} className="text-accent" />
            <p className="mt-3 text-2xl font-bold text-ink">{s.value}</p>
            <p className="text-sm text-muted">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Upcoming posts" action={<Link href={`${APP}/posts/calendar`} className="text-sm font-bold text-primary">Open calendar</Link>}>
            {upcoming.length === 0 ? (
              <p className="text-ink-2">
                Nothing scheduled ahead.{" "}
                <Link href={`${APP}/posts`} className="font-bold text-primary">Create a post</Link>
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((p) => {
                  const acc = ws.accounts.find((a) => a.id === p.accountIds[0]);
                  return (
                    <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                      <span className="w-36 shrink-0 text-sm font-medium text-ink-2">
                        {new Date(p.scheduledAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {acc && <SocialIcon id={acc.network} size={22} rounded="full" />}
                      <span className="flex-1 truncate text-sm text-ink">{p.text}</span>
                      <StatusBadge status={p.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Tips to improve">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-accent">
                <Icon name="trendUp" size={22} />
              </span>
              <div className="flex-1">
                <p className="font-bold text-ink">Post consistently with queue times</p>
                <p className="text-sm text-ink-2">Set 2–3 daily slots and let “Add to queue” fill them. Accounts that post on a rhythm grow faster.</p>
              </div>
              <Link href={`${APP}/queue-templates`} className="btn btn-ghost btn-sm border border-line">Set up</Link>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Get started" action={<span className="text-sm font-bold text-primary">{done}/{steps.length}</span>}>
            <ul className="space-y-1">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="group flex items-center gap-3 rounded-lg py-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${s.done ? "bg-success text-white" : "bg-primary-tint text-accent"}`}>
                      <Icon name={s.done ? "check" : s.icon} size={16} strokeWidth={s.done ? 2.6 : 1.8} />
                    </span>
                    <span className={`flex-1 text-sm font-medium ${s.done ? "text-muted line-through" : "text-ink group-hover:text-primary"}`}>{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Learn in 2 minutes">
            <VideoTrigger video={videos[0]} className="block w-full text-left">
              <VideoThumb title={videos[0].title} label="Product overview" />
            </VideoTrigger>
          </Card>
        </div>
      </div>
    </div>
  );
}
