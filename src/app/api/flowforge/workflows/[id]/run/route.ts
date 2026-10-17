import { requireAuth } from "@/lib/flowforge/auth";
import { runWorkflow } from "@/lib/flowforge/engine";
import { store } from "@/lib/flowforge/store";
import type { Workflow } from "@/lib/flowforge/types";

export const maxDuration = 60;

/** Test run with sample trigger data (defaults to the last captured payload). */
export async function POST(req: Request, ctx: RouteContext<"/api/flowforge/workflows/[id]/run">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const wf = await store().get<Workflow>("workflows", id);
  if (!wf) return Response.json({ error: "Save the workflow first." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { sample?: unknown };
  const sample = body.sample ?? wf.state?.lastSample ?? {};
  const run = await runWorkflow(wf, sample, "test");
  return Response.json({ run });
}
