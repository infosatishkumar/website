import { z } from "zod";
import { defineAction, type ActionContext } from "../types";
import { request, attachment, need } from "../http";

const API = "https://api.x.com/2";
const x = (ctx: ActionContext, path: string, init: RequestInit & { json?: unknown } = {}) =>
  request(`${API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${need(ctx.creds.xAccessToken, "X (Twitter)")}`, ...init.headers },
  });
const myId = async (ctx: ActionContext) => (await x(ctx, "users/me")).data.id as string;

export const xActions = [
  defineAction({
    name: "x_post",
    platform: "x",
    write: true,
    description:
      "Post on X (Twitter), optionally with an image the owner attached in chat. Pass reply_to_id to reply to a post.",
    schema: z.object({
      text: z.string().max(4000),
      reply_to_id: z.string().optional(),
      image_id: z.string().optional().describe("Id of an image the owner attached in chat, e.g. img_1"),
    }),
    run: async ({ text, reply_to_id, image_id }, ctx) => {
      let media: { media_ids: string[] } | undefined;
      if (image_id) {
        const img = attachment(ctx, image_id);
        const form = new FormData();
        form.set("media", img.blob, img.name);
        form.set("media_category", "tweet_image");
        const up = await x(ctx, "media/upload", { method: "POST", body: form });
        media = { media_ids: [up.data.id] };
      }
      return x(ctx, "tweets", {
        method: "POST",
        json: { text, ...(reply_to_id ? { reply: { in_reply_to_tweet_id: reply_to_id } } : {}), ...(media ? { media } : {}) },
      });
    },
  }),
  defineAction({
    name: "x_list_mentions",
    platform: "x",
    write: false,
    description: "List recent posts that mention the owner (the replies and comments to respond to).",
    schema: z.object({ limit: z.number().int().min(5).max(100).optional() }),
    run: async ({ limit = 20 }, ctx) =>
      x(
        ctx,
        `users/${await myId(ctx)}/mentions?max_results=${limit}&tweet.fields=created_at,conversation_id,author_id&expansions=author_id&user.fields=username`,
      ),
  }),
  defineAction({
    name: "x_list_dms",
    platform: "x",
    write: false,
    description: "List recent direct-message events on X.",
    schema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
    run: async ({ limit = 20 }, ctx) =>
      x(
        ctx,
        `dm_events?max_results=${limit}&dm_event.fields=created_at,sender_id,text,dm_conversation_id&expansions=sender_id&user.fields=username`,
      ),
  }),
  defineAction({
    name: "x_send_dm",
    platform: "x",
    write: true,
    description: "Send a direct message on X to a user by their numeric user id.",
    schema: z.object({ participant_id: z.string(), text: z.string() }),
    run: async ({ participant_id, text }, ctx) =>
      x(ctx, `dm_conversations/with/${participant_id}/messages`, { method: "POST", json: { text } }),
  }),
];

export async function testX(ctx: ActionContext) {
  const me = await x(ctx, "users/me");
  return { x: `@${me.data.username}` };
}
