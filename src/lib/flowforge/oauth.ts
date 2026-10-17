import "server-only";
import { PROVIDERS, type OAuthProvider } from "./catalog";

// Server-side OAuth flows for each social platform. Each provider turns an
// authorization code into a stored secret plus a human label; providers with
// expiring tokens also know how to refresh them.

export const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v26.0";

export interface Finalized {
  label: string;
  secret: Record<string, unknown>;
  meta?: Record<string, unknown>;
  /** Epoch ms when the stored access token stops working. */
  expiresAt?: number;
}

interface Impl {
  scopes: string[];
  pkce?: boolean;
  authorizeUrl(p: { clientId: string; redirectUri: string; state: string; challenge: string; scope: string }): string;
  finish(p: { code: string; redirectUri: string; verifier: string; clientId: string; clientSecret: string }): Promise<Finalized>;
  refresh?(secret: Record<string, unknown>, creds: { clientId: string; clientSecret: string }): Promise<Finalized>;
}

export function providerCreds(p: OAuthProvider) {
  const info = PROVIDERS[p];
  const clientId = process.env[info.idEnv];
  const clientSecret = process.env[info.secretEnv];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function json(res: Response, what: string) {
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`${what} failed (${res.status}): ${msg.slice(0, 400)}`);
  }
  return body as Record<string, unknown>;
}

function form(url: string, params: Record<string, string>, basic?: [string, string]) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      ...(basic ? { Authorization: `Basic ${Buffer.from(basic.join(":")).toString("base64")}` } : {}),
    },
    body: new URLSearchParams(params),
  });
}

const qs = (base: string, params: Record<string, string>) => `${base}?${new URLSearchParams(params)}`;
const expiry = (seconds: unknown) =>
  typeof seconds === "number" && seconds > 0 ? Date.now() + seconds * 1000 : undefined;

const IMPLS: Record<OAuthProvider, Impl> = {
  meta: {
    scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"],
    authorizeUrl: ({ clientId, redirectUri, state, scope }) =>
      qs(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`, {
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope,
        response_type: "code",
      }),
    async finish({ code, redirectUri, clientId, clientSecret }) {
      const g = `https://graph.facebook.com/${GRAPH_VERSION}`;
      const short = await json(
        await fetch(qs(`${g}/oauth/access_token`, { client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code })),
        "Facebook token exchange",
      );
      const long = await json(
        await fetch(qs(`${g}/oauth/access_token`, {
          grant_type: "fb_exchange_token",
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: String(short.access_token),
        })),
        "Facebook long-lived token",
      );
      const userToken = String(long.access_token);
      const me = await json(await fetch(qs(`${g}/me`, { fields: "id,name", access_token: userToken })), "Facebook profile");
      const accounts = await json(
        await fetch(qs(`${g}/me/accounts`, { fields: "id,name,access_token", limit: "100", access_token: userToken })),
        "Facebook pages",
      );
      const pages = (accounts.data as { id: string; name: string; access_token: string }[]) ?? [];
      if (!pages.length) throw new Error("No Facebook Pages were shared. Reconnect and select at least one Page.");
      return {
        label: `${me.name} · ${pages.length} page${pages.length > 1 ? "s" : ""}`,
        // Page tokens derived from a long-lived user token do not expire.
        secret: { userToken, pageTokens: Object.fromEntries(pages.map((p) => [p.id, p.access_token])) },
        meta: { pages: pages.map((p) => ({ id: p.id, name: p.name })) },
      };
    },
  },

  instagram: {
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    authorizeUrl: ({ clientId, redirectUri, state, scope }) =>
      qs("https://www.instagram.com/oauth/authorize", {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope,
        state,
      }),
    async finish({ code, redirectUri, clientId, clientSecret }) {
      const short = await json(
        await form("https://api.instagram.com/oauth/access_token", {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code: code.replace(/#_$/, ""),
        }),
        "Instagram token exchange",
      );
      const first = (Array.isArray(short.data) ? short.data[0] : short) as Record<string, unknown>;
      const long = await json(
        await fetch(qs("https://graph.instagram.com/access_token", {
          grant_type: "ig_exchange_token",
          client_secret: clientSecret,
          access_token: String(first.access_token),
        })),
        "Instagram long-lived token",
      );
      const token = String(long.access_token);
      const me = await json(
        await fetch(qs("https://graph.instagram.com/me", { fields: "user_id,username", access_token: token })),
        "Instagram profile",
      );
      return {
        label: `@${me.username}`,
        secret: { accessToken: token, userId: String(me.user_id ?? first.user_id) },
        expiresAt: expiry(long.expires_in),
      };
    },
    async refresh(secret) {
      const r = await json(
        await fetch(qs("https://graph.instagram.com/refresh_access_token", {
          grant_type: "ig_refresh_token",
          access_token: String(secret.accessToken),
        })),
        "Instagram token refresh",
      );
      return { label: "", secret: { ...secret, accessToken: r.access_token }, expiresAt: expiry(r.expires_in) };
    },
  },

  threads: {
    scopes: ["threads_basic", "threads_content_publish"],
    authorizeUrl: ({ clientId, redirectUri, state, scope }) =>
      qs("https://threads.net/oauth/authorize", {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope,
        state,
      }),
    async finish({ code, redirectUri, clientId, clientSecret }) {
      const short = await json(
        await form("https://graph.threads.net/oauth/access_token", {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }),
        "Threads token exchange",
      );
      const long = await json(
        await fetch(qs("https://graph.threads.net/access_token", {
          grant_type: "th_exchange_token",
          client_secret: clientSecret,
          access_token: String(short.access_token),
        })),
        "Threads long-lived token",
      );
      const token = String(long.access_token);
      const me = await json(
        await fetch(qs("https://graph.threads.net/v1.0/me", { fields: "id,username", access_token: token })),
        "Threads profile",
      );
      return {
        label: `@${me.username}`,
        secret: { accessToken: token, userId: String(me.id) },
        expiresAt: expiry(long.expires_in),
      };
    },
    async refresh(secret) {
      const r = await json(
        await fetch(qs("https://graph.threads.net/refresh_access_token", {
          grant_type: "th_refresh_token",
          access_token: String(secret.accessToken),
        })),
        "Threads token refresh",
      );
      return { label: "", secret: { ...secret, accessToken: r.access_token }, expiresAt: expiry(r.expires_in) };
    },
  },

  linkedin: {
    scopes: ["openid", "profile", "w_member_social"],
    authorizeUrl: ({ clientId, redirectUri, state, scope }) =>
      qs("https://www.linkedin.com/oauth/v2/authorization", {
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope,
      }),
    async finish({ code, redirectUri, clientId, clientSecret }) {
      const t = await json(
        await form("https://www.linkedin.com/oauth/v2/accessToken", {
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
        "LinkedIn token exchange",
      );
      const me = await json(
        await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } }),
        "LinkedIn profile",
      );
      return {
        label: String(me.name ?? me.email ?? "LinkedIn member"),
        secret: { accessToken: t.access_token, refreshToken: t.refresh_token, personUrn: `urn:li:person:${me.sub}` },
        expiresAt: expiry(t.expires_in),
      };
    },
    async refresh(secret, { clientId, clientSecret }) {
      if (!secret.refreshToken) throw new Error("LinkedIn token expired. Reconnect LinkedIn.");
      const t = await json(
        await form("https://www.linkedin.com/oauth/v2/accessToken", {
          grant_type: "refresh_token",
          refresh_token: String(secret.refreshToken),
          client_id: clientId,
          client_secret: clientSecret,
        }),
        "LinkedIn token refresh",
      );
      return {
        label: "",
        secret: { ...secret, accessToken: t.access_token, refreshToken: t.refresh_token ?? secret.refreshToken },
        expiresAt: expiry(t.expires_in),
      };
    },
  },

  x: {
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    pkce: true,
    authorizeUrl: ({ clientId, redirectUri, state, scope, challenge }) =>
      qs("https://x.com/i/oauth2/authorize", {
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }),
    async finish({ code, redirectUri, verifier, clientId, clientSecret }) {
      const t = await json(
        await form(
          "https://api.x.com/2/oauth2/token",
          { grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier, client_id: clientId },
          [clientId, clientSecret],
        ),
        "X token exchange",
      );
      const me = await json(
        await fetch("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${t.access_token}` } }),
        "X profile",
      );
      const user = me.data as { username: string };
      return {
        label: `@${user.username}`,
        secret: { accessToken: t.access_token, refreshToken: t.refresh_token },
        expiresAt: expiry(t.expires_in),
      };
    },
    async refresh(secret, { clientId, clientSecret }) {
      const t = await json(
        await form(
          "https://api.x.com/2/oauth2/token",
          { grant_type: "refresh_token", refresh_token: String(secret.refreshToken), client_id: clientId },
          [clientId, clientSecret],
        ),
        "X token refresh",
      );
      // X rotates refresh tokens on every use.
      return {
        label: "",
        secret: { accessToken: t.access_token, refreshToken: t.refresh_token ?? secret.refreshToken },
        expiresAt: expiry(t.expires_in),
      };
    },
  },

  google: {
    scopes: ["openid", "email", "https://www.googleapis.com/auth/spreadsheets"],
    authorizeUrl: ({ clientId, redirectUri, state, scope }) =>
      qs("https://accounts.google.com/o/oauth2/v2/auth", {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope,
        state,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
      }),
    async finish({ code, redirectUri, clientId, clientSecret }) {
      const t = await json(
        await form("https://oauth2.googleapis.com/token", {
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
        "Google token exchange",
      );
      const me = await json(
        await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` } }),
        "Google profile",
      );
      return {
        label: String(me.email ?? "Google account"),
        secret: { accessToken: t.access_token, refreshToken: t.refresh_token },
        expiresAt: expiry(t.expires_in),
      };
    },
    async refresh(secret, { clientId, clientSecret }) {
      const t = await json(
        await form("https://oauth2.googleapis.com/token", {
          grant_type: "refresh_token",
          refresh_token: String(secret.refreshToken),
          client_id: clientId,
          client_secret: clientSecret,
        }),
        "Google token refresh",
      );
      return { label: "", secret: { ...secret, accessToken: t.access_token }, expiresAt: expiry(t.expires_in) };
    },
  },

  pinterest: {
    scopes: ["boards:read", "pins:read", "pins:write", "user_accounts:read"],
    authorizeUrl: ({ clientId, redirectUri, state, scope }) =>
      qs("https://www.pinterest.com/oauth/", {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope,
        state,
      }),
    async finish({ code, redirectUri, clientId, clientSecret }) {
      const t = await json(
        await form(
          "https://api.pinterest.com/v5/oauth/token",
          { grant_type: "authorization_code", code, redirect_uri: redirectUri },
          [clientId, clientSecret],
        ),
        "Pinterest token exchange",
      );
      const auth = { Authorization: `Bearer ${t.access_token}` };
      const me = await json(await fetch("https://api.pinterest.com/v5/user_account", { headers: auth }), "Pinterest profile");
      const boards = await json(await fetch("https://api.pinterest.com/v5/boards?page_size=100", { headers: auth }), "Pinterest boards");
      const items = (boards.items as { id: string; name: string }[]) ?? [];
      return {
        label: `@${me.username}`,
        secret: { accessToken: t.access_token, refreshToken: t.refresh_token },
        meta: { boards: items.map((b) => ({ id: b.id, name: b.name })) },
        expiresAt: expiry(t.expires_in),
      };
    },
    async refresh(secret, { clientId, clientSecret }) {
      const t = await json(
        await form(
          "https://api.pinterest.com/v5/oauth/token",
          { grant_type: "refresh_token", refresh_token: String(secret.refreshToken) },
          [clientId, clientSecret],
        ),
        "Pinterest token refresh",
      );
      return {
        label: "",
        secret: { ...secret, accessToken: t.access_token, refreshToken: t.refresh_token ?? secret.refreshToken },
        expiresAt: expiry(t.expires_in),
      };
    },
  },
};

export function impl(p: OAuthProvider): Impl {
  return IMPLS[p];
}

export function isProvider(p: string): p is OAuthProvider {
  return p in IMPLS;
}

/** Comma-joined for Meta/Instagram/Threads/Pinterest, space-joined otherwise. */
export function scopeString(p: OAuthProvider): string {
  const sep = ["meta", "instagram", "threads", "pinterest"].includes(p) ? "," : " ";
  return IMPLS[p].scopes.join(sep);
}
