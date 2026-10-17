// {{path.to.value}} interpolation used by every step field.
// Paths: trigger.*, steps.<number or id>.*, now, today. Arrays use .0 or [0].

export type Ctx = Record<string, unknown>;

export function resolvePath(ctx: Ctx, path: string): unknown {
  const parts = path
    .trim()
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function stringify(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export function render(template: string | undefined, ctx: Ctx): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path: string) =>
    stringify(resolvePath(ctx, path)),
  );
}

export function renderAll(config: Record<string, string>, ctx: Ctx): Record<string, string> {
  return Object.fromEntries(Object.entries(config).map(([k, v]) => [k, render(v, ctx)]));
}
