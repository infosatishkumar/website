import { requireAuth } from "@/lib/flowforge/auth";
import { store } from "@/lib/flowforge/store";
import { appUrl, syncTriggerRegistration } from "@/lib/flowforge/triggers";
import type { Workflow } from "@/lib/flowforge/types";

export async function DELETE(req: Request, ctx: RouteContext<"/api/flowforge/workflows/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  const wf = await store().get<Workflow>("workflows", id);
  if (wf) {
    await syncTriggerRegistration({ ...wf, status: "off" }, wf, appUrl(req)).catch(() => {});
    await store().remove("workflows", id);
  }
  return Response.json({ ok: true });
}
