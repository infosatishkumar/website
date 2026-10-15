"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "../Icon";
import { APP, type Plan } from "@/lib/connector/data";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** `buy` links each plan to UPI checkout; off for products without online checkout (listings). */
export default function PricingTable({ plans, buy = true }: { plans: Plan[]; buy?: boolean }) {
  const [annual, setAnnual] = useState(true);
  return (
    <div>
      <div className="mx-auto mb-10 flex w-fit items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-line">
        {[
          { v: false, label: "Monthly" },
          { v: true, label: "Yearly" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setAnnual(o.v)}
            className={`rounded-full px-5 py-2 text-sm font-bold transition-colors ${
              annual === o.v ? "bg-primary text-white" : "text-ink-2 hover:text-primary"
            }`}
          >
            {o.label}
            {o.v && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${annual ? "bg-white/20" : "bg-success-tint text-success"}`}>Save 20%</span>}
          </button>
        ))}
      </div>
      <div className={`grid gap-5 md:grid-cols-2 ${plans.length === 4 ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}>
        {plans.map((p) => {
          const price = annual ? p.annual : p.monthly;
          return (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-2xl bg-white p-7 ${
                p.popular ? "border-2 border-primary shadow-[0_20px_40px_-16px_rgba(103,61,230,0.45)]" : "border border-line"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  Most popular
                </span>
              )}
              <p className="text-xl font-bold text-ink">{p.name}</p>
              <p className="mt-1 text-sm text-muted">{p.blurb}</p>
              {annual && (
                <p className="mt-5 text-sm text-muted">
                  <span className="line-through">{inr(p.monthly)}</span>
                  <span className="ml-2 rounded-full bg-primary-tint px-2 py-0.5 text-xs font-bold text-primary">
                    SAVE {Math.round((1 - p.annual / p.monthly) * 100)}%
                  </span>
                </p>
              )}
              <p className={`${annual ? "mt-1" : "mt-5"} flex items-end gap-1`}>
                <span className="text-4xl font-bold tracking-tight text-ink">{inr(price)}</span>
                <span className="mb-1 text-muted">/mo</span>
              </p>
              <p className="mt-1 text-xs text-muted">{annual ? `Billed ${inr(price * 12)} yearly` : "Billed monthly"}</p>
              <Link
                href={buy ? `${APP}/billing/?plan=${encodeURIComponent(p.name)}&cycle=${annual ? "annual" : "monthly"}` : `${APP}/launchpad`}
                className={`btn mt-6 ${p.popular ? "btn-primary" : "btn-outline"}`}
              >
                {buy ? "Buy now · pay by UPI" : "Start free trial"}
              </Link>
              <ul className="mt-6 space-y-2.5 border-t border-line pt-6 text-sm">
                {p.limits.map((l) => (
                  <li key={l} className="flex items-center gap-2 font-bold text-ink">
                    <Icon name="checkCircle" size={18} className="text-primary" />
                    {l}
                  </li>
                ))}
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-ink-2">
                    <Icon name="check" size={18} className="text-success" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
