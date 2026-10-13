// Small fetch wrapper: JSON in/out, readable errors that the agent can see and act on.
export async function request(
  url: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<any> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // non-JSON body, keep raw text
  }
  if (!res.ok) {
    const msg = typeof data === "string" ? data : JSON.stringify(data.error ?? data);
    throw new Error(`HTTP ${res.status} from ${new URL(url).host}: ${msg}`);
  }
  return data;
}

// Keep tool results small enough for the model's context.
export function out(data: unknown, limit = 12000): string {
  const s = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return s.length > limit ? s.slice(0, limit) + "\n...(truncated)" : s;
}
