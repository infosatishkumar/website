import { endSession, passwordConfigured, startSession } from "@/lib/flowforge/auth";
import { safeEqual } from "@/lib/flowforge/crypto";

// Naive per-instance throttle: 10 attempts per 10 minutes per IP.
const attempts = new Map<string, { n: number; since: number }>();

export async function POST(req: Request) {
  if (!passwordConfigured()) {
    return Response.json({ error: "Set FLOWFORGE_ADMIN_PASSWORD to enable sign-in." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const a = attempts.get(ip);
  const now = Date.now();
  if (a && now - a.since < 600_000 && a.n >= 10) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!password || !safeEqual(password, process.env.FLOWFORGE_ADMIN_PASSWORD!)) {
    attempts.set(ip, a && now - a.since < 600_000 ? { n: a.n + 1, since: a.since } : { n: 1, since: now });
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }
  attempts.delete(ip);
  await startSession();
  return Response.json({ ok: true });
}

export async function DELETE() {
  await endSession();
  return Response.json({ ok: true });
}
