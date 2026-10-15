"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import Logo, { LogoMark } from "../Logo";
import Icon from "../Icon";
import { APP, BASE } from "@/lib/connector/data";
import { initLive, logout, reportError, resetWorkspace, setTheme, useLive, useTheme, useWorkspace } from "@/lib/connector/store";
import AuthScreen from "./AuthScreen";
import SetupScreen from "./SetupCheck";

type NavItem = { href: string; label: string; icon: string; badge?: "approvals" | "inbox" };
type Section = { key: string; label: string; icon: string; items: NavItem[] };

/** Two-level navigation: the icon rail picks a section, the panel lists its pages. */
const sections: Section[] = [
  { key: "home", label: "Home", icon: "home", items: [{ href: `${APP}/launchpad`, label: "Home", icon: "home" }] },
  { key: "agent", label: "Agent", icon: "sparkles", items: [{ href: `${APP}/agent`, label: "AI Agent", icon: "sparkles" }] },
  {
    key: "publish",
    label: "Publish",
    icon: "send",
    items: [
      { href: `${APP}/posts`, label: "Create post", icon: "edit" },
      { href: `${APP}/posts/calendar`, label: "Calendar", icon: "calendar" },
      { href: `${APP}/posts/drafts`, label: "Drafts", icon: "doc" },
      { href: `${APP}/posts/contribution`, label: "Approvals", icon: "checkCircle", badge: "approvals" },
      { href: `${APP}/posts/bulkimport`, label: "Bulk import", icon: "layers" },
      { href: `${APP}/queue-templates`, label: "Queue times", icon: "clock" },
      { href: `${APP}/templates`, label: "Content bank", icon: "layout" },
    ],
  },
  {
    key: "accounts",
    label: "Accounts",
    icon: "users",
    items: [
      { href: `${APP}/accounts/create`, label: "Connect account", icon: "plug" },
      { href: `${APP}/accounts`, label: "Manage accounts", icon: "users" },
      { href: `${APP}/groups`, label: "Groups", icon: "folder" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: "analytics",
    items: [
      { href: `${APP}/reports`, label: "Reports", icon: "report" },
      { href: `${APP}/competitor`, label: "Competitor reports", icon: "compare" },
      { href: `${APP}/analytics/facebook`, label: "Facebook", icon: "analytics" },
      { href: `${APP}/analytics/instagram`, label: "Instagram", icon: "analytics" },
      { href: `${APP}/analytics/X`, label: "X", icon: "analytics" },
      { href: `${APP}/analytics/linkedin`, label: "LinkedIn", icon: "analytics" },
      { href: `${APP}/analytics/gmb`, label: "Google Business", icon: "analytics" },
      { href: `${APP}/analytics/youtube`, label: "YouTube", icon: "analytics" },
      { href: `${APP}/analytics/tiktok`, label: "TikTok", icon: "analytics" },
    ],
  },
  { key: "inbox", label: "Inbox", icon: "inbox", items: [{ href: `${APP}/inbox`, label: "Inbox", icon: "inbox", badge: "inbox" }] },
  {
    key: "content",
    label: "Content",
    icon: "library",
    items: [
      { href: `${APP}/library`, label: "Library", icon: "library" },
      { href: `${APP}/feeds/index`, label: "Feed content", icon: "rss" },
      { href: `${APP}/tags`, label: "Tags", icon: "tag" },
      { href: `${APP}/utm`, label: "UTM presets", icon: "link" },
      { href: `${APP}/posts/customfields`, label: "Custom fields", icon: "hash" },
      { href: `${APP}/posts/mentiongroups`, label: "Mention groups", icon: "at" },
    ],
  },
];

const norm = (p: string) => p.replace(/\/+$/, "");

function matches(pathname: string, href: string) {
  const p = norm(pathname);
  const h = norm(href);
  if (h.startsWith(`${APP}/analytics/`)) return p.toLowerCase() === h.toLowerCase();
  if (h === `${APP}/posts` || h === `${APP}/accounts`) return p === h;
  return p === h || p.startsWith(`${h}/`);
}

function sectionFor(pathname: string) {
  const p = norm(pathname);
  return (
    sections.find((s) => s.items.some((i) => matches(pathname, i.href))) ??
    sections.find((s) => s.items.some((i) => p.startsWith(`${norm(i.href)}/`))) ??
    sections[0]
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { checked, status, health } = useLive();
  const theme = useTheme();
  useEffect(() => {
    initLive();
  }, []);

  const wrap = (node: ReactNode) => <div className={theme === "dark" ? "theme-dark" : ""}>{node}</div>;

  if (!checked) {
    return wrap(
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <span className="animate-pulse"><LogoMark size={44} /></span>
      </div>,
    );
  }
  // Backend files exist but the API can't start (config missing, old PHP…).
  if (!status && health) return wrap(<SetupScreen />);
  if (status?.backend && !status.loggedIn) {
    return wrap(
      <Suspense>
        <AuthScreen />
      </Suspense>,
    );
  }
  return wrap(<Frame>{children}</Frame>);
}

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ws = useWorkspace();
  const { status } = useLive();
  const [drawer, setDrawer] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawer(false);
  }

  const active = sectionFor(pathname);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const shown = sections.find((s) => s.key === openKey) ?? active;
  const counts = {
    approvals: ws.posts.filter((p) => p.status === "pending").length,
    inbox: ws.inbox.filter((c) => !c.read).length,
  };

  const panel = shown.items.length > 1 && (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-rail px-3 py-4 lg:block">
      <p className="px-3 pb-3 text-sm font-bold text-ink">{shown.label}</p>
      <nav className="space-y-1">
        {shown.items.map((it) => (
          <NavLink key={it.href} item={it} active={matches(pathname, it.href)} count={it.badge ? counts[it.badge] : 0} />
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="flex min-h-screen flex-col bg-rail text-ink">
      <TopBar onMenu={() => setDrawer(true)} />
      <div className="flex flex-1">
        {/* icon rail */}
        <nav className="sticky top-16 hidden h-[calc(100vh-64px)] w-[84px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-line bg-rail py-3 lg:flex">
          {sections.map((s) => {
            const isActive = s.key === active.key;
            const isShown = s.key === shown.key;
            return (
              <Link
                key={s.key}
                href={s.items[0].href}
                onMouseEnter={() => setOpenKey(s.key)}
                onFocus={() => setOpenKey(s.key)}
                className={`relative flex w-[72px] flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? "bg-surface-2 text-ink" : isShown ? "text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon name={s.icon} size={22} />
                {s.label}
                {s.items.some((i) => i.badge && counts[i.badge] > 0) && <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-primary" />}
              </Link>
            );
          })}
          <div className="mt-auto flex flex-col items-center gap-1 pt-3">
            <Link href={`${BASE}/help`} className="flex w-[72px] flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium text-muted hover:bg-surface-2 hover:text-ink">
              <Icon name="help" size={22} /> Help
            </Link>
          </div>
        </nav>
        <div className="flex min-w-0 flex-1" onMouseEnter={() => setOpenKey(null)}>
          {panel}
          <main className="min-w-0 flex-1 bg-canvas lg:rounded-tl-2xl">
            <Notices />
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </main>
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-night/60" />
          <aside className="menu-in relative h-full w-80 max-w-[85vw] overflow-y-auto bg-rail p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <Logo href={`${APP}/launchpad`} />
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded-lg p-1 text-muted">
                <Icon name="close" />
              </button>
            </div>
            {sections.map((s) => (
              <div key={s.key} className="mb-3">
                <p className="eyebrow px-3 py-1">{s.label}</p>
                {s.items.map((it) => (
                  <NavLink key={it.href} item={it} active={matches(pathname, it.href)} count={it.badge ? counts[it.badge] : 0} />
                ))}
              </div>
            ))}
            {status?.loggedIn && <p className="px-3 pt-2 text-xs text-muted">Signed in as {status.user?.email}</p>}
          </aside>
        </div>
      )}
    </div>
  );
}

function NavLink({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <Icon name={item.icon} size={18} />
      <span className="flex-1">{item.label}</span>
      {count > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-bold leading-5 text-white">{count}</span>}
    </Link>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { status } = useLive();
  const theme = useTheme();
  const live = !!status?.loggedIn;
  const plan = status?.user?.plan?.name;
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-rail px-3 sm:px-5">
      <button type="button" className="rounded-lg p-2 text-ink lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" size={22} />
      </button>
      <Link href={`${APP}/launchpad`} className="flex items-center gap-2.5" aria-label="Home">
        <LogoMark size={34} />
        <span className="hidden flex-col leading-none sm:flex">
          <span className="text-[15px] font-bold text-ink">Social Media</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">Connector</span>
        </span>
      </Link>
      <Link
        href={`${APP}/billing`}
        className="ml-2 hidden items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1.5 text-xs font-bold text-accent md:inline-flex"
      >
        <Icon name="crown" size={14} /> {plan && plan !== "Free" ? `${plan} plan` : "Free plan · Upgrade"}
      </Link>
      <span
        className={`hidden rounded-full px-2.5 py-1 text-xs font-bold md:inline ${live ? "bg-success-tint text-success" : "bg-warn-tint text-warn-ink"}`}
        title={live ? "Connected to your server — posts publish for real" : "No backend found — data stays in this browser"}
      >
        {live ? "Live" : "Demo mode"}
      </span>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Link
          href={`${APP}/agent`}
          className="hidden items-center gap-2 rounded-full border border-primary px-4 py-1.5 text-sm font-bold text-ink transition-colors hover:bg-primary-tint sm:inline-flex"
        >
          <Icon name="sparkles" size={17} className="text-accent" /> Agent
        </Link>
        <Link href={`${APP}/posts`} className="btn btn-primary btn-sm">
          <Icon name="plus" size={16} /> <span className="hidden sm:inline">Create post</span>
        </Link>
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <Link href={`${APP}/inbox`} className="relative hidden rounded-full p-2 text-ink-2 hover:bg-surface-2 hover:text-ink sm:block" aria-label="Notifications">
          <Icon name="bell" />
        </Link>
        <ProfileMenu />
      </div>
    </header>
  );
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const { status } = useLive();
  const user = status?.user;
  const initials = (user?.name ?? "You").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center rounded-full p-0.5 hover:ring-2 hover:ring-primary-tint" aria-expanded={open} aria-label="Account menu">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{initials}</span>
      </button>
      {open && (
        <div className="menu-in absolute right-0 top-12 w-64 rounded-xl border border-line bg-surface p-2 shadow-xl" onMouseLeave={() => setOpen(false)}>
          <div className="border-b border-line px-3 pb-3 pt-1">
            <p className="font-bold text-ink">{user?.name ?? "Demo workspace"}</p>
            <p className="truncate text-xs text-muted">{user?.email ?? "Data is stored in this browser"}</p>
          </div>
          {status?.loggedIn && (
            <p className="px-3 pt-2 text-xs text-muted">
              AI credits today: <b className="text-ink">{status.credits}</b> / {status.creditsPerDay}
            </p>
          )}
          {user?.isAdmin && (
            <Link href={`${APP}/settings/platform`} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
              <Icon name="gear" size={17} /> Platform settings
            </Link>
          )}
          {user?.isAdmin && (
            <Link href={`${APP}/settings/payments`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
              <Icon name="dollar" size={17} /> Payments
            </Link>
          )}
          <Link href={`${APP}/billing`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
            <Icon name="crown" size={17} /> Plans &amp; billing
          </Link>
          <Link href={BASE} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
            <Icon name="globe" size={17} /> Website
          </Link>
          {status?.loggedIn ? (
            <button type="button" onClick={() => logout().catch(reportError)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2">
              <Icon name="logout" size={17} /> Log out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (confirm("Reset the demo workspace to its sample data?")) resetWorkspace();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-surface-2"
            >
              <Icon name="refresh" size={17} /> Reset demo data
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const BANNER_KEY = "smc-banner-dismissed";

function Notices() {
  return (
    <Suspense>
      <WelcomeNotice />
      <UpgradeBanner />
    </Suspense>
  );
}

function WelcomeNotice() {
  const params = useSearchParams();
  const [hidden, setHidden] = useState(false);
  if (params.get("welcome") !== "1" || hidden) return null;
  return (
    <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl bg-success-tint px-4 py-3 text-sm font-medium text-ink sm:mx-6 lg:mx-8">
      <Icon name="checkCircle" className="text-success" />
      <span className="flex-1">Your email is verified — welcome to Social Media Connector! Start by connecting an account.</span>
      <button type="button" onClick={() => setHidden(true)} aria-label="Dismiss"><Icon name="close" size={16} /></button>
    </div>
  );
}

function UpgradeBanner() {
  const { status } = useLive();
  const paid = !!status?.user?.plan && status.user.plan.name !== "Free";
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(BANNER_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (hidden || paid) return null;
  return (
    <div className="mx-4 mt-4 flex items-center gap-3 rounded-xl border border-primary-tint bg-primary-soft px-4 py-3 text-sm text-ink-2 sm:mx-6 lg:mx-8">
      <Icon name="sparkles" size={18} className="shrink-0 text-accent" />
      <span className="flex-1">
        Bring your next big idea to life. Get more AI credits and accounts with a paid plan.{" "}
        <Link href={`${APP}/billing`} className="font-bold text-accent underline">Upgrade</Link>
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(BANNER_KEY, "1");
          } catch {
            /* ignore */
          }
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
