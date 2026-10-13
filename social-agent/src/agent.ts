import Anthropic from "@anthropic-ai/sdk";
import { createInterface } from "readline/promises";
import { stdin, stdout } from "process";
import { config } from "./config.js";
import { setPrompt } from "./approval.js";
import { metaTools } from "./platforms/meta.js";
import { youtubeTools } from "./platforms/youtube.js";
import { xTools } from "./platforms/x.js";
import { linkedinTools } from "./platforms/linkedin.js";

const tools = [...metaTools(), ...youtubeTools(), ...xTools(), ...linkedinTools()];
const connected = [
  metaTools().some((t) => t.name.startsWith("fb_")) && "Facebook Page",
  metaTools().some((t) => t.name.startsWith("ig_")) && "Instagram",
  youtubeTools().length && "YouTube",
  xTools().length && "X (Twitter)",
  linkedinTools().length && "LinkedIn",
].filter(Boolean) as string[];

const SYSTEM = `You are the user's personal social media manager. You act on their own accounts through the tools you have: posting, uploading videos, reading and replying to comments, commenting, and reading and answering direct messages.

Connected platforms: ${connected.join(", ") || "none"}.

How to work:
- Talk in the language the user uses (Hindi, Hinglish or English).
- Read before you write: list posts, comments or conversations first so replies are grounded in what people actually said.
- Draft replies that sound like a real person: warm, short, specific to the comment. Never invent facts, prices, offers or promises the user has not given you.
- Every publishing or sending tool shows the user a preview and asks for approval. If they decline or ask for changes, revise and try again; never work around a refusal.
- When asked to "reply to all comments", go through them one by one and skip spam, abuse or anything that needs the user's personal judgement; list those for the user instead.
- If a platform isn't connected or an API call fails, explain plainly what is missing (token, permission, public media URL) and how to fix it.`;

const client = new Anthropic();
const rl = createInterface({ input: stdin, output: stdout });
setPrompt(rl);

console.log(`\n🤖 Social Media Agent  —  connected: ${connected.join(", ") || "none (see README to add tokens)"}`);
if (config.dryRun) console.log("   DRY_RUN is on: nothing will actually be posted or sent.");
console.log('   Type what you want (e.g. "Instagram ke naye comments dikhao aur reply draft karo"). "exit" to quit.\n');

let history: Anthropic.Beta.BetaMessageParam[] = [];

while (true) {
  let input: string;
  try {
    input = (await rl.question("You › ")).trim();
  } catch {
    break; // stdin closed
  }
  if (!input) continue;
  if (/^(exit|quit|bye)$/i.test(input)) break;

  history.push({ role: "user", content: input });
  const runner = client.beta.messages.toolRunner({
    model: config.model,
    max_tokens: 16000,
    system: SYSTEM,
    tools,
    messages: history,
    output_config: { effort: config.effort },
    // If a request is declined by a safety classifier, retry it on a fallback model automatically.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_iterations: 40,
  });

  try {
    for await (const message of runner) {
      for (const block of message.content) {
        if (block.type === "text" && block.text.trim()) console.log(`\nAgent › ${block.text}\n`);
        if (block.type === "tool_use") console.log(`   … ${block.name}`);
      }
      if (message.stop_reason === "refusal") console.log("\nAgent › (The request was declined.)\n");
    }
    history = [...runner.params.messages];
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic API key is missing or invalid. Set ANTHROPIC_API_KEY in .env.");
    } else if (err instanceof Anthropic.RateLimitError) {
      console.error("Rate limited by the Anthropic API — wait a moment and try again.");
    } else if (err instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${err.status}: ${err.message}`);
    } else {
      console.error(err);
    }
    // Keep history consistent: drop the unanswered turn.
    history = history.slice(0, -1);
  }
}

rl.close();
