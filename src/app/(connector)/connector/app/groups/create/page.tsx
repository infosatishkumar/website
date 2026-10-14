"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, PageHeader } from "@/components/connector/app/ui";
import AccountPicker from "@/components/connector/app/AccountPicker";
import { APP } from "@/lib/connector/data";
import { uid, update } from "@/lib/connector/store";

export default function CreateGroup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  return (
    <>
      <PageHeader title="Create group" sub="Name the group and choose its accounts." />
      <form
        className="grid gap-6 lg:grid-cols-[1fr_360px]"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          update((s) => ({ ...s, groups: [...s.groups, { id: uid(), name: name.trim(), accountIds: ids }] }));
          router.push(`${APP}/groups`);
        }}
      >
        <Card title="Accounts">
          <AccountPicker selected={ids} onChange={setIds} />
        </Card>
        <Card title="Details">
          <label className="block text-sm font-medium text-ink">
            Group name
            <input required value={name} onChange={(e) => setName(e.target.value)} className="field mt-1.5" placeholder="e.g. Client — UrbanBite" />
          </label>
          <p className="mt-4 text-sm text-muted">{ids.length} account{ids.length === 1 ? "" : "s"} selected</p>
          <button type="submit" className="btn btn-primary mt-5 w-full">Create group</button>
        </Card>
      </form>
    </>
  );
}
