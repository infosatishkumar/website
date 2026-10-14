import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Icon, { IconTile } from "@/components/connector/Icon";
import { SceneFrame } from "@/components/connector/site/DemoPlayer";
import { Container, CtaBand, FeatureGrid, Hero, SectionHeading } from "@/components/connector/site/Sections";
import { APP, features, type VideoItem } from "@/lib/connector/data";

export function generateStaticParams() {
  return features.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: PageProps<"/connector/features/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const f = features.find((x) => x.slug === slug);
  return { title: f?.label ?? "Feature" };
}

const sceneFor = (slug: string): VideoItem["scene"] => {
  if (/calendar|scheduler/.test(slug)) return "calendar";
  if (/analytics|report/.test(slug)) return "analytics";
  if (/review|engagement|approval/.test(slug)) return "inbox";
  return "composer";
};

export default async function FeaturePage({ params }: PageProps<"/connector/features/[slug]">) {
  const { slug } = await params;
  const f = features.find((x) => x.slug === slug);
  if (!f) notFound();
  const scene = sceneFor(f.slug);

  return (
    <>
      <Hero title={f.label} sub={f.tagline} video={{ title: f.label, scene }} />
      <section className="py-24">
        <Container className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <IconTile name={f.icon} size="lg" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-ink sm:text-4xl">What you get</h2>
            <ul className="mt-6 space-y-4">
              {f.points.map((p) => (
                <li key={p} className="flex items-center gap-3 text-lg text-ink-2">
                  <Icon name="checkCircle" className="text-success" /> {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={f.appHref ?? `${APP}/launchpad`} className="btn btn-primary">
                Try it in the app <Icon name="arrowRight" size={18} />
              </Link>
            </div>
          </div>
          <SceneFrame scene={scene} />
        </Container>
      </section>
      <section className="bg-canvas py-24">
        <Container>
          <SectionHeading title="Explore more features" />
          <div className="mt-12">
            <FeatureGrid limit={6} />
          </div>
        </Container>
      </section>
      <CtaBand />
    </>
  );
}
