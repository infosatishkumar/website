import type { Metadata } from "next";
import { Container, CtaBand, PageIntro, Testimonials } from "@/components/connector/site/Sections";
import { caseStudies } from "@/lib/connector/data";

export const metadata: Metadata = { title: "Customer stories" };

export default function CaseStudyPage() {
  return (
    <>
      <PageIntro eyebrow="Customer stories" title="Real teams, real results" sub="How agencies, chains and local businesses grow with Social Media Connector." />
      <section className="py-20">
        <Container className="grid gap-6 md:grid-cols-2">
          {caseStudies.map((c) => (
            <article key={c.company} className="flex flex-col justify-between gap-8 rounded-2xl border border-line p-8 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">{c.industry}</p>
                <h2 className="mt-2 text-2xl font-bold text-ink">{c.company}</h2>
                <p className="mt-2 text-ink-2">{c.result}</p>
              </div>
              <div className="shrink-0 rounded-2xl bg-primary-soft px-6 py-5 text-center">
                <p className="text-4xl font-bold text-primary">{c.metric}</p>
                <p className="text-sm text-ink-2">{c.metricLabel}</p>
              </div>
            </article>
          ))}
        </Container>
      </section>
      <Testimonials />
      <CtaBand />
    </>
  );
}
