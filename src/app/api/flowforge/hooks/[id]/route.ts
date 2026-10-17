import { safeEqual } from "@/lib/flowforge/crypto";
import { runWorkflow } from "@/lib/flowforge/engine";
import { store } from "@/lib/flowforge/store";
import type { Workflow } from "@/lib/flowforge/types";

export const maxDuration = 60;

async function readBody(req: Request): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (req.method === "GET" || req.method === "HEAD") return {};
  if (type.includes("application/json")) return req.json().catch(() => ({}));
  if (type.includes("form")) {
    const fd = await req.formData();
    const out: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      out[k] = typeof v === "string" ? v : v.name;
    });
    return out;
  }
  const text = await req.text();
  try {
    return JSON.parse(text);
  } catch {
    return text ? { body: text } : {};
  }
}

async function handle(req: Request, ctx: RouteContext<"/api/flowforge/hooks/[id]">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const wf = await store().get<Workflow>("workflows", id);
  const provided =
    url.searchParams.get("token") ??
    req.headers.get("x-flowforge-token") ??
    req.headers.get("x-telegram-bot-api-secret-token") ??
    "";
  if (!wf || !provided || !safeEqual(provided, wf.hookToken)) {
    return Response.json({ error: "Unknown hook" }, { status: 404 });
  }
  const trig = wf.steps[0];
  if (trig?.app !== "webhook" && trig?.app !== "telegram") {
    return Response.json({ error: "This workflow is not started by a webhook." }, { status: 400 });
  }

  const body = await readBody(req);
  const query = Object.fromEntries([...url.searchParams].filter(([k]) => k !== "token"));
  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? { ...query, ...(body as Record<string, unknown>) }
      : { ...query, body };

  // Always remember the latest payload so the builder can use it as sample data.
  await store().put("workflows", wf.id, { ...wf, state: { ...wf.state, lastSample: payload } });
  if (wf.status !== "on") {
    return Response.json({ ok: true, captured: true, note: "Workflow is off; payload saved as sample data." }, { status: 202 });
  }
  const run = await runWorkflow(wf, payload, trig.app === "telegram" ? "telegram" : "webhook");
  return Response.json({ ok: run.status !== "error", run: run.id, status: run.status });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
