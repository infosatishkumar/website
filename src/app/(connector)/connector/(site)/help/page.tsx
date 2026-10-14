import type { Metadata } from "next";
import Link from "next/link";
import Icon, { IconTile } from "@/components/connector/Icon";
import DemoForm from "@/components/connector/site/DemoForm";
import { Container, PageIntro, SectionHeading } from "@/components/connector/site/Sections";
import { BASE, helpCategories } from "@/lib/connector/data";

export const metadata: Metadata = { title: "Help Center" };

export default function HelpPage() {
  return (
    <>
      <PageIntro eyebrow="Help Center" title="How can we help?" sub="Guides, tutorials and answers for every part of Social Media Connector.">
        <form className="mx-auto flex max-w-xl items-center gap-2 rounded-xl bg-white p-2 shadow-lg ring-1 ring-line" action={`${BASE}/help`}>
          <Icon name="search" className="ml-2 text-muted" />
          <input name="q" className="flex-1 px-2 py-2 outline-none" placeholder="Search articles, e.g. bulk import" />
          <button className="btn btn-primary btn-sm" type="submit">Search</button>
        </form>
      </PageIntro>
      <section className="py-20">
        <Container className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {helpCategories.map((c) => (
            <div key={c.title} className="rounded-2xl border border-line p-6">
              <div className="flex items-center gap-3">
                <IconTile name={c.icon} />
                <h2 className="text-lg font-bold text-ink">{c.title}</h2>
              </div>
              <ul className="mt-4 space-y-2">
                {c.articles.map((a) => (
                  <li key={a}>
                    <Link href={`${BASE}/video-tutorials`} className="flex items-center gap-2 text-ink-2 hover:text-primary">
                      <Icon name="doc" size={16} className="text-muted" /> {a}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Container>
      </section>
      <section id="demo" className="scroll-mt-32 bg-canvas py-24">
        <Container className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading center={false} eyebrow="Talk to a human" title="Book a personalised demo" sub="See how Social Media Connector fits your workflow in a 30-minute call with a product specialist." />
            <ul className="mt-8 space-y-3 text-ink-2">
              {["Tailored walkthrough for your team", "Migration help from your current tool", "Pricing for 100+ accounts"].map((p) => (
                <li key={p} className="flex items-center gap-3"><Icon name="checkCircle" className="text-success" /> {p}</li>
              ))}
            </ul>
          </div>
          <DemoForm />
        </Container>
      </section>
    </>
  );
}
