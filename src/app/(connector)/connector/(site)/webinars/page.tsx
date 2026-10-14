import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/connector/Icon";
import { Container, CtaBand, PageIntro } from "@/components/connector/site/Sections";
import { BASE, webinars } from "@/lib/connector/data";

export const metadata: Metadata = { title: "Webinars" };

export default function WebinarsPage() {
  const upcoming = webinars.filter((w) => w.status === "Upcoming");
  const past = webinars.filter((w) => w.status !== "Upcoming");
  return (
    <>
      <PageIntro eyebrow="Webinars" title="Stay up to date with live sessions" sub="Join live, or watch on demand whenever it suits you." />
      <section className="py-20">
        <Container>
          <h2 className="text-2xl font-bold text-ink">Upcoming</h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {upcoming.map((w) => (
              <div key={w.title} className="hero-glow relative overflow-hidden rounded-2xl p-7 text-white">
                <div className="dot-grid absolute inset-0 opacity-50" />
                <div className="relative">
                  <span className="rounded-full bg-warning px-3 py-1 text-xs font-bold text-night">LIVE · {w.date}</span>
                  <p className="mt-5 text-2xl font-bold">{w.title}</p>
                  <p className="mt-2 text-white/70">Hosted by the {w.host}</p>
                  <Link href={`${BASE}/help#demo`} className="btn btn-white mt-6">Save my seat</Link>
                </div>
              </div>
            ))}
          </div>
          <h2 className="mt-16 text-2xl font-bold text-ink">On demand</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {past.map((w) => (
              <Link key={w.title} href={`${BASE}/video-tutorials`} className="group rounded-2xl border border-line p-5 hover:border-primary">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white"><Icon name="play" size={16} /></span>
                <p className="mt-4 font-bold text-ink group-hover:text-primary">{w.title}</p>
                <p className="mt-1 text-sm text-muted">{w.date} · {w.host}</p>
              </Link>
            ))}
          </div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
