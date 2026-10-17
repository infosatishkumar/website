import { requireAuth } from "@/lib/flowforge/auth";
import { store } from "@/lib/flowforge/store";

export async function DELETE() {
  const denied = await requireAuth();
  if (denied) return denied;
  await store().clear("runs");
  return Response.json({ ok: true });
}
