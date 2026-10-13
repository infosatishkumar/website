import { readFileSync, existsSync } from "fs";

// Minimal .env loader so the agent runs with no extra dependency.
function loadDotEnv(path = ".env") {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnv();

const env = (k: string) => process.env[k]?.trim() || undefined;

export const config = {
  model: env("AGENT_MODEL") ?? "claude-opus-5-5",
  effort: (env("AGENT_EFFORT") ?? "medium") as "low" | "medium" | "high" | "xhigh" | "max",
  // When true, every write action (post, upload, comment, reply, message) runs without asking.
  autoApprove: env("AUTO_APPROVE") === "true",
  // When true, write actions are only printed, never sent.
  dryRun: env("DRY_RUN") === "true",

  meta: {
    graphVersion: env("META_GRAPH_VERSION") ?? "v23.0",
    pageId: env("FB_PAGE_ID"),
    pageToken: env("FB_PAGE_ACCESS_TOKEN"),
    igUserId: env("IG_USER_ID"),
  },
  youtube: {
    clientId: env("YT_CLIENT_ID"),
    clientSecret: env("YT_CLIENT_SECRET"),
    refreshToken: env("YT_REFRESH_TOKEN"),
  },
  x: {
    accessToken: env("X_USER_ACCESS_TOKEN"),
  },
  linkedin: {
    accessToken: env("LINKEDIN_ACCESS_TOKEN"),
    authorUrn: env("LINKEDIN_AUTHOR_URN"),
    version: env("LINKEDIN_VERSION") ?? "202509",
  },
};
