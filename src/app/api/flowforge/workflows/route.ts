import { requireAuth } from "@/lib/flowforge/auth";
import { appByKey } from "@/lib/flowforge/catalog";
import { id, token } from "@/lib/flowforge/crypto";
import { store } from "@/lib/flowforge/store";
import { appUrl, syncTriggerRegistration } from "@/lib/flowforge/triggers";
import type { Step, Workflow } from "@/lib/flowforge/types";

function cleanSteps(raw: unknown): Step[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error("A workflow needs a trigger step.");
  return raw.slice(0, 30).map((s, i) => {
    const step = s as Partial<Step>;
    if (!step.app || !appByKey(step.app)) throw new Error(`Step ${i + 1}: unknown app.`);
    const config: Record<string, string> = {};
    for (const [k, v] of Object.entries(step.config ?? {})) config[k] = String(v ?? "").slice(0, 20_000);
    return {
      id: typeof step.id === "string" && step.id ? step.id.slice(0, 40) : id("step"),
      kind: i === 0 ? "trigger" : step.app === "filter" ? "filter" : "action",
      app: step.app,
      op: String(step.op ?? ""),
      label: String(step.label ?? "").slice(0, 120) || appByKey(step.app)!.name,
      connectionId: step.connectionId || undefined,
      config,
    };
  });
}

/** Create or update a workflow. Server owns id defaults, hook token and run count. */
export async function PUT(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    const body = (await req.json()) as Partial<Workflow>;
    const prev = body.id ? await store().get<Workflow>("workflows", body.id) : null;
    const now = new Date().toISOString();
    const steps = cleanSteps(body.steps);
    const prevTrigger = prev?.steps[0];
    const triggerChanged =
      !prevTrigger || prevTrigger.app !== steps[0].app || JSON.stringify(prevTrigger.config) !== JSON.stringify(steps[0].config);
    const wf: Workflow = {
      id: prev?.id ?? id("wf"),
      name: String(body.name ?? "").trim().slice(0, 120) || "Untitled workflow",
      status: body.status === "on" ? "on" : "off",
      hookToken: prev?.hookToken ?? token(18),
      steps,
      runs: prev?.runs ?? 0,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      // Reset polling memory when the trigger itself changes.
      state: triggerChanged ? { lastSample: prev?.state?.lastSample } : prev?.state,
    };
    await syncTriggerRegistration(wf, prev, appUrl(req));
    await store().put("workflows", wf.id, wf);
    return Response.json({ workflow: wf });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
