import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ACTIONS, type PendingAction } from "./actions";
import { trim } from "./http";
import type { Credentials } from "./types";

type Message = Anthropic.Beta.BetaMessageParam;

// Kept identical across requests (as is the tool list) so the conversation history stays valid
// and cached; what is connected is discovered by the tools themselves.
const SYSTEM = `You are the owner's personal social media manager, working inside their private dashboard. Through your tools you act on their own accounts: Facebook Page, Instagram, YouTube, X (Twitter) and LinkedIn. You can post, upload images and videos, read and reply to comments, comment, and read and answer direct messages.

How to work:
- Reply in the language the owner uses (Hindi, Hinglish or English). Keep chat replies short and friendly.
- Read before you write: list posts, comments or conversations first so replies are grounded in what people actually said.
- Images the owner attaches appear as "[Image img_N: filename]" followed by the image. Use that id as image_id when posting it. You can look at the image to write a fitting caption.
- Write replies and captions that sound like a real person: warm, specific, with relevant hashtags where the platform suits them. Never invent facts, prices, offers or promises the owner has not given you.
- Every publishing or sending tool does NOT run right away: it puts an approval card in front of the owner, who decides. After calling one, tell the owner briefly what is waiting for approval. Never call the same action twice for the same request.
- When asked to post "everywhere", call the publishing tool once per connected platform, adapting the text to each platform.
- When asked to reply to many comments, draft one reply per comment and skip spam, abuse, or anything needing the owner's personal judgement; list those for the owner instead.
- Messages starting with "[Action results]" are outcomes of actions the owner approved or rejected.
- If a tool says a platform is not connected, or an API call fails, explain plainly what is missing (which key on the Settings tab, a permission, a public media URL) and how to fix it.`;

export type ChatImage = { id: string; name: string; fileId: string };

export async function runAgent(opts: {
  creds: Credentials;
  history: Message[];
  text: string;
  images: ChatImage[];
}) {
  const client = new Anthropic({ apiKey: opts.creds.anthropicKey });
  const pending: PendingAction[] = [];
  const activity: string[] = [];
  const ctx = { creds: opts.creds, files: new Map() };

  const tools = ACTIONS.map((action) =>
    betaZodTool({
      name: action.name,
      description: action.description + (action.write ? " (Requires the owner's approval.)" : ""),
      inputSchema: action.schema,
      run: async (input, runCtx) => {
        activity.push(action.name);
        if (action.write) {
          pending.push({
            id: runCtx?.toolUseBlock?.id ?? crypto.randomUUID(),
            name: action.name,
            platform: action.platform,
            input: input as Record<string, unknown>,
          });
          return "Shown to the owner as an approval card. It has NOT been sent yet; it runs only if they approve.";
        }
        return trim(await action.run(input, ctx));
      },
    }),
  );

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const img of opts.images) {
    content.push({ type: "text", text: `[Image ${img.id}: ${img.name}]` });
    content.push({ type: "image", source: { type: "file", file_id: img.fileId } });
  }
  content.push({ type: "text", text: opts.text || "(see the attached image)" });

  const runner = client.beta.messages.toolRunner({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    system: SYSTEM,
    tools,
    messages: [...opts.history, { role: "user", content }],
    output_config: { effort: "medium" },
    // Drop, rather than reject, thinking that no longer matches an edited history.
    thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
    // If a safety classifier declines a request, retry it on a fallback model automatically.
    betas: ["server-side-fallback-2026-07-01", "thinking-binding-controls-2026-08-01"],
    fallbacks: "default",
    max_iterations: 30,
  });

  const replies: string[] = [];
  let refused = false;
  for await (const message of runner) {
    for (const block of message.content) {
      if (block.type === "text" && block.text.trim()) replies.push(block.text);
    }
    if (message.stop_reason === "refusal") refused = true;
  }
  if (refused) replies.push("Sorry, I can't help with that request.");

  return { history: [...runner.params.messages], replies, pending, activity };
}
