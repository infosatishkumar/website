"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Logo from "../Logo";
import Icon, { IconTile } from "../Icon";
import SocialIcon, { networkMeta } from "../SocialIcon";
import VideoTrigger, { VideoThumb } from "./VideoModal";
import DemoButton from "./DemoBooking";
import {
  APP,
  BASE,
  features,
  featureGroups,
  platformExtras,
  platformNetworks,
  products,
  resources,
  solutions,
  testimonials,
} from "@/lib/connector/data";

type MenuKey = "platform" | "solutions" | "resources" | null;

const tabs = [
  { label: "Social Media", href: BASE },
  { label: "Reviews", href: `${BASE}/reviews` },
  { label: "Listings", href: `${BASE}/listings` },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState<MenuKey>(null);
  const [mobile, setMobile] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListings = pathname.startsWith(`${BASE}/listings`);

  // Close menus whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(null);
    setMobile(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const enter = (k: MenuKey) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(k);
  };
  const leave = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 120);
  };

  const activeTab = isListings
    ? tabs[2].href
    : pathname.startsWith(`${BASE}/reviews`)
      ? tabs[1].href
      : tabs[0].href;

  const menus: { key: Exclude<MenuKey, null>; label: string }[] = isListings
    ? [{ key: "platform", label: "Platform" }]
    : [
        { key: "platform", label: "Platform" },
        { key: "solutions", label: "Solutions" },
        { key: "resources", label: "Resources" },
      ];

  return (
    <header className="sticky top-0 z-50 bg-white" onMouseLeave={leave}>
      {/* product strip */}
      {!isListings && (
        <div className="hidden bg-primary-soft md:block">
          <div className="mx-auto flex max-w-7xl px-6">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`px-5 py-2 text-sm font-medium transition-colors ${
                  activeTab === t.href ? "bg-white text-ink" : "text-ink-2 hover:text-primary"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="border-b border-line">
        <nav className="mx-auto flex h-[72px] max-w-7xl items-center gap-8 px-6">
          <Logo />
          <ul className="hidden h-full items-stretch gap-1 lg:flex">
            {menus.map((m) => (
              <li key={m.key} className="flex" onMouseEnter={() => enter(m.key)}>
                <button
                  type="button"
                  aria-expanded={open === m.key}
                  onClick={() => setOpen(open === m.key ? null : m.key)}
                  className={`relative flex items-center gap-1 px-3 font-medium transition-colors ${
                    open === m.key ? "text-primary" : "text-ink hover:text-primary"
                  }`}
                >
                  {m.label}
                  <Icon name="chevronDown" size={16} className={`transition-transform ${open === m.key ? "rotate-180" : ""}`} />
                  <span
                    className={`absolute inset-x-1 bottom-0 h-[3px] rounded-t bg-primary transition-opacity ${
                      open === m.key ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </button>
              </li>
            ))}
            <li className="flex" onMouseEnter={() => enter(null)}>
              <Link
                href={isListings ? `${BASE}/listings/plans` : `${BASE}/plans`}
                className="flex items-center px-3 font-medium text-ink hover:text-primary"
              >
                Pricing
              </Link>
            </li>
          </ul>
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <Link href={`${APP}/launchpad`} className="btn btn-ghost">
              Log in
            </Link>
            <DemoButton className="btn btn-outline">Request demo</DemoButton>
            <Link href={`${APP}/launchpad`} className="btn btn-primary">
              Start free trial
            </Link>
          </div>
          <button
            type="button"
            className="ml-auto rounded-lg p-2 text-ink lg:hidden"
            onClick={() => setMobile((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobile}
          >
            <Icon name={mobile ? "close" : "menu"} size={26} />
          </button>
        </nav>
      </div>

      {/* mega menu */}
      {open && (
        <div
          className="absolute inset-x-0 top-full hidden px-6 lg:block"
          onMouseEnter={() => enter(open)}
          onMouseLeave={leave}
        >
          <div className="menu-in mx-auto flex max-w-7xl overflow-hidden rounded-b-2xl border border-t-0 border-line bg-white shadow-[0_24px_48px_-12px_rgba(29,30,32,0.18)]">
            {open === "platform" && (isListings ? <ListingsPlatformMenu /> : <PlatformMenu />)}
            {open === "solutions" && <SolutionsMenu />}
            {open === "resources" && <ResourcesMenu />}
          </div>
        </div>
      )}

      {mobile && <MobileMenu />}
    </header>
  );
}

function MenuLinkRow({ href, icon, label, desc }: { href: string; icon: string; label: string; desc?: string }) {
  return (
    <Link href={href} className="group flex items-start gap-3.5 rounded-xl p-2.5 transition-colors hover:bg-primary-soft">
      <IconTile name={icon} />
      <span>
        <span className="block font-bold text-ink group-hover:text-primary">{label}</span>
        {desc && <span className="mt-0.5 block text-sm text-muted">{desc}</span>}
      </span>
    </Link>
  );
}

function SmallLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 font-medium text-ink hover:text-primary">
      <IconTile name={icon} size="sm" />
      {label}
    </Link>
  );
}

function SidePanel({ children }: { children: React.ReactNode }) {
  return <aside className="w-[340px] shrink-0 bg-primary-soft p-7">{children}</aside>;
}

function PlatformMenu() {
  return (
    <>
      <div className="flex-1 p-7">
        <div className="grid grid-cols-2 gap-2 border-b border-line pb-5">
          {products.map((p) => (
            <MenuLinkRow key={p.label} {...p} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6 pt-5">
          {featureGroups.map((g) => (
            <div key={g}>
              <p className="eyebrow mb-3 px-2">{g}</p>
              <div className="flex flex-col gap-1">
                {features
                  .filter((f) => f.group === g)
                  .slice(0, 6)
                  .map((f) => (
                    <SmallLink key={f.slug} href={`${BASE}/features/${f.slug}`} icon={f.icon} label={f.label} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <SidePanel>
        <VideoTrigger video={{ title: "Social Media Connector overview", scene: "calendar" }} className="block w-full text-left">
          <VideoThumb title="Overview" label="Everything you need to know" />
          <p className="mt-4 text-lg font-bold text-ink">Product overview video</p>
          <p className="mt-1 text-sm text-muted">
            See how Social Media Connector simplifies workflows, scales your output and delivers results.
          </p>
        </VideoTrigger>
        <div className="mt-6 flex flex-col gap-1 border-t border-primary-tint pt-5">
          {platformExtras.map((l) => (
            <SmallLink key={l.label} {...l} />
          ))}
        </div>
      </SidePanel>
    </>
  );
}

function ListingsPlatformMenu() {
  return (
    <>
      <div className="flex-1 p-7">
        <div className="grid grid-cols-2 gap-2 border-b border-line pb-5">
          <MenuLinkRow href={`${BASE}/listings`} icon="globeSearch" label="Listings" desc="Create and manage your online listings." />
          <MenuLinkRow href={`${BASE}/reviews`} icon="star" label="Reviews" desc="Improve your star ratings of online listings." />
          <MenuLinkRow href={BASE} icon="gear" label="Social Media" desc="Manage social media at scale effortlessly." />
          <MenuLinkRow href={`${BASE}/features/ai-pilot`} icon="sparkles" label="AI Pilot" desc="Generate fresh content in your brand tone." />
        </div>
        <div className="grid grid-cols-2 gap-6 pt-5">
          <div>
            <p className="eyebrow mb-3 px-2">Capabilities</p>
            <SmallLink href={`${BASE}/features/review-generation`} icon="starPlus" label="Review Generation" />
            <SmallLink href={`${BASE}/features/advanced-reports`} icon="analytics" label="Review Reports" />
            <SmallLink href={`${BASE}/features/review-management`} icon="star" label="Review Management" />
            <SmallLink href={`${BASE}/features/review-marketing`} icon="megaphone" label="Review Marketing" />
          </div>
          <div>
            <p className="eyebrow mb-3 px-2">Review generation channels</p>
            {(["whatsapp"] as const).map((n) => (
              <Link key={n} href={`${BASE}/reviews#channels`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 font-medium text-ink hover:text-primary">
                <SocialIcon id={n} size={30} />
                {networkMeta[n].name}
              </Link>
            ))}
            <SmallLink href={`${BASE}/reviews#channels`} icon="sms" label="SMS" />
            <SmallLink href={`${BASE}/reviews#channels`} icon="mail" label="Email" />
          </div>
        </div>
      </div>
      <SidePanel>
        <VideoTrigger video={{ title: "Listings overview", scene: "listings" }} className="block w-full text-left">
          <VideoThumb title="Listings" label="Turn searches into store visits" />
          <p className="mt-4 text-lg font-bold text-ink">Listings overview video</p>
          <p className="mt-1 text-sm text-muted">
            Create and update storefront listings, boost search visibility and keep info accurate.
          </p>
        </VideoTrigger>
        <div className="mt-6 border-t border-primary-tint pt-5">
          <SmallLink href={`${BASE}/resources/whats-new`} icon="refresh" label="Latest Feature Releases" />
        </div>
      </SidePanel>
    </>
  );
}

function SolutionsMenu() {
  const t = testimonials[0];
  return (
    <>
      <div className="flex-1 p-7">
        <div className="grid grid-cols-2 gap-2 border-b border-line pb-5">
          {solutions
            .filter((s) => s.kind === "audience")
            .map((s) => (
              <MenuLinkRow key={s.slug} href={`${BASE}/solutions/${s.slug}`} icon={s.icon} label={s.label} desc={s.desc} />
            ))}
        </div>
        <div className="grid grid-cols-2 gap-8 pt-5">
          <div>
            <p className="eyebrow mb-3 px-2">Industries</p>
            <div className="grid grid-cols-2 gap-1">
              {solutions
                .filter((s) => s.kind === "industry")
                .map((s) => (
                  <SmallLink key={s.slug} href={`${BASE}/solutions/${s.slug}`} icon={s.icon} label={s.label} />
                ))}
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3 px-2">Social media platforms</p>
            <div className="grid grid-cols-2 gap-1">
              {platformNetworks.map((n) => (
                <Link key={n} href={`${BASE}/solutions/platform-${n}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 font-medium text-ink hover:text-primary">
                  <SocialIcon id={n} size={30} />
                  {networkMeta[n].name.replace(" (Twitter)", "")}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
      <SidePanel>
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
            {t.name[0]}
          </span>
          <div>
            <p className="font-bold text-ink">{t.name}</p>
            <p className="text-sm text-muted">{t.role}</p>
          </div>
        </div>
        <p className="mt-4 text-warning">{"★★★★★"}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">&ldquo;{t.quote}&rdquo;</p>
        <Link href={`${BASE}/case-study`} className="mt-6 inline-flex items-center gap-1 font-bold text-primary">
          Read customer stories <Icon name="arrowRight" size={16} />
        </Link>
      </SidePanel>
    </>
  );
}

function ResourcesMenu() {
  return (
    <>
      <div className="grid flex-1 grid-cols-3 gap-2 p-7">
        {resources.map((r) => (
          <MenuLinkRow key={r.label} {...r} />
        ))}
      </div>
      <SidePanel>
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="relative flex h-36 items-center justify-center gap-3 bg-gradient-to-br from-primary-tint to-[#ffe1ef]">
            <span className="flex h-20 w-16 flex-col items-center justify-center gap-1 rounded-lg bg-white shadow">
              <SocialIcon id="instagram" size={22} rounded="full" />
              <span className="text-[10px] font-bold text-ink">You</span>
            </span>
            <span className="rounded-lg bg-night px-2 py-1 text-xs font-bold text-white">VS</span>
            <span className="flex h-20 w-16 flex-col items-center justify-center gap-1 rounded-lg bg-white shadow">
              <SocialIcon id="instagram" size={22} rounded="full" />
              <span className="text-[10px] font-bold text-ink">Rival</span>
            </span>
          </div>
          <div className="p-5">
            <p className="text-lg font-bold text-ink">Head-to-head Instagram analysis</p>
            <p className="mt-1 text-sm text-muted">Compare your Instagram side by side with competitors and see where you stand.</p>
            <Link href={`${APP}/competitor`} className="mt-3 inline-block font-bold text-primary">
              Try for free
            </Link>
          </div>
        </div>
      </SidePanel>
    </>
  );
}

function MobileMenu() {
  const [section, setSection] = useState<string | null>("Platform");
  const groups: { title: string; links: { href: string; label: string; icon?: string }[] }[] = [
    { title: "Platform", links: [...products, ...features.slice(0, 8).map((f) => ({ href: `${BASE}/features/${f.slug}`, label: f.label, icon: f.icon })), { href: `${BASE}/features`, label: "All features", icon: "list" }] },
    { title: "Solutions", links: solutions.map((s) => ({ href: `${BASE}/solutions/${s.slug}`, label: s.label, icon: s.icon })) },
    { title: "Resources", links: resources },
  ];
  return (
    <div className="max-h-[calc(100vh-72px)] overflow-y-auto border-b border-line bg-white px-4 pb-6 lg:hidden">
      <div className="flex gap-2 overflow-x-auto py-3">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="rounded-full bg-primary-soft px-4 py-1.5 text-sm font-medium text-ink">
            {t.label}
          </Link>
        ))}
      </div>
      {groups.map((g) => (
        <div key={g.title} className="border-b border-line">
          <button
            type="button"
            className="flex w-full items-center justify-between py-4 font-bold text-ink"
            onClick={() => setSection(section === g.title ? null : g.title)}
          >
            {g.title}
            <Icon name="chevronDown" size={18} className={section === g.title ? "rotate-180" : ""} />
          </button>
          {section === g.title && (
            <div className="grid grid-cols-1 gap-1 pb-4 sm:grid-cols-2">
              {g.links.map((l) => (
                <SmallLink key={l.label} href={l.href} icon={l.icon ?? "arrowRight"} label={l.label} />
              ))}
            </div>
          )}
        </div>
      ))}
      <Link href={`${BASE}/plans`} className="block border-b border-line py-4 font-bold text-ink">
        Pricing
      </Link>
      <div className="mt-5 grid gap-3">
        <Link href={`${APP}/launchpad`} className="btn btn-primary">Start free trial</Link>
        <DemoButton className="btn btn-outline">Request demo</DemoButton>
        <Link href={`${APP}/launchpad`} className="btn btn-ghost">Log in</Link>
      </div>
    </div>
  );
}
