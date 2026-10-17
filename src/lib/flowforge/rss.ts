import "server-only";
import { safeFetch } from "./safe-fetch";

export interface FeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  published: string;
  image?: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .trim();
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

function attr(xml: string, name: string, attribute: string, filter?: RegExp): string {
  for (const m of xml.matchAll(new RegExp(`<${name}\\b([^>]*)/?>`, "gi"))) {
    if (filter && !filter.test(m[1])) continue;
    const a = m[1].match(new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
    if (a) return decode(a[1]);
  }
  return "";
}

const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Parses RSS 2.0 <item>s and Atom <entry>s, newest first as published. */
export function parseFeed(xml: string): FeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  return blocks.map((b) => {
    const link = tag(b, "link") || attr(b, "link", "href", /rel=["']alternate["']/) || attr(b, "link", "href");
    const description = tag(b, "description") || tag(b, "summary") || tag(b, "content") || tag(b, "media:description");
    return {
      id: tag(b, "guid") || tag(b, "id") || link,
      title: stripHtml(tag(b, "title")),
      link,
      description: stripHtml(description).slice(0, 2000),
      published: tag(b, "pubDate") || tag(b, "published") || tag(b, "updated"),
      image: attr(b, "media:thumbnail", "url") || attr(b, "media:content", "url") || attr(b, "enclosure", "url") || undefined,
    };
  });
}

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  const res = await safeFetch(url, { headers: { "User-Agent": "FlowForge/1.0 (+RSS trigger)" } });
  if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}`);
  return parseFeed(await res.text());
}
