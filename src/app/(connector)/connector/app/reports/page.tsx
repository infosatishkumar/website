"use client";

import { useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon from "@/components/connector/SocialIcon";
import AccountPicker from "@/components/connector/app/AccountPicker";
import { BarChart, Kpi, LineChart } from "@/components/connector/app/Charts";
import { Card, DemoNote, PageHeader, Toggle } from "@/components/connector/app/ui";
import { LogoMark } from "@/components/connector/Logo";
import { fmt, series, useWorkspace } from "@/lib/connector/store";

const sectionsAll = ["Summary", "Audience growth", "Top posts", "Engagement by day"] as const;

export default function ReportsPage() {
  const ws = useWorkspace();
  const [ids, setIds] = useState<string[]>([]);
  const [title, setTitle] = useState("Monthly performance report");
  const [days, setDays] = useState(30);
  const [sections, setSections] = useState<string[]>([...sectionsAll]);
  const [whiteLabel, setWhiteLabel] = useState(false);
  const [generated, setGenerated] = useState(false);

  const chosen = ws.accounts.filter((a) => ids.includes(a.id));
  const key = `${ids.join("-")}-${days}`;
  const growth = series(`${key}-g`, Math.min(days, 30), 8000, 220);
  const reach = series(`${key}-r`, 1, 60000, 30000)[0] * Math.max(1, chosen.length);
  const top = ws.posts.filter((p) => p.status === "published" || p.status === "scheduled").slice(0, 4);

  return (
    <>
      <PageHeader title="Reports" sub="Build a client-ready report and download it as PDF." />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-6 print:hidden">
          <Card title="Accounts"><AccountPicker selected={ids} onChange={(v) => { setIds(v); setGenerated(false); }} /></Card>
          <Card title="Settings">
            <label className="block text-sm font-medium text-ink">
              Report title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="field mt-1.5" />
            </label>
            <label className="mt-4 block text-sm font-medium text-ink">
              Date range
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="field mt-1.5">
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </label>
            <p className="mt-4 text-sm font-medium text-ink">Sections</p>
            <div className="mt-2 space-y-2">
              {sectionsAll.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" className="accent-[#673DE6]" checked={sections.includes(s)} onChange={(e) => setSections(e.target.checked ? [...sections, s] : sections.filter((x) => x !== s))} />
                  {s}
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
              <span className="text-sm font-medium text-ink">White label</span>
              <Toggle on={whiteLabel} onChange={setWhiteLabel} label="White label" />
            </div>
            <button type="button" disabled={ids.length === 0} onClick={() => setGenerated(true)} className="btn btn-primary mt-5 w-full disabled:opacity-40">Generate report</button>
          </Card>
        </div>

        <div>
          {!generated ? (
            <Card>
              <div className="flex flex-col items-center py-16 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-tint text-primary"><Icon name="report" size={30} /></span>
                <p className="mt-4 text-lg font-bold text-ink">Pick accounts and generate</p>
                <p className="mt-1 max-w-sm text-ink-2">Your report preview appears here, ready to print or save as PDF.</p>
              </div>
            </Card>
          ) : (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between bg-primary px-6 py-5 text-white">
                <div>
                  <p className="text-xl font-bold">{title}</p>
                  <p className="text-sm text-white/75">Last {days} days · generated {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
                {!whiteLabel ? <LogoMark size={40} /> : <span className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-bold">Your logo</span>}
              </div>
              <div className="space-y-8 p-6">
                <DemoNote>Report figures are sample data until network APIs are connected.</DemoNote>
                <div className="flex flex-wrap gap-3">{chosen.map((a) => <span key={a.id} className="inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1 text-sm"><SocialIcon id={a.network} size={16} rounded="full" />{a.name}</span>)}</div>
                {sections.includes("Summary") && (
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Kpi label="Total reach" value={fmt(reach)} delta="14%" />
                    <Kpi label="Engagements" value={fmt(Math.round(reach * 0.064))} delta="6%" />
                    <Kpi label="New followers" value={`+${growth[growth.length - 1] - growth[0]}`} up={growth[growth.length - 1] >= growth[0]} delta="vs prev." />
                    <Kpi label="Posts" value={String(ws.posts.filter((p) => p.accountIds.some((x) => ids.includes(x))).length)} />
                  </div>
                )}
                {sections.includes("Audience growth") && <div><p className="mb-2 font-bold text-ink">Audience growth</p><LineChart data={growth} /></div>}
                {sections.includes("Engagement by day") && <div><p className="mb-2 font-bold text-ink">Engagement by day</p><BarChart data={series(`${key}-d`, 7, 300, 200)} labels={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]} /></div>}
                {sections.includes("Top posts") && (
                  <div>
                    <p className="mb-2 font-bold text-ink">Top posts</p>
                    <ul className="divide-y divide-line rounded-xl border border-line">
                      {top.map((p, k) => (
                        <li key={p.id} className="flex items-center gap-3 p-3 text-sm">
                          <span className="font-bold text-primary">#{k + 1}</span>
                          <span className="flex-1 truncate text-ink">{p.text}</span>
                          <span className="font-bold text-ink">{fmt(series(p.id, 1, 2400, 1800)[0])}</span>
                          <span className="text-muted">reach</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-line p-4 print:hidden">
                <button type="button" onClick={() => window.print()} className="btn btn-primary"><Icon name="download" size={18} /> Download PDF</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
