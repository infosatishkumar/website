"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon, { networkIds, networkMeta, type NetworkId } from "@/components/connector/SocialIcon";
import { Card, Modal, PageHeader } from "@/components/connector/app/ui";
import { SetupProblems } from "@/components/connector/app/SetupCheck";
import { APP } from "@/lib/connector/data";
import { META_CONNECT_URL } from "@/lib/connector/api";
import { uid, update, useLive, useWorkspace } from "@/lib/connector/store";

const kinds: Partial<Record<NetworkId, string>> = {
  facebook: "Page or Group",
  instagram: "Business or Creator profile",
  linkedin: "Profile or Company page",
  google: "Business Profile location",
  youtube: "Channel",
};

export default function ConnectAccount() {
  const ws = useWorkspace();
  const { status } = useLive();
  const live = !!status?.loggedIn;
  const router = useRouter();
  const [net, setNet] = useState<NetworkId | null>(null);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [step, setStep] = useState<"form" | "authorising">("form");

  const connect = () => {
    if (!net || !name.trim()) return;
    setStep("authorising");
    setTimeout(() => {
      update((s) => ({
        ...s,
        accounts: [...s.accounts, { id: uid(), network: net, name: name.trim(), handle: handle.trim().replace(/^@/, "") || name.trim().toLowerCase().replace(/\s+/g, ""), connectedAt: new Date().toISOString() }],
      }));
      router.push(`${APP}/accounts`);
    }, 1200);
  };

  return (
    <>
      <PageHeader title="Connect account" sub="Choose a network to add a profile, page or channel." />
      {live ? (
        <div className="card mb-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <span className="flex gap-2">
            <SocialIcon id="facebook" size={44} />
            <SocialIcon id="instagram" size={44} />
          </span>
          <div className="flex-1">
            <p className="font-bold text-ink">Facebook Pages &amp; Instagram Business</p>
            <p className="text-sm text-ink-2">
              Log in with Facebook and pick your Pages. Instagram Business accounts linked to those Pages are added automatically.
            </p>
            {!status?.configured.meta && (
              <p className="mt-1 text-sm font-bold text-danger">Add meta_app_id and meta_app_secret to smc-config.php first.</p>
            )}
            <div className="mt-3"><SetupProblems compact /></div>
          </div>
          <a href={META_CONNECT_URL} className={`btn btn-primary ${status?.configured.meta ? "" : "pointer-events-none opacity-40"}`}>
            <Icon name="plug" size={18} /> Connect with Facebook
          </a>
        </div>
      ) : (
        <div className="mb-6 space-y-3">
          <SetupProblems />
          <p className="text-sm text-ink-2">
            Demo mode: the tiles below only simulate a connection. Real Facebook &amp; Instagram login appears here once the
            backend is running and you are logged in.
          </p>
        </div>
      )}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {networkIds.map((n) => {
            const count = ws.accounts.filter((a) => a.network === n).length;
            return (
              <button
                key={n}
                type="button"
                disabled={live}
                onClick={() => {
                  setNet(n);
                  setName("");
                  setHandle("");
                  setStep("form");
                }}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-line p-6 transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-primary enabled:hover:shadow-lg disabled:opacity-60"
              >
                <SocialIcon id={n} size={52} />
                <span className="font-bold text-ink">{networkMeta[n].name}</span>
                <span className="text-xs text-muted">{kinds[n] ?? "Profile"}</span>
                {live ? (
                  <span className="text-xs font-bold text-muted">
                    {n === "facebook" || n === "instagram" ? "Use the Facebook button" : "Coming soon"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                    <Icon name="plus" size={16} /> Connect
                  </span>
                )}
                {count > 0 && <span className="rounded-full bg-success-tint px-2 py-0.5 text-xs font-bold text-success">{count} connected</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {net && (
        <Modal title={`Connect ${networkMeta[net].name}`} onClose={() => setNet(null)}>
          {step === "authorising" ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="relative flex">
                <SocialIcon id={net} size={64} />
                <span className="absolute -bottom-2 -right-2 h-6 w-6 animate-spin rounded-full border-[3px] border-primary border-t-transparent bg-white" />
              </span>
              <p className="mt-5 font-bold text-ink">Authorising with {networkMeta[net].name}…</p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                connect();
              }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3 rounded-xl bg-canvas p-4">
                <SocialIcon id={net} size={40} />
                <p className="text-sm text-ink-2">Pick the {kinds[net]?.toLowerCase() ?? "profile"} you want to manage.</p>
              </div>
              <label className="block text-sm font-medium text-ink">
                Display name
                <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className="field mt-1.5" placeholder="e.g. Johnny's Pizzeria" />
              </label>
              <label className="block text-sm font-medium text-ink">
                Handle
                <input value={handle} onChange={(e) => setHandle(e.target.value)} className="field mt-1.5" placeholder="@handle" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn btn-ghost" onClick={() => setNet(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Continue with {networkMeta[net].name.replace(" (Twitter)", "")}</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
