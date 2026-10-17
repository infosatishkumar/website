import "server-only";
import { executor } from "./apps";
import { appByKey } from "./catalog";
import { id } from "./crypto";
import { store } from "./store";
import { renderAll, type Ctx } from "./template";
import type { Run, Step, StepResult, Workflow } from "./types";

const MAX_RUNS = 300;

function checkFilter(cfg: Record<string, string>): boolean {
  const left = cfg.left ?? "";
  const right = cfg.right ?? "";
  const ln = Number(left);
  const rn = Number(right);
  switch (cfg.operator || "exists") {
    case "exists":
      return left.trim() !== "";
    case "does not exist":
      return left.trim() === "";
    case "equals":
      return left.trim().toLowerCase() === right.trim().toLowerCase();
    case "does not equal":
      return left.trim().toLowerCase() !== right.trim().toLowerCase();
    case "contains":
      return left.toLowerCase().includes(right.toLowerCase());
    case "does not contain":
      return !left.toLowerCase().includes(right.toLowerCase());
    case "greater than":
      return Number.isFinite(ln) && Number.isFinite(rn) && ln > rn;
    case "less than":
      return Number.isFinite(ln) && Number.isFinite(rn) && ln < rn;
    default:
      return false;
  }
}

async function runStep(step: Step, ctx: Ctx): Promise<{ output?: unknown; stop?: boolean }> {
  const cfg = renderAll(step.config ?? {}, ctx);
  if (step.app === "filter") return { output: { passed: checkFilter(cfg) }, stop: !checkFilter(cfg) };
  const exec = executor(step.app, step.op);
  if (!exec) throw new Error(`Unknown action ${step.app}.${step.op}`);
  const def = appByKey(step.app);
  if (def?.auth !== "none" && !step.connectionId) throw new Error(`Connect a ${def?.name} account for this step.`);
  return { output: await exec(cfg, step.connectionId) };
}

/** Executes every action step after the trigger and records a Run. */
export async function runWorkflow(wf: Workflow, input: unknown, source: Run["source"]): Promise<Run> {
  const started = Date.now();
  const now = new Date();
  const ctx: Ctx = {
    trigger: input ?? {},
    steps: {} as Record<string, unknown>,
    now: now.toISOString(),
    today: now.toISOString().slice(0, 10),
    workflow: { id: wf.id, name: wf.name },
  };
  const steps = ctx.steps as Record<string, unknown>;
  steps["1"] = input;

  const results: StepResult[] = [];
  let status: Run["status"] = "success";
  let error: string | undefined;

  for (let i = 1; i < wf.steps.length; i++) {
    const step = wf.steps[i];
    const t = Date.now();
    if (status !== "success") {
      results.push({ stepId: step.id, label: step.label, app: step.app, status: "skipped", ms: 0 });
      continue;
    }
    try {
      const { output, stop } = await runStep(step, ctx);
      steps[String(i + 1)] = output;
      steps[step.id] = output;
      results.push({
        stepId: step.id,
        label: step.label,
        app: step.app,
        status: stop ? "stopped" : "success",
        output,
        ms: Date.now() - t,
      });
      if (stop) status = "filtered";
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = "error";
      results.push({ stepId: step.id, label: step.label, app: step.app, status: "error", error, ms: Date.now() - t });
    }
  }

  const run: Run = {
    id: id("run"),
    workflowId: wf.id,
    workflowName: wf.name,
    source,
    status,
    startedAt: now.toISOString(),
    ms: Date.now() - started,
    input: trimForStorage(input),
    steps: results.map((r) => ({ ...r, output: trimForStorage(r.output) })),
    error,
  };

  await store().put("runs", run.id, run);
  const fresh = (await store().get<Workflow>("workflows", wf.id)) ?? wf;
  await store().put("workflows", wf.id, { ...fresh, runs: (fresh.runs ?? 0) + 1 });
  await pruneRuns();
  return run;
}

function trimForStorage(v: unknown): unknown {
  if (v === undefined) return undefined;
  const s = JSON.stringify(v);
  return s && s.length > 20_000 ? { truncated: true, preview: s.slice(0, 20_000) } : v;
}

async function pruneRuns() {
  const runs = await store().list<Run>("runs");
  if (runs.length <= MAX_RUNS) return;
  const old = runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(MAX_RUNS);
  await Promise.all(old.map((r) => store().remove("runs", r.id)));
}

