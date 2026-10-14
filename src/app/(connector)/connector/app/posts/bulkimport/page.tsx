"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/components/connector/Icon";
import AccountPicker from "@/components/connector/app/AccountPicker";
import { Card, PageHeader } from "@/components/connector/app/ui";
import { APP } from "@/lib/connector/data";
import { uid, update, type Post } from "@/lib/connector/store";

const SAMPLE = `date,time,caption,image_url
2026-10-20,09:00,"Monday motivation: start small, stay consistent 💪",
2026-10-21,13:00,"New blog: 5 ways to plan a month of content",https://example.com/blog
2026-10-22,18:30,"Behind the scenes at our studio 🎬",`;

/** Minimal CSV parser that handles quoted fields and escaped quotes. */
function parseCsv(src: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

type Row = { line: number; date: string; time: string; caption: string; url: string; when: Date | null; errors: string[] };

export default function BulkImportPage() {
  const [csv, setCsv] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const [now] = useState(() => Date.now());

  const rows: Row[] = useMemo(() => {
    const data = parseCsv(csv.trim());
    if (data.length === 0) return [];
    const header = data[0].map((h) => h.trim().toLowerCase());
    const idx = (k: string) => header.indexOf(k);
    const body = idx("caption") >= 0 ? data.slice(1) : data;
    const col = (r: string[], k: string, fallback: number) => (r[idx(k) >= 0 ? idx(k) : fallback] ?? "").trim();
    return body.map((r, k) => {
      const date = col(r, "date", 0);
      const time = col(r, "time", 1) || "09:00";
      const caption = col(r, "caption", 2);
      const url = col(r, "image_url", 3);
      const errors: string[] = [];
      const when = new Date(`${date}T${time}`);
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{1,2}:\d{2}$/.test(time) && !Number.isNaN(when.getTime());
      if (!valid) errors.push("Date must be YYYY-MM-DD and time HH:MM");
      else if (when.getTime() < now) errors.push("Date is in the past");
      if (!caption) errors.push("Caption is empty");
      if (caption.length > 2200) errors.push("Caption over 2,200 characters");
      return { line: k + 2, date, time, caption, url, when: valid ? when : null, errors };
    });
  }, [csv, now]);

  const good = rows.filter((r) => r.errors.length === 0);

  const importRows = () => {
    const posts: Post[] = good.map((r) => ({
      id: uid(),
      text: r.url ? `${r.caption} ${r.url}` : r.caption,
      accountIds: ids,
      scheduledAt: (r.when as Date).toISOString(),
      status: "scheduled",
      tagIds: [],
      media: [],
      author: "Bulk import",
    }));
    update((s) => ({ ...s, posts: [...s.posts, ...posts] }));
    setDone(posts.length);
    setCsv("");
  };

  return (
    <>
      <PageHeader
        title="Bulk import"
        sub="Upload a CSV to schedule many posts at once."
        actions={
          <a className="btn btn-outline btn-sm" download="bulk-import-sample.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}>
            <Icon name="download" size={16} /> Sample CSV
          </a>
        }
      />
      {done !== null && (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-success-tint px-4 py-3 text-sm font-medium">
          <Icon name="checkCircle" className="text-success" /> {done} post{done === 1 ? "" : "s"} scheduled.
          <Link href={`${APP}/posts/calendar`} className="ml-auto font-bold text-primary">Open calendar</Link>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="1. Add your CSV">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line p-8 text-center text-muted hover:border-primary hover:text-primary">
              <Icon name="upload" size={28} />
              <span className="font-bold">Choose a .csv file</span>
              <span className="text-xs">Columns: date, time, caption, image_url</span>
              <input type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); e.target.value = ""; }} />
            </label>
            <p className="my-3 text-center text-xs font-bold uppercase text-muted">or paste</p>
            <textarea value={csv} onChange={(e) => { setCsv(e.target.value); setDone(null); }} rows={6} className="field font-mono text-xs" placeholder={SAMPLE} />
            <button type="button" className="mt-2 text-sm font-bold text-primary" onClick={() => setCsv(SAMPLE)}>Load sample data</button>
          </Card>
          {rows.length > 0 && (
            <Card title={`2. Review (${good.length} ready, ${rows.length - good.length} with errors)`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-muted"><tr className="border-b border-line"><th className="pb-2">Row</th><th className="pb-2">When</th><th className="pb-2">Caption</th><th className="pb-2">Status</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => (
                      <tr key={r.line}>
                        <td className="py-2 text-muted">{r.line}</td>
                        <td className="py-2 whitespace-nowrap">{r.date} {r.time}</td>
                        <td className="max-w-xs truncate py-2">{r.caption}</td>
                        <td className="py-2">
                          {r.errors.length ? <span className="text-xs font-bold text-danger">{r.errors.join("; ")}</span> : <span className="inline-flex items-center gap-1 text-xs font-bold text-success"><Icon name="check" size={14} /> Ready</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
        <Card title="3. Choose accounts" className="xl:self-start">
          <AccountPicker selected={ids} onChange={setIds} />
          <button type="button" disabled={good.length === 0 || ids.length === 0} onClick={importRows} className="btn btn-primary mt-5 w-full disabled:opacity-40">
            Schedule {good.length} post{good.length === 1 ? "" : "s"}
          </button>
        </Card>
      </div>
    </>
  );
}
