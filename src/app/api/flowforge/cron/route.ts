import { isAuthed } from "@/lib/flowforge/auth";
import { safeEqual } from "@/lib/flowforge/crypto";
import { tick } from "@/lib/flowforge/triggers";

export const maxDuration = 60;

/**
 * Fires schedules and polls RSS feeds. Call it every 1–5 minutes from
 * Vercel Cron or any external cron service with `Authorization: Bearer $CRON_SECRET`
 * (or `?key=$CRON_SECRET`). Signed-in admins may also trigger it from the UI.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("key") ?? "";
  const allowed = (secret && auth && safeEqual(auth, secret)) || (await isAuthed());
  if (!allowed) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await tick());
}

export const GET = handle;
export const POST = handle;
