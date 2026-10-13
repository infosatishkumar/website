import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { errorResponse } from "../errors";

// Sends an attached image to the Anthropic Files API so the conversation can reference it by id.
export async function POST(request: Request) {
  try {
    const { anthropicKey, name, mime, data } = await request.json();
    if (!anthropicKey) {
      return Response.json({ error: "Pehle Settings me apni Anthropic API key daalein." }, { status: 400 });
    }
    if (!/^image\/(jpeg|png|gif|webp)$/.test(mime)) {
      return Response.json({ error: "Sirf JPG, PNG, GIF ya WebP image." }, { status: 400 });
    }
    const client = new Anthropic({ apiKey: anthropicKey });
    const file = await client.files.upload({
      file: await toFile(Buffer.from(data, "base64"), name, { type: mime }),
      expires_in_seconds: 7 * 24 * 3600,
    });
    return Response.json({ fileId: file.id });
  } catch (err) {
    return errorResponse(err);
  }
}
