import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "About — Satish Kumar" };

const services = [
  {
    title: "Motion graphics",
    body: "Brand motion, social loops and kinetic type that make a message stick.",
  },
  {
    title: "Animation",
    body: "2D character and explainer animation, from storyboard to final render.",
  },
  {
    title: "Title design",
    body: "Opening titles and lower thirds for film, video and events.",
  },
  {
    title: "Writing",
    body: "Published author. I bring a writer's sense of structure to every piece.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
        <p data-reveal className="text-sm tracking-widest text-ink-soft uppercase">
          About
        </p>
        <h1
          data-reveal
          className="mt-4 max-w-5xl font-display text-5xl leading-[0.98] sm:text-8xl"
        >
          Designer, animator &amp; <em className="text-accent">storyteller</em>{" "}
          <span className="wobble">✺</span>
        </h1>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:grid-cols-[1fr_1.4fr] sm:px-8">
        <div
          data-reveal
          aria-hidden
          className="aspect-[4/5] rounded-3xl bg-[linear-gradient(160deg,#ff5a36,#f2b705)]"
        />
        <div data-reveal className="space-y-6 text-lg leading-relaxed text-ink-soft">
          <p className="text-2xl leading-snug text-ink">
            Hi, I&apos;m Satish — a creative motion graphic designer based in
            Bengaluru.
          </p>
          <p>
            I design and animate for brands, creators and teams who want their
            ideas to move people. I care about timing, rhythm and the small
            details that make motion feel alive rather than decorative.
          </p>
          <p>
            I&apos;m also a published author. Writing taught me that every
            frame should earn its place, and that the best stories are the
            ones told simply.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm text-paper transition-colors hover:bg-accent"
          >
            Work with me →
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <h2 data-reveal className="mb-10 font-display text-4xl sm:text-6xl">
          What I <em>do</em>
        </h2>
        <ul className="grid border-t border-line sm:grid-cols-2">
          {services.map((service, i) => (
            <li
              key={service.title}
              data-reveal
              className="border-b border-line py-8 sm:odd:border-r sm:odd:pr-10 sm:even:pl-10"
            >
              <span className="text-sm text-ink-soft tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-3xl">{service.title}</h3>
              <p className="mt-2 text-ink-soft">{service.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
