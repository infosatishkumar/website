"use client";

import { useMemo, useRef, useState } from "react";
import { APPS, appByKey, opFor, type Field } from "@/lib/flowforge/catalog";
import type { Run, Step, Workflow } from "@/lib/flowforge/types";
import { api, AppIcon, CopyField, flattenPaths, Json, StatusPill, type AppState, type ClientWorkflow } from "./ui";

export type Draft = Pick<Workflow, "name" | "status" | "steps"> & { id?: string };

const uid = () => `step_${Math.random().toString(36).slice(2, 9)}`;

function defaults(fields: Field[]) {
  return Object.fromEntries(fields.filter((f) => f.default).map((f) => [f.key, f.default!]));
}

export function newStep(app: string, kind: "trigger" | "action"): Step {
  const def = appByKey(app)!;
  const op = (kind === "trigger" ? def.triggers : def.actions)![0];
  return {
    id: uid(),
    kind: app === "filter" ? "filter" : kind,
    app,
    op: op.key,
    label: op.label,
    config: defaults(op.fields),
  };
}

const TRIGGER_APPS = APPS.filter((a) => a.triggers?.length);
const ACTION_APPS = APPS.filter((a) => a.actions?.length);

export default function Builder({
  initial,
  state,
  reload,
  toast,
  onBack,
  onConnect,
  onSaved,
}: {
  initial: Draft;
  state: AppState;
  reload: () => Promise<AppState | undefined>;
  toast: (msg: string, bad?: boolean) => void;
  onBack: () => void;
  onConnect: (app: string) => void;
  onSaved: (id: string) => void;
}) {
  const [wf, setWf] = useState<Draft>(initial);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState<"" | "save" | "test">("");
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const saved: ClientWorkflow | undefined = wf.id ? state.workflows.find((w) => w.id === wf.id) : undefined;
  const [sampleText, setSampleText] = useState(() =>
    JSON.stringify(saved?.state?.lastSample ?? sampleFor(initial.steps[0]?.app), null, 2),
  );
  const focused = useRef<string | null>(null);

  const step = wf.steps[sel];
  const sample = useMemo(() => {
    try {
      return JSON.parse(sampleText);
    } catch {
      return null;
    }
  }, [sampleText]);

  const vars = useMemo(() => {
    const list = flattenPaths(sample ?? {}, "trigger");
    lastRun?.steps.forEach((r, i) => {
      if (i + 2 <= sel + 1 && r.output !== undefined) flattenPaths(r.output, `steps.${i + 2}`, 0, list);
    });
    return list;
  }, [sample, lastRun, sel]);

  function patchStep(i: number, patch: Partial<Step>) {
    setWf((w) => ({ ...w, steps: w.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  }

  function setConfig(key: string, value: string) {
    patchStep(sel, { config: { ...step.config, [key]: value } });
  }

  function changeApp(app: string) {
    const fresh = newStep(app, sel === 0 ? "trigger" : "action");
    patchStep(sel, { ...fresh, id: step.id });
    if (sel === 0 && !saved?.state?.lastSample) setSampleText(JSON.stringify(sampleFor(app), null, 2));
  }

  function changeOp(op: string) {
    const o = opFor(step.app, sel === 0 ? "trigger" : "action", op)!;
    patchStep(sel, { op, label: o.label, config: { ...defaults(o.fields), ...step.config } });
  }

  function addStep() {
    setWf((w) => ({ ...w, steps: [...w.steps, newStep("telegram", "action")] }));
    setSel(wf.steps.length);
  }

  function removeStep() {
    if (sel === 0) return toast("The trigger can't be removed — change its app instead.", true);
    setWf((w) => ({ ...w, steps: w.steps.filter((_, i) => i !== sel) }));
    setSel(sel - 1);
  }

  function move(dir: -1 | 1) {
    const to = sel + dir;
    if (sel === 0 || to < 1 || to >= wf.steps.length) return;
    setWf((w) => {
      const steps = [...w.steps];
      [steps[sel], steps[to]] = [steps[to], steps[sel]];
      return { ...w, steps };
    });
    setSel(to);
  }

  function insertVar(path: string) {
    const key = focused.current;
    if (!key || sel === 0) {
      navigator.clipboard?.writeText(`{{${path}}}`);
      return toast(`Copied {{${path}}} — click into a field first to insert directly.`);
    }
    setConfig(key, `${step.config[key] ?? ""}{{${path}}}`);
  }

  async function save(status = wf.status): Promise<string | null> {
    setBusy("save");
    try {
      const { workflow } = await api<{ workflow: Workflow }>("workflows", { method: "PUT", json: { ...wf, status } });
      setWf((w) => ({ ...w, id: workflow.id, status: workflow.status, steps: workflow.steps }));
      await reload();
      onSaved(workflow.id);
      return workflow.id;
    } catch (e) {
      toast((e as Error).message, true);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function test() {
    if (sample === null) return toast("Sample data must be valid JSON.", true);
    const id = await save();
    if (!id) return;
    setBusy("test");
    try {
      const { run } = await api<{ run: Run }>(`workflows/${id}/run`, { method: "POST", json: { sample } });
      setLastRun(run);
      await reload();
      toast(run.status === "success" ? "Test run succeeded — real actions were performed." : run.status === "filtered" ? "Run stopped by the filter." : `Test run failed: ${run.error}`, run.status === "error");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }

  async function refreshSample() {
    const s = await reload();
    const w = s?.workflows.find((x) => x.id === wf.id);
    if (w?.state?.lastSample) {
      setSampleText(JSON.stringify(w.state.lastSample, null, 2));
      toast("Loaded the latest received data.");
    } else toast("Nothing received yet. Send a request to the URL first.");
  }

  const def = appByKey(step?.app ?? "");
  const kind = sel === 0 ? "trigger" : "action";
  const op = step ? opFor(step.app, kind, step.op) : undefined;
  const conns = state.connections.filter((c) => c.app === step?.app);
  const conn = conns.find((c) => c.id === step?.connectionId);

  return (
    <section>
      <div className="pagehead">
        <div>
          <h1>{wf.name || "Untitled workflow"}</h1>
          <p>Pick a trigger, add actions, map data with {"{{variables}}"}, then test with real APIs.</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={onBack}>← Back</button>
          <button className="secondary" disabled={!!busy} onClick={() => save().then((id) => id && toast("Workflow saved"))}>
            {busy === "save" ? "Saving…" : "Save"}
          </button>
          <button className="primary" disabled={!!busy} onClick={test}>{busy === "test" ? "Running…" : "▶ Test run"}</button>
        </div>
      </div>

      <div className="actions" style={{ marginBottom: 18, gap: 16 }}>
        <div className="field" style={{ margin: 0, maxWidth: 420, flex: 1 }}>
          <label>Workflow name</label>
          <input value={wf.name} placeholder="e.g. New blog post → all socials" onChange={(e) => setWf({ ...wf, name: e.target.value })} />
        </div>
        <span
          className={`toggle ${wf.status === "on" ? "on" : ""}`}
          role="switch"
          aria-checked={wf.status === "on"}
          tabIndex={0}
          onClick={async () => {
            const next = wf.status === "on" ? "off" : "on";
            setWf({ ...wf, status: next });
            const id = await save(next);
            if (id) toast(next === "on" ? "Workflow is live" : "Workflow paused");
            else setWf({ ...wf });
          }}
          style={{ marginTop: 18 }}
        >
          <span className="track" /> {wf.status === "on" ? "On — live" : "Off"}
        </span>
      </div>

      <div className="builderwrap">
        <div>
          <div className="canvas">
            <div className="canvashead">
              <b>Workflow canvas</b>
              <span className="pill">{wf.steps.length} steps</span>
            </div>
            <div className="flowline">
              {wf.steps.map((s, i) => {
                const result = lastRun?.steps.find((r) => r.stepId === s.id);
                return (
                  <div key={s.id} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {i > 0 && <div className="connector" />}
                    <button className={`node ${i === sel ? "selected" : ""} ${result?.status === "error" ? "err" : ""}`} onClick={() => setSel(i)}>
                      <div className="node-top">
                        <AppIcon app={s.app} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <h3>{i + 1}. {s.label}</h3>
                          <p>{appByKey(s.app)?.name}{s.connectionId ? ` · ${state.connections.find((c) => c.id === s.connectionId)?.label ?? "account missing"}` : ""}</p>
                        </div>
                        <span className="nodebadge">
                          {result ? <StatusPill status={result.status === "stopped" ? "filtered" : result.status} /> : i === 0 ? "TRIGGER" : s.kind.toUpperCase()}
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
              <button className="addnode" onClick={addStep}>+ Add step</button>
            </div>
          </div>

          <div className="card pad" style={{ marginTop: 16 }}>
            <div className="sectionhead">
              <h2>Sample trigger data</h2>
              {["webhook", "telegram"].includes(wf.steps[0].app) ? (
                <button className="secondary" disabled={!wf.id} onClick={refreshSample}>Load last received</button>
              ) : null}
            </div>
            <p className="small" style={{ marginTop: 0 }}>
              Used for test runs and for the variable picker. Real runs use the data the trigger receives.
            </p>
            <div className="field" style={{ margin: 0 }}>
              <textarea className="mono" style={{ minHeight: 140 }} value={sampleText} onChange={(e) => setSampleText(e.target.value)} />
              {sample === null && <span className="helper" style={{ color: "var(--red)" }}>Not valid JSON</span>}
            </div>
          </div>

          {lastRun && (
            <div className="card pad" style={{ marginTop: 16 }}>
              <div className="sectionhead">
                <h2>Last test run</h2>
                <StatusPill status={lastRun.status} />
              </div>
              {lastRun.steps.map((r, i) => (
                <div className="steplog" key={r.stepId}>
                  <div className="actions" style={{ justifyContent: "space-between" }}>
                    <b>{i + 2}. {r.label}</b>
                    <span className="small">{r.ms} ms · <StatusPill status={r.status === "stopped" ? "filtered" : r.status} /></span>
                  </div>
                  {r.error ? <div className="notice" style={{ marginTop: 8 }}>{r.error}</div> : r.output !== undefined && <Json value={r.output} />}
                </div>
              ))}
              {!lastRun.steps.length && <p className="small">The workflow has no action steps yet.</p>}
            </div>
          )}
        </div>

        {step && def && (
          <div className="card sidepanel">
            <h3>{sel === 0 ? "Trigger" : `Step ${sel + 1}`}</h3>
            <div className="small">{op?.desc}</div>

            <div className="field">
              <label>App</label>
              <select value={step.app} onChange={(e) => changeApp(e.target.value)}>
                {(sel === 0 ? TRIGGER_APPS : ACTION_APPS).map((a) => (
                  <option key={a.key} value={a.key}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>{sel === 0 ? "Event" : "Action"}</label>
              <select value={step.op} onChange={(e) => changeOp(e.target.value)}>
                {(sel === 0 ? def.triggers : def.actions)?.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </div>

            {def.auth !== "none" && (
              <div className="field">
                <label>Account</label>
                <select value={step.connectionId ?? ""} onChange={(e) => patchStep(sel, { connectionId: e.target.value || undefined })}>
                  <option value="">— choose account —</option>
                  {conns.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <button className="linkbtn" style={{ alignSelf: "flex-start", fontSize: 12 }} onClick={() => onConnect(step.app)}>
                  + Connect {conns.length ? "another" : "a"} {def.name} account
                </button>
              </div>
            )}

            <div className="field">
              <label>Step name</label>
              <input value={step.label} onChange={(e) => patchStep(sel, { label: e.target.value })} />
            </div>

            {op?.fields.map((f) => (
              <div className="field" key={f.key}>
                <label>{f.label}{f.required ? " *" : ""}</label>
                <FieldInput
                  field={f}
                  value={step.config[f.key] ?? ""}
                  options={f.optionsFrom ? ((conn?.meta?.[f.optionsFrom] as { id: string; name: string }[]) ?? []) : undefined}
                  onFocus={() => (focused.current = f.key)}
                  onChange={(v) => setConfig(f.key, v)}
                />
                {f.help && <span className="helper">{f.help}</span>}
              </div>
            ))}

            {sel === 0 && step.app === "webhook" && (
              <div className="field">
                <label>Your webhook URL</label>
                {saved ? (
                  <>
                    <CopyField value={saved.hookUrl} />
                    <span className="helper">
                      POST JSON or form data here (WordPress forms, Elementor, Meta lead webhooks via Make, your site…). While the
                      workflow is Off, requests are only saved as sample data.
                    </span>
                    <CopyField value={`curl -X POST '${saved.hookUrl}' -H 'Content-Type: application/json' -d '{"name":"Asha","email":"asha@example.com"}'`} />
                  </>
                ) : (
                  <span className="helper">Save the workflow to get its unique URL.</span>
                )}
              </div>
            )}
            {sel === 0 && step.app === "telegram" && (
              <div className="notice info">
                Turn the workflow On to register the bot&apos;s webhook. A Telegram bot can only feed one workflow at a time.
                Requires the deployed https URL.
              </div>
            )}
            {sel === 0 && (step.app === "schedule" || step.app === "rss") && (
              <div className="notice info">
                Runs on the cron tick ({state.system.cronSecret ? "cron secret set" : "set CRON_SECRET and a cron job — see Setup"}).
                {step.app === "rss" && " The first check only remembers existing posts; new posts after that fire the workflow."}
              </div>
            )}

            {sel > 0 && vars.length > 0 && (
              <>
                <div className="divider" />
                <label className="small" style={{ fontWeight: 700 }}>Insert data from earlier steps</label>
                <div className="chips" style={{ marginTop: 8 }}>
                  {vars.slice(0, 40).map((v) => (
                    <button key={v.path} className="varchip" title={v.preview} onMouseDown={(e) => e.preventDefault()} onClick={() => insertVar(v.path)}>
                      {v.path}
                    </button>
                  ))}
                </div>
                <p className="helper">Click a field, then a variable to append it. Run a test to see outputs of later steps.</p>
              </>
            )}

            <div className="divider" />
            <div className="actions">
              {sel > 0 && <button className="secondary" onClick={() => move(-1)}>↑</button>}
              {sel > 0 && <button className="secondary" onClick={() => move(1)}>↓</button>}
              {sel > 0 && <button className="danger" onClick={removeStep}>Remove step</button>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FieldInput({
  field,
  value,
  options,
  onChange,
  onFocus,
}: {
  field: Field;
  value: string;
  options?: { id: string; name: string }[];
  onChange: (v: string) => void;
  onFocus: () => void;
}) {
  if (field.type === "select") {
    const opts = options ? options.map((o) => ({ value: o.id, label: o.name })) : (field.options ?? []).map((o) => ({ value: o, label: o }));
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} onFocus={onFocus}>
        {options && <option value="">{options.length ? "— choose —" : "Connect an account first"}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  if (field.type === "textarea" || field.type === "json") {
    return (
      <textarea
        className={field.type === "json" ? "mono" : undefined}
        value={value}
        placeholder={field.placeholder}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      type={field.type === "number" ? "number" : "text"}
      value={value}
      placeholder={field.placeholder}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function sampleFor(app?: string): unknown {
  switch (app) {
    case "rss":
      return { id: "https://example.com/p/1", title: "My new blog post", link: "https://example.com/p/1", description: "A short summary of the post.", published: new Date().toUTCString() };
    case "schedule":
      return { firedAt: new Date().toISOString(), intervalMinutes: 60 };
    case "telegram":
      return { update_id: 1, message: { message_id: 1, text: "Hello bot", chat: { id: 123456789, type: "private" }, from: { id: 123456789, first_name: "Asha" } } };
    default:
      return { name: "Asha Verma", email: "asha@example.com", phone: "+919876543210", message: "I'd like a quote" };
  }
}
