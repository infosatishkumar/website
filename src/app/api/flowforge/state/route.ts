import { openAccess, requireAuth } from "@/lib/flowforge/auth";
import { PROVIDERS, type OAuthProvider } from "@/lib/flowforge/catalog";
import { publicConnection } from "@/lib/flowforge/connections";
import { providerCreds } from "@/lib/flowforge/oauth";
import { store, storeKind } from "@/lib/flowforge/store";
import { appUrl, hookUrl } from "@/lib/flowforge/triggers";
import type { Connection, Run, Workflow } from "@/lib/flowforge/types";

export async function GET(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  const base = appUrl(req);
  const [workflows, runs, connections] = await Promise.all([
    store().list<Workflow>("workflows"),
    store().list<Run>("runs"),
    store().list<Connection>("connections"),
  ]);
  const providers = Object.fromEntries(
    (Object.keys(PROVIDERS) as OAuthProvider[]).map((p) => [
      p,
      { configured: Boolean(providerCreds(p)), redirectUri: `${base}/api/flowforge/oauth/${p}/callback` },
    ]),
  );
  return Response.json({
    workflows: workflows.map((w) => ({ ...w, hookUrl: hookUrl(base, w) })),
    runs: runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 150),
    connections: connections.map(publicConnection),
    providers,
    system: {
      appUrl: base,
      store: storeKind(),
      openAccess: openAccess(),
      cronSecret: Boolean(process.env.CRON_SECRET),
      cronUrl: `${base}/api/flowforge/cron`,
    },
  });
}
