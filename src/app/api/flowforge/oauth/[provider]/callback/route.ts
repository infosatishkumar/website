import { isAuthed } from "@/lib/flowforge/auth";
import { saveConnection } from "@/lib/flowforge/connections";
import { impl, isProvider, providerCreds } from "@/lib/flowforge/oauth";
import { store } from "@/lib/flowforge/store";
import { appUrl } from "@/lib/flowforge/triggers";

interface Pending {
  provider: string;
  app: string;
  verifier: string;
  redirectUri: string;
  created: number;
}

export async function GET(req: Request, ctx: RouteContext<"/api/flowforge/oauth/[provider]/callback">) {
  const base = appUrl(req);
  const back = (key: "connected" | "error", msg: string) =>
    Response.redirect(`${base}/flowforge?page=integrations&${key}=${encodeURIComponent(msg)}`, 302);

  if (!(await isAuthed())) return Response.redirect(`${base}/flowforge`, 302);
  const { provider } = await ctx.params;
  const params = new URL(req.url).searchParams;
  if (params.get("error")) return back("error", params.get("error_description") || params.get("error")!);

  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";
  const pending = state ? await store().get<Pending>("kv", `oauth:${state}`) : null;
  if (state) await store().remove("kv", `oauth:${state}`);
  if (!pending || pending.provider !== provider || Date.now() - pending.created > 15 * 60_000 || !isProvider(provider)) {
    return back("error", "This sign-in link expired. Please click Connect again.");
  }
  const creds = providerCreds(provider);
  if (!creds || !code) return back("error", "Missing authorization code.");

  try {
    const done = await impl(provider).finish({
      code,
      redirectUri: pending.redirectUri,
      verifier: pending.verifier,
      ...creds,
    });
    await saveConnection({ app: pending.app, ...done });
    return back("connected", done.label);
  } catch (e) {
    return back("error", e instanceof Error ? e.message : String(e));
  }
}
