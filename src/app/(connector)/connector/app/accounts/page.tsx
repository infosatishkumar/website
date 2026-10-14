"use client";

import Link from "next/link";
import Icon from "@/components/connector/Icon";
import SocialIcon, { networkMeta } from "@/components/connector/SocialIcon";
import { AccountChip, Card, Empty, PageHeader } from "@/components/connector/app/ui";
import { APP } from "@/lib/connector/data";
import { update, useWorkspace } from "@/lib/connector/store";

export default function AccountsPage() {
  const ws = useWorkspace();
  const disconnect = (id: string) => {
    if (!confirm("Disconnect this account? Its scheduled posts stay in your calendar.")) return;
    update((s) => ({
      ...s,
      accounts: s.accounts.filter((a) => a.id !== id),
      groups: s.groups.map((g) => ({ ...g, accountIds: g.accountIds.filter((x) => x !== id) })),
    }));
  };

  return (
    <>
      <PageHeader
        title="Accounts"
        sub={`${ws.accounts.length} connected profile${ws.accounts.length === 1 ? "" : "s"}`}
        actions={<Link href={`${APP}/accounts/create`} className="btn btn-primary"><Icon name="plus" size={18} /> Connect account</Link>}
      />
      <Card>
        {ws.accounts.length === 0 ? (
          <Empty icon="plug" title="No accounts yet" sub="Connect your first social profile to start scheduling." action={<Link href={`${APP}/accounts/create`} className="btn btn-primary">Connect account</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="pb-3 font-medium">Account</th>
                  <th className="pb-3 font-medium">Network</th>
                  <th className="pb-3 font-medium">Scheduled</th>
                  <th className="pb-3 font-medium">Connected</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ws.accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3"><AccountChip account={a} /></td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-2"><SocialIcon id={a.network} size={20} />{networkMeta[a.network].name}</span>
                    </td>
                    <td className="py-3 font-bold text-ink">{ws.posts.filter((p) => p.status === "scheduled" && p.accountIds.includes(a.id)).length}</td>
                    <td className="py-3 text-ink-2">{new Date(a.connectedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="py-3 text-right">
                      <Link href={`${APP}/analytics/${a.network === "google" ? "gmb" : a.network}`} className="btn btn-ghost btn-sm">Analytics</Link>
                      <button type="button" onClick={() => disconnect(a.id)} className="btn btn-ghost btn-sm text-danger">Disconnect</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
