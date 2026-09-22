"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Project } from "@/lib/types";

const covers = [
  "linear-gradient(135deg, #ff5a36 0%, #ffb199 100%)",
  "linear-gradient(135deg, #2f5bff 0%, #a9bbff 100%)",
  "linear-gradient(135deg, #16140f 0%, #6b6456 100%)",
  "linear-gradient(135deg, #1f9d6b 0%, #b8f0d6 100%)",
  "linear-gradient(135deg, #f2b705 0%, #fff0b3 100%)",
];

function coverFor(project: Project, index: number) {
  return project.image_url
    ? `center / cover no-repeat url("${encodeURI(project.image_url)}")`
    : covers[index % covers.length];
}

export default function WorkList({ projects }: { projects: Project[] }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    let x = 0;
    let y = 0;
    let cx = 0;
    let cy = 0;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
    };
    const tick = () => {
      cx += (x - cx) * 0.12;
      cy += (y - cy) * 0.12;
      const tilt = Math.max(-8, Math.min(8, (x - cx) * 0.08));
      preview.style.transform = `translate3d(${cx}px, ${cy}px, 0) rotate(${tilt}deg)`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  if (!projects.length) {
    return (
      <p className="py-10 text-ink-soft">
        New work is on the way. Check back soon.
      </p>
    );
  }

  return (
    <div className="relative">
      <ul className="border-t border-line">
        {projects.map((project, i) => (
          <li key={project.id} className="border-b border-line">
            <Link
              href={`/projects/${project.slug}`}
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              className="group grid grid-cols-[3rem_1fr] items-baseline gap-x-4 py-6 sm:grid-cols-[4rem_1fr_auto] sm:py-8"
            >
              <span className="text-sm text-ink-soft tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-3xl leading-tight transition-transform duration-500 group-hover:translate-x-3 group-hover:italic sm:text-5xl">
                {project.title}
              </span>
              <span className="col-start-2 mt-2 flex flex-wrap gap-2 sm:col-start-auto sm:mt-0 sm:justify-end">
                {project.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-line px-3 py-1 text-xs text-ink-soft"
                  >
                    {tag}
                  </span>
                ))}
              </span>
              <span
                aria-hidden
                className="col-span-full mt-4 block aspect-[16/10] rounded-xl sm:hidden"
                style={{ background: coverFor(project, i) }}
              />
            </Link>
          </li>
        ))}
      </ul>

      <div
        ref={previewRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-40 hidden sm:block"
      >
        <div
          className="-mt-32 -ml-44 h-64 w-88 overflow-hidden rounded-2xl shadow-2xl transition-[opacity,scale] duration-300 ease-out"
          style={{
            opacity: active === null ? 0 : 1,
            scale: active === null ? "0.6" : "1",
            background:
              active === null ? undefined : coverFor(projects[active], active),
          }}
        />
      </div>
    </div>
  );
}
