"use client";

import { useEffect, useState } from "react";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/connector/app/ui";
import { get, post } from "@/lib/connector/api";
import { reportError, useLive } from "@/lib/connector/store";

type Payment = {
  id: string;
  plan: string;
  cycle: string;
  amount: number;
  utr: string;
  status: string;
  createdAt: string;
  user: { name: string; email: string } | null;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Owner: match each UTR with your UPI app, then approve to switch the plan on. */
export default function PaymentsAdmin() {
  const { status } = useLive();
  const [rows, setRows] = useState<Payment[] | null>(null);
  const admin = !!status?.user?.isAdmin;

  useEffect(() => {
    if (admin) get<{ payments: Payment[] }>("payments_admin").then((r) => setRows(r.payments), reportError);
  }, [admin]);

  const decide = (id: string, approve: boolean) => {
    if (!approve && !confirm("Reject this payment? The customer gets an email asking for a screenshot.")) return;
    post<{ payments: Payment[] }>("payment_decide", { id, approve }).then((r) => setRows(r.payments), reportError);
  };

  if (!status?.loggedIn) return null;
  if (!admin) {
    return (
      <>
        <PageHeader title="Payments" />
        <Card>
          <p className="text-ink-2">Only the site owner can open this page.</p>
        </Card>
      </>
    );
  }

  const pending = (rows ?? []).filter((r) => r.status === "pending");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Payments"
        sub="Customers pay by UPI and send the UTR number. Find the same UTR in your UPI app (PhonePe → History), then approve to switch their plan on."
      />
      {rows === null ? (
        <p className="text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <Empty icon="dollar" title="No payments yet" sub="When someone pays from the Plans page it appears here." />
      ) : (
        <Card title={`${pending.length} waiting for approval`}>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">
                    {inr(r.amount)} · {r.plan} {r.cycle === "annual" ? "(yearly)" : "(monthly)"}
                  </p>
                  <p className="truncate text-sm text-ink-2">
                    {r.user?.name} · {r.user?.email} · {new Date(r.createdAt).toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 font-mono text-sm text-ink">UTR {r.utr}</p>
                </div>
                {r.status === "pending" ? (
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => decide(r.id, true)}>
                      Approve
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm border border-line" onClick={() => decide(r.id, false)}>
                      Reject
                    </button>
                  </div>
                ) : (
                  <StatusBadge status={r.status} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
