"use client";

import { useState } from "react";
import { APPS, appByKey, PROVIDERS, type AppDef } from "@/lib/flowforge/catalog";
import type { PublicConnection } from "@/lib/flowforge/types";
import { api, AppIcon, CopyField, Modal, type AppState } from "./ui";

const CATEGORIES = ["All", "Social", "Messaging", "Productivity", "AI", "Core"] as const;

export default function Integrations({
  state,
  reload,
  toast,
  onConnect,
}: {
  state: AppState;
  reload: () => Promise<unknown>;
  toast: (msg: string, bad?: boolean) => void;
  onConnect: (app: string) => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
  const apps = APPS.filter(
    (a) => (cat === "All" || a.category === cat) && `${a.name} ${a.desc} ${a.category}`.toLowerCase().includes(q.toLowerCase()),
  );

  async function disconnect(c: PublicConnection) {
    if (!confirm(`Disconnect ${c.label}? Workflow steps using it will fail until you pick another account.`)) return;
    await api(`connections/${c.id}`, { method: "DELETE" });
    await reload();
    toast("Account disconnected");
  }

  return (
    <section>
      <div className="pagehead">
        <div>
          <h1>Integrations</h1>
          <p>Connect real accounts. Credentials are verified live and stored encrypted on the server.</p>
        </div>
      </div>
      <div className="sectionhead">
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <input className="search" placeholder="Search apps…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="integrationgrid">
        {apps.map((a) => {
          const conns = state.connections.filter((c) => c.app === a.key);
          const ready = a.auth !== "oauth" || state.providers[a.oauth!]?.configured;
          return (
            <div className="card integration" key={a.key}>
              <div className="integrationtop">
                <AppIcon app={a.key} size={40} />
                <div>
                  <h3>{a.name}</h3>
                  <div className="small">{a.category} · {a.auth === "none" ? "built in" : a.auth === "oauth" ? "OAuth" : "API key / token"}</div>
                </div>
                <span className={`pill ${a.auth === "none" || conns.length ? "on" : ready ? "" : "draft"}`} style={{ marginLeft: "auto" }}>
                  {a.auth === "none" ? "Ready" : conns.length ? `${conns.length} connected` : ready ? "Available" : "Needs app keys"}
                </span>
              </div>
              <p>{a.desc}</p>
              {conns.map((c) => (
                <div className="acct" key={c.id}>
                  <span title={c.label}>✓ {c.label}</span>
                  {c.expiresAt && <span className="small" style={{ flex: "none" }}>exp. {new Date(c.expiresAt).toLocaleDateString()}</span>}
                  <button className="rowbtn" onClick={() => disconnect(c)}>Remove</button>
                </div>
              ))}
              {a.auth !== "none" && (
                <div className="actions">
                  <button className={conns.length ? "secondary" : "primary"} onClick={() => onConnect(a.key)}>
                    {conns.length ? "+ Add account" : "Connect"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Connect dialog: credential form for token apps, OAuth redirect or setup guide otherwise. */
export function ConnectModal({
  app,
  state,
  onClose,
  onDone,
}: {
  app: string;
  state: AppState;
  onClose: () => void;
  onDone: (label: string) => void;
}) {
  const def = appByKey(app) as AppDef;
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (def.auth === "oauth") {
    const p = def.oauth!;
    const info = PROVIDERS[p];
    const status = state.providers[p];
    return (
      <Modal onClose={onClose}>
        <div className="actions" style={{ marginBottom: 8 }}>
          <AppIcon app={app} size={40} />
          <h2>Connect {def.name}</h2>
        </div>
        {status.configured ? (
          <>
            <p>You&apos;ll be sent to {info.name} to approve access, then brought straight back here.</p>
            <div className="modalfoot">
              <button className="secondary" onClick={onClose}>Cancel</button>
              <a className="primary" style={{ borderRadius: 9, padding: "10px 13px", fontWeight: 650, color: "#fff", textDecoration: "none" }} href={`/api/flowforge/oauth/${p}/start?app=${app}`}>
                Continue to {info.name} →
              </a>
            </div>
          </>
        ) : (
          <>
            <p>
              One-time setup: {info.name} only lets registered apps post on your behalf. Create your own developer app (free),
              then every account connects with one click.
            </p>
            <ol style={{ paddingLeft: 18, margin: "0 0 10px", fontSize: 13 }}>
              <li>Open <a href={info.consoleUrl} target="_blank" rel="noreferrer">{info.consoleUrl}</a></li>
              <li style={{ marginTop: 6 }}>{info.steps}</li>
              <li style={{ marginTop: 6 }}>Use this redirect / callback URL:</li>
            </ol>
            <CopyField value={status.redirectUri} />
            <ol start={4} style={{ paddingLeft: 18, margin: "12px 0 0", fontSize: 13 }}>
              <li>
                Add <code>{info.idEnv}</code> and <code>{info.secretEnv}</code> to your environment variables (Vercel → Settings →
                Environment Variables, or <code>.env.local</code>) and redeploy.
              </li>
            </ol>
            <div className="modalfoot">
              <button className="primary" onClick={onClose}>Got it</button>
            </div>
          </>
        )}
      </Modal>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { connection } = await api<{ connection: PublicConnection }>("connections", { method: "POST", json: { app, fields } });
      onDone(connection.label);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <div className="actions" style={{ marginBottom: 8 }}>
          <AppIcon app={app} size={40} />
          <h2>Connect {def.name}</h2>
        </div>
        {def.authHelp && <p>{def.authHelp}</p>}
        {def.authFields?.map((f) => (
          <div className="field" key={f.key}>
            <label>{f.label}{f.required ? " *" : ""}</label>
            <input
              type={f.type === "password" ? "password" : "text"}
              autoComplete="off"
              placeholder={f.placeholder}
              value={fields[f.key] ?? ""}
              onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
            />
            {f.help && <span className="helper">{f.help}</span>}
          </div>
        ))}
        {error && <div className="notice">{error}</div>}
        <div className="modalfoot">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy}>{busy ? "Verifying…" : "Verify & connect"}</button>
        </div>
      </form>
    </Modal>
  );
}
