"use client";

import ListManager from "@/components/connector/app/ListManager";

export default function MentionGroupsPage() {
  return (
    <ListManager
      listKey="mentionGroups"
      title="Mention groups"
      sub="Save sets of @handles to tag partners and teammates in one click."
      icon="at"
      titleLabel="Group name"
      valueLabel="Handles"
      titlePlaceholder="Partners"
      valuePlaceholder="@brandone @brandtwo"
    />
  );
}
