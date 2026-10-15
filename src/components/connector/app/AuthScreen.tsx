"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import Icon from "../Icon";
import { LogoMark } from "../Logo";
import { PasswordInput } from "./ui";
import { ApiError } from "@/lib/connector/api";
import { APP, BASE } from "@/lib/connector/data";
import { forgotPassword, initLive, login, resendVerification, resetPassword, signup, useLive } from "@/lib/connector/store";

type Mode = "login" | "signup" | "forgot" | "reset" | "check-email";

/** Login, sign-up, verification and password reset — one card, hPanel style. */
export default function AuthScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useLive();
  const resetToken = params.get("reset");
  const authMsg = params.get("auth");
  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    authMsg === "invalid"
      ? "This verification link is invalid or was already used. Log in, or sign up again."
      : authMsg === "expired"
        ? "Your session expired. Please log in again."
        : "",
  );
  const [info, setInfo] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);
  const [exists, setExists] = useState(false);

  const run = (fn: () => Promise<void>) => async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      if (err instanceof ApiError && err.status === 403) setNeedsVerify(true);
      if (err instanceof ApiError && err.status === 409) setExists(true);
    } finally {
      setBusy(false);
    }
  };

  const go = (m: Mode) => {
    setMode(m);
    setError("");
    setInfo("");
    setNeedsVerify(false);
    setExists(false);
  };

  const submit =
    mode === "login"
      ? run(async () => {
          await login(email, password);
        })
      : mode === "signup"
        ? run(async () => {
            await signup(name, email, password);
            setMode("check-email");
          })
        : mode === "forgot"
          ? run(async () => {
              await forgotPassword(email);
              setInfo("If an account exists for that email, a reset link is on its way.");
            })
          : run(async () => {
              // The reset link proves the email, so the server logs you straight in.
              await resetPassword(resetToken ?? "", password);
              router.replace(`${APP}/launchpad/`);
              await initLive(true);
            });

  return (
    <div className="flex min-h-screen bg-rail">
      {/* brand side */}
      <div className="hero-glow relative hidden w-[46%] flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div className="dot-grid absolute inset-0 opacity-50" />
        <Link href={BASE} className="relative flex items-center gap-3">
          <LogoMark size={40} />
          <span className="flex flex-col leading-none">
            <span className="text-lg font-bold">Social Media</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-meteorite">Connector</span>
          </span>
        </Link>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-tight">Plan, publish and grow every channel — with an AI agent at your side.</h2>
          <ul className="mt-8 space-y-3 text-white/80">
            {["Publish to Facebook, Instagram, LinkedIn, X, YouTube, TikTok + more", "AI Agent that writes and schedules posts", "Calendar, approvals and analytics"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
                  <Icon name="check" size={14} strokeWidth={2.6} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/50">No card required · Cancel anytime</p>
      </div>

      {/* form side */}
      <div className="flex flex-1 items-center justify-center bg-canvas p-5">
        <div className="menu-in w-full max-w-md rounded-2xl border border-line bg-surface p-8 shadow-xl">
          <div className="mb-6 lg:hidden">
            <LogoMark size={40} />
          </div>

          {mode === "check-email" ? (
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-tint text-primary">
                <Icon name="mail" size={30} />
              </span>
              <h1 className="mt-5 text-2xl font-bold text-ink">Check your email</h1>
              <p className="mt-2 text-ink-2">
                We sent a verification link to <b className="text-ink">{email}</b>. Click <b>Verify Email</b> in that message to finish creating
                your account.
              </p>
              <p className="mt-3 text-sm text-muted">Can’t find it? Check Spam or Promotions.</p>
              {info && <Note tone="ok">{info}</Note>}
              {error && <Note tone="error">{error}</Note>}
              <button
                type="button"
                disabled={busy}
                className="btn btn-outline mt-6 w-full disabled:opacity-50"
                onClick={() =>
                  run(async () => {
                    await resendVerification(email);
                    setInfo("Sent again. It can take a minute to arrive.");
                  })()
                }
              >
                Resend email
              </button>
              <button type="button" className="mt-3 text-sm font-bold text-primary" onClick={() => go("login")}>
                Back to log in
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-ink">
                {mode === "login" ? "Log in" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Forgot password" : "Set a new password"}
              </h1>
              <p className="mt-1 text-sm text-ink-2">
                {mode === "login"
                  ? "Welcome back! Log in to your dashboard."
                  : mode === "signup"
                    ? "Start free — we’ll send a link to verify your email."
                    : mode === "forgot"
                      ? "Enter your email and we’ll send you a reset link."
                      : "Choose a new password with at least 8 characters."}
              </p>

              <form className="mt-6 space-y-4" method="post" action="#" onSubmit={submit}>
                {mode === "signup" && (
                  <Field label="Full name">
                    <input required aria-label="Full name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Your name" />
                  </Field>
                )}
                {mode !== "reset" && (
                  <Field label="Email">
                    <input
                      required
                      type="email"
                      name="email"
                      id="smc-email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label="Email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="field"
                      placeholder="you@example.com"
                    />
                  </Field>
                )}
                {mode !== "forgot" && (
                  <Field
                    label={mode === "reset" ? "New password" : "Password"}
                    extra={
                      mode === "login" && (
                        <button type="button" className="text-xs font-bold text-primary" onClick={() => go("forgot")}>
                          Forgot password?
                        </button>
                      )
                    }
                  >
                    <PasswordInput
                      required
                      aria-label={mode === "reset" ? "New password" : "Password"}
                      name="password"
                      id="smc-password"
                      minLength={mode === "login" ? 1 : 8}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
                    />
                  </Field>
                )}

                {error && <Note tone="error">{error}</Note>}
                {info && <Note tone="ok">{info}</Note>}
                {exists && (
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => { go("login"); }}>
                      Log in
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => { go("forgot"); }}>
                      Reset password
                    </button>
                  </div>
                )}
                {needsVerify && (
                  <button
                    type="button"
                    className="text-sm font-bold text-primary"
                    onClick={() =>
                      run(async () => {
                        await resendVerification(email);
                        setNeedsVerify(false);
                        setInfo("Verification email sent. Check your inbox.");
                      })()
                    }
                  >
                    Resend verification email
                  </button>
                )}

                <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-50">
                  {busy
                    ? "Please wait…"
                    : mode === "login"
                      ? "Log in"
                      : mode === "signup"
                        ? "Create account"
                        : mode === "forgot"
                          ? "Send reset link"
                          : "Update password"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-ink-2">
                {mode === "login" ? (
                  status?.signupOpen !== false && (
                    <>
                      New here?{" "}
                      <button type="button" className="font-bold text-primary" onClick={() => go("signup")}>
                        Create an account
                      </button>
                    </>
                  )
                ) : (
                  <>
                    Already have an account?{" "}
                    <button type="button" className="font-bold text-primary" onClick={() => go("login")}>
                      Log in
                    </button>
                  </>
                )}
              </div>
              {mode === "login" && <p className="mt-4 text-center text-xs text-muted">You’ll stay logged in on this device for 90 days.</p>}
              {mode === "signup" && <p className="mt-4 text-center text-xs text-muted">By creating an account you agree to our terms and privacy policy.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Not a <label>: it holds buttons (forgot password, show password) that a label would re-trigger. */
function Field({ label, extra, children }: { label: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="block text-sm font-medium text-ink">
      <span className="mb-1.5 flex items-center justify-between">
        {label}
        {extra}
      </span>
      {children}
    </div>
  );
}

function Note({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  return <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${tone === "ok" ? "bg-success-tint text-ink" : "bg-danger-tint text-danger"}`}>{children}</p>;
}
