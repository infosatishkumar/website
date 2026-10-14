import Link from "next/link";
import type { ReactNode } from "react";
import Icon, { IconTile } from "../Icon";
import SocialIcon, { networkIds } from "../SocialIcon";
import { SceneFrame } from "./DemoPlayer";
import VideoTrigger from "./VideoModal";
import { APP, BASE, faqs, features, stats, testimonials, type VideoItem } from "@/lib/connector/data";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-6 ${className}`}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  center = true,
  light = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  sub?: ReactNode;
  center?: boolean;
  light?: boolean;
}) {
  return (
    <div className={`${center ? "mx-auto text-center" : ""} max-w-3xl`}>
      {eyebrow && (
        <p className={`mb-3 text-sm font-bold uppercase tracking-[0.12em] ${light ? "text-meteorite" : "text-primary"}`}>
          {eyebrow}
        </p>
      )}
      <h2 className={`text-3xl font-bold leading-tight tracking-tight sm:text-[42px] ${light ? "text-white" : "text-ink"}`}>
        {title}
      </h2>
      {sub && <p className={`mt-4 text-lg ${light ? "text-white/70" : "text-ink-2"}`}>{sub}</p>}
    </div>
  );
}

/** Dark Hostinger-style hero with glow, badge, CTA pair and assurance line. */
export function Hero({
  badge,
  title,
  sub,
  video,
  children,
}: {
  badge?: string;
  title: ReactNode;
  sub: ReactNode;
  video?: Pick<VideoItem, "title" | "scene">;
  children?: ReactNode;
}) {
  return (
    <section className="hero-glow relative overflow-hidden text-white">
      <div className="dot-grid absolute inset-0 opacity-70" />
      <Container className="relative pb-20 pt-16 sm:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          {badge && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur">
              <span className="rounded-full bg-warning px-2 py-0.5 text-xs font-bold text-night">NEW</span>
              {badge}
            </span>
          )}
          <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">{title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/75 sm:text-xl">{sub}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={`${APP}/launchpad`} className="btn btn-primary px-8 py-4 text-base">
              Start free trial
            </Link>
            {video ? (
              <VideoTrigger video={video} className="btn border border-white/30 px-8 py-4 text-base text-white hover:bg-white/10">
                <Icon name="play" size={16} /> Watch demo
              </VideoTrigger>
            ) : (
              <Link href={`${BASE}/help#demo`} className="btn border border-white/30 px-8 py-4 text-base text-white hover:bg-white/10">
                Talk to a human
              </Link>
            )}
          </div>
          <p className="mt-5 flex items-center justify-center gap-4 text-sm text-white/60">
            <span className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-success" /> No card required</span>
            <span className="flex items-center gap-1.5"><Icon name="check" size={16} className="text-success" /> Cancel anytime</span>
          </p>
        </div>
        {children && <div className="relative mx-auto mt-14 max-w-5xl">{children}</div>}
      </Container>
    </section>
  );
}

export function NetworkStrip() {
  return (
    <section className="border-b border-line bg-white py-10">
      <Container className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
        <p className="text-center font-bold text-ink lg:text-left">
          Connect <span className="text-primary">11 networks</span> from one composer
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {networkIds.map((n) => (
            <SocialIcon key={n} id={n} size={40} />
          ))}
        </div>
      </Container>
    </section>
  );
}

export function Stats() {
  return (
    <section className="bg-canvas py-14">
      <Container className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-white p-6 text-center ring-1 ring-line">
            <p className="text-4xl font-bold tracking-tight text-primary">{s.value}</p>
            <p className="mt-1 text-sm text-ink-2">{s.label}</p>
          </div>
        ))}
      </Container>
    </section>
  );
}

export function FeatureSplit({
  eyebrow,
  title,
  body,
  points,
  scene,
  href,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  scene: VideoItem["scene"];
  href: string;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={reverse ? "lg:order-2" : ""}>
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
        <h3 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h3>
        <p className="mt-4 text-lg text-ink-2">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-ink-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                <Icon name="check" size={14} strokeWidth={2.6} />
              </span>
              {p}
            </li>
          ))}
        </ul>
        <Link href={href} className="mt-8 inline-flex items-center gap-1.5 font-bold text-primary hover:gap-2.5 transition-all">
          Learn more <Icon name="arrowRight" size={18} />
        </Link>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>
        <SceneFrame scene={scene} />
      </div>
    </div>
  );
}

export function FeatureGrid({ limit }: { limit?: number }) {
  const list = limit ? features.slice(0, limit) : features;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((f) => (
        <Link
          key={f.slug}
          href={`${BASE}/features/${f.slug}`}
          className="group rounded-2xl border border-line bg-white p-6 transition-all hover:-translate-y-1 hover:border-primary hover:shadow-[0_16px_32px_-16px_rgba(103,61,230,0.4)]"
        >
          <IconTile name={f.icon} size="lg" />
          <p className="mt-5 text-lg font-bold text-ink group-hover:text-primary">{f.label}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.tagline}</p>
        </Link>
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="bg-canvas py-24">
      <Container>
        <SectionHeading eyebrow="Wall of love" title="Teams switch and never look back" />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="flex flex-col rounded-2xl bg-white p-7 ring-1 ring-line">
              <p className="text-lg tracking-widest text-warning">{"★".repeat(t.rating)}</p>
              <blockquote className="mt-4 flex-1 text-[17px] leading-relaxed text-ink">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-tint font-bold text-primary">{t.name[0]}</span>
                <span>
                  <span className="block font-bold text-ink">{t.name}</span>
                  <span className="block text-sm text-muted">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function Faq() {
  return (
    <section className="py-24">
      <Container className="max-w-3xl">
        <SectionHeading title="Frequently asked questions" />
        <div className="mt-12 divide-y divide-line rounded-2xl border border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group p-6 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-ink">
                {f.q}
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform group-open:rotate-45">
                  <Icon name="plus" size={18} />
                </span>
              </summary>
              <p className="mt-3 text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function CtaBand({ title = "Ready to connect every channel?", sub = "Start your 14-day free trial today. No card required." }: { title?: string; sub?: string }) {
  return (
    <section className="px-6 pb-24">
      <div className="hero-glow relative mx-auto max-w-7xl overflow-hidden rounded-3xl px-8 py-16 text-center text-white">
        <div className="dot-grid absolute inset-0 opacity-60" />
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">{sub}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={`${APP}/launchpad`} className="btn btn-white px-8 py-4 text-base">Start free trial</Link>
            <Link href={`${BASE}/plans`} className="btn border border-white/30 px-8 py-4 text-base text-white hover:bg-white/10">See pricing</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Light page header used on inner marketing pages. */
export function PageIntro({ eyebrow, title, sub, children }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-primary-soft">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-tint" />
      <div className="absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-[#ffe1ef] opacity-70" />
      <Container className="relative py-16 sm:py-20">
        <SectionHeading eyebrow={eyebrow} title={title} sub={sub} />
        {children && <div className="mt-8">{children}</div>}
      </Container>
    </section>
  );
}
