"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import SocialIcon, { networkMeta, type NetworkId } from "@/components/connector/SocialIcon";
import { BarChart, Donut, Kpi, LineChart } from "@/components/connector/app/Charts";
import { Card, DemoNote, PageHeader } from "@/components/connector/app/ui";
import { APP } from "@/lib/connector/data";
import { fmt, series, useWorkspace } from "@/lib/connector/store";

/** URL slug → network. `X` and `gmb` mirror the familiar app URLs. */
const slugs: Record<string, NetworkId> = {
  x: "x", twitter: "x", facebook: "facebook", instagram: "instagram", linkedin: "linkedin",
  gmb: "google", google: "google", youtube: "youtube", tiktok: "tiktok", pinterest: "pinterest",
  threads: "threads", bluesky: "bluesky",
};
const tabs: { slug: string; id: NetworkId }[] = [
  { slug: "X", id: "x" }, { slug: "facebook", id: "facebook" }, { slug: "instagram", id: "instagram" },
  { slug: "linkedin", id: "linkedin" }, { slug: "gmb", id: "google" }, { slug: "youtube", id: "youtube" }, { slug: "tiktok", id: "tiktok" },
];

const ranges = { "7d": 7, "30d": 30, "90d": 90 } as const;

export default function AnalyticsPage() {
  const { network } = useParams<{ network: string }>();
  const id = slugs[network.toLowerCase()];
  const ws = useWorkspace();
  const [range, setRange] = useState<keyof typeof ranges>("30d");

  if (!id) {
    return <p className="text-ink-2">Unknown network. <Link href={`${APP}/analytics/facebook`} className="font-bold text-primary">Open Facebook analytics</Link></p>;
  }

  const n = ranges[range];
  const key = `${id}-${range}`;
  const followers = series(`${key}-f`, n, 4000 + id.length * 900, 140);
  const reach = series(`${key}-r`, n, 2400, 900);
  const eng = series(`${key}-e`, 7, 300, 260);
  const labels = Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  });
  const totalReach = reach.reduce((a, b) => a + b, 0);
  const growth = followers[followers.length - 1] - followers[0];
  const accounts = ws.accounts.filter((a) => a.network === id);
  const color = id === "x" || id === "tiktok" || id === "threads" ? "#673DE6" : networkMeta[id].color;

  return (
    <>
      <PageHeader
        title={`${networkMeta[id].name} analytics`}
        sub={accounts.length ? accounts.map((a) => a.name).join(", ") : "No account connected for this network yet."}
        actions={
          <div className="flex overflow-hidden rounded-lg border border-line bg-white">
            {(Object.keys(ranges) as (keyof typeof ranges)[]).map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)} className={`px-3 py-2 text-sm font-bold ${range === r ? "bg-primary text-white" : "text-ink-2"}`}>Last {r}</button>
            ))}
          </div>
        }
      />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link key={t.slug} href={`${APP}/analytics/${t.slug}`} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ring-1 ${t.id === id ? "bg-white text-primary ring-primary" : "bg-white text-ink-2 ring-line"}`}>
            <SocialIcon id={t.id} size={18} rounded="full" /> {networkMeta[t.id].name.replace(" (Twitter)", "")}
          </Link>
        ))}
      </div>
      <DemoNote>Sample numbers for the design preview. Connect the {networkMeta[id].name} API on a backend to show live insights here.</DemoNote>
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Followers" value={fmt(followers[followers.length - 1])} delta={`${growth >= 0 ? "+" : ""}${growth}`} up={growth >= 0} />
        <Kpi label="Reach" value={fmt(totalReach)} delta="12.4%" />
        <Kpi label="Engagement rate" value={`${(eng.reduce((a, b) => a + b, 0) / Math.max(totalReach, 1) * 100 * 4).toFixed(1)}%`} delta="0.8%" />
        <Kpi label="Posts published" value={String(ws.posts.filter((p) => p.status === "published" && p.accountIds.some((a) => accounts.some((x) => x.id === a))).length + n / 3 | 0)} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Audience growth"><LineChart data={followers} labels={labels} color={color} /></Card>
        <Card title="Engagement by type">
          <Donut parts={[
            { label: "Likes", value: eng[0] + 400, color: "#673DE6" },
            { label: "Comments", value: eng[1] + 120, color: "#8C85FF" },
            { label: "Shares", value: eng[2] + 80, color: "#00B090" },
            { label: "Saves", value: eng[3] + 60, color: "#FEA419" },
          ]} />
        </Card>
        <Card title="Engagement by weekday"><BarChart data={eng} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} color={color} /></Card>
        <Card title="Best time to post">
          <div className="grid grid-cols-6 gap-1 text-[10px] text-muted">
            {["", "9AM", "12PM", "3PM", "6PM", "9PM"].map((h) => <span key={h} className="text-center font-bold">{h}</span>)}
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, r) => (
              <div key={d} className="contents">
                <span className="font-bold">{d}</span>
                {series(`${key}-h${r}`, 5, 50, 60).map((v, c) => (
                  <span key={c} className="h-6 rounded" style={{ background: "#673DE6", opacity: Math.min(1, 0.12 + v / 140) }} title={`${d} ${c}`} />
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
