"use client";

import ListManager from "@/components/connector/app/ListManager";

export default function FeedsPage() {
  return (
    <ListManager
      listKey="feeds"
      title="RSS feeds"
      sub="Add blog or news feeds and turn new articles into posts automatically."
      icon="rss"
      titleLabel="Feed name"
      valueLabel="Feed URL"
      titlePlaceholder="Company blog"
      valuePlaceholder="https://example.com/rss.xml"
    />
  );
}
