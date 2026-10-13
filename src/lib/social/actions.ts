import { metaActions, testMeta } from "./platforms/meta";
import { youtubeActions, testYoutube } from "./platforms/youtube";
import { xActions, testX } from "./platforms/x";
import { linkedinActions, testLinkedin } from "./platforms/linkedin";
import type { ActionContext, Platform } from "./types";

export const ACTIONS = [...metaActions, ...youtubeActions, ...xActions, ...linkedinActions];

export const findAction = (name: string) => ACTIONS.find((a) => a.name === name);

export const TESTS: Record<string, (ctx: ActionContext) => Promise<Record<string, string>>> = {
  meta: testMeta,
  youtube: testYoutube,
  x: testX,
  linkedin: testLinkedin,
};

export type PendingAction = { id: string; name: string; platform: Platform; input: Record<string, unknown> };
