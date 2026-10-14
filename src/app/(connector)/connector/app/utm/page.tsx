"use client";

import { useState } from "react";
import Icon from "@/components/connector/Icon";
import { Card, PageHeader } from "@/components/connector/app/ui";
import { addListItem, removeListItem, useWorkspace } from "@/lib/connector/store";

export default function UtmPage() {
  const ws = useWorkspace();
  const [url, setUrl] = useState("https://example.com/offer");
  const [p, setP] = useState({ utm_source: "social", utm_medium: "post", utm_campaign: "", utm_content: "" });
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);

  const query = Object.entries(p).filter(([, v]) => v.trim()).map(([k, v]) => `${k}=${encodeURIComponent(v.trim())}`).join("&");
  const full = query ? `${url}${url.includes("?") ? "&" : "?"}${query}` : url;

  return (
    <>
      <PageHeader title="UTM presets" sub="Build tracked links and save presets your team can reuse." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Link builder">
          <label className="block text-sm font-medium text-ink">
            Destination URL
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="field mt-1.5" />
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(Object.keys(p) as (keyof typeof p)[]).map((k) => (
              <label key={k} className="block text-sm font-medium text-ink">
                {k}
                <input value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} className="field mt-1.5" placeholder={k === "utm_campaign" ? "diwali-sale" : ""} />
              </label>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-canvas p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Tracked link</p>
            <p className="mt-1 break-all font-mono text-sm text-ink">{full}</p>
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(full).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
              className="btn btn-primary btn-sm mt-3"
            >
              <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim() && query) { addListItem("utm", { title: name.trim(), value: query }); setName(""); } }}>
            <input value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Preset name" />
            <button type="submit" className="btn btn-outline btn-sm">Save preset</button>
          </form>
        </Card>
        <Card title="Saved presets">
          <ul className="space-y-3">
            {ws.utm.map((u) => (
              <li key={u.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-ink">{u.title}</p>
                  <button type="button" onClick={() => removeListItem("utm", u.id)} className="text-muted hover:text-danger" aria-label="Delete preset"><Icon name="trash" size={16} /></button>
                </div>
                <p className="mt-1 break-all text-xs text-ink-2">{u.value}</p>
                <button
                  type="button"
                  className="mt-2 text-xs font-bold text-primary"
                  onClick={() => {
                    const sp = new URLSearchParams(u.value);
                    setP({ utm_source: sp.get("utm_source") ?? "", utm_medium: sp.get("utm_medium") ?? "", utm_campaign: sp.get("utm_campaign") ?? "", utm_content: sp.get("utm_content") ?? "" });
                  }}
                >
                  Apply
                </button>
              </li>
            ))}
            {ws.utm.length === 0 && <li className="text-sm text-muted">No presets yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
