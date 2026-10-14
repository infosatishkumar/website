import type { Metadata } from "next";
import Link from "next/link";
import Icon, { IconTile } from "@/components/connector/Icon";
import { ListingsScene, SceneFrame } from "@/components/connector/site/DemoPlayer";
import { Container, CtaBand, Faq, Hero, SectionHeading } from "@/components/connector/site/Sections";
import { APP, BASE } from "@/lib/connector/data";

export const metadata: Metadata = { title: "Listings — manage online business listings" };

const directories = [
  "Google Business Profile", "Google Maps", "Google Assistant", "Gemini", "Apple Maps", "Bing Places",
  "Yelp", "Facebook", "Foursquare", "TripAdvisor", "Justdial", "Waze",
];

export default function ListingsPage() {
  return (
    <>
      <Hero
        title={<>Turn searches into <span className="text-meteorite">store visits</span></>}
        sub="Create and update your storefront listings across 40+ directories, boost search visibility and keep every detail accurate."
        video={{ title: "Listings overview", scene: "listings" }}
      >
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
          <div className="aspect-[16/9]">
            <ListingsScene />
          </div>
        </div>
      </Hero>

      <section className="py-24">
        <Container className="grid items-center gap-14 lg:grid-cols-2">
          <div className="rounded-3xl bg-primary-soft p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-warning px-4 py-2 font-bold text-night">
                <Icon name="search" size={18} /> Listing
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-success px-4 py-2 font-bold text-white">
                <Icon name="refresh" size={18} /> Sync-All
              </span>
            </div>
            <div className="space-y-3">
              {directories.slice(0, 5).map((d, k) => (
                <div key={d} className={`flex items-center gap-3 rounded-2xl bg-white p-4 ${k === 0 ? "ring-2 ring-success" : ""}`}>
                  <IconTile name="globeSearch" size="sm" />
                  <span className="font-bold text-ink">{d}</span>
                  <Icon name="arrowUpRight" size={14} className="text-primary" />
                  <Icon name="refresh" size={20} className="ml-auto text-success" />
                  <Icon name="dots" size={20} className="text-muted" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionHeading center={false} eyebrow="Auto-sync" title="Keep all your listings updated effortlessly" sub="Use timely auto-sync to refresh your listings and publish updates instantly when business details change." />
            <ul className="mt-8 space-y-4">
              {["Hours, phone and address everywhere at once", "Holiday hours scheduled in advance", "Duplicate and incorrect listings flagged", "Photos and offers pushed to Google"].map((p) => (
                <li key={p} className="flex items-center gap-3 text-ink-2">
                  <Icon name="checkCircle" className="text-success" /> {p}
                </li>
              ))}
            </ul>
            <Link href={`${BASE}/listings/plans`} className="btn btn-primary mt-8">See listings plans</Link>
          </div>
        </Container>
      </section>

      <section className="bg-canvas py-24">
        <Container>
          <SectionHeading eyebrow="Coverage" title="One update. 40+ directories." />
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {directories.map((d) => (
              <div key={d} className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center ring-1 ring-line">
                <IconTile name="pin" />
                <span className="text-sm font-bold text-ink">{d}</span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-24">
        <Container className="grid items-center gap-14 lg:grid-cols-2">
          <SceneFrame scene="inbox" />
          <div>
            <SectionHeading center={false} eyebrow="Reviews built in" title="Grow your star rating while you sync" sub="Ask for reviews over WhatsApp, SMS and email, and reply to every review from one feed." />
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`${BASE}/reviews`} className="btn btn-primary">Explore reviews</Link>
              <Link href={`${APP}/launchpad`} className="btn btn-outline">Start free trial</Link>
            </div>
          </div>
        </Container>
      </section>

      <Faq />
      <CtaBand title="Put your business on the map" />
    </>
  );
}
