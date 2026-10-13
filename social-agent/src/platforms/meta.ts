import { readFile } from "fs/promises";
import { basename } from "path";
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { config } from "../config.js";
import { request, out } from "../http.js";
import { approve } from "../approval.js";

// Facebook Page + Instagram professional account, both through the Meta Graph API.
const { graphVersion, pageId, pageToken, igUserId } = config.meta;
const G = `https://graph.facebook.com/${graphVersion}`;

function graph(path: string, params: Record<string, string | number | undefined> = {}) {
  const u = new URL(`${G}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v));
  u.searchParams.set("access_token", pageToken!);
  return u.toString();
}
const post = (path: string, body: Record<string, unknown>) =>
  request(graph(path), { method: "POST", json: body });

const limit = z.number().int().min(1).max(50).optional().describe("How many items (default 10)");

export function metaTools() {
  if (!pageId || !pageToken) return [];

  const facebook = [
    betaZodTool({
      name: "fb_list_posts",
      description: "List recent posts on the user's Facebook Page.",
      inputSchema: z.object({ limit }),
      run: async ({ limit = 10 }) =>
        out(await request(graph(`${pageId}/posts`, { fields: "id,message,created_time,permalink_url", limit }))),
    }),
    betaZodTool({
      name: "fb_create_post",
      description:
        "Publish a post on the Facebook Page. Text, optionally with a link or a public image URL.",
      inputSchema: z.object({
        message: z.string().describe("Post text"),
        link: z.string().url().optional(),
        image_url: z.string().url().optional().describe("Publicly reachable image URL to post as a photo"),
      }),
      run: async ({ message, link, image_url }) => {
        const no = await approve("Facebook: publish post", { message, link, image_url });
        if (no) return no;
        const res = image_url
          ? await post(`${pageId}/photos`, { url: image_url, caption: message })
          : await post(`${pageId}/feed`, { message, link });
        return out({ published: true, ...res });
      },
    }),
    betaZodTool({
      name: "fb_upload_video",
      description:
        "Upload a video to the Facebook Page, from a local file path or a public video URL.",
      inputSchema: z.object({
        file_path: z.string().optional().describe("Local path to a video file"),
        video_url: z.string().url().optional().describe("Public URL of a video file"),
        title: z.string().optional(),
        description: z.string().optional(),
      }),
      run: async ({ file_path, video_url, title, description }) => {
        if (!file_path && !video_url) throw new Error("Give file_path or video_url");
        const no = await approve("Facebook: upload video", { file_path, video_url, title, description });
        if (no) return no;
        const url = `https://graph-video.facebook.com/${graphVersion}/${pageId}/videos`;
        const form = new FormData();
        form.set("access_token", pageToken);
        if (title) form.set("title", title);
        if (description) form.set("description", description);
        if (file_path) form.set("source", new Blob([await readFile(file_path)]), basename(file_path));
        else form.set("file_url", video_url!);
        return out({ uploaded: true, ...(await request(url, { method: "POST", body: form })) });
      },
    }),
    betaZodTool({
      name: "fb_list_comments",
      description: "List comments on a Facebook post, or replies under a comment.",
      inputSchema: z.object({ object_id: z.string().describe("Post id or comment id"), limit }),
      run: async ({ object_id, limit = 25 }) =>
        out(
          await request(
            graph(`${object_id}/comments`, { fields: "id,message,from,created_time,comment_count", limit }),
          ),
        ),
    }),
    betaZodTool({
      name: "fb_comment",
      description:
        "Comment as the Page. Pass a post id to comment on the post, or a comment id to reply to that comment.",
      inputSchema: z.object({ object_id: z.string(), message: z.string() }),
      run: async ({ object_id, message }) => {
        const no = await approve("Facebook: comment / reply", { on: object_id, message });
        if (no) return no;
        return out({ sent: true, ...(await post(`${object_id}/comments`, { message })) });
      },
    }),
    betaZodTool({
      name: "fb_list_conversations",
      description: "List recent Messenger conversations of the Page with their latest messages.",
      inputSchema: z.object({ limit }),
      run: async ({ limit = 10 }) =>
        out(
          await request(
            graph(`${pageId}/conversations`, {
              platform: "messenger",
              fields: "id,updated_time,participants,messages.limit(5){message,from,created_time}",
              limit,
            }),
          ),
        ),
    }),
    betaZodTool({
      name: "fb_send_message",
      description:
        "Send a Messenger message from the Page to a person (PSID from fb_list_conversations). " +
        "Meta only allows this within 24h of the person's last message.",
      inputSchema: z.object({ recipient_id: z.string(), text: z.string() }),
      run: async ({ recipient_id, text }) => {
        const no = await approve("Messenger: send message", { to: recipient_id, text });
        if (no) return no;
        return out(
          await post(`${pageId}/messages`, {
            recipient: { id: recipient_id },
            message: { text },
            messaging_type: "RESPONSE",
          }),
        );
      },
    }),
  ];

  if (!igUserId) return facebook;

  const instagram = [
    betaZodTool({
      name: "ig_list_media",
      description: "List recent Instagram posts/reels of the user's professional account.",
      inputSchema: z.object({ limit }),
      run: async ({ limit = 10 }) =>
        out(
          await request(
            graph(`${igUserId}/media`, {
              fields: "id,caption,media_type,permalink,timestamp,comments_count,like_count",
              limit,
            }),
          ),
        ),
    }),
    betaZodTool({
      name: "ig_publish",
      description:
        "Publish to Instagram: an image post or a Reel (video). Instagram needs a PUBLIC https URL " +
        "for the media; local files are not accepted by Instagram's API.",
      inputSchema: z.object({
        kind: z.enum(["image", "reel"]),
        media_url: z.string().url(),
        caption: z.string().optional(),
      }),
      run: async ({ kind, media_url, caption }) => {
        const no = await approve(`Instagram: publish ${kind}`, { media_url, caption });
        if (no) return no;
        const container = await post(
          `${igUserId}/media`,
          kind === "image"
            ? { image_url: media_url, caption }
            : { media_type: "REELS", video_url: media_url, caption },
        );
        // Videos are processed asynchronously; wait until the container is ready.
        for (let i = 0; kind === "reel" && i < 60; i++) {
          const s = await request(graph(container.id, { fields: "status_code" }));
          if (s.status_code === "FINISHED") break;
          if (s.status_code === "ERROR") throw new Error("Instagram could not process the video");
          await new Promise((r) => setTimeout(r, 5000));
        }
        return out({ published: true, ...(await post(`${igUserId}/media_publish`, { creation_id: container.id })) });
      },
    }),
    betaZodTool({
      name: "ig_list_comments",
      description: "List comments on an Instagram post (with their replies).",
      inputSchema: z.object({ media_id: z.string(), limit }),
      run: async ({ media_id, limit = 25 }) =>
        out(
          await request(
            graph(`${media_id}/comments`, {
              fields: "id,text,username,timestamp,replies{id,text,username,timestamp}",
              limit,
            }),
          ),
        ),
    }),
    betaZodTool({
      name: "ig_reply_comment",
      description: "Reply to a comment on Instagram.",
      inputSchema: z.object({ comment_id: z.string(), message: z.string() }),
      run: async ({ comment_id, message }) => {
        const no = await approve("Instagram: reply to comment", { comment_id, message });
        if (no) return no;
        return out({ sent: true, ...(await post(`${comment_id}/replies`, { message })) });
      },
    }),
    betaZodTool({
      name: "ig_comment",
      description: "Add a new top-level comment on one of the user's own Instagram posts.",
      inputSchema: z.object({ media_id: z.string(), message: z.string() }),
      run: async ({ media_id, message }) => {
        const no = await approve("Instagram: comment", { media_id, message });
        if (no) return no;
        return out({ sent: true, ...(await post(`${media_id}/comments`, { message })) });
      },
    }),
    betaZodTool({
      name: "ig_list_conversations",
      description: "List recent Instagram DM conversations with their latest messages.",
      inputSchema: z.object({ limit }),
      run: async ({ limit = 10 }) =>
        out(
          await request(
            graph(`${pageId}/conversations`, {
              platform: "instagram",
              fields: "id,updated_time,participants,messages.limit(5){message,from,created_time}",
              limit,
            }),
          ),
        ),
    }),
    betaZodTool({
      name: "ig_send_message",
      description:
        "Send an Instagram DM (recipient IGSID from ig_list_conversations). " +
        "Meta only allows this within 24h of the person's last message.",
      inputSchema: z.object({ recipient_id: z.string(), text: z.string() }),
      run: async ({ recipient_id, text }) => {
        const no = await approve("Instagram: send DM", { to: recipient_id, text });
        if (no) return no;
        return out(await post(`${pageId}/messages`, { recipient: { id: recipient_id }, message: { text } }));
      },
    }),
  ];

  return [...facebook, ...instagram];
}
