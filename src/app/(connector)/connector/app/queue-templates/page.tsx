"use client";

import { useState } from "react";
import Icon from "@/components/connector/Icon";
import { Card, PageHeader } from "@/components/connector/app/ui";
import { update, useWorkspace } from "@/lib/connector/store";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function QueuePage() {
  const ws = useWorkspace();
  const [time, setTime] = useState("10:00");
  const [sel, setSel] = useState<number[]>([0, 1, 2, 3, 4]);

  const add = () =>
    update((s) => {
      const exists = new Set(s.queue.map((q) => `${q.day}-${q.time}`));
      const add = sel.filter((d) => !exists.has(`${d}-${time}`)).map((day) => ({ day, time }));
      return { ...s, queue: [...s.queue, ...add] };
    });

  return (
    <>
      <PageHeader title="Queue times" sub="“Add to queue” drops posts into the next free slot from this weekly template." />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card title="Weekly template">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {days.map((d, i) => {
              const slots = ws.queue.filter((q) => q.day === i).map((q) => q.time).sort();
              return (
                <div key={d} className="rounded-xl bg-canvas p-3">
                  <p className="mb-2 text-sm font-bold text-ink">{d.slice(0, 3)}</p>
                  <ul className="space-y-1.5">
                    {slots.map((t) => (
                      <li key={t} className="group flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-sm font-medium text-ink ring-1 ring-line">
                        {t}
                        <button type="button" aria-label={`Remove ${t}`} className="text-muted opacity-0 hover:text-danger group-hover:opacity-100" onClick={() => update((s) => ({ ...s, queue: s.queue.filter((q) => !(q.day === i && q.time === t)) }))}>
                          <Icon name="close" size={14} />
                        </button>
                      </li>
                    ))}
                    {slots.length === 0 && <li className="text-xs text-muted">No slots</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Add a time slot">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="field" aria-label="Time" />
          <div className="mt-4 flex flex-wrap gap-1.5">
            {days.map((d, i) => {
              const on = sel.includes(i);
              return (
                <button key={d} type="button" onClick={() => setSel(on ? sel.filter((x) => x !== i) : [...sel, i])} className={`rounded-full px-3 py-1 text-xs font-bold ${on ? "bg-primary text-white" : "bg-canvas text-ink-2"}`}>
                  {d.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={add} disabled={sel.length === 0} className="btn btn-primary mt-5 w-full disabled:opacity-40">Add slot</button>
        </Card>
      </div>
    </>
  );
}
