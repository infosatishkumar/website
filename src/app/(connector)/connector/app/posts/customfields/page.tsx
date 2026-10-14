"use client";

import ListManager from "@/components/connector/app/ListManager";

export default function CustomFieldsPage() {
  return (
    <ListManager
      listKey="customFields"
      title="Custom fields"
      sub="Reusable placeholders like {{website}} that you can drop into any caption."
      icon="hash"
      titleLabel="Field name"
      valueLabel="Value"
      titlePlaceholder="website"
      valuePlaceholder="https://example.com"
      renderValue={(v) => v}
    />
  );
}
