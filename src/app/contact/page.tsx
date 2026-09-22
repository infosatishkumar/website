import type { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = { title: "Contact — Satish Kumar" };

export default function ContactPage() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pt-16 sm:grid-cols-[1fr_1.1fr] sm:px-8 sm:pt-24">
      <div>
        <p data-reveal className="text-sm tracking-widest text-ink-soft uppercase">
          Contact
        </p>
        <h1
          data-reveal
          className="mt-4 font-display text-6xl leading-[0.95] sm:text-8xl"
        >
          Say <em className="text-accent">hello</em>
          <span className="wobble ml-2">👋</span>
        </h1>
        <p data-reveal className="mt-8 max-w-sm text-lg text-ink-soft">
          Got a project, a story or a question? Drop a note and I&apos;ll get
          back to you within a couple of days.
        </p>
        <a
          data-reveal
          href="mailto:infosatish.in@gmail.com"
          className="mt-8 inline-block font-display text-2xl underline decoration-accent underline-offset-8 hover:italic"
        >
          infosatish.in@gmail.com
        </a>
      </div>
      <div data-reveal className="rounded-3xl bg-paper-2 p-6 sm:p-10">
        <ContactForm />
      </div>
    </section>
  );
}
