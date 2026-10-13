import type { Interface } from "readline/promises";
import { config } from "./config.js";

let rl: Interface | undefined;
export function setPrompt(r: Interface) {
  rl = r;
}

/**
 * Human-in-the-loop gate for anything that publishes or sends on the user's behalf.
 * Returns null when approved, or a message for the model when it must not proceed.
 */
export async function approve(action: string, details: Record<string, unknown>): Promise<string | null> {
  const preview = Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `   ${k}: ${String(v)}`)
    .join("\n");
  console.log(`\n⚠️  ${action}\n${preview}`);

  if (config.dryRun) {
    console.log("   [DRY_RUN] not sent.");
    return "DRY_RUN is on: the action was shown to the user but NOT sent.";
  }
  if (config.autoApprove) return null;
  if (!rl) return "No terminal available to confirm; action not sent.";

  const answer = (await rl.question("   Approve? (y = haan / n = nahi / or type changes): ")).trim();
  if (/^(y|yes|haan|ha|han)$/i.test(answer)) return null;
  if (/^(n|no|nahi|nahin)$/i.test(answer) || answer === "") {
    return "The user declined this action. It was NOT sent. Ask what they would like instead.";
  }
  return `The user did NOT approve yet and asked for this change: "${answer}". Revise and ask again.`;
}
