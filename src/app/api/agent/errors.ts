import Anthropic from "@anthropic-ai/sdk";

/** Turns any failure into a short message the dashboard can show. */
export function errorResponse(err: unknown) {
  let message = err instanceof Error ? err.message : String(err);
  let status = 500;
  if (err instanceof Anthropic.AuthenticationError) {
    message = "Anthropic API key galat hai ya missing hai. Settings me check karein.";
    status = 401;
  } else if (err instanceof Anthropic.RateLimitError) {
    message = "Anthropic API abhi busy hai (rate limit). Thodi der baad try karein.";
    status = 429;
  } else if (err instanceof Anthropic.APIError) {
    message = `Anthropic API error ${err.status}: ${err.message}`;
    status = err.status ?? 500;
  }
  return Response.json({ error: message }, { status });
}
