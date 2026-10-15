"use client";

import Link from "next/link";
import { useState } from "react";
import { IconTile } from "@/components/connector/Icon";
import { PageHeader } from "@/components/connector/app/ui";
import { APP } from "@/lib/connector/data";

const bank = [
  { cat: "Restaurant", icon: "utensils", text: "Today's special just dropped 🍝 Come hungry, leave happy. Table bookings via the link in bio!" },
  { cat: "Restaurant", icon: "utensils", text: "Weekend brunch is back! Bottomless coffee and fresh waffles from 9 AM ☕🧇" },
  { cat: "Real estate", icon: "home", text: "Open house this Sunday 🏡 3 BHK with a sunlit balcony. DM us to book a slot." },
  { cat: "Real estate", icon: "home", text: "Buying your first home? Here are 5 questions to ask before you sign." },
  { cat: "Healthcare", icon: "stethoscope", text: "A 10-minute walk after meals can help regulate blood sugar. Small habits, big impact 💙" },
  { cat: "E-commerce", icon: "cart", text: "Restocked and ready 🛍️ Your favourites are back — grab them before they're gone!" },
  { cat: "E-commerce", icon: "cart", text: "Free shipping this week only 🚚 No code needed." },
  { cat: "Agency", icon: "megaphone", text: "Case study: how we grew a local café's reach by 212% in 90 days 📈" },
  { cat: "Festivals", icon: "sparkles", text: "Wishing you a Diwali full of light, love and prosperity ✨ #HappyDiwali" },
  { cat: "Festivals", icon: "sparkles", text: "Merry Christmas from all of us! 🎄 Thank you for an amazing year." },
  { cat: "Engagement", icon: "chat", text: "This or that? ☕ Coffee or 🍵 Tea — tell us in the comments!" },
  { cat: "Engagement", icon: "chat", text: "Caption this photo 👇 Best answer gets a shout-out!" },
];

export default function TemplatesPage() {
  const cats = ["All", ...Array.from(new Set(bank.map((b) => b.cat)))];
  const [cat, setCat] = useState("All");
  const list = cat === "All" ? bank : bank.filter((b) => b.cat === cat);
  return (
    <>
      <PageHeader title="Content bank" sub="Ready-to-post captions for every industry and occasion." />
      <div className="mb-5 flex flex-wrap gap-2">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-full px-4 py-1.5 text-sm font-bold ring-1 ${cat === c ? "bg-primary text-white ring-primary" : "bg-surface text-ink-2 ring-line"}`}>{c}</button>
        ))}
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((b) => (
          <div key={b.text} className="card flex flex-col p-5">
            <div className="flex items-center gap-3">
              <IconTile name={b.icon} size="sm" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">{b.cat}</span>
            </div>
            <p className="mt-4 flex-1 text-ink">{b.text}</p>
            <Link href={`${APP}/posts?text=${encodeURIComponent(b.text)}`} className="btn btn-outline btn-sm mt-5 self-start">Use template</Link>
          </div>
        ))}
      </div>
    </>
  );
}
