import { verifyToken } from "@/lib/flowforge/apps";
import { requireAuth } from "@/lib/flowforge/auth";
import { appByKey } from "@/lib/flowforge/catalog";
import { publicConnection, saveConnection } from "@/lib/flowforge/connections";

/** Connect a token-based app: verify the credentials live, then store them encrypted. */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { app, fields } = (await req.json().catch(() => ({}))) as { app?: string; fields?: Record<string, string> };
  const def = app ? appByKey(app) : undefined;
  if (!def || def.auth !== "token") return Response.json({ error: "Unknown app." }, { status: 400 });
  const clean: Record<string, string> = {};
  for (const f of def.authFields ?? []) {
    const v = String(fields?.[f.key] ?? "").trim();
    if (f.required && !v) return Response.json({ error: `${f.label} is required.` }, { status: 400 });
    if (v) clean[f.key] = v;
  }
  try {
    const { label, meta } = await verifyToken(def.key, clean);
    const conn = await saveConnection({ app: def.key, label, secret: clean, meta });
    return Response.json({ connection: publicConnection(conn) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
