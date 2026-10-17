"use client";

import { useCallback, useEffect, useState } from "react";
import { appByKey } from "@/lib/flowforge/catalog";
import type { Run, Step } from "@/lib/flowforge/types";
import Builder, { newStep, type Draft } from "./Builder";
import Integrations, { ConnectModal } from "./Integrations";
import { api, AppIcon, CopyField, Json, Modal, StatusPill, when, type AppState, type ClientWorkflow } from "./ui";

type Page = "dashboard" | "workflows" | "builder" | "integrations" | "history" | "setup";

const TITLES: Record<Page, string> = {
  dashboard: "Dashboard",
  workflows: "Workflows",
  builder: "Workflow builder",
  integrations: "Integrations",
  history: "Run history",
  setup: "Setup",
};

function step(app: string, kind: "trigger" | "action", config: Record<string, string> = {}, op?: string): Step {
  const s = newStep(app, kind);
  if (op) {
    const def = appByKey(app)!;
    const o = (kind === "trigger" ? def.triggers : def.actions)!.find((x) => x.key === op)!;
    s.op = o.key;
    s.label = o.label;
  }
  return { ...s, config: { ...s.config, ...config } };
}

const TEMPLATES: { name: string; desc: string; apps: string[]; build: () => Draft }[] = [
  {
    name: "New blog post → all socials",
    desc: "Watch your RSS feed and share each new post on LinkedIn, Facebook, Bluesky and Telegram.",
    apps: ["rss", "linkedin", "facebook", "bluesky", "telegram"],
    build: () => ({
      name: "New blog post → all socials",
      status: "off",
      steps: [
        step("rss", "trigger", { feedUrl: "" }),
        step("linkedin", "action", { text: "New post: {{trigger.title}}\n\n{{trigger.description}}\n\n{{trigger.link}}" }),
        step("facebook", "action", { message: "{{trigger.title}}", link: "{{trigger.link}}" }),
        step("bluesky", "action", { text: "{{trigger.title}} {{trigger.link}}" }),
        step("telegram", "action", { chatId: "@yourchannel", text: "📝 {{trigger.title}}\n{{trigger.link}}" }),
      ],
    }),
  },
  {
    name: "Website lead → Sheet + Telegram alert",
    desc: "Catch form submissions by webhook, log them in Google Sheets and ping you on Telegram.",
    apps: ["webhook", "google_sheets", "telegram"],
    build: () => ({
      name: "Website lead → Sheet + alert",
      status: "off",
      steps: [
        step("webhook", "trigger"),
        step("filter", "action", { left: "{{trigger.email}}", operator: "exists" }),
        step("google_sheets", "action", { values: "{{now}}\n{{trigger.name}}\n{{trigger.email}}\n{{trigger.phone}}\n{{trigger.message}}" }),
        step("telegram", "action", { text: "🔔 New lead: {{trigger.name}} ({{trigger.email}}, {{trigger.phone}})\n{{trigger.message}}" }),
      ],
    }),
  },
  {
    name: "AI caption → Instagram + Threads",
    desc: "Send an image URL + topic by webhook; Claude writes the caption and it's published.",
    apps: ["webhook", "claude", "instagram", "threads"],
    build: () => ({
      name: "AI caption → Instagram + Threads",
      status: "off",
      steps: [
        step("webhook", "trigger"),
        step("claude", "action", {
          prompt: "Write an engaging Instagram caption (max 3 short lines + 5 hashtags) about: {{trigger.topic}}",
          system: "Reply with the caption only.",
        }),
        step("instagram", "action", { imageUrl: "{{trigger.imageUrl}}", caption: "{{steps.2.text}}" }),
        step("threads", "action", { text: "{{steps.2.text}}", imageUrl: "{{trigger.imageUrl}}" }),
      ],
    }),
  },
  {
    name: "Telegram bot auto-reply with Claude",
    desc: "Every message to your bot gets an AI answer.",
    apps: ["telegram", "claude"],
    build: () => ({
      name: "Telegram AI assistant",
      status: "off",
      steps: [
        step("telegram", "trigger"),
        step("claude", "action", { prompt: "{{trigger.message.text}}", system: "You are a friendly assistant. Keep answers short." }),
        step("telegram", "action", { chatId: "{{trigger.message.chat.id}}", text: "{{steps.2.text}}" }),
      ],
    }),
  },
  {
    name: "Daily post to X + Mastodon",
    desc: "Post a recurring message on a schedule.",
    apps: ["schedule", "x", "mastodon"],
    build: () => ({
      name: "Daily reminder post",
      status: "off",
      steps: [
        step("schedule", "trigger", { minutes: "1440" }),
        step("x", "action", { text: "Good morning! Today is {{today}}." }),
        step("mastodon", "action", { status: "Good morning! Today is {{today}}." }),
      ],
    }),
  },
];

export default function FlowForgeApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [page, setPage] = useState<Page>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("page") === "integrations"
      ? "integrations"
      : "dashboard",
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  // OAuth callbacks come back with ?connected=… or ?error=… in the URL.
  const [toastMsg, setToastMsg] = useState<{ msg: string; bad?: boolean } | null>(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    if (p.get("error")) return { msg: p.get("error")!, bad: true };
    if (p.get("connected")) return { msg: `Connected ${p.get("connected")}` };
    return null;
  });
  const [connectApp, setConnectApp] = useState<string | null>(null);
  const [inspect, setInspect] = useState<Run | null>(null);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState("");

  const toast = useCallback((msg: string, bad?: boolean) => {
    setToastMsg({ msg, bad });
    setTimeout(() => setToastMsg((t) => (t?.msg === msg ? null : t)), bad ? 6000 : 3200);
  }, []);

  const reload = useCallback(async () => {
    try {
      const s = await api<AppState>("state");
      setState(s);
      return s;
    } catch (e) {
      toast((e as Error).message, true);
    }
  }, [toast]);

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", "/flowforge");
    const t = setTimeout(() => setToastMsg(null), 6000);
    api<AppState>("state")
      .then(setState)
      .catch((e: Error) => setToastMsg({ msg: e.message, bad: true }));
    return () => clearTimeout(t);
  }, []);

  function go(p: Page) {
    setPage(p);
    setMenu(false);
    window.scrollTo(0, 0);
  }

  function openBuilder(d: Draft) {
    setDraft(d);
    setDraftKey((k) => k + 1);
    go("builder");
  }

  const edit = (w: ClientWorkflow) => openBuilder({ id: w.id, name: w.name, status: w.status, steps: w.steps });
  const create = () => openBuilder({ name: "Untitled workflow", status: "off", steps: [newStep("webhook", "trigger")] });

  async function toggle(w: ClientWorkflow) {
    try {
      await api("workflows", { method: "PUT", json: { ...w, status: w.status === "on" ? "off" : "on" } });
      await reload();
      toast(w.status === "on" ? "Workflow paused" : "Workflow is live");
    } catch (e) {
      toast((e as Error).message, true);
    }
  }

  async function duplicate(w: ClientWorkflow) {
    await api("workflows", { method: "PUT", json: { name: `${w.name} (copy)`, status: "off", steps: w.steps } });
    await reload();
    toast("Workflow duplicated");
  }

  async function remove(w: ClientWorkflow) {
    if (!confirm(`Delete "${w.name}"?`)) return;
    await api(`workflows/${w.id}`, { method: "DELETE" });
    await reload();
    toast("Workflow deleted");
  }

  async function signOut() {
    await api("auth", { method: "DELETE" });
    window.location.reload();
  }

  if (!state) {
    return <div className="empty" style={{ paddingTop: 120 }}>Loading FlowForge…</div>;
  }

  const runs = state.runs;
  const ok = runs.filter((r) => r.status === "success").length;
  const failed = runs.filter((r) => r.status === "error").length;
  const live = state.workflows.filter((w) => w.status === "on").length;
  const wfRows = state.workflows.filter((w) => w.name.toLowerCase().includes(q.toLowerCase()));

  const workflowTable = (rows: ClientWorkflow[], compact = false) => (
    <div className="card tablewrap">
      <table className="table">
        <thead>
          <tr>
            <th>Workflow</th>
            {!compact && <th>Apps</th>}
            <th>Status</th>
            <th>Runs</th>
            {!compact && <th>Updated</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.id}>
              <td>
                <div className="wf-name">
                  <AppIcon app={w.steps[0]?.app} />
                  <div>
                    {w.name}
                    <div className="small">{w.steps[0]?.label} · {w.steps.length} steps</div>
                  </div>
                </div>
              </td>
              {!compact && (
                <td>
                  <div className="actions" style={{ gap: 4 }}>
                    {[...new Set(w.steps.map((s) => s.app))].slice(0, 6).map((a) => <AppIcon key={a} app={a} size={26} />)}
                  </div>
                </td>
              )}
              <td><span className={`pill ${w.status === "on" ? "on" : "draft"}`}>{w.status === "on" ? "● Live" : "● Off"}</span></td>
              <td>{w.runs ?? 0}</td>
              {!compact && <td className="small">{when(w.updatedAt)}</td>}
              <td>
                <div className="actions" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                  <button className="rowbtn" onClick={() => edit(w)}>Edit</button>
                  {!compact && (
                    <>
                      <button className="rowbtn" onClick={() => toggle(w)}>{w.status === "on" ? "Pause" : "Turn on"}</button>
                      <button className="rowbtn" onClick={() => duplicate(w)}>Copy</button>
                      <button className="rowbtn" onClick={() => remove(w)}>Delete</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="empty">No workflows yet — start from a template or create one.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const runTable = (rows: Run[]) => (
    <div className="card tablewrap">
      <table className="table">
        <thead>
          <tr>
            <th>Result</th>
            <th>Workflow</th>
            <th>Source</th>
            <th>Duration</th>
            <th>Time</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><StatusPill status={r.status} /></td>
              <td>
                <b>{r.workflowName}</b>
                {r.error && <div className="small" style={{ color: "var(--red)", maxWidth: 380 }}>{r.error.slice(0, 140)}</div>}
              </td>
              <td className="small">{r.source}</td>
              <td className="small">{r.ms} ms</td>
              <td className="small">{when(r.startedAt)}</td>
              <td><button className="rowbtn" onClick={() => setInspect(r)}>Inspect</button></td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="empty">No runs yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="app">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="brand"><div className="logo">↯</div> FlowForge</div>
        <div>
          <div className="navlabel">Workspace</div>
          <nav className="nav">
            {(["dashboard", "workflows", "integrations", "history"] as Page[]).map((p) => (
              <button key={p} className={page === p || (p === "workflows" && page === "builder") ? "active" : ""} onClick={() => go(p)}>
                <span className="ico">{{ dashboard: "▦", workflows: "⤴", integrations: "▧", history: "◷" }[p as "dashboard"]}</span>
                {TITLES[p]}
              </button>
            ))}
          </nav>
        </div>
        <div>
          <div className="navlabel">Manage</div>
          <nav className="nav">
            <button className={page === "setup" ? "active" : ""} onClick={() => go("setup")}><span className="ico">⚙</span>Setup</button>
          </nav>
        </div>
        <div className="sidebarbottom">
          <div style={{ fontWeight: 750, marginBottom: 5 }}>{state.connections.length} accounts connected</div>
          <div className="small" style={{ marginBottom: 12 }}>{live} live workflow{live === 1 ? "" : "s"}</div>
          <button className="secondary" style={{ width: "100%" }} onClick={() => go("integrations")}>Connect apps</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="actions" style={{ flexWrap: "nowrap" }}>
            <button className="secondary mobilemenu" onClick={() => setMenu(!menu)}>☰</button>
            <span className="crumb hide-mobile">FlowForge</span>
            <span style={{ color: "#b5b9c5" }} className="hide-mobile">/</span>
            <b>{TITLES[page]}</b>
          </div>
          <div className="topright">
            <span className={`pill ${state.system.store === "supabase" ? "on" : "draft"} hide-mobile`}>
              ● {state.system.store === "supabase" ? "Cloud database" : "Local file storage"}
            </span>
            {!state.system.openAccess && <button className="secondary hide-mobile" onClick={signOut}>Sign out</button>}
            <div className="avatar">FF</div>
          </div>
        </header>

        <div className="content">
          {page === "dashboard" && (
            <section>
              <div className="pagehead">
                <div>
                  <h1>Automate your socials 👋</h1>
                  <p>Triggers, actions and real API connections — all in one place.</p>
                </div>
                <div className="actions">
                  <button className="secondary" onClick={() => go("integrations")}>Connect accounts</button>
                  <button className="primary" onClick={create}>＋ Create workflow</button>
                </div>
              </div>
              <div className="stats">
                <div className="card stat"><div className="statlabel">Workflows</div><div className="statnum">{state.workflows.length}</div><div className="trend">{live} live</div></div>
                <div className="card stat"><div className="statlabel">Successful runs</div><div className="statnum">{ok}</div><div className="trend">Last {runs.length} runs</div></div>
                <div className="card stat"><div className="statlabel">Failed runs</div><div className="statnum">{failed}</div><div className="small">Inspect errors in Run history</div></div>
                <div className="card stat"><div className="statlabel">Connected accounts</div><div className="statnum">{state.connections.length}</div><div className="small">Across {new Set(state.connections.map((c) => c.app)).size} apps</div></div>
              </div>

              <div className="sectionhead"><h2>Start from a template</h2></div>
              <div className="integrationgrid" style={{ marginBottom: 24 }}>
                {TEMPLATES.map((t) => (
                  <div className="card integration" key={t.name}>
                    <div className="actions" style={{ gap: 4 }}>{t.apps.map((a) => <AppIcon key={a} app={a} size={28} />)}</div>
                    <h3>{t.name}</h3>
                    <p>{t.desc}</p>
                    <div className="actions"><button className="secondary" onClick={() => openBuilder(t.build())}>Use template</button></div>
                  </div>
                ))}
              </div>

              <div className="two-col">
                <div>
                  <div className="sectionhead"><h2>Your workflows</h2><button className="secondary" onClick={() => go("workflows")}>View all →</button></div>
                  {workflowTable(state.workflows.slice(0, 5), true)}
                </div>
                <div>
                  <div className="sectionhead"><h2>Recent activity</h2><button className="secondary" onClick={() => go("history")}>All runs →</button></div>
                  <div className="card pad">
                    {runs.slice(0, 6).map((r) => (
                      <div className="activityrow" key={r.id}>
                        <div className={`statusdot ${r.status === "error" ? "bad" : r.status === "filtered" ? "warn" : ""}`} />
                        <div style={{ minWidth: 0 }}>
                          <b>{r.workflowName}</b>
                          <div className="small">{when(r.startedAt)} · {r.source} · {r.ms} ms</div>
                          {r.error && <div className="small" style={{ color: "var(--red)" }}>{r.error.slice(0, 120)}</div>}
                        </div>
                      </div>
                    ))}
                    {!runs.length && <div className="empty">No runs yet.</div>}
                  </div>
                </div>
              </div>
            </section>
          )}

          {page === "workflows" && (
            <section>
              <div className="pagehead">
                <div><h1>Workflows</h1><p>Build and manage your automations.</p></div>
                <button className="primary" onClick={create}>＋ Create workflow</button>
              </div>
              <div className="sectionhead">
                <input className="search" placeholder="Search workflows…" value={q} onChange={(e) => setQ(e.target.value)} />
                <span className="small">{wfRows.length} workflows</span>
              </div>
              {workflowTable(wfRows)}
            </section>
          )}

          {page === "builder" && draft && (
            <Builder
              key={draftKey}
              initial={draft}
              state={state}
              reload={reload}
              toast={toast}
              onBack={() => go("workflows")}
              onConnect={setConnectApp}
              onSaved={(id) => setDraft((d) => (d ? { ...d, id } : d))}
            />
          )}

          {page === "integrations" && <Integrations state={state} reload={reload} toast={toast} onConnect={setConnectApp} />}

          {page === "history" && (
            <section>
              <div className="pagehead">
                <div><h1>Run history</h1><p>Every execution with inputs, outputs and errors per step.</p></div>
                <div className="actions">
                  <button className="secondary" onClick={() => reload()}>Refresh</button>
                  <button
                    className="danger"
                    onClick={async () => {
                      if (!confirm("Clear all run history?")) return;
                      await api("runs", { method: "DELETE" });
                      await reload();
                    }}
                  >
                    Clear history
                  </button>
                </div>
              </div>
              {runTable(runs)}
            </section>
          )}

          {page === "setup" && <Setup state={state} toast={toast} reload={reload} />}
        </div>
      </main>

      {connectApp && (
        <ConnectModal
          app={connectApp}
          state={state}
          onClose={() => setConnectApp(null)}
          onDone={async (label) => {
            setConnectApp(null);
            await reload();
            toast(`Connected ${label}`);
          }}
        />
      )}

      {inspect && (
        <Modal onClose={() => setInspect(null)}>
          <h2>Execution details</h2>
          <p>{inspect.workflowName} · {new Date(inspect.startedAt).toLocaleString()} · {inspect.ms} ms · <StatusPill status={inspect.status} /></p>
          <div className="field"><label>Trigger data ({inspect.source})</label><Json value={inspect.input} /></div>
          {inspect.steps.map((s, i) => (
            <div className="steplog" key={s.stepId}>
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <b>{i + 2}. {s.label}</b>
                <span className="small">{s.ms} ms · <StatusPill status={s.status === "stopped" ? "filtered" : s.status} /></span>
              </div>
              {s.error ? <div className="notice" style={{ marginTop: 8 }}>{s.error}</div> : s.output !== undefined && <Json value={s.output} />}
            </div>
          ))}
          <div className="modalfoot"><button className="primary" onClick={() => setInspect(null)}>Close</button></div>
        </Modal>
      )}

      {toastMsg && <div className={`toast ${toastMsg.bad ? "bad" : ""}`}>{toastMsg.msg}</div>}
    </div>
  );
}

function Setup({ state, toast, reload }: { state: AppState; toast: (m: string, bad?: boolean) => void; reload: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const s = state.system;
  const check = (good: boolean, label: string, hint: string) => (
    <div className="activityrow">
      <div className={`statusdot ${good ? "" : "warn"}`} />
      <div><b>{label}</b><div className="small">{hint}</div></div>
    </div>
  );
  return (
    <section>
      <div className="pagehead">
        <div><h1>Setup</h1><p>What&apos;s configured on this deployment and what&apos;s left to do.</p></div>
      </div>
      <div className="two-col">
        <div className="card pad">
          <h2 style={{ marginTop: 0, fontSize: 17 }}>System status</h2>
          {check(s.store === "supabase", s.store === "supabase" ? "Supabase database" : "Local file storage", s.store === "supabase" ? "Workflows, runs and encrypted credentials are stored in the flowforge_docs table." : "Fine for local use. On Vercel set SUPABASE_SERVICE_ROLE_KEY and run supabase/flowforge.sql so data persists.")}
          {check(!s.openAccess, s.openAccess ? "No password (dev mode)" : "Password protected", s.openAccess ? "Set FLOWFORGE_ADMIN_PASSWORD before deploying." : "Only people with the admin password can sign in.")}
          {check(s.cronSecret, s.cronSecret ? "Cron secret set" : "Cron secret missing", "Schedules and RSS triggers need a cron job calling the URL below every 5 minutes.")}
          {check(s.appUrl.startsWith("https://"), `Public URL: ${s.appUrl}`, "OAuth redirects and Telegram webhooks need an https URL (set FLOWFORGE_APP_URL if this is wrong).")}
          {(Object.entries(state.providers) as [string, { configured: boolean }][]).map(([p, v]) => (
            <div className="activityrow" key={p}>
              <div className={`statusdot ${v.configured ? "" : "warn"}`} />
              <div><b>{p.charAt(0).toUpperCase() + p.slice(1)} OAuth</b><div className="small">{v.configured ? "App keys configured — accounts connect in one click." : "Add the app keys to enable one-click connect (see Integrations → Connect)."}</div></div>
            </div>
          ))}
        </div>
        <div className="card pad">
          <h2 style={{ marginTop: 0, fontSize: 17 }}>Cron (schedules &amp; RSS)</h2>
          <p className="small">
            Point a free scheduler such as cron-job.org, GitHub Actions, or Vercel Cron (Pro) at this URL every 5 minutes, with header
            <code> Authorization: Bearer $CRON_SECRET</code>:
          </p>
          <CopyField value={s.cronUrl} />
          <p className="small">Or append <code>?key=YOUR_CRON_SECRET</code> for services that can&apos;t send headers.</p>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ checked: number; fired: unknown[]; errors: { workflow: string; error: string }[] }>("cron", { method: "POST" });
                await reload();
                toast(`Checked ${r.checked} workflows, fired ${r.fired.length}${r.errors.length ? `, ${r.errors.length} errors: ${r.errors[0].error}` : ""}`, r.errors.length > 0);
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Checking…" : "Run schedule & RSS check now"}
          </button>
          <div className="divider" />
          <h2 style={{ fontSize: 17 }}>Security notes</h2>
          <ul className="small" style={{ paddingLeft: 18 }}>
            <li>Credentials are encrypted with AES-256-GCM using FLOWFORGE_SECRET — keep it secret and never change it after connecting accounts.</li>
            <li>Webhook URLs contain a secret token; treat them like passwords.</li>
            <li>HTTP Request and RSS steps block private-network addresses.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
