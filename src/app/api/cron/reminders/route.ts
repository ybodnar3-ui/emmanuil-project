import { getTranslations } from "next-intl/server";
import {
  listPushTargets,
  deleteSubscriptionByEndpoint,
} from "@/server/data/push";
import { getTodayFeed } from "@/server/data/today";
import { pushConfigured, sendPush } from "@/server/push/send";
import { formatPushPayload } from "@/server/push/format";
import { normalizeLocale } from "@/i18n/locale";
import { logError } from "@/server/log";

// web-push uses Node crypto — pin the Node.js runtime (not Edge).
export const runtime = "nodejs";

/**
 * Daily reminder cron. Vercel hits this on a schedule (see vercel.json) with
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 *  - Verifies the bearer matches CRON_SECRET (401 otherwise).
 *  - No VAPID keys → 200 { skipped: "no vapid" } no-op.
 *  - Per-user isolation: each target's OWN Today feed + OWN locale. Sends the
 *    personalized payload to every device subscription; a "gone" endpoint is
 *    pruned. A failure for one target is logged and never aborts the rest.
 *  - Never throws to the caller; returns { sent, skipped, failed, pruned }.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret) {
    logError(
      "cron.reminders",
      new Error("CRON_SECRET is not set — cron will reject all requests"),
    );
    return new Response("unauthorized", { status: 401 });
  }
  if (auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  if (!pushConfigured()) {
    return Response.json({ skipped: "no vapid" });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let pruned = 0;

  try {
    const targets = await listPushTargets();
    const now = new Date();

    for (const target of targets) {
      try {
        const locale = normalizeLocale(target.locale);
        const feed = await getTodayFeed(target.userId, now, locale);
        const t = await getTranslations({ locale, namespace: "reminder" });
        const payload = formatPushPayload(feed, {
          header: t("header"),
          contacts: t("contacts"),
          birthdays: t("birthdays"),
          tasks: t("tasks"),
          keyDate: t("keyDate", { name: "{name}", label: "{label}", when: "{when}" }),
          keyDateToday: t("keyDateToday"),
          keyDateInDays: t("keyDateInDays", { n: "{n}" }),
        });
        if (!payload) {
          skipped++;
          continue;
        }
        for (const subscription of target.subscriptions) {
          const result = await sendPush(subscription, payload);
          if (result === "ok") sent++;
          else if (result === "gone") {
            pruned++;
            await deleteSubscriptionByEndpoint(subscription.endpoint);
          } else {
            failed++;
          }
        }
      } catch (err) {
        failed++;
        logError("cron.reminders.user", err, { userId: target.userId });
      }
    }
  } catch (err) {
    logError("cron.reminders", err);
  }

  return Response.json({ sent, skipped, failed, pruned });
}
