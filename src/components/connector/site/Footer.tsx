import Link from "next/link";
import Logo from "../Logo";
import SocialIcon from "../SocialIcon";
import { APP, BASE, features, resources, solutions } from "@/lib/connector/data";

export default function Footer() {
  const cols = [
    { title: "Platform", links: features.slice(0, 7).map((f) => ({ label: f.label, href: `${BASE}/features/${f.slug}` })) },
    { title: "Solutions", links: solutions.slice(0, 7).map((s) => ({ label: s.label, href: `${BASE}/solutions/${s.slug}` })) },
    { title: "Resources", links: resources.slice(0, 7).map((r) => ({ label: r.label, href: r.href })) },
    {
      title: "Company",
      links: [
        { label: "Pricing", href: `${BASE}/plans` },
        { label: "Listings pricing", href: `${BASE}/listings/plans` },
        { label: "Customer stories", href: `${BASE}/case-study` },
        { label: "Video tutorials", href: `${BASE}/video-tutorials` },
        { label: "Webinars", href: `${BASE}/webinars` },
        { label: "Help center", href: `${BASE}/help` },
        { label: "Log in", href: `${APP}/launchpad` },
      ],
    },
  ];
  return (
    <footer className="bg-night text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div>
            <Logo light />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">
              One dashboard to connect every social profile, review site and business listing your brand owns.
            </p>
            <div className="mt-6 flex gap-2">
              {(["facebook", "instagram", "x", "linkedin", "youtube"] as const).map((n) => (
                <SocialIcon key={n} id={n} size={32} rounded="full" />
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="mb-4 font-bold">{c.title}</p>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-white/60 transition-colors hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-sm text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} Social Media Connector. All rights reserved.</p>
          <p className="flex flex-wrap gap-4">
            <Link href={`${BASE}/privacy`} className="hover:text-white">Privacy policy</Link>
            <Link href={`${BASE}/terms`} className="hover:text-white">Terms &amp; data deletion</Link>
            <span>Prices are listed in INR and exclude GST.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
