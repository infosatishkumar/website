import { runAgent } from "@/lib/social/agent";
import { errorResponse } from "./errors";

export const maxDuration = 300;

// Chat turn: the owner's keys and conversation come with every request; nothing is stored here.
export async function POST(request: Request) {
  try {
    const { creds, history, text, images } = await request.json();
    if (!creds?.anthropicKey) {
      return Response.json({ error: "Pehle Settings me apni Anthropic API key daalein." }, { status: 400 });
    }
    const result = await runAgent({
      creds,
      history: Array.isArray(history) ? history : [],
      text: String(text ?? ""),
      images: Array.isArray(images) ? images : [],
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
