import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { config } from "../config.js";
import { request, out } from "../http.js";
import { approve } from "../approval.js";

const API = "https://api.x.com/2";
const x = (path: string, init: RequestInit & { json?: unknown } = {}) =>
  request(`${API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.x.accessToken}`, ...init.headers },
  });

let me: string | undefined;
const myId = async () => (me ??= (await x("users/me")).data.id);

export function xTools() {
  if (!config.x.accessToken) return [];
  return [
    betaZodTool({
      name: "x_post",
      description: "Post on X (Twitter). Pass reply_to_id to reply to a post or comment.",
      inputSchema: z.object({ text: z.string().max(4000), reply_to_id: z.string().optional() }),
      run: async ({ text, reply_to_id }) => {
        const no = await approve(reply_to_id ? "X: reply" : "X: post", { text, reply_to_id });
        if (no) return no;
        return out(
          await x("tweets", {
            method: "POST",
            json: { text, ...(reply_to_id ? { reply: { in_reply_to_tweet_id: reply_to_id } } : {}) },
          }),
        );
      },
    }),
    betaZodTool({
      name: "x_list_mentions",
      description: "List recent posts that mention the user (replies and comments to respond to).",
      inputSchema: z.object({ limit: z.number().int().min(5).max(100).optional() }),
      run: async ({ limit = 20 }) =>
        out(
          await x(
            `users/${await myId()}/mentions?max_results=${limit}&tweet.fields=created_at,conversation_id,author_id&expansions=author_id&user.fields=username`,
          ),
        ),
    }),
    betaZodTool({
      name: "x_list_dms",
      description: "List recent direct-message events.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
      run: async ({ limit = 20 }) =>
        out(
          await x(
            `dm_events?max_results=${limit}&dm_event.fields=created_at,sender_id,text,dm_conversation_id&expansions=sender_id&user.fields=username`,
          ),
        ),
    }),
    betaZodTool({
      name: "x_send_dm",
      description: "Send a direct message to a user on X by their numeric user id.",
      inputSchema: z.object({ participant_id: z.string(), text: z.string() }),
      run: async ({ participant_id, text }) => {
        const no = await approve("X: send DM", { to: participant_id, text });
        if (no) return no;
        return out(await x(`dm_conversations/with/${participant_id}/messages`, { method: "POST", json: { text } }));
      },
    }),
  ];
}
