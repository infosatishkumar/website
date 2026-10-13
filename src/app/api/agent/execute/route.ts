import { findAction } from "@/lib/social/actions";
import type { Attachment } from "@/lib/social/types";

export const maxDuration = 300;

// Runs one action the owner approved on an approval card.
export async function POST(request: Request) {
  const { creds, name, input, files } = await request.json();
  const action = findAction(name);
  if (!action?.write) return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
  const parsed = action.schema.safeParse(input);
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.message }, { status: 400 });

  const map = new Map<string, Attachment>((Array.isArray(files) ? files : []).map((f: Attachment) => [f.id, f]));
  try {
    const result = await action.run(parsed.data, { creds: creds ?? {}, files: map });
    return Response.json({ ok: true, result });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
