"use client";

import Link from "next/link";
import ListManager from "@/components/connector/app/ListManager";
import { APP } from "@/lib/connector/data";

export default function LibraryPage() {
  return (
    <ListManager
      listKey="library"
      title="Content library"
      sub="Saved captions your team can reuse from the composer."
      icon="library"
      titleLabel="Title"
      valueLabel="Caption"
      titlePlaceholder="Weekend offer"
      valuePlaceholder="This weekend only…"
      multiline
      renderValue={(v) => (
        <>
          {v}{" "}
          <Link href={`${APP}/posts?text=${encodeURIComponent(v)}`} className="font-bold text-primary">Use</Link>
        </>
      )}
    />
  );
}
