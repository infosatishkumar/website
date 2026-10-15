"use client";

import { useEffect, useState, type ReactNode } from "react";
import Icon from "@/components/connector/Icon";
import SocialIcon from "@/components/connector/SocialIcon";
import { Card, PageHeader } from "@/components/connector/app/ui";
import { get, post } from "@/lib/connector/api";
import { initLive, reportError, useLive } from "@/lib/connector/store";

type Values = Record<string, string>;
type Settings = { values: Values; secrets: string[]; redirectUri: string; siteUrl: string; privacyUrl: string; termsUrl: string };

/** Site-owner page: connect the Meta app, Claude and email once — every user then just clicks "Connect". */
export default function PlatformSettings() {
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

  const field = (k: string) => ({
    value: form[k] ?? "",
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });
  const secretHint = (k: string) => (data.values[k] ? `Saved (${data.values[k]}) — leave empty to keep` : "Not set");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Platform settings"
        sub="Set these once for the whole website. Your users never see them — they just click Connect and log in with their own Facebook."
      />

      <div className="space-y-6">
        {/* Meta */}
        <Section
          title="Facebook & Instagram"
          icon={
            <span className="flex -space-x-2">
              <SocialIcon id="facebook" size={34} rounded="full" />
              <SocialIcon id="instagram" size={34} rounded="full" />
            </span>
          }
          ready={status.configured.meta}
          keys={["meta_app_id", "meta_app_secret", "meta_config_id"]}
          form={form}
          onSaved={load}
        >
          <ol className="mb-5 space-y-3 rounded-xl bg-surface-2 p-4 text-sm text-ink-2">
            <Step n={1}>
              Open{" "}
              <a href="https://developers.facebook.com/apps/creation/" target="_blank" rel="noreferrer" className="font-bold text-primary">
                developers.facebook.com → Create app
              </a>{" "}
              → use case <b>Other</b> → type <b>Business</b>. (Already have one? Open it.)
            </Step>
            <Step n={2}>
              Add the product <b>Facebook Login for Business</b> → Settings → <b>Valid OAuth Redirect URIs</b>:
              <Copy value={data.redirectUri} />
            </Step>
            <Step n={3}>
              <b>App settings → Basic</b>: App domain <Copy value={new URL(data.siteUrl).host} inline /> Privacy Policy URL
              <Copy value={data.privacyUrl} /> Terms / data deletion URL <Copy value={data.termsUrl} />
            </Step>
            <Step n={4}>Copy the <b>App ID</b> and <b>App Secret</b> from the same page into the boxes below and press Save.</Step>
            <Step n={5}>
              To let <b>everyone</b> connect (not only you): finish <b>Business verification</b>, request <b>Advanced access</b> for{" "}
              <code className="text-xs">pages_show_list, pages_read_engagement, pages_manage_posts, business_management, instagram_basic, instagram_content_publish</code>{" "}
              in App Review, then switch the app to <b>Live</b>.
            </Step>
          </ol>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label text="App ID">
              <input {...field("meta_app_id")} inputMode="numeric" className="field" placeholder="e.g. 1234567890123456" />
            </Label>
            <Label text="App Secret">
              <input {...field("meta_app_secret")} type="password" autoComplete="off" className="field" placeholder={secretHint("meta_app_secret")} />
            </Label>
            <Label text="Configuration ID (optional)" hint="Facebook Login for Business → Configurations">
              <input {...field("meta_config_id")} className="field" placeholder="Leave empty if you don't use one" />
            </Label>
          </div>
        </Section>

        {/* Claude */}
        <Section
          title="AI Agent (Claude)"
          icon={
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-primary-tint text-accent">
              <Icon name="sparkles" size={18} />
            </span>
          }
          ready={status.configured.anthropic}
          keys={["anthropic_api_key"]}
          form={form}
          onSaved={load}
        >
          <Label
            text="Claude API key"
            hint={
              <>
                From{" "}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="font-bold text-primary">
                  console.anthropic.com → API Keys
                </a>
              </>
            }
          >
            <input {...field("anthropic_api_key")} type="password" autoComplete="off" className="field" placeholder={secretHint("anthropic_api_key")} />
          </Label>
        </Section>

        {/* Email */}
        <Section
          title="Email (verification & password reset)"
          icon={
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-primary-tint text-accent">
              <Icon name="mail" size={18} />
            </span>
          }
          ready={status.configured.email}
          keys={["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "mail_from", "mail_from_name", "demo_notify_email"]}
          form={form}
          onSaved={load}
          extra={<TestEmail />}
        >
          <p className="mb-4 text-sm text-ink-2">
            Use a Hostinger mailbox (hPanel → Emails), e.g. <b>contact@satishkumar.net</b>, and its password.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label text="Mailbox (SMTP user)">
              <input {...field("smtp_user")} type="email" className="field" placeholder="contact@satishkumar.net" />
            </Label>
            <Label text="Mailbox password">
              <input {...field("smtp_pass")} type="password" autoComplete="off" className="field" placeholder={secretHint("smtp_pass")} />
            </Label>
            <Label text="SMTP server">
              <input {...field("smtp_host")} className="field" placeholder="smtp.hostinger.com" />
            </Label>
            <Label text="Port" hint="465 (SSL) or 587 (TLS)">
              <input {...field("smtp_port")} inputMode="numeric" className="field" placeholder="465" />
            </Label>
            <Label text="From address">
              <input {...field("mail_from")} type="email" className="field" placeholder="Same as mailbox" />
            </Label>
            <Label text="From name">
              <input {...field("mail_from_name")} className="field" placeholder="Social Media Connector" />
            </Label>
            <Label text="Demo booking alerts go to">
              <input {...field("demo_notify_email")} type="email" className="field" placeholder="contact@satishkumar.net" />
            </Label>
          </div>
        </Section>
      </div>
    </div>
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
  icon: ReactNode;
  ready: boolean;
  keys: string[];
  form: Values;
  onSaved: () => void;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
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
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {icon}
        <h2 className="flex-1 text-lg font-bold text-ink">{title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${ready ? "bg-success-tint text-success" : "bg-warn-tint text-warn-ink"}`}>
          {ready ? "Ready" : "Not set up"}
        </span>
      </div>
      {children}
      {msg && <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success-tint text-ink" : "bg-danger-tint text-danger"}`}>{msg.text}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={save} className="btn btn-primary disabled:opacity-50">
          {busy ? "Checking…" : "Save"}
        </button>
        {extra}
      </div>
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
    <label className="block text-sm font-medium text-ink">
      <span className="mb-1.5 block">{text}</span>
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </li>
  );
}

function Copy({ value, inline = false }: { value: string; inline?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <span className={`${inline ? "mx-1 inline-flex" : "mt-1.5 flex"} max-w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5`}>
      <code className="min-w-0 flex-1 truncate text-xs text-ink">{value}</code>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })}
        className="shrink-0 text-xs font-bold text-primary"
      >
        {done ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
