import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

// All secrets derive from FLOWFORGE_SECRET. In development a fixed fallback
// keeps things working out of the box; production refuses to run without it.
function masterSecret(): string {
  const s = process.env.FLOWFORGE_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("FLOWFORGE_SECRET (min 16 chars) must be set in production.");
  }
  return "flowforge-dev-secret-change-me";
}

function key(purpose: string): Buffer {
  return createHash("sha256").update(`${purpose}:${masterSecret()}`).digest();
}

export function encrypt(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("enc"), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt<T>(payload: string): T {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key("enc"), iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(out) as T;
}

export function sign(value: string): string {
  const mac = createHmac("sha256", key("sign")).update(value).digest("base64url");
  return `${value}.${mac}`;
}

/** Returns the original value if the signature is valid, otherwise null. */
export function unsign(signed: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(sign(value));
  const got = Buffer.from(signed);
  return expected.length === got.length && timingSafeEqual(expected, got) ? value : null;
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function token(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function id(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function pkcePair() {
  const verifier = token(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
