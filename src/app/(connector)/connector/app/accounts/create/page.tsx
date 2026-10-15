"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon, { networkMeta, type NetworkId } from "@/components/connector/SocialIcon";
import { SetupProblems } from "@/components/connector/app/SetupCheck";
import { Modal, PageHeader, PasswordInput } from "@/components/connector/app/ui";
import { connectUrl, post } from "@/lib/connector/api";
import { APP, BASE } from "@/lib/connector/data";
import { reportError, uid, update, useLive, useWorkspace } from "@/lib/connector/store";

type Button = { label: string; choice: string };
type Tile = { id: NetworkId; buttons: Button[] };

/** Networks in SocialPilot order; each button opens its "Connect via" popup. */
const tiles: Tile[] = [
  { id: "facebook", buttons: [{ label: "Connect Page", choice: "facebook" }] },
  { id: "instagram", buttons: [{ label: "Connect Business or Creator", choice: "instagram" }] },
  { id: "google", buttons: [{ label: "Connect Profile", choice: "google_business" }] },
  {
    id: "linkedin",
    buttons: [
      { label: "Connect Profile", choice: "linkedin_profile" },
      { label: "Connect Page", choice: "linkedin_page" },
    ],
  },
  { id: "youtube", buttons: [{ label: "Connect Channel", choice: "youtube" }] },
  { id: "tiktok", buttons: [{ label: "Connect Profile", choice: "tiktok" }] },
  { id: "x", buttons: [{ label: "Connect Profile", choice: "x" }] },
  { id: "pinterest", buttons: [{ label: "Connect Board", choice: "pinterest" }] },
  { id: "threads", buttons: [{ label: "Connect Profile", choice: "threads" }] },
  { id: "bluesky", buttons: [{ label: "Connect Profile", choice: "bluesky" }] },
];

type Via = {
  kind: string;
  brand: NetworkId | "meta";
  label: string;
  recommended?: boolean;
  features: [string, boolean][];
  checks: [string, string][];
};

const yes = (t: string): [string, boolean] => [t, true];

/** What each popup offers, with the checklist people see before logging in. */
const vias: Record<string, { title: string; options: Via[] }> = {
  facebook: {
    title: "Connect Facebook Page",
    options: [
      {
        kind: "facebook",
        brand: "meta",
        label: "Meta Business Suite",
        recommended: true,
        features: [yes("Publish text, photo, multi-photo and video posts."), yes("Schedule from the calendar and AI Agent."), yes("Track post status and errors.")],
        checks: [
          ["briefcase", "You are an admin of the Facebook Page."],
          ["user", "You log in with the Facebook account that manages the Page."],
        ],
      },
    ],
  },
  instagram: {
    title: "Connect Instagram Business or Creator",
    options: [
      {
        kind: "instagram",
        brand: "meta",
        label: "Meta Business Suite",
        recommended: true,
        features: [yes("Publish carousel posts, videos, and reels."), yes("Schedule from the calendar and AI Agent."), yes("Manage many accounts with one login."), yes("Track post status and errors.")],
        checks: [
          ["briefcase", "Your Instagram profile is a Business/Creator account."],
          ["shield", "You are an admin of your Facebook Page."],
          ["link", "Your Facebook Page is linked to Instagram Business profile."],
        ],
      },
      {
        kind: "instagram_login",
        brand: "instagram",
        label: "Instagram",
        features: [yes("Publish carousel posts, videos, and reels."), yes("Schedule from the calendar and AI Agent."), yes("No Facebook Page needed."), ["Manage many accounts with one login.", false]],
        checks: [
          ["briefcase", "Your Instagram profile is a Business/Creator account."],
          ["lock", "Login credentials for the Instagram account."],
        ],
      },
    ],
  },
  google_business: {
    title: "Connect Google Business Profile",
    options: [
      {
        kind: "google_business",
        brand: "google",
        label: "Google",
        features: [yes("Publish updates with a photo to your Business Profile."), yes("Schedule from the calendar and AI Agent.")],
        checks: [["briefcase", "You are an owner or manager of the Business Profile."]],
      },
    ],
  },
  linkedin_profile: {
    title: "Connect LinkedIn Profile",
    options: [
      {
        kind: "linkedin_profile",
        brand: "linkedin",
        label: "LinkedIn",
        features: [yes("Publish text and image posts to your profile."), yes("Schedule from the calendar and AI Agent.")],
        checks: [["user", "Log in with the LinkedIn account you want to post from."]],
      },
    ],
  },
  linkedin_page: {
    title: "Connect LinkedIn Page",
    options: [
      {
        kind: "linkedin_page",
        brand: "linkedin",
        label: "LinkedIn",
        features: [yes("Publish text and image posts to your company Page."), yes("Schedule from the calendar and AI Agent.")],
        checks: [["shield", "You are a Super admin or Content admin of the LinkedIn Page."]],
      },
    ],
  },
  youtube: {
    title: "Connect YouTube Channel",
    options: [
      {
        kind: "youtube",
        brand: "youtube",
        label: "YouTube",
        features: [yes("Upload videos with title and description."), yes("Schedule from the calendar and AI Agent.")],
        checks: [
          ["video", "You have a YouTube channel on this Google account."],
          ["upload", "Posts for YouTube need an MP4 video."],
        ],
      },
    ],
  },
  tiktok: {
    title: "Connect TikTok",
    options: [
      {
        kind: "tiktok",
        brand: "tiktok",
        label: "TikTok",
        features: [yes("Publish videos and photo posts."), yes("Schedule from the calendar and AI Agent.")],
        checks: [["user", "Log in with the TikTok account you want to post from."]],
      },
    ],
  },
  x: {
    title: "Connect X Profile",
    options: [
      {
        kind: "x",
        brand: "x",
        label: "X",
        features: [yes("Post text and up to 4 images."), yes("Schedule from the calendar and AI Agent.")],
        checks: [["user", "Log in with the X account you want to post from."]],
      },
    ],
  },
  pinterest: {
    title: "Connect Pinterest Board",
    options: [
      {
        kind: "pinterest",
        brand: "pinterest",
        label: "Pinterest",
        features: [yes("Create Pins with images on your boards."), yes("Schedule from the calendar and AI Agent.")],
        checks: [["layout", "You have at least one board on Pinterest."]],
      },
    ],
  },
  threads: {
    title: "Connect Threads Profile",
    options: [
      {
        kind: "threads",
        brand: "threads",
        label: "Threads",
        features: [yes("Post text, images, videos and carousels."), yes("Schedule from the calendar and AI Agent.")],
        checks: [["user", "Log in with the Instagram account you use for Threads."]],
      },
    ],
  },
};

export default function ConnectAccount() {
  return (
    <Suspense>
      <ConnectInner />
    </Suspense>
  );
}

function ConnectInner() {
  const ws = useWorkspace();
  const { status } = useLive();
  const live = !!status?.loggedIn;
  const error = useSearchParams().get("error");
  const [open, setOpenRaw] = useState<string | null>(null);
  // One-step connect: networks with a single way to log in go straight to that login.
  const setOpen = (choice: string | null) => {
    const spec = choice ? vias[choice] : undefined;
    if (live && spec && spec.options.length === 1 && status?.configured.connect?.[spec.options[0].kind]) {
      window.location.assign(connectUrl(spec.options[0].kind));
      return;
    }
    setOpenRaw(choice);
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
      {!live && (
        <div className="mb-6">
          <SetupProblems compact />
        </div>
      )}
      {error && <p className="mb-6 rounded-xl bg-danger-tint px-4 py-3 text-sm font-medium text-danger">{error}</p>}

      <div className="grid gap-x-5 gap-y-12 pt-8 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => {
          const count = ws.accounts.filter((a) => a.network === t.id).length;
          return (
            <div key={t.id} className="relative rounded-2xl border border-line bg-surface px-5 pb-6 pt-12 text-center">
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-surface p-1.5 shadow-md ring-1 ring-line">
                <SocialIcon id={t.id} size={52} rounded="full" />
              </span>
              <p className="text-lg font-bold text-ink">{networkMeta[t.id].name.replace(" (Twitter)", "")}</p>
              {count > 0 && <p className="mt-1 text-xs font-bold text-success">{count} connected</p>}
              <div className="my-4 border-t border-line" />
              <div className="flex flex-col items-center gap-3">
                {t.buttons.map((b) => (
                  <button key={b.label} type="button" onClick={() => setOpen(b.choice)} className="text-sm font-bold text-primary hover:underline">
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {open === "bluesky" ? (
        <BlueskyModal live={live} onClose={() => setOpen(null)} />
      ) : open && !live ? (
        <DemoModal network={tiles.find((t) => t.buttons.some((b) => b.choice === open))!.id} onClose={() => setOpen(null)} />
      ) : open ? (
        <ViaModal choice={open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

function ViaModal({ choice, onClose }: { choice: string; onClose: () => void }) {
  const { status } = useLive();
  const spec = vias[choice];
  const [kind, setKind] = useState(spec.options[0].kind);
  const ready = status?.configured.connect?.[kind] ?? false;
  const admin = !!status?.user?.isAdmin;

  return (
    <Modal title={spec.title} onClose={onClose} wide>
      <div className={`grid gap-4 ${spec.options.length > 1 ? "md:grid-cols-2" : ""}`}>
        {spec.options.map((o) => {
          const on = o.kind === kind;
          return (
            <button
              key={o.kind}
              type="button"
              onClick={() => setKind(o.kind)}
              className={`rounded-xl border-2 p-5 text-left transition-colors ${on ? "border-primary" : "border-line hover:border-primary/40"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">Connect via</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-lg font-bold text-ink">
                    {o.brand === "meta" ? <span className="text-xl leading-none text-[#0866FF]">∞</span> : <SocialIcon id={o.brand} size={22} rounded="full" />}
                    {o.label}
                    {o.recommended && <span className="rounded-md bg-success-tint px-2 py-0.5 text-xs font-bold text-success">Recommended</span>}
                  </p>
                </div>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${on ? "bg-primary text-white" : "ring-2 ring-line"}`}>
                  {on && <Icon name="check" size={14} strokeWidth={3} />}
                </span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-ink-2">
                {o.features.map(([f, ok]) => (
                  <li key={f} className="flex items-center gap-2">
                    <Icon name={ok ? "check" : "close"} size={16} className={ok ? "text-success" : "text-danger"} strokeWidth={2.4} /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-sm font-bold text-ink">Before proceeding, ensure the following:</p>
                <ul className="mt-3 space-y-2.5 text-sm text-ink-2">
                  {o.checks.map(([icon, c]) => (
                    <li key={c} className="flex items-start gap-2.5">
                      <Icon name={icon} size={16} className="mt-0.5 shrink-0 text-muted" /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`${BASE}/help`} className="text-sm text-ink-2">
          Need more details? <span className="font-bold text-primary">Learn more</span>
        </Link>
        {ready ? (
          <a href={connectUrl(kind)} className="btn btn-primary">
            Proceed to Connect
          </a>
        ) : admin ? (
          <Link href={`${APP}/settings/platform/?only=${kind}`} className="btn btn-primary">
            Add app keys to enable
          </Link>
        ) : (
          <span className="text-sm font-medium text-ink-2">This connection is being switched on — please try again shortly.</span>
        )}
      </div>
    </Modal>
  );
}

function BlueskyModal({ live, onClose }: { live: boolean; onClose: () => void }) {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Connect Bluesky Profile" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!live) {
            update((s) => ({
              ...s,
              accounts: [...s.accounts, { id: uid(), network: "bluesky", name: handle, handle, connectedAt: new Date().toISOString() }],
            }));
            router.push(`${APP}/accounts`);
            return;
          }
          setBusy(true);
          try {
            await post("bluesky_connect", { handle, password });
            router.push(`${APP}/accounts/select/`);
          } catch (err) {
            reportError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-4">
          <SocialIcon id="bluesky" size={40} rounded="full" />
          <p className="text-sm text-ink-2">
            Use an <b>app password</b>, not your main password. Create one in Bluesky → Settings → Privacy and security →{" "}
            <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noreferrer" className="font-bold text-primary">
              App passwords
            </a>
            .
          </p>
        </div>
        <label className="block text-sm font-medium text-ink">
          Handle
          <input autoFocus required value={handle} onChange={(e) => setHandle(e.target.value)} className="field mt-1.5" placeholder="yourname.bsky.social" />
        </label>
        <div className="block text-sm font-medium text-ink">
          <span className="mb-1.5 block">App password</span>
          <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" autoComplete="off" />
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
          {busy ? "Connecting…" : "Proceed to Connect"}
        </button>
      </form>
    </Modal>
  );
}

/** Demo mode (no backend): adds a sample account. */
function DemoModal({ network, onClose }: { network: NetworkId; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  return (
    <Modal title={`Connect ${networkMeta[network].name} (demo)`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          update((s) => ({
            ...s,
            accounts: [
              ...s.accounts,
              { id: uid(), network, name: name.trim(), handle: name.trim().toLowerCase().replace(/\s+/g, ""), connectedAt: new Date().toISOString() },
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
  );
}
