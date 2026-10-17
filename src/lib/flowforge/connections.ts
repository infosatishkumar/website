import "server-only";
import { appByKey } from "./catalog";
import { decrypt, encrypt, id } from "./crypto";
import { impl, providerCreds } from "./oauth";
import { store } from "./store";
import type { Connection, PublicConnection } from "./types";

export function publicConnection(conn: Connection): PublicConnection {
  const out: Partial<Connection> = { ...conn };
  delete out.secret;
  return out as PublicConnection;
}

export async function saveConnection(input: {
  app: string;
  label: string;
  secret: Record<string, unknown>;
  meta?: Record<string, unknown>;
  expiresAt?: number;
}): Promise<Connection> {
  const conn: Connection = {
    id: id("conn"),
    app: input.app,
    label: input.label,
    secret: encrypt(input.secret),
    meta: input.meta,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : undefined,
  };
  await store().put("connections", conn.id, conn);
  return conn;
}

/** Decrypts a connection's secret, refreshing OAuth tokens that are about to expire. */
export async function credentials<T = Record<string, string>>(connId: string | undefined, app: string): Promise<T> {
  if (!connId) throw new Error(`Choose a ${appByKey(app)?.name ?? app} account for this step.`);
  const conn = await store().get<Connection>("connections", connId);
  if (!conn) throw new Error("The selected account was disconnected. Pick another one.");
  if (conn.app !== app) throw new Error("The selected account belongs to a different app.");
  let secret = decrypt<Record<string, unknown>>(conn.secret);

  const provider = appByKey(app)?.oauth;
  const expiring = conn.expiresAt && Date.parse(conn.expiresAt) - Date.now() < 10 * 60 * 1000;
  // Instagram/Threads long-lived tokens refresh best well before expiry.
  const longLivedDue =
    (provider === "instagram" || provider === "threads") &&
    conn.expiresAt &&
    Date.parse(conn.expiresAt) - Date.now() < 7 * 24 * 3600 * 1000;

  if (provider && (expiring || longLivedDue)) {
    const p = impl(provider);
    const creds = providerCreds(provider);
    if (p.refresh && creds) {
      const r = await p.refresh(secret, creds);
      secret = r.secret;
      conn.secret = encrypt(secret);
      conn.expiresAt = r.expiresAt ? new Date(r.expiresAt).toISOString() : conn.expiresAt;
      await store().put("connections", conn.id, conn);
    } else if (expiring && Date.parse(conn.expiresAt!) < Date.now()) {
      throw new Error(`${appByKey(app)?.name} access expired. Reconnect the account.`);
    }
  }
  return secret as T;
}
