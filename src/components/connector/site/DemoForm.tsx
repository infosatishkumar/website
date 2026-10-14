"use client";

import { useState } from "react";
import Icon from "../Icon";

export default function DemoForm() {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div className="flex flex-col items-center rounded-2xl bg-white p-10 text-center ring-1 ring-line">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-tint text-success">
          <Icon name="check" size={28} strokeWidth={2.6} />
        </span>
        <p className="mt-4 text-xl font-bold text-ink">Request received</p>
        <p className="mt-2 text-ink-2">Our team will email you within one business day to pick a time.</p>
      </div>
    );
  }
  return (
    <form
      className="grid gap-4 rounded-2xl bg-white p-7 ring-1 ring-line sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <label className="text-sm font-medium text-ink">
        Full name
        <input required className="field mt-1.5" placeholder="Your name" />
      </label>
      <label className="text-sm font-medium text-ink">
        Work email
        <input required type="email" className="field mt-1.5" placeholder="you@company.com" />
      </label>
      <label className="text-sm font-medium text-ink">
        Company
        <input className="field mt-1.5" placeholder="Company name" />
      </label>
      <label className="text-sm font-medium text-ink">
        Accounts to manage
        <select className="field mt-1.5" defaultValue="1-10">
          <option>1-10</option>
          <option>11-50</option>
          <option>51-100</option>
          <option>100+</option>
        </select>
      </label>
      <label className="text-sm font-medium text-ink sm:col-span-2">
        What would you like to see?
        <textarea className="field mt-1.5" rows={3} placeholder="Approvals, reports, listings…" />
      </label>
      <button type="submit" className="btn btn-primary sm:col-span-2">Request demo</button>
    </form>
  );
}
