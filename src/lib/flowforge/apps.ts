import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { credentials } from "./connections";
import { GRAPH_VERSION } from "./oauth";
import { safeFetch } from "./safe-fetch";

// Executors: one function per app action. They receive step config that has
// already been rendered through the template engine.

type Cfg = Record<string, string>;
type Executor = (cfg: Cfg, connectionId?: string) => Promise<unknown>;

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function call(what: string, res: Response | Promise<Response>): Promise<Record<string, unknown>> {
  const r = await res;
  const body = await parse(r);
  if (!r.ok) {
    const msg = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`${what} failed (HTTP ${r.status}): ${msg.slice(0, 500)}`);
  }
  return (typeof body === "object" && body ? body : { response: body }) as Record<string, unknown>;
}

const jsonInit = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function need(cfg: Cfg, ...keys: string[]) {
  for (const k of keys) if (!cfg[k]?.trim()) throw new Error(`"${k}" is empty for this step.`);
}

function parseJsonField(raw: string | undefined, what: string): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${what} is not valid JSON.`);
  }
}

// LinkedIn "little text" treats these characters as markup.
const linkedinEscape = (s: string) => s.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);

function blueskyLinkFacets(text: string) {
  const facets: unknown[] = [];
  const enc = new TextEncoder();
  for (const m of text.matchAll(/https?:\/\/[^\s)]+/g)) {
    const start = enc.encode(text.slice(0, m.index)).length;
    facets.push({
      index: { byteStart: start, byteEnd: start + enc.encode(m[0]).length },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: m[0] }],
    });
  }
  return facets;
}

async function blueskySession(c: Record<string, string>) {
  const service = (c.service || "https://bsky.social").replace(/\/$/, "");
  const s = await call(
    "Bluesky login",
    safeFetch(`${service}/xrpc/com.atproto.server.createSession`, jsonInit({ identifier: c.identifier, password: c.appPassword })),
  );
  return { service, jwt: String(s.accessJwt), did: String(s.did), handle: String(s.handle) };
}

async function waitForContainer(url: string, field: string, ok: string, token: string) {
  for (let i = 0; i < 15; i++) {
    const s = await call("Media status", fetch(`${url}?fields=${field}&access_token=${token}`));
    if (s[field] === ok) return;
    if (s[field] === "ERROR" || s[field] === "EXPIRED") throw new Error(`Media processing failed: ${JSON.stringify(s)}`);
    await sleep(2000);
  }
  throw new Error("Media is still processing after 30s; try a smaller image.");
}

const EXECUTORS: Record<string, Executor> = {
  "http.request": async (cfg) => {
    need(cfg, "url");
    const method = (cfg.method || "POST").toUpperCase();
    const headers = parseJsonField(cfg.headers, "Headers") as Record<string, string>;
    const hasBody = method !== "GET" && method !== "DELETE" && cfg.body?.trim();
    if (hasBody && !Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
      headers["Content-Type"] = /^\s*[[{]/.test(cfg.body) ? "application/json" : "text/plain";
    }
    const res = await safeFetch(cfg.url, { method, headers, body: hasBody ? cfg.body : undefined });
    const body = await parse(res);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
    return { status: res.status, headers: Object.fromEntries(res.headers), body };
  },

  "formatter.compose": async (cfg) => {
    let text = cfg.template ?? "";
    const max = Number(cfg.maxLength);
    if (max > 0 && text.length > max) text = `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
    return { text, length: text.length };
  },

  "claude.generate": async (cfg, connId) => {
    need(cfg, "prompt");
    const { apiKey } = await credentials(connId, "claude");
    const client = new Anthropic({ apiKey });
    const model = cfg.model || "claude-opus-5-5";
    const effort = (cfg.effort || "low") as "low" | "medium" | "high";
    // Opus 5.5 / Sonnet 5.5 support server-side refusal fallbacks.
    const fallback = model === "claude-opus-5-5" || model === "claude-sonnet-5-5";
    const params: Anthropic.Beta.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: 16000,
      output_config: { effort },
      messages: [{ role: "user", content: cfg.prompt }],
    };
    if (cfg.system?.trim()) params.system = cfg.system;
    if (fallback) {
      params.betas = ["server-side-fallback-2026-07-01"];
      params.fallbacks = "default";
    }
    const msg = await client.beta.messages.create(params);
    if (msg.stop_reason === "refusal") throw new Error("Claude declined this request.");
    const text = msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return { text, model: msg.model, usage: msg.usage };
  },

  "facebook.page_post": async (cfg, connId) => {
    need(cfg, "pageId", "message");
    const c = await credentials<{ pageTokens: Record<string, string> }>(connId, "facebook");
    const token = c.pageTokens[cfg.pageId];
    if (!token) throw new Error("This Page is not part of the connected account. Reconnect Facebook.");
    const base = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.pageId}`;
    const params: Record<string, string> = cfg.imageUrl
      ? { url: cfg.imageUrl, caption: cfg.message, access_token: token }
      : { message: cfg.message, ...(cfg.link ? { link: cfg.link } : {}), access_token: token };
    return call(
      "Facebook post",
      fetch(`${base}/${cfg.imageUrl ? "photos" : "feed"}`, { method: "POST", body: new URLSearchParams(params) }),
    );
  },

  "instagram.publish_photo": async (cfg, connId) => {
    need(cfg, "imageUrl");
    const c = await credentials<{ accessToken: string; userId: string }>(connId, "instagram");
    const base = `https://graph.instagram.com/${c.userId}`;
    const container = await call(
      "Instagram media container",
      fetch(`${base}/media`, {
        method: "POST",
        body: new URLSearchParams({ image_url: cfg.imageUrl, caption: cfg.caption ?? "", access_token: c.accessToken }),
      }),
    );
    await waitForContainer(`https://graph.instagram.com/${container.id}`, "status_code", "FINISHED", c.accessToken);
    return call(
      "Instagram publish",
      fetch(`${base}/media_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: String(container.id), access_token: c.accessToken }),
      }),
    );
  },

  "threads.create_post": async (cfg, connId) => {
    need(cfg, "text");
    const c = await credentials<{ accessToken: string; userId: string }>(connId, "threads");
    const base = `https://graph.threads.net/v1.0/${c.userId}`;
    const params: Record<string, string> = cfg.imageUrl
      ? { media_type: "IMAGE", image_url: cfg.imageUrl, text: cfg.text, access_token: c.accessToken }
      : { media_type: "TEXT", text: cfg.text, access_token: c.accessToken };
    const container = await call("Threads container", fetch(`${base}/threads`, { method: "POST", body: new URLSearchParams(params) }));
    if (cfg.imageUrl) {
      await waitForContainer(`https://graph.threads.net/v1.0/${container.id}`, "status", "FINISHED", c.accessToken);
    }
    return call(
      "Threads publish",
      fetch(`${base}/threads_publish`, {
        method: "POST",
        body: new URLSearchParams({ creation_id: String(container.id), access_token: c.accessToken }),
      }),
    );
  },

  "linkedin.create_post": async (cfg, connId) => {
    need(cfg, "text");
    const c = await credentials<{ accessToken: string; personUrn: string }>(connId, "linkedin");
    const res = await fetch(
      "https://api.linkedin.com/rest/posts",
      jsonInit(
        {
          author: c.personUrn,
          commentary: linkedinEscape(cfg.text),
          visibility: cfg.visibility || "PUBLIC",
          distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        },
        {
          Authorization: `Bearer ${c.accessToken}`,
          "LinkedIn-Version": process.env.LINKEDIN_API_VERSION || "202608",
          "X-Restli-Protocol-Version": "2.0.0",
        },
      ),
    );
    if (!res.ok) await call("LinkedIn post", res);
    return { id: res.headers.get("x-restli-id") };
  },

  "x.create_post": async (cfg, connId) => {
    need(cfg, "text");
    const c = await credentials<{ accessToken: string }>(connId, "x");
    const r = await call("X post", fetch("https://api.x.com/2/tweets", jsonInit({ text: cfg.text }, { Authorization: `Bearer ${c.accessToken}` })));
    return r.data;
  },

  "pinterest.create_pin": async (cfg, connId) => {
    need(cfg, "boardId", "imageUrl");
    const c = await credentials<{ accessToken: string }>(connId, "pinterest");
    return call(
      "Pinterest pin",
      fetch(
        "https://api.pinterest.com/v5/pins",
        jsonInit(
          {
            board_id: cfg.boardId,
            title: cfg.title || undefined,
            description: cfg.description || undefined,
            link: cfg.link || undefined,
            media_source: { source_type: "image_url", url: cfg.imageUrl },
          },
          { Authorization: `Bearer ${c.accessToken}` },
        ),
      ),
    );
  },

  "bluesky.create_post": async (cfg, connId) => {
    need(cfg, "text");
    const s = await blueskySession(await credentials(connId, "bluesky"));
    const facets = blueskyLinkFacets(cfg.text);
    return call(
      "Bluesky post",
      safeFetch(
        `${s.service}/xrpc/com.atproto.repo.createRecord`,
        jsonInit(
          {
            repo: s.did,
            collection: "app.bsky.feed.post",
            record: {
              $type: "app.bsky.feed.post",
              text: cfg.text,
              createdAt: new Date().toISOString(),
              ...(facets.length ? { facets } : {}),
            },
          },
          { Authorization: `Bearer ${s.jwt}` },
        ),
      ),
    );
  },

  "mastodon.post_status": async (cfg, connId) => {
    need(cfg, "status");
    const c = await credentials(connId, "mastodon");
    const r = await call(
      "Mastodon post",
      safeFetch(
        `${c.instance.replace(/\/$/, "")}/api/v1/statuses`,
        jsonInit({ status: cfg.status, visibility: cfg.visibility || "public" }, { Authorization: `Bearer ${c.accessToken}` }),
      ),
    );
    return { id: r.id, url: r.url };
  },

  "telegram.send_message": async (cfg, connId) => {
    need(cfg, "chatId", "text");
    const { botToken } = await credentials(connId, "telegram");
    const r = await call(
      "Telegram message",
      fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        jsonInit({
          chat_id: cfg.chatId,
          text: cfg.text,
          ...(cfg.parseMode && cfg.parseMode !== "none" ? { parse_mode: cfg.parseMode } : {}),
        }),
      ),
    );
    return r.result;
  },

  "telegram.send_photo": async (cfg, connId) => {
    need(cfg, "chatId", "photoUrl");
    const { botToken } = await credentials(connId, "telegram");
    const r = await call(
      "Telegram photo",
      fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, jsonInit({ chat_id: cfg.chatId, photo: cfg.photoUrl, caption: cfg.caption })),
    );
    return r.result;
  },

  "whatsapp.send_template": async (cfg, connId) => {
    need(cfg, "to", "template");
    const c = await credentials(connId, "whatsapp");
    const params = (cfg.params ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    return call(
      "WhatsApp template",
      fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${c.phoneNumberId}/messages`,
        jsonInit(
          {
            messaging_product: "whatsapp",
            to: cfg.to.replace(/[^\d]/g, ""),
            type: "template",
            template: {
              name: cfg.template,
              language: { code: cfg.language || "en_US" },
              ...(params.length
                ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] }
                : {}),
            },
          },
          { Authorization: `Bearer ${c.accessToken}` },
        ),
      ),
    );
  },

  "whatsapp.send_text": async (cfg, connId) => {
    need(cfg, "to", "body");
    const c = await credentials(connId, "whatsapp");
    return call(
      "WhatsApp message",
      fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${c.phoneNumberId}/messages`,
        jsonInit(
          { messaging_product: "whatsapp", to: cfg.to.replace(/[^\d]/g, ""), type: "text", text: { body: cfg.body } },
          { Authorization: `Bearer ${c.accessToken}` },
        ),
      ),
    );
  },

  "discord.send_message": async (cfg, connId) => {
    need(cfg, "content");
    const { webhookUrl } = await credentials(connId, "discord");
    const url = new URL(webhookUrl);
    url.searchParams.set("wait", "true");
    const r = await call(
      "Discord message",
      safeFetch(url.toString(), jsonInit({ content: cfg.content.slice(0, 2000), ...(cfg.username ? { username: cfg.username } : {}) })),
    );
    return { id: r.id, channel_id: r.channel_id };
  },

  "slack.send_message": async (cfg, connId) => {
    need(cfg, "text");
    const { webhookUrl } = await credentials(connId, "slack");
    await call("Slack message", safeFetch(webhookUrl, jsonInit({ text: cfg.text })));
    return { ok: true };
  },

  "email.send": async (cfg, connId) => {
    need(cfg, "to", "subject", "html");
    const c = await credentials(connId, "email");
    const html = /<[a-z][\s\S]*>/i.test(cfg.html) ? cfg.html : cfg.html.replace(/\n/g, "<br>");
    return call(
      "Resend email",
      fetch(
        "https://api.resend.com/emails",
        jsonInit(
          {
            from: c.from,
            to: cfg.to.split(",").map((s) => s.trim()).filter(Boolean),
            subject: cfg.subject,
            html,
            ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
          },
          { Authorization: `Bearer ${c.apiKey}` },
        ),
      ),
    );
  },

  "google_sheets.append_row": async (cfg, connId) => {
    need(cfg, "spreadsheetId", "values");
    const c = await credentials<{ accessToken: string }>(connId, "google_sheets");
    const range = encodeURIComponent(`'${(cfg.sheet || "Sheet1").replace(/'/g, "''")}'!A1`);
    const row = cfg.values.split("\n").map((v) => v.trim());
    return call(
      "Google Sheets append",
      fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.spreadsheetId.trim())}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        jsonInit({ values: [row] }, { Authorization: `Bearer ${c.accessToken}` }),
      ),
    );
  },

  "notion.create_page": async (cfg, connId) => {
    need(cfg, "databaseId", "title");
    const { token } = await credentials(connId, "notion");
    const paragraphs = (cfg.content ?? "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: p.slice(0, 2000) } }] },
      }));
    const r = await call(
      "Notion page",
      fetch(
        "https://api.notion.com/v1/pages",
        jsonInit(
          {
            parent: { database_id: cfg.databaseId.replace(/-/g, "").trim() },
            properties: { [cfg.titleProperty || "Name"]: { title: [{ text: { content: cfg.title } }] } },
            children: paragraphs,
          },
          { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" },
        ),
      ),
    );
    return { id: r.id, url: r.url };
  },

  "airtable.create_record": async (cfg, connId) => {
    need(cfg, "baseId", "table", "fields");
    const { token } = await credentials(connId, "airtable");
    return call(
      "Airtable record",
      fetch(
        `https://api.airtable.com/v0/${encodeURIComponent(cfg.baseId.trim())}/${encodeURIComponent(cfg.table.trim())}`,
        jsonInit({ fields: parseJsonField(cfg.fields, "Fields"), typecast: true }, { Authorization: `Bearer ${token}` }),
      ),
    );
  },
};

export function executor(app: string, op: string): Executor | undefined {
  return EXECUTORS[`${app}.${op}`];
}

/**
 * Checks pasted credentials against the real API before saving them.
 * Returns the account label to show in the UI.
 */
export async function verifyToken(app: string, c: Record<string, string>): Promise<{ label: string; meta?: Record<string, unknown> }> {
  switch (app) {
    case "claude": {
      const client = new Anthropic({ apiKey: c.apiKey });
      await client.models.retrieve("claude-opus-5-5");
      return { label: `Anthropic key …${c.apiKey.slice(-4)}` };
    }
    case "telegram": {
      const r = await call("Telegram getMe", fetch(`https://api.telegram.org/bot${c.botToken}/getMe`));
      const bot = r.result as { username: string };
      return { label: `@${bot.username}`, meta: { username: bot.username } };
    }
    case "bluesky": {
      const s = await blueskySession(c);
      return { label: `@${s.handle}` };
    }
    case "mastodon": {
      const r = await call(
        "Mastodon verify",
        safeFetch(`${c.instance.replace(/\/$/, "")}/api/v1/accounts/verify_credentials`, {
          headers: { Authorization: `Bearer ${c.accessToken}` },
        }),
      );
      return { label: `@${r.acct}@${new URL(c.instance).host}` };
    }
    case "whatsapp": {
      const r = await call(
        "WhatsApp verify",
        fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${c.phoneNumberId}?fields=display_phone_number,verified_name`, {
          headers: { Authorization: `Bearer ${c.accessToken}` },
        }),
      );
      return { label: `${r.verified_name ?? "WhatsApp"} ${r.display_phone_number ?? ""}`.trim() };
    }
    case "discord": {
      if (!/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(c.webhookUrl)) {
        throw new Error("That doesn't look like a Discord webhook URL.");
      }
      const r = await call("Discord verify", safeFetch(c.webhookUrl));
      return { label: `Discord · ${r.name}` };
    }
    case "slack": {
      if (!c.webhookUrl.startsWith("https://hooks.slack.com/")) throw new Error("Slack webhook URLs start with https://hooks.slack.com/");
      return { label: "Slack webhook" };
    }
    case "email":
      if (!c.apiKey.startsWith("re_")) throw new Error("Resend API keys start with re_");
      return { label: c.from };
    case "notion": {
      const r = await call(
        "Notion verify",
        fetch("https://api.notion.com/v1/users/me", { headers: { Authorization: `Bearer ${c.token}`, "Notion-Version": "2022-06-28" } }),
      );
      return { label: `Notion · ${r.name ?? "integration"}` };
    }
    case "airtable": {
      const r = await call("Airtable verify", fetch("https://api.airtable.com/v0/meta/whoami", { headers: { Authorization: `Bearer ${c.token}` } }));
      return { label: `Airtable · ${r.email ?? r.id}` };
    }
    default:
      return { label: app };
  }
}

/** Points a Telegram bot's webhook at a workflow (or clears it). */
export async function telegramWebhook(connId: string, url: string | null, secret?: string) {
  const { botToken } = await credentials(connId, "telegram");
  const endpoint = url ? "setWebhook" : "deleteWebhook";
  await call(
    `Telegram ${endpoint}`,
    fetch(
      `https://api.telegram.org/bot${botToken}/${endpoint}`,
      jsonInit(url ? { url, secret_token: secret, allowed_updates: ["message", "channel_post"] } : {}),
    ),
  );
}
