"use client";

import { useState } from "react";
import Logo from "../Logo";
import { login } from "@/lib/connector/store";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="hero-glow flex min-h-screen items-center justify-center p-4">
      <form
        className="menu-in w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await login(email, password);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Logo href="/connector" />
        <h1 className="mt-6 text-2xl font-bold text-ink">Log in</h1>
        <p className="mt-1 text-sm text-ink-2">Use the email and password from smc-config.php.</p>
        <label className="mt-6 block text-sm font-medium text-ink">
          Email
          <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1.5" />
        </label>
        <label className="mt-4 block text-sm font-medium text-ink">
          Password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-1.5" />
        </label>
        {error && <p className="mt-4 rounded-lg bg-danger-tint px-3 py-2 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full disabled:opacity-50">
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
