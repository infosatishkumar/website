import { TESTS } from "@/lib/social/actions";

// "Test connection" button on the Settings tab.
export async function POST(request: Request) {
  const { creds, platform } = await request.json();
  const test = TESTS[platform];
  if (!test) return Response.json({ ok: false, error: "Unknown platform" }, { status: 400 });
  try {
    return Response.json({ ok: true, result: await test({ creds: creds ?? {}, files: new Map() }) });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
