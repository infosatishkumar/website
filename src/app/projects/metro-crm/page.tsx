import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Metro CRM — Case Study — Satish Kumar",
  description:
    "A custom sales CRM for a Bengaluru manufacturer of PUF panels, purlins and roofing sheets: lead capture, quotations, job cards, attendance and an AI assistant in one app.",
};

const facts = [
  { label: "Client", value: "Metro Puf Industries & Delta Infrastructures" },
  { label: "Industry", value: "Building materials manufacturing" },
  { label: "Role", value: "Product design, development & deployment" },
  { label: "Stack", value: "JavaScript SPA, PHP, MySQL, Hostinger" },
];

const stats = [
  { value: "6,000+", label: "leads managed" },
  { value: "27,000+", label: "follow-up notes stored" },
  { value: "20", label: "modules in one app" },
  { value: "83%", label: "smaller sync payload" },
];

const problems = [
  {
    title: "Leads everywhere",
    body: "Enquiries arrived from Facebook Lead Ads, Google Ads, IndiaMART, the website and WhatsApp. Each lived in a different inbox or spreadsheet, and some were never called back.",
  },
  {
    title: "Quotes built by hand",
    body: "Every quotation for sandwich panels, purlins or roofing sheets was calculated and typed manually. Weights, areas, GST and numbering were easy to get wrong.",
  },
  {
    title: "No shared picture",
    body: "Management could not see who was handling which customer, which leads had gone cold, or what had been promised. Two agents sometimes chased the same buyer.",
  },
];

const modules = [
  {
    group: "Capture",
    items: [
      "Facebook Lead Ads, Google Ads and IndiaMART pulled in automatically",
      "Website forms (WordPress) posted straight into the right lead list",
      "Duplicate check by phone number before any lead is saved",
      "Lead lists, sources and auto-assignment to agents",
    ],
  },
  {
    group: "Sell",
    items: [
      "Leads & customers with stages, remarks and full note history",
      "Follow-up reminders and a Stagnant Leads view for cold enquiries",
      "Auto-detected state, city and product, editable by the agent",
      "Click-to-call, WhatsApp and product photo sharing from any lead",
    ],
  },
  {
    group: "Quote & build",
    items: [
      "Quotation builder for PUF panels, purlins and sheets, with live preview",
      "Area and weight calculation per row, GST and round-off",
      "Approval links, version history and PDF quotations",
      "Job cards, dispatch tracking and received payments",
    ],
  },
  {
    group: "Run the team",
    items: [
      "Face-recognition attendance and login tracking",
      "Daily reports, dashboards and per-agent performance",
      "Product and catalogue library for both companies",
      "Role-based access: agents see only their own customers",
    ],
  },
];

const flow = [
  { step: "Enquiry", note: "Ad, marketplace, website or call" },
  { step: "Lead", note: "De-duplicated and assigned" },
  { step: "Follow-up", note: "Notes, reminders, stages" },
  { step: "Quotation", note: "Calculated, approved, sent" },
  { step: "Job card", note: "Production and dispatch" },
  { step: "Payment", note: "Received and reconciled" },
];

const decisions = [
  {
    title: "One file, zero build step",
    body: "The whole front end ships as a single HTML file. The client's team can deploy an update by uploading one file to shared hosting — no build tools, no servers to manage.",
  },
  {
    title: "Save only what changed",
    body: "Instead of re-sending the whole database, the app computes a delta of what each user changed and sends just that. A server-side lock keeps simultaneous saves from overwriting each other.",
  },
  {
    title: "Notes are never overwritten",
    body: "Follow-up notes are append-only and de-duplicated by key, so two agents writing at the same moment can never erase each other's history.",
  },
  {
    title: "Compress the big download",
    body: "With thousands of leads the initial sync grew to about 11 MB. Gzipping the response cut it to roughly 1.85 MB, so the CRM opens quickly even on mobile data.",
  },
];

const challenges = [
  {
    title: "The banner that would not go away",
    problem:
      "Agents kept seeing “Changes not saved yet”, even when they were not doing anything. Server space and plan limits looked fine.",
    fix: "The browser network log showed the save requests returning 403 from the host's CDN, not from the app. The CDN's firewall was treating rapid saves as an attack. Turning the CDN off for the CRM domain fixed it for every agent.",
  },
  {
    title: "Duplicate leads leaked customers",
    problem:
      "When an agent added a lead that already belonged to a colleague, the existing customer appeared in their list.",
    fix: "The duplicate check now stops the save and shows a clear message naming the customer and the agent already handling them. Admins still see everything.",
  },
  {
    title: "A quotation that could not be updated",
    problem:
      "Editing a quote and switching it between the two companies changed its ID prefix, and the update was rejected.",
    fix: "Edits now keep the original quote number and swap only the company prefix, and the linked job card follows the change.",
  },
];

const next = [
  "Incremental sync, so each device downloads only records changed since its last visit",
  "Deeper reporting on lead source quality and conversion by product",
  "More automation around follow-up reminders and quotation approvals",
];

export default function MetroCrmCaseStudy() {
  return (
    <article className="mx-auto w-full max-w-6xl px-5 pt-16 pb-10 sm:px-8 sm:pt-24">
      <Link href="/projects" className="text-sm text-ink-soft hover:text-ink">
        ← All work
      </Link>

      <p
        data-reveal
        className="mt-8 text-sm tracking-widest text-ink-soft uppercase"
      >
        Case study · Web application
      </p>
      <h1
        data-reveal
        className="mt-4 font-display text-6xl leading-[0.95] sm:text-8xl"
      >
        Metro <em className="text-accent">CRM</em>
      </h1>
      <p
        data-reveal
        className="mt-8 max-w-3xl text-xl leading-relaxed text-ink-soft sm:text-2xl"
      >
        A custom sales CRM for a Bengaluru manufacturer of PUF panels, purlins
        and roofing sheets. It takes an enquiry from the first ad click all the
        way to a dispatched order and a received payment, in one app the whole
        team uses every day.
      </p>

      <dl
        data-reveal
        className="mt-12 grid gap-6 border-y border-line py-8 sm:grid-cols-4"
      >
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-sm text-ink-soft">{f.label}</dt>
            <dd className="mt-1">{f.value}</dd>
          </div>
        ))}
      </dl>

      <section
        data-reveal
        className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4"
      >
        {stats.map((s) => (
          <div key={s.label} className="rounded-3xl bg-paper-2 p-6">
            <p className="font-display text-5xl leading-none sm:text-6xl">
              {s.value}
            </p>
            <p className="mt-3 text-sm text-ink-soft">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="mt-24">
        <h2 data-reveal className="font-display text-4xl sm:text-6xl">
          The problem
        </h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          {problems.map((p, i) => (
            <div key={p.title} data-reveal>
              <p className="text-sm text-accent">0{i + 1}</p>
              <h3 className="mt-2 text-xl font-medium">{p.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24">
        <h2 data-reveal className="font-display text-4xl sm:text-6xl">
          One path from <em className="text-accent">enquiry</em> to payment
        </h2>
        <ol
          data-reveal
          className="mt-10 grid gap-3 sm:grid-cols-6"
          aria-label="Lead to payment flow"
        >
          {flow.map((f, i) => (
            <li
              key={f.step}
              className="relative rounded-2xl border border-line p-4"
            >
              <span className="text-xs text-ink-soft">Step {i + 1}</span>
              <p className="mt-1 text-lg font-medium">{f.step}</p>
              <p className="mt-1 text-sm text-ink-soft">{f.note}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24">
        <h2 data-reveal className="font-display text-4xl sm:text-6xl">
          What I built
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {modules.map((m) => (
            <div
              key={m.group}
              data-reveal
              className="rounded-3xl border border-line p-8"
            >
              <h3 className="font-display text-3xl">{m.group}</h3>
              <ul className="mt-5 space-y-3 text-ink-soft">
                {m.items.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden className="text-accent">
                      ✺
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          data-reveal
          className="mt-6 rounded-3xl bg-ink p-8 text-paper sm:p-10"
        >
          <p className="text-sm tracking-widest uppercase opacity-70">
            Built in
          </p>
          <h3 className="mt-2 font-display text-3xl sm:text-4xl">
            Alex, the AI sales assistant
          </h3>
          <p className="mt-4 max-w-3xl leading-relaxed opacity-80">
            Agents can ask Alex questions about their leads, follow-ups and
            quotations in plain language. It runs on the Claude API, called
            from the CRM&apos;s own server so the API key never reaches the
            browser.
          </p>
        </div>
      </section>

      <section className="mt-24">
        <h2 data-reveal className="font-display text-4xl sm:text-6xl">
          Key decisions
        </h2>
        <div className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {decisions.map((d) => (
            <div key={d.title} data-reveal className="border-t border-line pt-6">
              <h3 className="text-xl font-medium">{d.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24">
        <h2 data-reveal className="font-display text-4xl sm:text-6xl">
          Hard problems, solved
        </h2>
        <div className="mt-10 space-y-6">
          {challenges.map((c) => (
            <div
              key={c.title}
              data-reveal
              className="grid gap-6 rounded-3xl bg-paper-2 p-8 sm:grid-cols-[1fr_1.4fr]"
            >
              <div>
                <h3 className="text-xl font-medium">{c.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-soft">
                  {c.problem}
                </p>
              </div>
              <div>
                <p className="text-sm tracking-widest text-accent uppercase">
                  The fix
                </p>
                <p className="mt-3 leading-relaxed">{c.fix}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24 grid gap-12 sm:grid-cols-2">
        <div data-reveal>
          <h2 className="font-display text-4xl sm:text-5xl">Outcome</h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink-soft">
            <p>
              Every enquiry now lands in one place, is checked for duplicates
              and reaches an agent automatically. Over 6,000 leads and 27,000
              follow-up notes live in a single MySQL database instead of
              scattered sheets.
            </p>
            <p>
              Quotations, job cards and payments are connected to the lead
              that started them, so management can follow any order from the
              first call to dispatch.
            </p>
          </div>
        </div>
        <div data-reveal>
          <h2 className="font-display text-4xl sm:text-5xl">What&apos;s next</h2>
          <ul className="mt-6 space-y-4 text-lg leading-relaxed text-ink-soft">
            {next.map((n) => (
              <li key={n} className="flex gap-3">
                <span aria-hidden className="text-accent">
                  →
                </span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        data-reveal
        className="mt-24 flex flex-col items-start gap-6 border-t border-line pt-12 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="font-display text-3xl sm:text-4xl">
          Need a tool built around how your team works?
        </p>
        <Link
          href="/contact"
          className="rounded-full bg-ink px-6 py-3 text-paper hover:bg-accent"
        >
          Let&apos;s talk
        </Link>
      </section>
    </article>
  );
}
