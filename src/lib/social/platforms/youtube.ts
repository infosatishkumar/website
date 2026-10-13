import { z } from "zod";
import { defineAction, type ActionContext } from "../types";
import { request, need } from "../http";

const API = "https://www.googleapis.com/youtube/v3";

async function token(ctx: ActionContext): Promise<string> {
  const res = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: need(ctx.creds.ytClientId, "YouTube"),
      client_secret: need(ctx.creds.ytClientSecret, "YouTube"),
      refresh_token: need(ctx.creds.ytRefreshToken, "YouTube"),
      grant_type: "refresh_token",
    }),
  });
  return res.access_token;
}
async function yt(ctx: ActionContext, path: string, init: RequestInit & { json?: unknown } = {}) {
  return request(`${API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token(ctx)}`, ...init.headers },
  });
}

export const youtubeActions = [
  defineAction({
    name: "yt_list_videos",
    platform: "youtube",
    write: false,
    description: "List the owner's own recent YouTube videos.",
    schema: z.object({ limit: z.number().int().min(1).max(50).optional() }),
    run: async ({ limit = 10 }, ctx) =>
      yt(ctx, `search?part=snippet&forMine=true&type=video&order=date&maxResults=${limit}`),
  }),
  defineAction({
    name: "yt_upload_video",
    platform: "youtube",
    write: true,
    description: "Upload a video to the owner's YouTube channel from a public video file URL.",
    schema: z.object({
      video_url: z.string().url(),
      title: z.string().max(100),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      privacy: z.enum(["public", "unlisted", "private"]).optional().describe("Default private"),
    }),
    run: async ({ video_url, title, description, tags, privacy = "private" }, ctx) => {
      const source = await fetch(video_url);
      if (!source.ok) throw new Error(`Could not download the video (${source.status})`);
      const bytes = await source.arrayBuffer();
      const access = await token(ctx);
      // Resumable upload: create the session, then send the bytes.
      const start = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access}`,
            "Content-Type": "application/json",
            "X-Upload-Content-Length": String(bytes.byteLength),
            "X-Upload-Content-Type": "video/*",
          },
          body: JSON.stringify({
            snippet: { title, description, tags },
            status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
          }),
        },
      );
      const location = start.headers.get("location");
      if (!start.ok || !location) throw new Error(`YouTube upload failed to start: ${await start.text()}`);
      const res = await request(location, { method: "PUT", headers: { "Content-Type": "video/*" }, body: bytes });
      return { id: res.id, url: `https://youtu.be/${res.id}`, privacy };
    },
  }),
  defineAction({
    name: "yt_list_comments",
    platform: "youtube",
    write: false,
    description: "List comment threads on a YouTube video, or across the owner's whole channel if no video_id is given.",
    schema: z.object({
      video_id: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async ({ video_id, limit = 20 }, ctx) => {
      let scope = `videoId=${video_id}`;
      if (!video_id) {
        const me = await yt(ctx, "channels?part=id&mine=true");
        scope = `allThreadsRelatedToChannelId=${me.items?.[0]?.id}`;
      }
      return yt(ctx, `commentThreads?part=snippet,replies&order=time&maxResults=${limit}&${scope}`);
    },
  }),
  defineAction({
    name: "yt_reply_comment",
    platform: "youtube",
    write: true,
    description: "Reply to a YouTube comment (parent_id is the top-level comment id).",
    schema: z.object({ parent_id: z.string(), text: z.string() }),
    run: async ({ parent_id, text }, ctx) =>
      yt(ctx, "comments?part=snippet", {
        method: "POST",
        json: { snippet: { parentId: parent_id, textOriginal: text } },
      }),
  }),
  defineAction({
    name: "yt_comment",
    platform: "youtube",
    write: true,
    description: "Post a new top-level comment on a YouTube video.",
    schema: z.object({ video_id: z.string(), text: z.string() }),
    run: async ({ video_id, text }, ctx) =>
      yt(ctx, "commentThreads?part=snippet", {
        method: "POST",
        json: { snippet: { videoId: video_id, topLevelComment: { snippet: { textOriginal: text } } } },
      }),
  }),
];

export async function testYoutube(ctx: ActionContext) {
  const me = await yt(ctx, "channels?part=snippet&mine=true");
  return { youtube: `Channel: ${me.items?.[0]?.snippet?.title ?? "(none)"}` };
}
