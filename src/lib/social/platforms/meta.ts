import { z } from "zod";
import { defineAction, type ActionContext } from "../types";
import { request, attachment, need } from "../http";

// Facebook Page + Instagram professional account, both through the Meta Graph API.
const GRAPH = "https://graph.facebook.com/v23.0";

function page(ctx: ActionContext) {
  return {
    id: need(ctx.creds.fbPageId, "Facebook Page"),
    token: need(ctx.creds.fbPageToken, "Facebook Page"),
  };
}
function ig(ctx: ActionContext) {
  return { ...page(ctx), igId: need(ctx.creds.igUserId, "Instagram") };
}
function url(path: string, token: string, params: Record<string, string | number | undefined> = {}) {
  const u = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, String(v));
  u.searchParams.set("access_token", token);
  return u.toString();
}
const post = (path: string, token: string, body: Record<string, unknown>) =>
  request(url(path, token), { method: "POST", json: body });

/** Uploads an attached image to the Page as a photo; unpublished photos give Instagram a public URL. */
async function uploadPhoto(ctx: ActionContext, imageId: string, opts: { caption?: string; published: boolean }) {
  const { id, token } = page(ctx);
  const img = attachment(ctx, imageId);
  const form = new FormData();
  form.set("access_token", token);
  form.set("published", String(opts.published));
  if (opts.caption) form.set("caption", opts.caption);
  form.set("source", img.blob, img.name);
  return request(`${GRAPH}/${id}/photos`, { method: "POST", body: form });
}

const limit = z.number().int().min(1).max(50).optional().describe("How many items (default 10)");
const conversationFields = "id,updated_time,participants,messages.limit(5){message,from,created_time}";

export const metaActions = [
  defineAction({
    name: "fb_list_posts",
    platform: "facebook",
    write: false,
    description: "List recent posts on the owner's Facebook Page.",
    schema: z.object({ limit }),
    run: async ({ limit = 10 }, ctx) => {
      const { id, token } = page(ctx);
      return request(url(`${id}/posts`, token, { fields: "id,message,created_time,permalink_url", limit }));
    },
  }),
  defineAction({
    name: "fb_create_post",
    platform: "facebook",
    write: true,
    description:
      "Publish a post on the Facebook Page: text, optionally with a link, an image the owner attached in chat (image_id), or a public image URL.",
    schema: z.object({
      message: z.string().describe("Post text"),
      link: z.string().url().optional(),
      image_id: z.string().optional().describe("Id of an image the owner attached in chat, e.g. img_1"),
      image_url: z.string().url().optional(),
    }),
    run: async ({ message, link, image_id, image_url }, ctx) => {
      const { id, token } = page(ctx);
      if (image_id) return uploadPhoto(ctx, image_id, { caption: message, published: true });
      if (image_url) return post(`${id}/photos`, token, { url: image_url, caption: message });
      return post(`${id}/feed`, token, { message, link });
    },
  }),
  defineAction({
    name: "fb_upload_video",
    platform: "facebook",
    write: true,
    description: "Upload a video to the Facebook Page from a public video URL.",
    schema: z.object({
      video_url: z.string().url(),
      title: z.string().optional(),
      description: z.string().optional(),
    }),
    run: async ({ video_url, title, description }, ctx) => {
      const { id, token } = page(ctx);
      return request(`https://graph-video.facebook.com/v23.0/${id}/videos?access_token=${token}`, {
        method: "POST",
        json: { file_url: video_url, title, description },
      });
    },
  }),
  defineAction({
    name: "fb_list_comments",
    platform: "facebook",
    write: false,
    description: "List comments on a Facebook post, or replies under a comment.",
    schema: z.object({ object_id: z.string().describe("Post id or comment id"), limit }),
    run: async ({ object_id, limit = 25 }, ctx) =>
      request(
        url(`${object_id}/comments`, page(ctx).token, {
          fields: "id,message,from,created_time,comment_count",
          limit,
        }),
      ),
  }),
  defineAction({
    name: "fb_comment",
    platform: "facebook",
    write: true,
    description: "Comment as the Page: a post id comments on the post, a comment id replies to that comment.",
    schema: z.object({ object_id: z.string(), message: z.string() }),
    run: async ({ object_id, message }, ctx) => post(`${object_id}/comments`, page(ctx).token, { message }),
  }),
  defineAction({
    name: "fb_list_conversations",
    platform: "facebook",
    write: false,
    description: "List recent Messenger conversations of the Page with their latest messages.",
    schema: z.object({ limit }),
    run: async ({ limit = 10 }, ctx) => {
      const { id, token } = page(ctx);
      return request(url(`${id}/conversations`, token, { platform: "messenger", fields: conversationFields, limit }));
    },
  }),
  defineAction({
    name: "fb_send_message",
    platform: "facebook",
    write: true,
    description:
      "Send a Messenger message from the Page (recipient PSID from fb_list_conversations). Meta allows this only within 24h of the person's last message.",
    schema: z.object({ recipient_id: z.string(), text: z.string() }),
    run: async ({ recipient_id, text }, ctx) => {
      const { id, token } = page(ctx);
      return post(`${id}/messages`, token, {
        recipient: { id: recipient_id },
        message: { text },
        messaging_type: "RESPONSE",
      });
    },
  }),

  defineAction({
    name: "ig_list_media",
    platform: "instagram",
    write: false,
    description: "List recent Instagram posts and reels of the owner's professional account.",
    schema: z.object({ limit }),
    run: async ({ limit = 10 }, ctx) => {
      const { igId, token } = ig(ctx);
      return request(
        url(`${igId}/media`, token, {
          fields: "id,caption,media_type,permalink,timestamp,comments_count,like_count",
          limit,
        }),
      );
    },
  }),
  defineAction({
    name: "ig_publish",
    platform: "instagram",
    write: true,
    description:
      "Publish to Instagram: an image post (image_id of an image attached in chat, or a public image URL) or a Reel (public video URL).",
    schema: z.object({
      kind: z.enum(["image", "reel"]),
      image_id: z.string().optional().describe("Id of an image the owner attached in chat, e.g. img_1"),
      media_url: z.string().url().optional().describe("Public https URL of the image or video"),
      caption: z.string().optional(),
    }),
    run: async ({ kind, image_id, media_url, caption }, ctx) => {
      const { igId, token } = ig(ctx);
      let mediaUrl = media_url;
      if (kind === "image" && image_id) {
        // Instagram only takes a public URL, so host the image as an unpublished Page photo first.
        const photo = await uploadPhoto(ctx, image_id, { published: false });
        const info = await request(url(photo.id, token, { fields: "images" }));
        mediaUrl = info.images?.[0]?.source;
      }
      if (!mediaUrl) throw new Error("Give image_id or media_url");
      const container = await post(
        `${igId}/media`,
        token,
        kind === "image" ? { image_url: mediaUrl, caption } : { media_type: "REELS", video_url: mediaUrl, caption },
      );
      // Media is processed asynchronously; wait until the container is ready.
      for (let i = 0; i < 50; i++) {
        const s = await request(url(container.id, token, { fields: "status_code" }));
        if (s.status_code === "FINISHED") break;
        if (s.status_code === "ERROR") throw new Error("Instagram could not process this media");
        await new Promise((r) => setTimeout(r, 5000));
      }
      return post(`${igId}/media_publish`, token, { creation_id: container.id });
    },
  }),
  defineAction({
    name: "ig_list_comments",
    platform: "instagram",
    write: false,
    description: "List comments (with replies) on an Instagram post.",
    schema: z.object({ media_id: z.string(), limit }),
    run: async ({ media_id, limit = 25 }, ctx) =>
      request(
        url(`${media_id}/comments`, ig(ctx).token, {
          fields: "id,text,username,timestamp,replies{id,text,username,timestamp}",
          limit,
        }),
      ),
  }),
  defineAction({
    name: "ig_reply_comment",
    platform: "instagram",
    write: true,
    description: "Reply to a comment on Instagram.",
    schema: z.object({ comment_id: z.string(), message: z.string() }),
    run: async ({ comment_id, message }, ctx) => post(`${comment_id}/replies`, ig(ctx).token, { message }),
  }),
  defineAction({
    name: "ig_comment",
    platform: "instagram",
    write: true,
    description: "Add a new top-level comment on one of the owner's own Instagram posts.",
    schema: z.object({ media_id: z.string(), message: z.string() }),
    run: async ({ media_id, message }, ctx) => post(`${media_id}/comments`, ig(ctx).token, { message }),
  }),
  defineAction({
    name: "ig_list_conversations",
    platform: "instagram",
    write: false,
    description: "List recent Instagram DM conversations with their latest messages.",
    schema: z.object({ limit }),
    run: async ({ limit = 10 }, ctx) => {
      const { id, token } = ig(ctx);
      return request(url(`${id}/conversations`, token, { platform: "instagram", fields: conversationFields, limit }));
    },
  }),
  defineAction({
    name: "ig_send_message",
    platform: "instagram",
    write: true,
    description:
      "Send an Instagram DM (recipient IGSID from ig_list_conversations). Meta allows this only within 24h of the person's last message.",
    schema: z.object({ recipient_id: z.string(), text: z.string() }),
    run: async ({ recipient_id, text }, ctx) => {
      const { id, token } = ig(ctx);
      return post(`${id}/messages`, token, { recipient: { id: recipient_id }, message: { text } });
    },
  }),
];

export async function testMeta(ctx: ActionContext) {
  const { id, token, } = page(ctx);
  const fb = await request(url(id, token, { fields: "name" }));
  const result: Record<string, string> = { facebook: `Page: ${fb.name}` };
  if (ctx.creds.igUserId) {
    const i = await request(url(ctx.creds.igUserId, token, { fields: "username" }));
    result.instagram = `@${i.username}`;
  }
  return result;
}
