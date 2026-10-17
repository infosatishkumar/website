"use client";

import { useState } from "react";

export default function Login({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/flowforge/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) window.location.reload();
    else setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Sign-in failed");
  }

  return (
    <div className="login">
      <form className="card pad" style={{ width: "min(400px,100%)" }} onSubmit={submit}>
        <div className="brand" style={{ padding: 0, marginBottom: 18 }}>
          <div className="logo">↯</div> FlowForge
        </div>
        {configured ? (
          <>
            <h2 style={{ margin: "0 0 4px" }}>Sign in</h2>
            <p className="small" style={{ marginTop: 0 }}>Enter the admin password for this workspace.</p>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input id="pw" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <div className="notice" style={{ marginBottom: 12 }}>{error}</div>}
            <button className="primary" style={{ width: "100%" }} disabled={busy || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </>
        ) : (
          <div className="notice">
            FlowForge is locked. Set <b>FLOWFORGE_ADMIN_PASSWORD</b> and <b>FLOWFORGE_SECRET</b> in your
            environment variables (Vercel → Project → Settings → Environment Variables), then redeploy.
          </div>
        )}
      </form>
    </div>
  );
}
