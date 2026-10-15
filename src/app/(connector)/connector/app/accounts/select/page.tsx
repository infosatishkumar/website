"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon, { networkMeta, type NetworkId } from "@/components/connector/SocialIcon";
import { Empty, PageHeader } from "@/components/connector/app/ui";
import { get, post } from "@/lib/connector/api";
import { APP } from "@/lib/connector/data";
import { refreshLive, reportError, useLive } from "@/lib/connector/store";

/** Picker wording per connect button: network name and what gets picked. */
const kindLabels: Record<string, [string, string]> = {
  facebook: ["Facebook", "pages"],
  instagram: ["Instagram", "pages"],
  instagram_login: ["Instagram", "pages"],
  threads: ["Threads", "profiles"],
  linkedin_profile: ["LinkedIn", "profiles"],
  linkedin_page: ["LinkedIn", "pages"],
  x: ["X", "profiles"],
  youtube: ["YouTube", "channels"],
  google_business: ["Google Business", "locations"],
  pinterest: ["Pinterest", "boards"],
  tiktok: ["TikTok", "profiles"],
  bluesky: ["Bluesky", "profiles"],
};

type Pending = { key: string; network: NetworkId; name: string; handle: string; picture: string; via: string; connected: boolean };

/** After a network login: pick which pages / profiles / boards to connect (SocialPilot-style). */
export default function SelectAccounts() {
  const { status } = useLive();
  const router = useRouter();
  const [items, setItems] = useState<Pending[] | null>(null);
  const [kind, setKind] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!status?.loggedIn) return;
    get<{ kind: string; items: Pending[] }>("meta_pending").then((r) => {
      setItems(r.items);
      setKind(r.kind);
    }, reportError);
  }, [status?.loggedIn]);

  const list = useMemo(() => (items ?? []).filter((i) => `${i.name} ${i.handle}`.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const selectable = list.filter((i) => !i.connected);
  const allOn = selectable.length > 0 && selectable.every((i) => picked.includes(i.key));
  const [net, noun] = kindLabels[kind] ?? ["", "accounts"];
  const title = `Connect ${net ? net + " " : ""}${noun[0].toUpperCase()}${noun.slice(1)}`;

  const connect = async () => {
    setBusy(true);
    try {
      await post("meta_pending_connect", { keys: picked });
      await refreshLive();
      router.push(`${APP}/accounts/?connected=${picked.length}`);
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={title}
        sub="Choose which ones Social Media Connector can post to."
        actions={
          <>
            <span className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-2">{picked.length} selected</span>
            <Link href={`${APP}/accounts/create`} className="btn btn-ghost">Cancel</Link>
            <button type="button" disabled={picked.length === 0 || busy} onClick={connect} className="btn btn-primary disabled:opacity-40">
              {busy ? "Connecting…" : "Connect account"}
            </button>
          </>
        }
      />
      <section className="card">
        <div className="border-b border-line px-5 py-4">
          <p className="inline-block border-b-2 border-warning pb-2 font-bold text-ink">Select {noun[0].toUpperCase() + noun.slice(1)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#673DE6]"
                checked={allOn}
                disabled={selectable.length === 0}
                onChange={() => setPicked(allOn ? [] : selectable.map((i) => i.key))}
              />
              Select all {selectable.length} {selectable.length === 1 ? noun.replace(/s$/, "") : noun}
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${noun}`} className="w-48 bg-transparent text-sm text-ink outline-none" />
              <Icon name="search" size={16} className="text-muted" />
            </div>
          </div>
        </div>
        <div className="p-5">
          {items === null ? (
            <p className="text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <Empty
              icon="plug"
              title={`No ${noun} found`}
              sub={
                kind === "facebook" || kind === "instagram"
                  ? "Facebook didn’t return any Pages or Instagram Business accounts. Make sure you selected them on the Facebook screen and that Instagram is linked to a Page."
                  : `${net || "The network"} didn’t return any ${noun} for this login. Check you are using the right account and try again.`
              }
              action={<Link href={`${APP}/accounts/create`} className="btn btn-primary">Try again</Link>}
            />
          ) : (
            <ul className="space-y-2">
              {list.map((i) => {
                const on = picked.includes(i.key);
                return (
                  <li key={i.key}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                        i.connected ? "cursor-default border-line opacity-60" : on ? "border-primary bg-primary-soft" : "border-line hover:bg-surface-2"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#673DE6]"
                        disabled={i.connected}
                        checked={on || i.connected}
                        onChange={() => setPicked(on ? picked.filter((k) => k !== i.key) : [...picked, i.key])}
                      />
                      <span className="relative">
                        {i.picture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.picture} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-tint font-bold text-accent">{i.name[0]}</span>
                        )}
                        <span className="absolute -bottom-1 -right-1">
                          <SocialIcon id={i.network} size={16} rounded="full" />
                        </span>
                      </span>
                      <span className="font-medium text-ink">{i.name}</span>
                      {i.handle && i.network !== "facebook" && i.handle !== i.name && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">@{i.handle}</span>}
                      {i.via && <span className="text-xs text-muted">via {i.via}</span>}
                      <span className="ml-auto text-xs text-muted">{i.connected ? "Already connected" : networkMeta[i.network].name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
