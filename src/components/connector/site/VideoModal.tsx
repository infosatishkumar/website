"use client";

import { useEffect, useState, type ReactNode } from "react";
import Icon from "../Icon";
import DemoPlayer from "./DemoPlayer";
import type { VideoItem } from "@/lib/connector/data";

export function VideoModal({
  video,
  onClose,
}: {
  video: Pick<VideoItem, "title" | "scene" | "youtubeId">;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-night/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      onClick={onClose}
    >
      <div className="menu-in w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between text-white">
          <p className="font-bold">{video.title}</p>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Close video">
            <Icon name="close" size={22} />
          </button>
        </div>
        {video.youtubeId ? (
          <div className="aspect-video overflow-hidden rounded-xl bg-black">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1`}
              title={video.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <DemoPlayer start={video.scene} />
        )}
      </div>
    </div>
  );
}

/** Wraps any trigger; clicking it opens the video modal. */
export default function VideoTrigger({
  video,
  children,
  className = "",
}: {
  video: Pick<VideoItem, "title" | "scene" | "youtubeId">;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && <VideoModal video={video} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Thumbnail with play button in Hostinger purple. */
export function VideoThumb({ title, label }: { title: string; label?: string }) {
  return (
    <span className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-deep">
      <span className="hero-glow absolute inset-0" />
      <span className="dot-grid absolute inset-0 opacity-50" />
      <span className="absolute inset-x-[12%] bottom-0 top-[22%] rounded-t-lg bg-white/95 p-2 shadow-xl transition-transform duration-300 group-hover:-translate-y-1">
        <span className="grid h-full grid-cols-4 gap-1">
          {Array.from({ length: 8 }).map((_, k) => (
            <span key={k} className="rounded bg-canvas" />
          ))}
        </span>
      </span>
      <span className="absolute left-3 top-3 max-w-[70%] text-left text-xs font-bold leading-tight text-white sm:text-sm">
        {label ?? title}
      </span>
      <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-4 ring-white/30 transition-transform group-hover:scale-110">
        <Icon name="play" size={18} className="translate-x-[1px]" />
      </span>
    </span>
  );
}
