"use client";

import Link from "next/link";
import Icon from "@/components/connector/Icon";
import { AccountChip, Card, Empty, PageHeader } from "@/components/connector/app/ui";
import { APP } from "@/lib/connector/data";
import { update, useWorkspace } from "@/lib/connector/store";

export default function GroupsPage() {
  const ws = useWorkspace();
  return (
    <>
      <PageHeader
        title="Groups"
        sub="Bundle accounts by client, brand or location to post to them together."
        actions={<Link href={`${APP}/groups/create`} className="btn btn-primary"><Icon name="plus" size={18} /> New group</Link>}
      />
      {ws.groups.length === 0 ? (
        <Card><Empty icon="folder" title="No groups yet" sub="Create a group to select several accounts in one click." /></Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {ws.groups.map((g) => (
            <Card
              key={g.id}
              title={<span className="flex items-center gap-2"><Icon name="folder" size={18} className="text-primary" />{g.name}</span>}
              action={
                <button
                  type="button"
                  className="text-sm font-bold text-danger"
                  onClick={() => confirm(`Delete group “${g.name}”?`) && update((s) => ({ ...s, groups: s.groups.filter((x) => x.id !== g.id) }))}
                >
                  Delete
                </button>
              }
            >
              <ul className="space-y-3">
                {g.accountIds.map((id) => {
                  const a = ws.accounts.find((x) => x.id === id);
                  return a ? <li key={id}><AccountChip account={a} /></li> : null;
                })}
                {g.accountIds.length === 0 && <li className="text-sm text-muted">No accounts in this group.</li>}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
