"use client";

import { useState } from "react";
import VideoTrigger, { VideoThumb } from "./VideoModal";
import type { VideoItem } from "@/lib/connector/data";

export default function VideoGallery({ videos }: { videos: VideoItem[] }) {
  const cats = ["All", ...Array.from(new Set(videos.map((v) => v.category)))];
  const [cat, setCat] = useState("All");
  const list = cat === "All" ? videos : videos.filter((v) => v.category === cat);
  return (
    <>
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`rounded-full px-4 py-2 text-sm font-bold ring-1 transition-colors ${
              cat === c ? "bg-primary text-white ring-primary" : "bg-white text-ink-2 ring-line hover:text-primary"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((v) => (
          <VideoTrigger key={v.slug} video={v} className="group text-left">
            <VideoThumb title={v.title} label={v.category} />
            <p className="mt-4 font-bold text-ink group-hover:text-primary">{v.title}</p>
            <p className="mt-1 text-sm text-muted">{v.duration}</p>
          </VideoTrigger>
        ))}
      </div>
    </>
  );
}
