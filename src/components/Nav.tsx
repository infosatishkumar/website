"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/projects", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Journal" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 bg-paper/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="font-display text-2xl leading-none">
          Satish<span className="text-accent">.</span>
        </Link>
        <ul className="flex gap-4 text-sm sm:gap-8">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`relative transition-colors hover:text-ink ${
                    active ? "text-ink" : "text-ink-soft"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute -bottom-1.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-accent" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
