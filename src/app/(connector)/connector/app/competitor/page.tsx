"use client";

import { useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon from "@/components/connector/SocialIcon";
import { BarChart, LineChart } from "@/components/connector/app/Charts";
import { Card, DemoNote, PageHeader } from "@/components/connector/app/ui";
import { fmt, series } from "@/lib/connector/store";

export default function CompetitorPage() {
  const [mine, setMine] = useState("johnnyspizza");
  const [rival, setRival] = useState("");
  const [compare, setCompare] = useState<[string, string] | null>(null);

  const stats = (h: string) => {
    const f = series(`${h}-f`, 12, 3000 + h.length * 700, 260);
    const e = series(`${h}-e`, 1, 40, 30)[0] / 10 + 1.5;
    const p = series(`${h}-p`, 1, 20, 12)[0] + 8;
    return { followers: f, er: e, posts: p };
  };
  const a = compare ? stats(compare[0]) : null;
  const b = compare ? stats(compare[1]) : null;

  return (
    <>
      <PageHeader title="Competitor analysis" sub="Compare your Instagram head-to-head with any public profile." />
      <Card>
        <form className="flex flex-col gap-3 md:flex-row md:items-end" onSubmit={(e) => { e.preventDefault(); if (mine.trim() && rival.trim()) setCompare([mine.trim().replace(/^@/, ""), rival.trim().replace(/^@/, "")]); }}>
          <label className="flex-1 text-sm font-medium text-ink">
            Your profile
            <input value={mine} onChange={(e) => setMine(e.target.value)} className="field mt-1.5" placeholder="@yourbrand" />
          </label>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-xl bg-night text-xs font-bold text-white md:mb-0.5">VS</span>
          <label className="flex-1 text-sm font-medium text-ink">
            Competitor
            <input value={rival} onChange={(e) => setRival(e.target.value)} className="field mt-1.5" placeholder="@competitor" />
          </label>
          <button type="submit" className="btn btn-primary"><Icon name="compare" size={18} /> Compare</button>
        </form>
      </Card>

      {compare && a && b && (
        <div className="mt-6 space-y-6">
          <DemoNote>Sample comparison for the design preview — live numbers require the Instagram Graph API.</DemoNote>
          <div className="grid gap-6 md:grid-cols-2">
            {[{ h: compare[0], s: a, me: true }, { h: compare[1], s: b, me: false }].map(({ h, s, me }) => (
              <Card key={h}>
                <div className="flex items-center gap-3">
                  <SocialIcon id="instagram" size={40} rounded="full" />
                  <div>
                    <p className="font-bold text-ink">@{h}</p>
                    <p className="text-sm text-muted">{me ? "You" : "Competitor"}</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-canvas p-3"><p className="text-xl font-bold text-ink">{fmt(s.followers[11])}</p><p className="text-xs text-muted">Followers</p></div>
                  <div className="rounded-xl bg-canvas p-3"><p className="text-xl font-bold text-ink">{s.er.toFixed(1)}%</p><p className="text-xs text-muted">Engagement</p></div>
                  <div className="rounded-xl bg-canvas p-3"><p className="text-xl font-bold text-ink">{s.posts}</p><p className="text-xs text-muted">Posts / mo</p></div>
                </div>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card title={`Follower trend · @${compare[0]}`}><LineChart data={a.followers} color="#673DE6" /></Card>
            <Card title={`Follower trend · @${compare[1]}`}><LineChart data={b.followers} color="#FC5185" /></Card>
          </div>
          <Card title="Engagement rate (%)">
            <BarChart data={[Math.round(a.er * 10) / 10, Math.round(b.er * 10) / 10]} labels={[`@${compare[0]}`, `@${compare[1]}`]} height={180} />
          </Card>
        </div>
      )}
    </>
  );
}
