import { isAuthed } from "@/lib/flowforge/auth";
import { APPS, PROVIDERS } from "@/lib/flowforge/catalog";
import { pkcePair, token } from "@/lib/flowforge/crypto";
import { impl, isProvider, providerCreds, scopeString } from "@/lib/flowforge/oauth";
import { store } from "@/lib/flowforge/store";
import { appUrl } from "@/lib/flowforge/triggers";

export async function GET(req: Request, ctx: RouteContext<"/api/flowforge/oauth/[provider]/start">) {
  const base = appUrl(req);
  if (!(await isAuthed())) return Response.redirect(`${base}/flowforge`, 302);
  const { provider } = await ctx.params;
  if (!isProvider(provider)) return new Response("Unknown provider", { status: 404 });
  const creds = providerCreds(provider);
  if (!creds) {
    const info = PROVIDERS[provider];
    return Response.redirect(
      `${base}/flowforge?error=${encodeURIComponent(`${info.name} is not set up yet: add ${info.idEnv} and ${info.secretEnv} to the environment.`)}`,
      302,
    );
  }
  const app = new URL(req.url).searchParams.get("app") ?? APPS.find((a) => a.oauth === provider)!.key;
  const state = token(24);
  const { verifier, challenge } = pkcePair();
  const redirectUri = `${base}/api/flowforge/oauth/${provider}/callback`;
  await store().put("kv", `oauth:${state}`, { provider, app, verifier, redirectUri, created: Date.now() });
  const url = impl(provider).authorizeUrl({
    clientId: creds.clientId,
    redirectUri,
    state,
    challenge,
    scope: scopeString(provider),
  });
  return Response.redirect(url, 302);
}
