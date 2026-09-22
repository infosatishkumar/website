import Link from "next/link";

const socials = [
  { href: "https://github.com/infosatishkumar", label: "GitHub" },
  { href: "https://twitter.com/infosatishkumar", label: "Twitter" },
  { href: "https://satishkumar.net", label: "Website" },
];

export default function Footer() {
  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-5 pt-20 pb-10 sm:px-8">
        <p className="text-sm tracking-widest text-paper/60 uppercase">
          Have an idea?
        </p>
        <Link
          href="/contact"
          className="group mt-4 block font-display text-5xl leading-[0.95] sm:text-8xl"
        >
          Let&apos;s make
          <br />
          something{" "}
          <em className="text-accent transition-all duration-500 group-hover:tracking-wide">
            move
          </em>
          <span className="wobble ml-3">↗</span>
        </Link>

        <div className="mt-20 flex flex-col gap-6 border-t border-paper/15 pt-8 text-sm text-paper/60 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Satish Kumar · Bengaluru</p>
          <ul className="flex gap-6">
            {socials.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-paper"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
