"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import Icon from "@/components/connector/Icon";
import UpiQr, { upiLink } from "@/components/connector/app/UpiQr";
import { Card, PageHeader, StatusBadge } from "@/components/connector/app/ui";
import { get, post } from "@/lib/connector/api";
import { socialPlans } from "@/lib/connector/data";
import { initLive, reportError, useLive } from "@/lib/connector/store";

type Payment = { id: string; plan: string; cycle: string; amount: number; utr: string; status: string; createdAt: string };
type Info = { upiId: string; payee: string };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function BillingPage() {
  return (
    <Suspense>
      <Billing />
    </Suspense>
  );
}

function Billing() {
  const params = useSearchParams();
  const { status } = useLive();
  const [plan, setPlan] = useState(params.get("plan") ?? "Standard");
  const [cycle, setCycle] = useState<"monthly" | "annual">(params.get("cycle") === "monthly" ? "monthly" : "annual");
  const [info, setInfo] = useState<Info | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    get<Info>("upi_info").then(setInfo, reportError);
    if (status?.loggedIn) get<{ payments: Payment[] }>("payments").then((r) => setPayments(r.payments), reportError);
  }, [status?.loggedIn]);

  const p = socialPlans.find((x) => x.name === plan) ?? socialPlans[1];
  const amount = cycle === "annual" ? p.annual * 12 : p.monthly;
  const link = useMemo(() => (info?.upiId ? upiLink(info.upiId, info.payee, amount, `SMC ${p.name} ${cycle}`) : ""), [info, amount, p.name, cycle]);
  const current = status?.user?.plan;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Plans & billing"
        sub={
          current && current.name !== "Free"
            ? `You are on ${current.name} until ${new Date(current.until ?? "").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`
            : "You are on the Free plan. Pick a plan and pay with any UPI app."
        }
      />

      <div className="mb-6 flex w-fit gap-1 rounded-full border border-line bg-surface p-1">
        {(["monthly", "annual"] as const).map((c) => (
          <button key={c} type="button" onClick={() => setCycle(c)} className={`rounded-full px-5 py-2 text-sm font-bold ${cycle === c ? "bg-primary text-white" : "text-ink-2"}`}>
            {c === "monthly" ? "Monthly" : "Yearly · save 20%"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {socialPlans.map((x) => {
          const on = x.name === p.name;
          return (
            <button
              key={x.name}
              type="button"
              onClick={() => {
                setPlan(x.name);
                setDone(false);
              }}
              className={`rounded-2xl border-2 bg-surface p-4 text-left transition-colors ${on ? "border-primary" : "border-line hover:border-primary/40"}`}
            >
              <p className="flex items-center justify-between font-bold text-ink">
                {x.name}
                {on && <Icon name="checkCircle" size={18} className="text-primary" />}
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">
                {inr(cycle === "annual" ? x.annual : x.monthly)}
                <span className="text-sm font-normal text-muted">/mo</span>
              </p>
              <p className="mt-1 text-xs text-muted">{x.limits.join(" · ")}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card title={`Pay ${inr(amount)} with UPI`}>
          {!info ? (
            <p className="text-muted">Loading…</p>
          ) : !info.upiId ? (
            <p className="text-ink-2">Payments are not set up yet.</p>
          ) : (
            <div className="flex flex-col items-center text-center">
              <UpiQr link={link} />
              <p className="mt-3 text-sm text-ink-2">Scan with PhonePe, Google Pay, Paytm or any UPI app. The amount fills in by itself.</p>
              <a href={link} className="btn btn-primary mt-4 w-full sm:hidden">
                <Icon name="zap" size={18} /> Pay {inr(amount)} in UPI app
              </a>
              <div className="mt-4 w-full rounded-xl bg-surface-2 p-3 text-sm">
                <p className="text-muted">Paying to</p>
                <p className="font-bold text-ink">{info.payee}</p>
                <button type="button" onClick={() => navigator.clipboard?.writeText(info.upiId)} className="mt-1 inline-flex items-center gap-1 font-mono text-primary">
                  {info.upiId} <Icon name="copy" size={14} />
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card title="After paying">
          {done ? (
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-tint text-success">
                <Icon name="check" size={28} strokeWidth={2.6} />
              </span>
              <p className="mt-3 text-lg font-bold text-ink">Payment submitted</p>
              <p className="mt-1 text-sm text-ink-2">We’ll confirm it and switch on {p.name} — usually within a few hours. You’ll get an email.</p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const r = await post<{ payments: Payment[] }>("payment_create", { plan: p.name, cycle, utr });
                  setPayments(r.payments);
                  setDone(true);
                  setUtr("");
                  await initLive(true);
                } catch (err) {
                  reportError(err);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <ol className="space-y-2 text-sm text-ink-2">
                <li>1. Pay <b className="text-ink">{inr(amount)}</b> using the QR code.</li>
                <li>2. Open the payment in your UPI app and copy the <b className="text-ink">UTR / UPI Ref No.</b> (12 digits).</li>
                <li>3. Paste it below and submit.</li>
              </ol>
              <label className="block text-sm font-medium text-ink">
                UTR / UPI reference number
                <input
                  required
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className="field mt-1.5 font-mono"
                  placeholder="e.g. 428917365012"
                />
              </label>
              <button type="submit" disabled={busy || utr.trim().length < 10} className="btn btn-primary w-full disabled:opacity-50">
                {busy ? "Submitting…" : `Submit payment for ${p.name}`}
              </button>
            </form>
          )}
        </Card>
      </div>

      {payments.length > 0 && (
        <Card title="Your payments" className="mt-6">
          <ul className="divide-y divide-line">
            {payments.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="w-28 text-muted">{new Date(x.createdAt).toLocaleDateString("en-IN")}</span>
                <span className="flex-1 font-medium text-ink">
                  {x.plan} · {x.cycle === "annual" ? "Yearly" : "Monthly"} · {inr(x.amount)}
                </span>
                <span className="font-mono text-xs text-muted">{x.utr}</span>
                <StatusBadge status={x.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
