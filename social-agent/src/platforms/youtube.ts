import { readFile, stat } from "fs/promises";
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { config } from "../config.js";
import { request, out } from "../http.js";
import { approve } from "../approval.js";

const API = "https://www.googleapis.com/youtube/v3";
const { clientId, clientSecret, refreshToken } = config.youtube;

let cached: { token: string; expires: number } | undefined;
async function token(): Promise<string> {
  if (cached && Date.now() < cached.expires) return cached.token;
  const res = await request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken!,
      grant_type: "refresh_token",
    }),
  });
  cached = { token: res.access_token, expires: Date.now() + (res.expires_in - 60) * 1000 };
  return cached.token;
}
async function yt(path: string, init: RequestInit & { json?: unknown } = {}) {
  return request(`${API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, ...init.headers },
  });
}

export function youtubeTools() {
  if (!clientId || !clientSecret || !refreshToken) return [];
  return [
    betaZodTool({
      name: "yt_list_videos",
      description: "List the user's own recent YouTube videos.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional() }),
      run: async ({ limit = 10 }) =>
        out(await yt(`search?part=snippet&forMine=true&type=video&order=date&maxResults=${limit}`)),
    }),
    betaZodTool({
      name: "yt_upload_video",
      description: "Upload a local video file to the user's YouTube channel.",
      inputSchema: z.object({
        file_path: z.string(),
        title: z.string().max(100),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
        privacy: z.enum(["public", "unlisted", "private"]).optional().describe("Default private"),
      }),
      run: async ({ file_path, title, description, tags, privacy = "private" }) => {
        const no = await approve("YouTube: upload video", { file_path, title, description, privacy });
        if (no) return no;
        const size = (await stat(file_path)).size;
        // Resumable upload: create the session, then send the bytes.
        const start = await fetch(
          "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${await token()}`,
              "Content-Type": "application/json",
              "X-Upload-Content-Length": String(size),
              "X-Upload-Content-Type": "video/*",
            },
            body: JSON.stringify({
              snippet: { title, description, tags },
              status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
            }),
          },
        );
        const location = start.headers.get("location");
        if (!start.ok || !location) throw new Error(`YouTube upload init failed: ${await start.text()}`);
        const res = await request(location, {
          method: "PUT",
          headers: { "Content-Type": "video/*" },
          body: await readFile(file_path),
        });
        return out({ uploaded: true, id: res.id, url: `https://youtu.be/${res.id}`, status: res.status });
      },
    }),
    betaZodTool({
      name: "yt_list_comments",
      description:
        "List comment threads on a YouTube video, or across the whole channel if no video_id is given.",
      inputSchema: z.object({
        video_id: z.string().optional(),
        channel_id: z.string().optional().describe("Needed when video_id is absent"),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      run: async ({ video_id, channel_id, limit = 20 }) => {
        const scope = video_id ? `videoId=${video_id}` : `allThreadsRelatedToChannelId=${channel_id}`;
        return out(await yt(`commentThreads?part=snippet,replies&order=time&maxResults=${limit}&${scope}`));
      },
    }),
    betaZodTool({
      name: "yt_reply_comment",
      description: "Reply to a YouTube comment (parent_id is the top-level comment id).",
      inputSchema: z.object({ parent_id: z.string(), text: z.string() }),
      run: async ({ parent_id, text }) => {
        const no = await approve("YouTube: reply to comment", { parent_id, text });
        if (no) return no;
        return out(
          await yt("comments?part=snippet", {
            method: "POST",
            json: { snippet: { parentId: parent_id, textOriginal: text } },
          }),
        );
      },
    }),
    betaZodTool({
      name: "yt_comment",
      description: "Post a new top-level comment on any YouTube video.",
      inputSchema: z.object({ video_id: z.string(), text: z.string() }),
      run: async ({ video_id, text }) => {
        const no = await approve("YouTube: comment", { video_id, text });
        if (no) return no;
        return out(
          await yt("commentThreads?part=snippet", {
            method: "POST",
            json: { snippet: { videoId: video_id, topLevelComment: { snippet: { textOriginal: text } } } },
          }),
        );
      },
    }),
  ];
}
