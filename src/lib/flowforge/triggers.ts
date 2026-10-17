import "server-only";
import { telegramWebhook } from "./apps";
import { runWorkflow } from "./engine";
import { fetchFeed } from "./rss";
import { store } from "./store";
import type { Workflow } from "./types";

export function appUrl(req: Request): string {
  if (process.env.FLOWFORGE_APP_URL) return process.env.FLOWFORGE_APP_URL.replace(/\/$/, "");
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  const proto = h.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}

export const hookUrl = (base: string, wf: Workflow) =>
  `${base}/api/flowforge/hooks/${wf.id}?token=${wf.hookToken}`;

/**
 * Keeps platform-side registrations in sync after a workflow is saved.
 * Today that means pointing a Telegram bot's webhook at the workflow.
 */
export async function syncTriggerRegistration(wf: Workflow, prev: Workflow | null, base: string) {
  const trig = wf.steps[0];
  const prevTrig = prev?.steps[0];
  const wasTelegram = prevTrig?.app === "telegram" && prev?.status === "on" && prevTrig.connectionId;
  const isTelegram = trig?.app === "telegram" && wf.status === "on" && trig.connectionId;

  if (wasTelegram && (!isTelegram || prevTrig!.connectionId !== trig.connectionId)) {
    await telegramWebhook(prevTrig!.connectionId!, null).catch(() => {});
  }
  if (isTelegram) {
    if (!base.startsWith("https://")) {
      throw new Error("Telegram needs a public https URL. Deploy the site (or set FLOWFORGE_APP_URL to an https tunnel) first.");
    }
    await telegramWebhook(trig.connectionId!, `${base}/api/flowforge/hooks/${wf.id}`, wf.hookToken);
  }
}

export interface TickReport {
  checked: number;
  fired: { workflow: string; source: string; status: string }[];
  errors: { workflow: string; error: string }[];
}

/** One cron tick: fires due schedules and polls RSS feeds. */
export async function tick(): Promise<TickReport> {
  const report: TickReport = { checked: 0, fired: [], errors: [] };
  const workflows = (await store().list<Workflow>("workflows")).filter((w) => w.status === "on");

  for (const wf of workflows) {
    const trig = wf.steps[0];
    if (!trig || (trig.app !== "schedule" && trig.app !== "rss")) continue;
    report.checked++;
    const state = { ...(wf.state ?? {}) };
    try {
      if (trig.app === "schedule") {
        const minutes = Math.max(1, Number(trig.config.minutes) || 60);
        const last = Number(state.lastFire ?? 0);
        // 30s slack so a 5-minute cron reliably fires 5-minute schedules.
        if (Date.now() - last >= minutes * 60_000 - 30_000) {
          state.lastFire = Date.now();
          await store().put("workflows", wf.id, { ...wf, state });
          const run = await runWorkflow({ ...wf, state }, { firedAt: new Date().toISOString(), intervalMinutes: minutes }, "schedule");
          report.fired.push({ workflow: wf.name, source: "schedule", status: run.status });
        }
      } else {
        const items = await fetchFeed(trig.config.feedUrl);
        const seen = new Set((state.seen as string[]) ?? []);
        const first = !state.seen;
        const fresh = items.filter((i) => i.id && !seen.has(i.id));
        const nextSeen = [...items.map((i) => i.id), ...seen].slice(0, 300);
        await store().put("workflows", wf.id, { ...wf, state: { ...state, seen: nextSeen, lastSample: items[0] } });
        // The first poll only records what's already there, so old posts don't flood out.
        if (!first) {
          for (const item of fresh.slice(0, 5).reverse()) {
            const run = await runWorkflow(wf, item, "rss");
            report.fired.push({ workflow: wf.name, source: "rss", status: run.status });
          }
        }
      }
    } catch (e) {
      report.errors.push({ workflow: wf.name, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}
