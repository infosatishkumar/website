"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Logo from "../Logo";
import Icon from "../Icon";
import { APP, BASE } from "@/lib/connector/data";
import { initLive, logout, reportError, resetWorkspace, useLive, useWorkspace } from "@/lib/connector/store";
import LoginScreen from "./LoginScreen";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { title?: string; items: NavItem[] };

const nav: NavSection[] = [
  {
    items: [
      { href: `${APP}/launchpad`, label: "Launchpad", icon: "rocket" },
      { href: `${APP}/agent`, label: "AI Agent", icon: "sparkles" },
      { href: `${APP}/posts`, label: "Create post", icon: "edit" },
      { href: `${APP}/posts/calendar`, label: "Calendar", icon: "calendar" },
      { href: `${APP}/inbox`, label: "Inbox", icon: "inbox" },
    ],
  },
  {
    title: "Publishing",
    items: [
      { href: `${APP}/posts/bulkimport`, label: "Bulk import", icon: "layers" },
      { href: `${APP}/posts/contribution`, label: "Approvals", icon: "checkCircle" },
      { href: `${APP}/queue-templates`, label: "Queue times", icon: "clock" },
      { href: `${APP}/templates`, label: "Content bank", icon: "layout" },
    ],
  },
  {
    title: "Accounts",
    items: [
      { href: `${APP}/accounts`, label: "Accounts", icon: "users" },
      { href: `${APP}/accounts/create`, label: "Connect account", icon: "plug" },
      { href: `${APP}/groups`, label: "Groups", icon: "folder" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { href: `${APP}/analytics/facebook`, label: "Network analytics", icon: "analytics" },
      { href: `${APP}/reports`, label: "Reports", icon: "report" },
      { href: `${APP}/competitor`, label: "Competitors", icon: "compare" },
    ],
  },
  {
    title: "Content",
    items: [
      { href: `${APP}/library`, label: "Library", icon: "library" },
      { href: `${APP}/feeds/index`, label: "RSS feeds", icon: "rss" },
      { href: `${APP}/tags`, label: "Tags", icon: "tag" },
      { href: `${APP}/utm`, label: "UTM presets", icon: "link" },
      { href: `${APP}/posts/customfields`, label: "Custom fields", icon: "hash" },
      { href: `${APP}/posts/mentiongroups`, label: "Mention groups", icon: "at" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href.startsWith(`${APP}/analytics`)) return pathname.startsWith(`${APP}/analytics`);
  if (href === `${APP}/posts`) return pathname === href;
  if (href === `${APP}/accounts`) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  const ws = useWorkspace();
  const { checked, status } = useLive();
  useEffect(() => {
    initLive();
  }, []);
  const pending = ws.posts.filter((p) => p.status === "pending").length;
  const unread = ws.inbox.filter((c) => !c.read).length;

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Logo href={`${APP}/launchpad`} />
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-6 pt-2">
        {nav.map((sec, k) => (
          <div key={k}>
            {sec.title && <p className="eyebrow mb-1.5 px-3">{sec.title}</p>}
            <ul className="space-y-0.5">
              {sec.items.map((it) => {
                const active = isActive(pathname, it.href);
                const badge = it.label === "Approvals" ? pending : it.label === "Inbox" ? unread : 0;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active ? "bg-primary-tint text-primary" : "text-ink-2 hover:bg-canvas hover:text-ink"
                      }`}
                    >
                      <Icon name={it.icon} size={19} />
                      <span className="flex-1">{it.label}</span>
                      {badge > 0 && (
                        <span className="rounded-full bg-primary px-1.5 text-xs font-bold leading-5 text-white">{badge}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3">
        <Link href={`${BASE}/help`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-canvas">
          <Icon name="help" size={19} /> Help center
        </Link>
        <Link href={`${BASE}/video-tutorials`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-canvas">
          <Icon name="video" size={19} /> Video tutorials
        </Link>
      </div>
    </nav>
  );

  if (!checked) {
    return <div className="flex min-h-screen items-center justify-center bg-canvas text-muted">Loading…</div>;
  }
  if (status?.backend && !status.loggedIn) {
    return <LoginScreen />;
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-night/50" />
          <aside className="menu-in relative h-full w-72 bg-white" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <button type="button" className="rounded-lg p-2 text-ink lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={22} />
          </button>
          <div className="hidden max-w-md flex-1 items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-muted sm:flex">
            <Icon name="search" size={18} />
            <input className="flex-1 bg-transparent text-sm text-ink outline-none" placeholder="Search posts, accounts, reports…" />
          </div>
          <span
            className={`hidden rounded-full px-2.5 py-1 text-xs font-bold md:inline ${status?.loggedIn ? "bg-success-tint text-success" : "bg-[#fff3d1] text-[#9a6b00]"}`}
            title={status?.loggedIn ? "Connected to your server — posts publish for real" : "No backend found — data stays in this browser"}
          >
            {status?.loggedIn ? "Live" : "Demo mode"}
          </span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link href={`${APP}/posts`} className="btn btn-primary btn-sm">
              <Icon name="plus" size={16} /> <span className="hidden sm:inline">Create post</span>
            </Link>
            <Link href={`${APP}/inbox`} className="relative rounded-lg p-2 text-ink-2 hover:bg-canvas" aria-label="Notifications">
              <Icon name="bell" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />}
            </Link>
            <ProfileMenu />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const { status } = useLive();
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-canvas" aria-expanded={open}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">SK</span>
        <Icon name="chevronDown" size={16} className="hidden text-muted sm:block" />
      </button>
      {open && (
        <div className="menu-in absolute right-0 top-12 w-56 rounded-xl border border-line bg-white p-2 shadow-xl">
          <p className="px-3 py-2 text-sm font-bold text-ink">My workspace</p>
          <Link href={`${BASE}/plans`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-canvas">
            <Icon name="crown" size={17} /> Upgrade plan
          </Link>
          {status?.loggedIn ? (
            <button
              type="button"
              onClick={() => logout().catch(reportError)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-canvas"
            >
              <Icon name="logout" size={17} /> Log out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (confirm("Reset the demo workspace to its sample data?")) resetWorkspace();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-canvas"
            >
              <Icon name="refresh" size={17} /> Reset demo data
            </button>
          )}
          <Link href={BASE} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-canvas">
            <Icon name="logout" size={17} /> Back to website
          </Link>
        </div>
      )}
    </div>
  );
}
