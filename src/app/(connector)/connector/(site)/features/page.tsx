import type { Metadata } from "next";
import Link from "next/link";
import { IconTile } from "@/components/connector/Icon";
import { Container, CtaBand, PageIntro } from "@/components/connector/site/Sections";
import { BASE, featureGroups, features } from "@/lib/connector/data";

export const metadata: Metadata = { title: "All features" };

export default function FeaturesPage() {
  return (
    <>
      <PageIntro eyebrow="Platform" title="All features" sub="Everything Social Media Connector can do — grouped the way you work." />
      <section className="py-20">
        <Container className="space-y-16">
          {featureGroups.map((g) => (
            <div key={g}>
              <h2 className="mb-6 text-2xl font-bold text-ink">{g}</h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {features
                  .filter((f) => f.group === g)
                  .map((f) => (
                    <Link key={f.slug} href={`${BASE}/features/${f.slug}`} className="group flex gap-4 rounded-2xl border border-line p-5 transition-colors hover:border-primary">
                      <IconTile name={f.icon} />
                      <span>
                        <span className="block font-bold text-ink group-hover:text-primary">{f.label}</span>
                        <span className="mt-1 block text-sm text-ink-2">{f.tagline}</span>
                      </span>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
