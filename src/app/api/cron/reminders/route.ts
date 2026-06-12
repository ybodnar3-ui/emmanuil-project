import { getTranslations } from "next-intl/server";
import { listLinkedUsers } from "@/server/data/telegram";
import { getTodayFeed } from "@/server/data/today";
import {
  telegramConfigured,
  sendTelegramMessage,
} from "@/server/telegram/client";
import { formatReminderMessage } from "@/server/telegram/format";
import { normalizeLocale } from "@/i18n/locale";
import { logError } from "@/server/log";

/**
 * Daily reminder cron. Vercel hits this on a schedule (see vercel.json) with
 * `Authorization: Bearer <CRON_SECRET>`.
 *
 * Security + robustness:
 *  - Verifies the bearer matches CRON_SECRET (401 otherwise) — the only guard
 *    on this otherwise-public route.
 *  - No bot token → 200 { skipped } no-op.
 *  - Per-user isolation: each linked user's OWN Today feed (getTodayFeed(user.id))
 *    and OWN locale. Empty feed → skip (formatter returns null). A failure for
 *    one user is logged and does NOT abort the others.
 *  - Never throws to the caller; returns { sent, skipped, failed } counts.
 */

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  if (!telegramConfigured()) {
    return Response.json({ skipped: "no token" });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const users = await listLinkedUsers();
    const now = new Date();

    for (const user of users) {
      if (!user.telegramChatId) {
        skipped++;
        continue;
      }
      try {
        const feed = await getTodayFeed(user.id, now);
        const locale = normalizeLocale(user.locale);
        const t = await getTranslations({ locale, namespace: "reminder" });
        const message = formatReminderMessage(feed, {
          header: t("header"),
          contacts: t("contacts"),
          birthdays: t("birthdays"),
          tasks: t("tasks"),
        });
        if (!message) {
          skipped++;
          continue;
        }
        const ok = await sendTelegramMessage(user.telegramChatId, message);
        if (ok) sent++;
        else failed++;
      } catch (err) {
        // Per-user failure: log (no secrets) and continue with the rest.
        failed++;
        logError("cron.reminders.user", err, { userId: user.id });
      }
    }
  } catch (err) {
    // Top-level failure (e.g. the user query). Log and return 200 with counts;
    // never throw to the cron caller.
    logError("cron.reminders", err);
  }

  return Response.json({ sent, skipped, failed });
}
