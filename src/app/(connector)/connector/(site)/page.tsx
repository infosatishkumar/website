import Link from "next/link";
import Icon, { IconTile } from "@/components/connector/Icon";
import DemoPlayer from "@/components/connector/site/DemoPlayer";
import PricingTable from "@/components/connector/site/PricingTable";
import VideoTrigger, { VideoThumb } from "@/components/connector/site/VideoModal";
import {
  Container,
  CtaBand,
  Faq,
  FeatureGrid,
  FeatureSplit,
  Hero,
  NetworkStrip,
  SectionHeading,
  Stats,
  Testimonials,
} from "@/components/connector/site/Sections";
import { APP, BASE, socialPlans, solutions, videos } from "@/lib/connector/data";

export default function ConnectorHome() {
  return (
    <>
      <Hero
        badge="MCP Server — let AI agents run your social calendar"
        title={
          <>
            The only social media platform you need to{" "}
            <span className="bg-gradient-to-r from-meteorite to-[#ffb4d9] bg-clip-text text-transparent">drive growth</span>
          </>
        }
        sub="Kickstart a higher ROI with enterprise-grade publishing, analytics, reviews and listings — all connected in one dashboard."
        video={{ title: "Social Media Connector overview", scene: "calendar" }}
      >
        <div className="float-y rounded-2xl bg-white/10 p-2 ring-1 ring-white/20 backdrop-blur">
          <DemoPlayer start="calendar" />
        </div>
      </Hero>

      <NetworkStrip />

      <section className="py-24">
        <Container className="space-y-28">
          <FeatureSplit
            eyebrow="Publishing & scheduling"
            title="Create once, tailor for every network"
            body="Write a single post, then fine-tune captions, media and first comments per network — AI Pilot drafts the words in your brand tone."
            points={["Schedule to 11 networks at once", "Queue slots and best-time suggestions", "AI captions and hashtag ideas"]}
            scene="composer"
            href={`${BASE}/features/publishing-scheduling`}
          />
          <FeatureSplit
            reverse
            eyebrow="Content calendar"
            title="Every brand, every post, one calendar"
            body="Switch between day, week and month, drag posts to reschedule and overlay holidays so campaigns never collide."
            points={["Drag to reschedule", "Holiday & notes overlay", "Filter by account, tag or teammate"]}
            scene="calendar"
            href={`${BASE}/features/social-media-calendar`}
          />
          <FeatureSplit
            eyebrow="Analytics & reports"
            title="Proof of results in a single click"
            body="Per-network dashboards and white-label reports that your clients and bosses actually read."
            points={["Reach, engagement and growth trends", "Top posts and best times", "Scheduled PDF reports"]}
            scene="analytics"
            href={`${BASE}/features/analytics-reporting`}
          />
          <FeatureSplit
            reverse
            eyebrow="Engagement"
            title="Never miss a comment, DM or review"
            body="One inbox for every conversation. Assign, label and reply with saved responses."
            points={["Unified social inbox", "Review replies with AI drafts", "Team assignments"]}
            scene="inbox"
            href={`${BASE}/features/engagement`}
          />
        </Container>
      </section>

      <Stats />

      <section className="py-24">
        <Container>
          <SectionHeading
            eyebrow="Platform"
            title="Everything you need to run social at scale"
            sub="Capabilities, core features and power tools — designed to work together."
          />
          <div className="mt-14">
            <FeatureGrid limit={9} />
          </div>
          <div className="mt-10 text-center">
            <Link href={`${BASE}/features`} className="btn btn-outline">
              Explore all features <Icon name="arrowRight" size={18} />
            </Link>
          </div>
        </Container>
      </section>

      <section className="hero-glow relative overflow-hidden py-24 text-white">
        <div className="dot-grid absolute inset-0 opacity-60" />
        <Container className="relative">
          <SectionHeading light eyebrow="Built for" title="Solutions for every kind of team" />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {solutions
              .filter((s) => s.kind === "audience")
              .map((s) => (
                <Link
                  key={s.slug}
                  href={`${BASE}/solutions/${s.slug}`}
                  className="group rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur transition-colors hover:bg-white/10"
                >
                  <IconTile name={s.icon} size="lg" tone="dark" />
                  <p className="mt-5 text-xl font-bold">{s.label}</p>
                  <p className="mt-2 text-sm text-white/70">{s.desc}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-meteorite">
                    Learn more <Icon name="arrowRight" size={16} />
                  </span>
                </Link>
              ))}
          </div>
        </Container>
      </section>

      <section className="py-24">
        <Container>
          <SectionHeading
            eyebrow="Watch & learn"
            title="See Social Media Connector in action"
            sub="Short walkthroughs that get you from sign-up to your first scheduled post in minutes."
          />
          <div className="mt-14 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <VideoTrigger video={videos[0]} className="block text-left">
              <VideoThumb title={videos[0].title} label="Product overview · 2:14" />
            </VideoTrigger>
            <div className="flex flex-col gap-3">
              {videos.slice(1, 5).map((v) => (
                <VideoTrigger key={v.slug} video={v} className="group flex items-center gap-4 rounded-xl border border-line p-3 text-left transition-colors hover:border-primary">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                    <Icon name="play" size={16} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold text-ink group-hover:text-primary">{v.title}</span>
                    <span className="text-sm text-muted">{v.category} · {v.duration}</span>
                  </span>
                </VideoTrigger>
              ))}
              <Link href={`${BASE}/video-tutorials`} className="mt-1 inline-flex items-center gap-1 font-bold text-primary">
                All video tutorials <Icon name="arrowRight" size={16} />
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <Testimonials />

      <section className="py-24">
        <Container>
          <SectionHeading eyebrow="Pricing" title="Simple plans that scale with you" sub="Start free for 14 days. Upgrade, downgrade or cancel any time." />
          <div className="mt-12">
            <PricingTable plans={socialPlans} />
          </div>
          <p className="mt-8 text-center text-sm text-muted">
            Need more than 100 accounts? <Link href={`${APP}/launchpad`} className="font-bold text-primary">Talk to sales</Link>
          </p>
        </Container>
      </section>

      <Faq />
      <CtaBand />
    </>
  );
}
