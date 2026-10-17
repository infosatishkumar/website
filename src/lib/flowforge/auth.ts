import "server-only";
import { cookies } from "next/headers";
import { sign, unsign } from "./crypto";

const COOKIE = "ff_session";
const MAX_AGE = 60 * 60 * 24 * 14;

/** True when no password is configured and we're in local development. */
export function openAccess(): boolean {
  return !process.env.FLOWFORGE_ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
}

export function passwordConfigured(): boolean {
  return Boolean(process.env.FLOWFORGE_ADMIN_PASSWORD);
}

export async function isAuthed(): Promise<boolean> {
  if (openAccess()) return true;
  if (!passwordConfigured()) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const value = unsign(raw);
  if (!value) return false;
  const exp = Number(value.split(":")[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

export async function startSession() {
  const exp = Date.now() + MAX_AGE * 1000;
  (await cookies()).set(COOKIE, sign(`admin:${exp}`), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Use at the top of private route handlers. */
export async function requireAuth(): Promise<Response | null> {
  return (await isAuthed())
    ? null
    : Response.json({ error: "Not signed in" }, { status: 401 });
}
