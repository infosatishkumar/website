"use client";

import Link from "next/link";
import { useState } from "react";
import Icon, { IconTile } from "@/components/connector/Icon";
import { Card, StatusBadge, AccountChip } from "@/components/connector/app/ui";
import VideoTrigger, { VideoThumb } from "@/components/connector/site/VideoModal";
import { APP, videos } from "@/lib/connector/data";
import { useWorkspace } from "@/lib/connector/store";

export default function Launchpad() {
  const ws = useWorkspace();
  const [now] = useState(() => Date.now());
  const upcoming = ws.posts
    .filter((p) => p.status === "scheduled" && new Date(p.scheduledAt).getTime() > now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 5);

  const steps = [
    { done: ws.accounts.length > 0, label: "Connect a social account", href: `${APP}/accounts/create`, icon: "plug" },
    { done: ws.posts.some((p) => p.author === "You" && p.status === "scheduled"), label: "Schedule your first post", href: `${APP}/posts`, icon: "send" },
    { done: ws.groups.length > 0, label: "Group accounts by client", href: `${APP}/groups/create`, icon: "folder" },
    { done: ws.queue.length > 0, label: "Set your queue times", href: `${APP}/queue-templates`, icon: "clock" },
    { done: false, label: "Build your first report", href: `${APP}/reports`, icon: "report" },
  ];
  const done = steps.filter((s) => s.done).length;

  const counts = [
    { label: "Connected accounts", value: ws.accounts.length, icon: "users", href: `${APP}/accounts` },
    { label: "Scheduled posts", value: ws.posts.filter((p) => p.status === "scheduled").length, icon: "calendar", href: `${APP}/posts/calendar` },
    { label: "Awaiting approval", value: ws.posts.filter((p) => p.status === "pending").length, icon: "checkCircle", href: `${APP}/posts/contribution` },
    { label: "Unread messages", value: ws.inbox.filter((c) => !c.read).length, icon: "inbox", href: `${APP}/inbox` },
  ];

  return (
    <>
      <div className="hero-glow relative mb-6 overflow-hidden rounded-2xl p-6 text-white sm:p-8">
        <div className="dot-grid absolute inset-0 opacity-50" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-meteorite">Launchpad</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Welcome back! Let&apos;s grow every channel.</h1>
            <p className="mt-2 text-white/70">You&apos;ve completed {done} of {steps.length} setup steps.</p>
            <div className="mt-4 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`${APP}/posts`} className="btn btn-white"><Icon name="edit" size={18} /> Create post</Link>
            <Link href={`${APP}/accounts/create`} className="btn border border-white/30 text-white hover:bg-white/10"><Icon name="plug" size={18} /> Connect account</Link>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {counts.map((c) => (
          <Link key={c.label} href={c.href} className="card flex items-center gap-4 p-5 transition-colors hover:border-primary">
            <IconTile name={c.icon} />
            <span>
              <span className="block text-2xl font-bold text-ink">{c.value}</span>
              <span className="text-sm text-muted">{c.label}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title="Get started" action={<span className="text-sm font-bold text-primary">{done}/{steps.length}</span>}>
            <ul className="divide-y divide-line">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="group flex items-center gap-4 py-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${s.done ? "bg-success text-white" : "bg-primary-tint text-primary"}`}>
                      <Icon name={s.done ? "check" : s.icon} size={18} strokeWidth={s.done ? 2.6 : 1.8} />
                    </span>
                    <span className={`flex-1 font-medium ${s.done ? "text-muted line-through" : "text-ink group-hover:text-primary"}`}>{s.label}</span>
                    <Icon name="chevronRight" size={18} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Upcoming posts" action={<Link href={`${APP}/posts/calendar`} className="text-sm font-bold text-primary">Open calendar</Link>}>
            {upcoming.length === 0 ? (
              <p className="text-ink-2">Nothing scheduled ahead. <Link href={`${APP}/posts`} className="font-bold text-primary">Create a post</Link></p>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((p) => {
                  const acc = ws.accounts.find((a) => a.id === p.accountIds[0]);
                  return (
                    <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
                      <span className="w-36 shrink-0 text-sm font-medium text-ink-2">
                        {new Date(p.scheduledAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {acc && <AccountChip account={acc} small />}
                      <span className="flex-1 truncate text-sm text-ink">{p.text}</span>
                      <StatusBadge status={p.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Learn in 2 minutes">
            <VideoTrigger video={videos[0]} className="block w-full text-left">
              <VideoThumb title={videos[0].title} label="Product overview" />
            </VideoTrigger>
            <ul className="mt-4 space-y-2">
              {videos.slice(1, 4).map((v) => (
                <li key={v.slug}>
                  <VideoTrigger video={v} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-canvas">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white"><Icon name="play" size={12} /></span>
                    <span className="flex-1 text-sm font-medium text-ink">{v.title}</span>
                    <span className="text-xs text-muted">{v.duration}</span>
                  </VideoTrigger>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Upgrade to Premium">
            <p className="text-sm text-ink-2">Unlock white-label reports, client management and competitor analysis.</p>
            <Link href="/connector/plans" className="btn btn-primary btn-sm mt-4">See plans</Link>
          </Card>
        </div>
      </div>
    </>
  );
}
