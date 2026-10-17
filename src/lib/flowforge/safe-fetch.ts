import "server-only";
import { lookup } from "dns/promises";
import { isIP } from "net";

// Guards user-supplied URLs (HTTP Request step, RSS feeds, webhooks) against
// SSRF: only http(s), no credentials in the URL, and the host must not
// resolve to a private, loopback or link-local address.

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) return privateV4(ip);
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return privateV4(v6.slice(7));
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb")
  );
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https URLs are allowed.");
  }
  if (url.username || url.password) throw new Error("Credentials in URLs are not allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("Requests to internal hosts are blocked.");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.some((a) => privateIp(a.address))) {
    throw new Error("Requests to private network addresses are blocked.");
  }
  return url;
}

/** fetch() for untrusted URLs: validates every redirect hop and times out. */
export async function safeFetch(raw: string, init: RequestInit = {}, hops = 5): Promise<Response> {
  const url = await assertPublicUrl(raw);
  const res = await fetch(url, {
    ...init,
    redirect: "manual",
    signal: init.signal ?? AbortSignal.timeout(20_000),
  });
  const loc = res.headers.get("location");
  if (res.status >= 300 && res.status < 400 && loc) {
    if (hops <= 0) throw new Error("Too many redirects.");
    const method = res.status === 303 ? "GET" : init.method;
    return safeFetch(new URL(loc, url).toString(), {
      ...init,
      method,
      body: method === "GET" ? undefined : init.body,
    }, hops - 1);
  }
  return res;
}
