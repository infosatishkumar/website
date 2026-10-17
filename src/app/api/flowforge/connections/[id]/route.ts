import { requireAuth } from "@/lib/flowforge/auth";
import { store } from "@/lib/flowforge/store";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/flowforge/connections/[id]">) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await ctx.params;
  await store().remove("connections", id);
  return Response.json({ ok: true });
}
