import type { Metadata } from "next";
import { IconTile } from "@/components/connector/Icon";
import SocialIcon from "@/components/connector/SocialIcon";
import { Container, CtaBand, FeatureSplit, Hero, SectionHeading, Testimonials } from "@/components/connector/site/Sections";
import { BASE } from "@/lib/connector/data";

export const metadata: Metadata = { title: "Reviews — generate and manage online reviews" };

const steps = [
  { icon: "send", title: "Ask", body: "Send a branded review request after every visit or order." },
  { icon: "smile", title: "Gate", body: "Happy customers go to Google; unhappy ones reach you privately first." },
  { icon: "chat", title: "Reply", body: "Answer every review with AI-drafted, on-brand replies." },
  { icon: "megaphone", title: "Promote", body: "Turn 5-star reviews into social posts and website widgets." },
];

export default function ReviewsPage() {
  return (
    <>
      <Hero
        title={<>More 5-star reviews, <span className="text-meteorite">on autopilot</span></>}
        sub="Collect, manage and showcase reviews from Google and Facebook — and watch your star rating climb."
        video={{ title: "Reviews overview", scene: "inbox" }}
      >
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { label: "Average rating", value: "4.7", sub: "from 3.9 in 4 months" },
            { label: "New reviews", value: "+312", sub: "this quarter" },
            { label: "Response rate", value: "98%", sub: "within 24 hours" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-6 text-left text-ink shadow-xl">
              <p className="text-sm text-muted">{s.label}</p>
              <p className="mt-1 text-4xl font-bold">{s.value}</p>
              <p className="mt-1 text-sm text-success">{s.sub}</p>
              <p className="mt-3 text-warning">★★★★★</p>
            </div>
          ))}
        </div>
      </Hero>

      <section className="py-24">
        <Container>
          <SectionHeading eyebrow="How it works" title="From request to five stars in four steps" />
          <div className="mt-14 grid gap-5 md:grid-cols-4">
            {steps.map((s, k) => (
              <div key={s.title} className="relative rounded-2xl border border-line p-6">
                <span className="absolute right-5 top-5 text-5xl font-bold text-primary-tint">{k + 1}</span>
                <IconTile name={s.icon} size="lg" />
                <p className="mt-5 text-xl font-bold text-ink">{s.title}</p>
                <p className="mt-2 text-ink-2">{s.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="channels" className="scroll-mt-32 bg-canvas py-24">
        <Container>
          <SectionHeading eyebrow="Review generation channels" title="Ask where your customers already are" />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-7 ring-1 ring-line">
              <SocialIcon id="whatsapp" size={52} />
              <p className="mt-5 text-xl font-bold text-ink">WhatsApp</p>
              <p className="mt-2 text-ink-2">The highest open rates — a friendly message with a one-tap review link.</p>
            </div>
            <div className="rounded-2xl bg-white p-7 ring-1 ring-line">
              <IconTile name="sms" size="lg" tone="dark" />
              <p className="mt-5 text-xl font-bold text-ink">SMS</p>
              <p className="mt-2 text-ink-2">Short, personal texts sent right after checkout or service.</p>
            </div>
            <div className="rounded-2xl bg-white p-7 ring-1 ring-line">
              <IconTile name="mail" size="lg" tone="dark" />
              <p className="mt-5 text-xl font-bold text-ink">Email</p>
              <p className="mt-2 text-ink-2">Branded templates with star buttons and automatic follow-ups.</p>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-24">
        <Container className="space-y-28">
          <FeatureSplit
            eyebrow="Review management"
            title="Every review in one feed"
            body="Google and Facebook reviews from every location, with rating alerts and AI-drafted replies."
            points={["Filter by location and rating", "AI replies in your tone", "Alerts for 1–2 star reviews"]}
            scene="inbox"
            href={`${BASE}/features/review-management`}
          />
          <FeatureSplit
            reverse
            eyebrow="Review reports"
            title="Track ratings across locations"
            body="See how each location's rating and review volume trends over time."
            points={["Rating trend by location", "Sentiment by keyword", "Scheduled report emails"]}
            scene="analytics"
            href={`${BASE}/features/advanced-reports`}
          />
        </Container>
      </section>

      <Testimonials />
      <CtaBand title="Start collecting 5-star reviews today" />
    </>
  );
}
