import type { z } from "zod";

/** Keys the owner pastes in Settings. They live in the browser and arrive with each request. */
export type Credentials = {
  anthropicKey?: string;
  fbPageId?: string;
  fbPageToken?: string;
  igUserId?: string;
  ytClientId?: string;
  ytClientSecret?: string;
  ytRefreshToken?: string;
  xAccessToken?: string;
  linkedinToken?: string;
  linkedinAuthorUrn?: string;
};

/** An image the owner attached in chat, sent back only when an action needs its bytes. */
export type Attachment = { id: string; name: string; mime: string; data: string };

export type ActionContext = { creds: Credentials; files: Map<string, Attachment> };

export type Platform = "facebook" | "instagram" | "youtube" | "x" | "linkedin";

export type Action<S extends z.ZodType = z.ZodType> = {
  name: string;
  platform: Platform;
  description: string;
  /** Write actions publish or send something and always wait for the owner's approval. */
  write: boolean;
  schema: S;
  run: (input: z.infer<S>, ctx: ActionContext) => Promise<unknown>;
};

export const defineAction = <S extends z.ZodType>(a: Action<S>) => a as unknown as Action;
