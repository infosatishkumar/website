"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon, { networkMeta, type NetworkId } from "@/components/connector/SocialIcon";
import { SetupProblems } from "@/components/connector/app/SetupCheck";
import { Modal, PageHeader } from "@/components/connector/app/ui";
import { metaConnectUrl } from "@/lib/connector/api";
import { APP, BASE } from "@/lib/connector/data";
import { uid, update, useLive, useWorkspace } from "@/lib/connector/store";

type Option = { label: string; kind?: "facebook" | "instagram" };
type Tile = { id: NetworkId; options: Option[] };

/** Networks in SocialPilot order; Meta ones connect for real, the rest are on the roadmap. */
const tiles: Tile[] = [
  { id: "facebook", options: [{ label: "Connect Page", kind: "facebook" }] },
  { id: "instagram", options: [{ label: "Connect Business or Creator", kind: "instagram" }] },
  { id: "google", options: [{ label: "Connect Profile" }] },
  { id: "linkedin", options: [{ label: "Connect Profile" }, { label: "Connect Page" }] },
  { id: "youtube", options: [{ label: "Connect Channel" }] },
  { id: "tiktok", options: [{ label: "Connect Business" }] },
  { id: "x", options: [{ label: "Connect Profile" }] },
  { id: "pinterest", options: [{ label: "Connect Board" }] },
  { id: "threads", options: [{ label: "Connect Profile" }] },
  { id: "bluesky", options: [{ label: "Connect Profile" }] },
];

const checklist: Record<"facebook" | "instagram", string[]> = {
  facebook: ["You are an admin of the Facebook Page.", "You log in with the Facebook account that manages the Page."],
  instagram: [
    "Your Instagram profile is a Business or Creator account.",
    "You are an admin of the linked Facebook Page.",
    "Your Facebook Page is linked to the Instagram profile.",
  ],
};

export default function ConnectAccount() {
  const ws = useWorkspace();
  const { status } = useLive();
  const live = !!status?.loggedIn;
  const router = useRouter();
  const [meta, setMeta] = useState<"facebook" | "instagram" | null>(null);
  const [soon, setSoon] = useState<NetworkId | null>(null);
  const [demo, setDemo] = useState<NetworkId | null>(null);
  const [name, setName] = useState("");

  const choose = (t: Tile, o: Option) => {
    if (live) {
      if (o.kind) setMeta(o.kind);
      else setSoon(t.id);
    } else {
      setName("");
      setDemo(t.id);
    }
  };

  return (
    <>
      <PageHeader
        title="Connect account"
        sub="Choose a network to add a page, profile or channel."
        actions={
          <span className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-2">
            {ws.accounts.length} account{ws.accounts.length === 1 ? "" : "s"} connected
          </span>
        }
      />
      {(!live || !status?.configured.meta) && (
        <div className="mb-6">
          <SetupProblems compact />
        </div>
      )}

      <div className="grid gap-x-5 gap-y-12 pt-8 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => {
          const count = ws.accounts.filter((a) => a.network === t.id).length;
          const real = t.options.some((o) => o.kind);
          return (
            <div key={t.id} className="relative rounded-2xl border border-line bg-surface px-5 pb-6 pt-12 text-center">
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-surface p-1.5 shadow-md ring-1 ring-line">
                <SocialIcon id={t.id} size={52} rounded="full" />
              </span>
              <p className="text-lg font-bold text-ink">{networkMeta[t.id].name.replace(" (Twitter)", "")}</p>
              {count > 0 && <p className="mt-1 text-xs font-bold text-success">{count} connected</p>}
              <div className="my-4 border-t border-line" />
              <div className="flex flex-col items-center gap-3">
                {t.options.map((o) => (
                  <button key={o.label} type="button" onClick={() => choose(t, o)} className="text-sm font-bold text-primary hover:underline">
                    {o.label}
                  </button>
                ))}
                {live && !real && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-muted">Coming soon</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Meta: Business Suite route, like SocialPilot */}
      {meta && (
        <Modal title={meta === "instagram" ? "Connect Instagram Business or Creator" : "Connect Facebook Page"} onClose={() => setMeta(null)} wide>
          <div className="rounded-xl border-2 border-primary p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Connect via</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-bold text-ink">
                  <span className="text-[#0866FF]">∞</span> Meta Business Suite
                  <span className="rounded-md bg-success-tint px-2 py-0.5 text-xs font-bold text-success">Recommended</span>
                </p>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                <Icon name="check" size={14} strokeWidth={3} />
              </span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-ink-2">
              {(meta === "instagram"
                ? ["Publish posts and carousels", "Schedule from the calendar and AI Agent", "Track post status and errors"]
                : ["Publish text, photo and multi-photo posts", "Schedule from the calendar and AI Agent", "Track post status and errors"]
              ).map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Icon name="check" size={16} className="text-success" strokeWidth={2.4} /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-sm font-bold text-ink">Before proceeding, ensure the following:</p>
              <ul className="mt-3 space-y-2.5 text-sm text-ink-2">
                {checklist[meta].map((c) => (
                  <li key={c} className="flex items-start gap-2.5">
                    <Icon name="briefcase" size={16} className="mt-0.5 shrink-0 text-muted" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Link href={`${BASE}/help`} className="text-sm text-ink-2">
              Need help? <span className="font-bold text-primary">Learn more</span>
            </Link>
            {status?.configured.meta ? (
              <a href={metaConnectUrl(meta)} className="btn btn-primary">
                Proceed to connect
              </a>
            ) : (
              <span className="text-sm font-bold text-danger">Add the Meta app ID and secret in smc-config.php first.</span>
            )}
          </div>
        </Modal>
      )}

      {soon && (
        <Modal title={`${networkMeta[soon].name} — coming soon`} onClose={() => setSoon(null)}>
          <div className="flex flex-col items-center text-center">
            <SocialIcon id={soon} size={56} rounded="full" />
            <p className="mt-4 text-ink-2">
              {networkMeta[soon].name} needs its own developer app and approval from the network. It will appear here as soon as it’s set up. For now you
              can connect Facebook Pages and Instagram Business accounts.
            </p>
            <button type="button" className="btn btn-primary mt-6" onClick={() => setSoon(null)}>Got it</button>
          </div>
        </Modal>
      )}

      {/* demo mode: simulated connection */}
      {demo && (
        <Modal title={`Connect ${networkMeta[demo].name} (demo)`} onClose={() => setDemo(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              update((s) => ({
                ...s,
                accounts: [
                  ...s.accounts,
                  { id: uid(), network: demo, name: name.trim(), handle: name.trim().toLowerCase().replace(/\s+/g, ""), connectedAt: new Date().toISOString() },
                ],
              }));
              router.push(`${APP}/accounts`);
            }}
          >
            <p className="text-sm text-ink-2">Demo mode only simulates a connection. On your live site this opens the network’s real login.</p>
            <label className="block text-sm font-medium text-ink">
              Display name
              <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className="field mt-1.5" placeholder="e.g. Johnny's Pizzeria" />
            </label>
            <button type="submit" className="btn btn-primary w-full">Add demo account</button>
          </form>
        </Modal>
      )}
    </>
  );
}
