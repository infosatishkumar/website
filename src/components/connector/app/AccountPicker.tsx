"use client";

import { useState } from "react";
import Icon from "../Icon";
import { AccountChip } from "./ui";
import { useWorkspace } from "@/lib/connector/store";

export default function AccountPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const ws = useWorkspace();
  const [q, setQ] = useState("");
  const list = ws.accounts.filter((a) => `${a.name} ${a.handle} ${a.network}`.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const allOn = ws.accounts.length > 0 && selected.length === ws.accounts.length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-line px-3 py-2">
        <Icon name="search" size={16} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts" className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      {ws.groups.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {ws.groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onChange(Array.from(new Set([...selected, ...g.accountIds])))}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-2 hover:border-primary hover:text-primary"
            >
              <Icon name="folder" size={14} /> {g.name}
            </button>
          ))}
        </div>
      )}
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted">{selected.length} of {ws.accounts.length} selected</span>
        <button type="button" className="font-bold text-primary" onClick={() => onChange(allOn ? [] : ws.accounts.map((a) => a.id))}>
          {allOn ? "Clear" : "Select all"}
        </button>
      </div>
      <ul className="max-h-80 space-y-1 overflow-y-auto">
        {list.map((a) => {
          const on = selected.includes(a.id);
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => toggle(a.id)}
                className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${on ? "bg-primary-soft" : "hover:bg-canvas"}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${on ? "border-primary bg-primary text-white" : "border-line"}`}>
                  {on && <Icon name="check" size={12} strokeWidth={3} />}
                </span>
                <AccountChip account={a} />
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="p-2 text-sm text-muted">No matching accounts.</li>}
      </ul>
    </div>
  );
}
