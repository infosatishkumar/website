import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "@/components/connector/Icon";
import { Container, CtaBand, PageIntro } from "@/components/connector/site/Sections";
import { BASE, resourceContent, resources } from "@/lib/connector/data";

export function generateStaticParams() {
  return Object.keys(resourceContent).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/connector/resources/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: resourceContent[slug]?.title ?? "Resources" };
}

export default async function ResourcePage({ params }: PageProps<"/connector/resources/[slug]">) {
  const { slug } = await params;
  const r = resourceContent[slug];
  if (!r) notFound();
  return (
    <>
      <PageIntro eyebrow="Resources" title={r.title} sub={r.intro}>
        <div className="flex flex-wrap justify-center gap-2">
          {resources.map((x) => (
            <Link
              key={x.label}
              href={x.href}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ${
                x.href === `${BASE}/resources/${slug}` ? "bg-primary text-white ring-primary" : "bg-white text-ink-2 ring-line hover:text-primary"
              }`}
            >
              {x.label}
            </Link>
          ))}
        </div>
      </PageIntro>
      <section className="py-20">
        <Container className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {r.items.map((it, k) => (
            <article key={it.title} className="group flex flex-col overflow-hidden rounded-2xl border border-line transition-colors hover:border-primary">
              <div className="relative h-36 overflow-hidden" style={{ background: ["#ebe4ff", "#ffe1ef", "#def4f0", "#fff3d1"][k % 4] }}>
                <span className="absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-white/50" />
                <span className="absolute left-6 top-6 text-5xl font-bold text-primary/20">{String(k + 1).padStart(2, "0")}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">{it.meta}</p>
                <h2 className="mt-2 text-lg font-bold text-ink group-hover:text-primary">{it.title}</h2>
                <p className="mt-2 flex-1 text-sm text-ink-2">{it.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary">
                  Read more <Icon name="arrowRight" size={16} />
                </span>
              </div>
            </article>
          ))}
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
