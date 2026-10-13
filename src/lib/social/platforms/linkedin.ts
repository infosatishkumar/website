import { z } from "zod";
import { defineAction, type ActionContext } from "../types";
import { request, attachment, need } from "../http";

const VERSION = "202509";

function li(ctx: ActionContext) {
  return {
    headers: {
      Authorization: `Bearer ${need(ctx.creds.linkedinToken, "LinkedIn")}`,
      "LinkedIn-Version": VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    author: need(ctx.creds.linkedinAuthorUrn, "LinkedIn"),
  };
}

export const linkedinActions = [
  defineAction({
    name: "linkedin_post",
    platform: "linkedin",
    write: true,
    description: "Publish a post on LinkedIn, optionally with an image the owner attached in chat.",
    schema: z.object({
      text: z.string().max(3000),
      image_id: z.string().optional().describe("Id of an image the owner attached in chat, e.g. img_1"),
    }),
    run: async ({ text, image_id }, ctx) => {
      const { headers, author } = li(ctx);
      let content: { media: { id: string } } | undefined;
      if (image_id) {
        const img = attachment(ctx, image_id);
        const init = await request("https://api.linkedin.com/rest/images?action=initializeUpload", {
          method: "POST",
          headers,
          json: { initializeUploadRequest: { owner: author } },
        });
        await request(init.value.uploadUrl, {
          method: "PUT",
          headers: { Authorization: headers.Authorization },
          body: img.blob,
        });
        content = { media: { id: init.value.image } };
      }
      await request("https://api.linkedin.com/rest/posts", {
        method: "POST",
        headers,
        json: {
          author,
          commentary: text,
          visibility: "PUBLIC",
          distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
          ...(content ? { content } : {}),
        },
      });
      return "Published on LinkedIn.";
    },
  }),
];

export async function testLinkedin(ctx: ActionContext) {
  const me = await request("https://api.linkedin.com/v2/userinfo", { headers: li(ctx).headers });
  return { linkedin: me.name ?? "connected" };
}
