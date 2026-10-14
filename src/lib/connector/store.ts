import { useSyncExternalStore } from "react";
import type { NetworkId } from "@/components/connector/SocialIcon";

/*
 * Client-side workspace store for the dashboard demo.
 * Persists to localStorage; swap `persist`/`load` for API calls when a backend exists.
 */

export type Account = { id: string; network: NetworkId; name: string; handle: string; connectedAt: string };
export type PostStatus = "scheduled" | "draft" | "published" | "pending" | "rejected";
export type Post = {
  id: string;
  text: string;
  accountIds: string[];
  scheduledAt: string;
  status: PostStatus;
  tagIds: string[];
  media: string[];
  author: string;
};
export type Group = { id: string; name: string; accountIds: string[] };
export type Tag = { id: string; name: string; color: string };
export type SimpleItem = { id: string; title: string; value: string };
export type Message = { id: string; from: string; text: string; at: string; mine?: boolean };
export type Conversation = { id: string; network: NetworkId; name: string; kind: "comment" | "dm" | "review"; messages: Message[]; read: boolean };
export type QueueSlot = { day: number; time: string };

export type State = {
  accounts: Account[];
  posts: Post[];
  groups: Group[];
  tags: Tag[];
  library: SimpleItem[];
  customFields: SimpleItem[];
  mentionGroups: SimpleItem[];
  feeds: SimpleItem[];
  utm: SimpleItem[];
  queue: QueueSlot[];
  inbox: Conversation[];
};

export type ListKey = "library" | "customFields" | "mentionGroups" | "feeds" | "utm";

const KEY = "smc-workspace-v1";

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Monday 00:00 of the current week (local time). */
export function weekStart(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function at(dayOffset: number, h: number, m = 0) {
  const d = weekStart();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function seed(): State {
  const accounts: Account[] = [
    { id: "a1", network: "facebook", name: "Global Ventures", handle: "globalventures", connectedAt: at(-30, 10) },
    { id: "a2", network: "instagram", name: "Johnny's Pizzeria", handle: "johnnyspizza", connectedAt: at(-21, 10) },
    { id: "a3", network: "x", name: "Steve Brown", handle: "stevebrown", connectedAt: at(-14, 10) },
    { id: "a4", network: "linkedin", name: "Code Junction", handle: "code-junction", connectedAt: at(-10, 10) },
    { id: "a5", network: "youtube", name: "Global Ventures TV", handle: "globalventurestv", connectedAt: at(-7, 10) },
    { id: "a6", network: "google", name: "Johnny's Pizzeria — MG Road", handle: "johnnys-mg-road", connectedAt: at(-5, 10) },
  ];
  const tags: Tag[] = [
    { id: "t1", name: "Promo", color: "#673DE6" },
    { id: "t2", name: "Evergreen", color: "#00B090" },
    { id: "t3", name: "Festival", color: "#FEA419" },
  ];
  const p = (id: string, d: number, h: number, accountIds: string[], text: string, status: PostStatus = "scheduled", tagIds: string[] = []): Post => ({
    id, text, accountIds, scheduledAt: at(d, h), status, tagIds, media: [], author: "You",
  });
  const posts: Post[] = [
    p("p1", 0, 8, ["a3"], "Innovate. Expand. Lead. 🚀 Unlock new opportunities this week.", "published"),
    p("p2", 0, 11, ["a1"], "Utilising new features to grow your brand. Learn more on our blog.", "published", ["t2"]),
    p("p3", 1, 8, ["a3"], "Smart strategy, stronger presence. Here's our 3-step plan."),
    p("p4", 2, 8, ["a2"], "Double the pizza, double the fun 🍕 Buy 1 Get 1 free today!", "scheduled", ["t1"]),
    p("p5", 3, 8, ["a4"], "Code today, innovate tomorrow. Every line counts."),
    p("p6", 4, 8, ["a5"], "Want to grow your brand online? New video out now.", "scheduled", ["t2"]),
    p("p7", 5, 8, ["a2", "a6"], "Savour the taste of perfection at our MG Road outlet.", "scheduled", ["t1"]),
    p("p8", 6, 8, ["a1"], "Connecting brands worldwide with smarter social.", "pending"),
    p("p9", 9, 10, ["a1", "a4"], "Diwali offer: 20% off every plan this week ✨ #FestiveSale", "pending", ["t3"]),
    p("p10", 2, 15, ["a3"], "Thread: 5 lessons from scaling a remote team 🧵", "draft"),
  ];
  return {
    accounts,
    posts,
    tags,
    groups: [
      { id: "g1", name: "Johnny's Pizzeria", accountIds: ["a2", "a6"] },
      { id: "g2", name: "Global Ventures", accountIds: ["a1", "a5"] },
    ],
    library: [
      { id: "l1", title: "Weekend offer caption", value: "This weekend only: flat 20% off. Tag a friend who needs this! 🎉" },
      { id: "l2", title: "Hiring post", value: "We're hiring! Join a team that ships every week. Apply via the link in bio." },
      { id: "l3", title: "Thank-you post", value: "10K followers! Thank you for being part of our journey 💜" },
    ],
    customFields: [
      { id: "c1", title: "website", value: "https://example.com" },
      { id: "c2", title: "phone", value: "+91 98765 43210" },
    ],
    mentionGroups: [{ id: "m1", title: "Partners", value: "@codejunction @globalventures" }],
    feeds: [{ id: "f1", title: "Company blog", value: "https://example.com/blog/rss.xml" }],
    utm: [{ id: "u1", title: "Festive campaign", value: "utm_source=social&utm_medium=post&utm_campaign=diwali" }],
    queue: [0, 1, 2, 3, 4].flatMap((day) => [
      { day, time: "09:00" },
      { day, time: "13:00" },
      { day, time: "18:30" },
    ]),
    inbox: [
      { id: "i1", network: "instagram", name: "riya.designs", kind: "comment", read: false, messages: [{ id: uid(), from: "riya.designs", text: "Love this! Is the pizza available for delivery?", at: at(0, 12) }] },
      { id: "i2", network: "facebook", name: "Arjun Mehta", kind: "dm", read: false, messages: [{ id: uid(), from: "Arjun Mehta", text: "Hi, what time do you open on Sunday?", at: at(0, 9) }] },
      { id: "i3", network: "google", name: "Kavya N.", kind: "review", read: true, messages: [{ id: uid(), from: "Kavya N.", text: "★★★★★ Amazing service and the best margherita in town!", at: at(-1, 20) }] },
      { id: "i4", network: "linkedin", name: "Sanjay Rao", kind: "comment", read: true, messages: [{ id: uid(), from: "Sanjay Rao", text: "Great post — sharing with my team.", at: at(-2, 14) }] },
    ],
  };
}

const SERVER_SNAPSHOT = seed();
let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...seed(), ...(JSON.parse(raw) as Partial<State>) } : seed();
  } catch {
    state = seed();
  }
  return state;
}

function persist(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — keep in memory */
  }
}

export function update(fn: (s: State) => State) {
  state = fn(load());
  persist(state);
  listeners.forEach((l) => l());
}

export function resetWorkspace() {
  state = seed();
  persist(state);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useWorkspace(): State {
  return useSyncExternalStore(subscribe, load, () => SERVER_SNAPSHOT);
}

/* ---- helpers ---- */

export function addPost(post: Omit<Post, "id">) {
  const id = uid();
  update((s) => ({ ...s, posts: [...s.posts, { ...post, id }] }));
  return id;
}

export function patchPost(id: string, patch: Partial<Post>) {
  update((s) => ({ ...s, posts: s.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
}

export function removePost(id: string) {
  update((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id) }));
}

export function addListItem(key: ListKey, item: Omit<SimpleItem, "id">) {
  update((s) => ({ ...s, [key]: [...s[key], { ...item, id: uid() }] }));
}

export function removeListItem(key: ListKey, id: string) {
  update((s) => ({ ...s, [key]: s[key].filter((x) => x.id !== id) }));
}

/** Deterministic pseudo-random series so demo analytics stay stable per key. */
export function series(key: string, n: number, base: number, spread: number) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    v = Math.max(0, v + ((h % 1000) / 1000 - 0.42) * spread);
    out.push(Math.round(v));
  }
  return out;
}

export function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);
}
