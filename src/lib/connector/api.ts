/**
 * Client for the Hostinger PHP backend (hostinger/api). When the site runs
 * without it (local dev, Vercel preview) every call fails fast and the
 * dashboard stays in demo mode.
 */

const BASE = "/api/index.php?action=";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(action: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + action, {
    credentials: "same-origin",
    ...init,
    headers: { "X-SMC": "1", ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers },
  });
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new ApiError(
      res.status === 404 || res.ok ? "Backend not available" : `Server error (${res.status}). Open Server check for details.`,
      res.status === 404 || res.ok ? 0 : res.status,
    );
  }
  const data = await res.json();
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const get = <T>(action: string) => call<T>(action);
export const post = <T>(action: string, body: unknown = {}) => call<T>(action, { method: "POST", body: JSON.stringify(body) });

export type BackendStatus = {
  backend: boolean;
  loggedIn: boolean;
  configured: { anthropic: boolean; meta: boolean };
  autopublish: boolean;
};

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const { url } = await call<{ url: string }>("upload", { method: "POST", body: form });
  return url;
}

export const META_CONNECT_URL = `${BASE}meta_connect`;

export type Health = { ok: boolean; problems: string[]; info: { php: string; config_expected_at?: string } };

/** Setup check; null when there is no backend on this site at all. */
export async function checkHealth(): Promise<Health | null> {
  try {
    const res = await fetch("/api/health.php", { cache: "no-store" });
    if (!(res.headers.get("content-type") ?? "").includes("application/json")) return null;
    return (await res.json()) as Health;
  } catch {
    return null;
  }
}
