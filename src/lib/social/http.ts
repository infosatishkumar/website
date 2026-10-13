import type { ActionContext } from "./types";

// Small fetch wrapper: JSON in/out, readable errors that the agent and the owner can act on.
export async function request(
  url: string,
  init: RequestInit & { json?: unknown } = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new Error(`Could not reach ${new URL(url).host}. Check the internet connection and try again.`);
  }
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // non-JSON body, keep the raw text
  }
  if (!res.ok) {
    const body = data as { error?: unknown } | string;
    const msg = typeof body === "string" ? body : JSON.stringify(body.error ?? body);
    throw new Error(`HTTP ${res.status} from ${new URL(url).host}: ${msg.slice(0, 600)}`);
  }
  return data;
}

/** Keep tool results small enough for the model's context. */
export function trim(data: unknown, limit = 12000): string {
  const s = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return s.length > limit ? s.slice(0, limit) + "\n...(truncated)" : s;
}

/** Bytes of an image the owner attached in chat. */
export function attachment(ctx: ActionContext, id: string) {
  const file = ctx.files.get(id);
  if (!file) throw new Error(`Image ${id} is not available any more. Ask the owner to attach it again.`);
  const blob = new Blob([Buffer.from(file.data, "base64")], { type: file.mime });
  return { blob, name: file.name, mime: file.mime };
}

export function need<T>(value: T | undefined, what: string): T {
  if (!value) throw new Error(`${what} is not connected. Add it on the Settings tab first.`);
  return value;
}
