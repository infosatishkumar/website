import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconTile } from "@/components/connector/Icon";
import SocialIcon, { networkMeta, type NetworkId } from "@/components/connector/SocialIcon";
import { Container, CtaBand, FeatureSplit, Hero, Testimonials } from "@/components/connector/site/Sections";
import { BASE, platformNetworks, solutions } from "@/lib/connector/data";

type Resolved = { title: string; desc: string; icon?: string; network?: NetworkId };

function resolve(slug: string): Resolved | null {
  if (slug.startsWith("platform-")) {
    const n = slug.slice("platform-".length) as NetworkId;
    if (!platformNetworks.includes(n)) return null;
    const name = networkMeta[n].name;
    return { title: `${name} management tool`, desc: `Schedule, publish and analyse ${name} content alongside every other network.`, network: n };
  }
  const s = solutions.find((x) => x.slug === slug);
  if (!s) return null;
  return {
    title: s.kind === "industry" ? `Social media for ${s.label}` : `Social Media Connector for ${s.label}`,
    desc: s.desc,
    icon: s.icon,
  };
}

export function generateStaticParams() {
  return [
    ...solutions.map((s) => ({ slug: s.slug })),
    ...platformNetworks.map((n) => ({ slug: `platform-${n}` })),
  ];
}

export async function generateMetadata({ params }: PageProps<"/connector/solutions/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: resolve(slug)?.title ?? "Solutions" };
}

export default async function SolutionPage({ params }: PageProps<"/connector/solutions/[slug]">) {
  const { slug } = await params;
  const r = resolve(slug);
  if (!r) notFound();

  return (
    <>
      <Hero title={r.title} sub={r.desc} video={{ title: r.title, scene: "calendar" }}>
        <div className="flex justify-center">
          <span className="float-y inline-flex rounded-3xl bg-white p-5 shadow-2xl">
            {r.network ? <SocialIcon id={r.network} size={80} /> : <IconTile name={r.icon ?? "rocket"} size="lg" />}
          </span>
        </div>
      </Hero>
      <section className="py-24">
        <Container className="space-y-28">
          <FeatureSplit
            eyebrow="Plan"
            title="A calendar built for how you work"
            body="Group accounts by client, location or campaign and see everything that's going out this week."
            points={["Account groups", "Holiday overlay", "Notes and approvals"]}
            scene="calendar"
            href={`${BASE}/features/social-media-calendar`}
          />
          <FeatureSplit
            reverse
            eyebrow="Measure"
            title="Reports that prove the work"
            body="Share clean, branded results with clients and stakeholders on autopilot."
            points={["White-label PDF", "Scheduled emails", "Competitor benchmarks"]}
            scene="analytics"
            href={`${BASE}/features/analytics-reporting`}
          />
        </Container>
      </section>
      <Testimonials />
      <CtaBand />
    </>
  );
}
