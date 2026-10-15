import type { ReactNode } from "react";
import { Container, PageIntro } from "./Sections";

/** Simple long-form page for the privacy policy and terms. */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <PageIntro eyebrow="Legal" title={title} sub={`Last updated ${updated}`} />
      <section className="py-16">
        <Container>
          <div className="mx-auto max-w-3xl space-y-8 text-ink-2 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_ul]:space-y-1.5">
            {children}
          </div>
        </Container>
      </section>
    </>
  );
}
