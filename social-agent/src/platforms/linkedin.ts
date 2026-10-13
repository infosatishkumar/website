import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { config } from "../config.js";
import { request, out } from "../http.js";
import { approve } from "../approval.js";

export function linkedinTools() {
  const { accessToken, authorUrn, version } = config.linkedin;
  if (!accessToken || !authorUrn) return [];
  return [
    betaZodTool({
      name: "linkedin_post",
      description: "Publish a text post on LinkedIn as the user (or their company page, per LINKEDIN_AUTHOR_URN).",
      inputSchema: z.object({ text: z.string().max(3000) }),
      run: async ({ text }) => {
        const no = await approve("LinkedIn: publish post", { text });
        if (no) return no;
        await request("https://api.linkedin.com/rest/posts", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "LinkedIn-Version": version,
            "X-Restli-Protocol-Version": "2.0.0",
          },
          json: {
            author: authorUrn,
            commentary: text,
            visibility: "PUBLIC",
            distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
            lifecycleState: "PUBLISHED",
            isReshareDisabledByAuthor: false,
          },
        });
        return "Published on LinkedIn.";
      },
    }),
  ];
}
