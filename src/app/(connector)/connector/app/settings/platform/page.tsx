"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon, { type NetworkId } from "@/components/connector/SocialIcon";
import { Card, PageHeader, PasswordInput } from "@/components/connector/app/ui";
import { get, post } from "@/lib/connector/api";
import { APP } from "@/lib/connector/data";
import { initLive, reportError, useLive } from "@/lib/connector/store";

type Values = Record<string, string>;
type Settings = { values: Values; secrets: string[]; redirectUri: string; siteUrl: string; privacyUrl: string; termsUrl: string };
type Field = { key: string; label: string; optional?: boolean };
type Provider = { id: string; title: string; icons: NetworkId[]; readyKind: string; portal: string; hint: string; fields: Field[] };

/** Developer apps the site owner sets up once; users then just click Connect. */
const providers: Provider[] = [
  {
    id: "meta",
    title: "Facebook & Instagram (Meta Business Suite)",
    icons: ["facebook", "instagram"],
    readyKind: "facebook",
    portal: "https://developers.facebook.com/apps/",
    hint: "Business app with “Facebook Login for Business”.",
    fields: [
      { key: "meta_app_id", label: "App ID" },
      { key: "meta_app_secret", label: "App Secret" },
      { key: "meta_config_id", label: "Configuration ID", optional: true },
    ],
  },
  {
    id: "instagram",
    title: "Instagram (direct login)",
    icons: ["instagram"],
    readyKind: "instagram_login",
    portal: "https://developers.facebook.com/apps/",
    hint: "Same Meta app → Instagram → “API setup with Instagram login”. Use the Instagram app ID and secret shown there.",
    fields: [
      { key: "instagram_app_id", label: "Instagram app ID" },
      { key: "instagram_app_secret", label: "Instagram app secret" },
    ],
  },
  {
    id: "threads",
    title: "Threads",
    icons: ["threads"],
    readyKind: "threads",
    portal: "https://developers.facebook.com/apps/",
    hint: "Meta app with the “Access the Threads API” use case.",
    fields: [
      { key: "threads_app_id", label: "Threads app ID" },
      { key: "threads_app_secret", label: "Threads app secret" },
    ],
  },
  {
    id: "linkedin",
    title: "LinkedIn",
    icons: ["linkedin"],
    readyKind: "linkedin_profile",
    portal: "https://www.linkedin.com/developers/apps",
    hint: "Profiles: add “Sign In with LinkedIn using OpenID Connect” + “Share on LinkedIn”. Company Pages need the Community Management API, which LinkedIn only allows on a separate app — put that app's keys in the Pages boxes.",
    fields: [
      { key: "linkedin_client_id", label: "Client ID (profiles)" },
      { key: "linkedin_client_secret", label: "Client Secret (profiles)" },
      { key: "linkedin_page_client_id", label: "Client ID (Pages app)", optional: true },
      { key: "linkedin_page_client_secret", label: "Client Secret (Pages app)", optional: true },
    ],
  },
  {
    id: "x",
    title: "X (Twitter)",
    icons: ["x"],
    readyKind: "x",
    portal: "https://developer.x.com/en/portal/dashboard",
    hint: "User authentication settings → OAuth 2.0, type “Web App”, permission Read and write.",
    fields: [
      { key: "x_client_id", label: "OAuth 2.0 Client ID" },
      { key: "x_client_secret", label: "Client Secret" },
    ],
  },
  {
    id: "google",
    title: "YouTube & Google Business Profile",
    icons: ["youtube", "google"],
    readyKind: "youtube",
    portal: "https://console.cloud.google.com/apis/credentials",
    hint: "OAuth client (Web application). Enable YouTube Data API v3 and the Business Profile APIs.",
    fields: [
      { key: "google_client_id", label: "Client ID" },
      { key: "google_client_secret", label: "Client secret" },
    ],
  },
  {
    id: "pinterest",
    title: "Pinterest",
    icons: ["pinterest"],
    readyKind: "pinterest",
    portal: "https://developers.pinterest.com/apps/",
    hint: "App with boards:read, pins:write and user_accounts:read.",
    fields: [
      { key: "pinterest_app_id", label: "App ID" },
      { key: "pinterest_app_secret", label: "App secret key" },
    ],
  },
  {
    id: "tiktok",
    title: "TikTok",
    icons: ["tiktok"],
    readyKind: "tiktok",
    portal: "https://developers.tiktok.com/apps/",
    hint: "Add Login Kit + Content Posting API (Direct Post) and verify your domain for media URLs.",
    fields: [
      { key: "tiktok_client_key", label: "Client key" },
      { key: "tiktok_client_secret", label: "Client secret" },
    ],
  },
];

/** Connect button → the developer app it needs (so only that one is shown). */
const providersFor: Record<string, string[]> = {
  facebook: ["meta"],
  instagram: ["meta"],
  instagram_login: ["instagram"],
  threads: ["threads"],
  linkedin_profile: ["linkedin"],
  linkedin_page: ["linkedin"],
  x: ["x"],
  youtube: ["google"],
  google_business: ["google"],
  pinterest: ["pinterest"],
  tiktok: ["tiktok"],
};

export default function PlatformSettingsPage() {
  return (
    <Suspense>
      <PlatformSettings />
    </Suspense>
  );
}

function PlatformSettings() {
  const only = providersFor[useSearchParams().get("only") ?? ""];
  const { status } = useLive();
  const [data, setData] = useState<Settings | null>(null);
  const [form, setForm] = useState<Values>({});
  const [error, setError] = useState("");

  const load = () =>
    get<Settings>("platform_settings").then((d) => {
      setData(d);
      setForm(Object.fromEntries(Object.entries(d.values).map(([k, v]) => [k, d.secrets.includes(k) ? "" : v])));
    }, (e: Error) => setError(e.message));

  useEffect(() => {
    if (status?.user?.isAdmin) load();
  }, [status?.user?.isAdmin]);

  if (!status?.loggedIn) return null;
  if (!status.user?.isAdmin) {
    return (
      <>
        <PageHeader title="Platform settings" />
        <Card>
          <p className="text-ink-2">Only the site owner can open this page.</p>
        </Card>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Platform settings" />
        {error ? <p className="rounded-xl bg-danger-tint px-4 py-3 text-sm text-danger">{error}</p> : <p className="text-muted">Loading…</p>}
      </>
    );
  }

  const ready = status.configured.connect ?? {};
  const input = (k: string, secret: boolean, placeholder = "") => {
    const props = {
      value: form[k] ?? "",
      onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })),
      autoComplete: "off",
      placeholder: secret ? (data.values[k] ? `Saved (${data.values[k]}) — leave empty to keep` : "Not set") : placeholder,
    };
    return secret ? <PasswordInput {...props} /> : <input {...props} className="field" />;
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Platform settings" sub="Only you (the site owner) see this page. Your users just click Connect and log in with their own account." />

      <div className="space-y-6">
        <section className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-lg font-bold text-ink">Social networks</h2>
          <p className="mt-1 text-sm text-ink-2">Use these links in every developer app (redirect / callback URL, privacy policy, terms).</p>
          <div className="mt-4 grid gap-2">
            <Copy label="Callback URL" value={data.redirectUri} />
            <Copy label="Privacy policy" value={data.privacyUrl} />
            <Copy label="Terms & data deletion" value={data.termsUrl} />
          </div>
          <div className="mt-5 divide-y divide-line rounded-xl border border-line">
            {!only && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <SocialIcon id="bluesky" size={30} rounded="full" />
                <p className="flex-1 font-bold text-ink">Bluesky</p>
                <span className="rounded-full bg-success-tint px-3 py-1 text-xs font-bold text-success">Ready — no keys needed</span>
              </div>
            )}
            {providers
              .filter((p) => !only || only.includes(p.id))
              .map((p) => (
                <ProviderRow key={p.id} p={p} ready={!!ready[p.readyKind]} form={form} onSaved={load} input={input} secrets={data.secrets} defaultOpen={!!only} />
              ))}
          </div>
        </section>

        {only ? (
          <div className="flex flex-wrap gap-3">
            <Link href={`${APP}/accounts/create`} className="btn btn-primary">
              Back to Connect account
            </Link>
            <Link href={`${APP}/settings/platform`} className="btn btn-ghost border border-line">
              Show all settings
            </Link>
          </div>
        ) : (
          <Section
            title="Email (verification & password reset)"
            icon="mail"
            ready={status.configured.email}
            keys={["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "mail_from", "mail_from_name", "demo_notify_email"]}
            form={form}
            onSaved={load}
            extra={<TestEmail />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Label text="Mailbox (SMTP user)">{input("smtp_user", false, "contact@satishkumar.net")}</Label>
              <Label text="Mailbox password">{input("smtp_pass", true)}</Label>
              <Label text="SMTP server">{input("smtp_host", false, "smtp.hostinger.com")}</Label>
              <Label text="Port" hint="465 (SSL) or 587 (TLS)">{input("smtp_port", false, "465")}</Label>
              <Label text="From address">{input("mail_from", false, "Same as mailbox")}</Label>
              <Label text="From name">{input("mail_from_name", false, "Social Media Connector")}</Label>
              <Label text="Demo booking alerts go to">{input("demo_notify_email", false, "contact@satishkumar.net")}</Label>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function ProviderRow({
  p,
  ready,
  form,
  onSaved,
  input,
  secrets,
  defaultOpen = false,
}: {
  p: Provider;
  defaultOpen?: boolean;
  ready: boolean;
  form: Values;
  onSaved: () => void;
  input: (k: string, secret: boolean) => ReactNode;
  secrets: string[];
}) {
  const [open, setOpen] = useState(defaultOpen);
  const save = useSave(p.fields.map((f) => f.key), form, onSaved);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2">
        <span className="flex -space-x-2">
          {p.icons.map((n) => (
            <SocialIcon key={n} id={n} size={30} rounded="full" />
          ))}
        </span>
        <span className="flex-1 font-bold text-ink">{p.title}</span>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${ready ? "bg-success-tint text-success" : "bg-warn-tint text-warn-ink"}`}>{ready ? "Ready" : "Add keys"}</span>
        <Icon name="chevronDown" size={18} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-5">
          <p className="mb-4 text-sm text-ink-2">
            {p.hint}{" "}
            <a href={p.portal} target="_blank" rel="noreferrer" className="font-bold text-primary">
              Open developer portal ↗
            </a>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {p.fields.map((f) => (
              <Label key={f.key} text={f.label + (f.optional ? " (optional)" : "")}>
                {input(f.key, secrets.includes(f.key))}
              </Label>
            ))}
          </div>
          <SaveBar save={save} />
        </div>
      )}
    </div>
  );
}

function useSave(keys: string[], form: Values, onSaved: () => void) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await post<{ warning?: string }>("platform_settings_save", Object.fromEntries(keys.map((k) => [k, form[k] ?? ""])));
      await initLive(true);
      onSaved();
      setMsg({ ok: true, text: r.warning || "Saved." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save" });
    } finally {
      setBusy(false);
    }
  };
  return { busy, msg, run };
}

function SaveBar({ save, extra }: { save: ReturnType<typeof useSave>; extra?: ReactNode }) {
  return (
    <>
      {save.msg && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${save.msg.ok ? "bg-success-tint text-ink" : "bg-danger-tint text-danger"}`}>{save.msg.text}</p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" disabled={save.busy} onClick={save.run} className="btn btn-primary disabled:opacity-50">
          {save.busy ? "Checking…" : "Save"}
        </button>
        {extra}
      </div>
    </>
  );
}

function Section({
  title,
  icon,
  ready,
  keys,
  form,
  onSaved,
  extra,
  children,
}: {
  title: string;
  icon: string;
  ready: boolean;
  keys: string[];
  form: Values;
  onSaved: () => void;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const save = useSave(keys, form, onSaved);
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-primary-tint text-accent">
          <Icon name={icon} size={18} />
        </span>
        <h2 className="flex-1 text-lg font-bold text-ink">{title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${ready ? "bg-success-tint text-success" : "bg-warn-tint text-warn-ink"}`}>
          {ready ? "Ready" : "Not set up"}
        </span>
      </div>
      {children}
      <SaveBar save={save} extra={extra} />
    </section>
  );
}

function TestEmail() {
  const [state, setState] = useState("");
  return (
    <>
      <button
        type="button"
        className="btn btn-ghost border border-line"
        onClick={() => {
          setState("Sending…");
          post<{ to: string }>("platform_test_email").then(
            (r) => setState(`Test email sent to ${r.to}`),
            (e: Error) => {
              setState("");
              reportError(e);
            },
          );
        }}
      >
        Send test email
      </button>
      {state && <span className="text-sm text-ink-2">{state}</span>}
    </>
  );
}

function Label({ text, hint, children }: { text: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="block text-sm font-medium text-ink">
      <span className="mb-1.5 block">{text}</span>
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </div>
  );
}

function Copy({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-44 shrink-0 text-xs font-bold text-muted">{label}</span>
      <span className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-xs text-ink">{value}</code>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard?.writeText(value).then(() => {
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            })
          }
          className="shrink-0 text-xs font-bold text-primary"
        >
          {done ? "Copied" : "Copy"}
        </button>
      </span>
    </div>
  );
}
