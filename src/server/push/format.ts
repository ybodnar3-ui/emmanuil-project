import type { FeedItem } from "@/server/today/feed";
import type { PushPayload } from "./send";

/**
 * Localized labels for the push body. Resolved by the caller from next-intl
 * (the cron picks them per the user's locale) and passed in, so this module
 * stays pure: no next-intl import, no I/O, no Date.now. Reuses the `reminder.*`
 * message keys (the same content the Telegram channel used).
 */
export type PushLabels = {
  header: string;
  contacts: string;
  birthdays: string;
  tasks: string;
  /** Greeting template with `{name}` / `{label}` / `{when}` placeholders. */
  keyDate: string;
  /** `{when}` when the key date is today. */
  keyDateToday: string;
  /** `{when}` template for an upcoming key date, with a literal `{n}` count. */
  keyDateInDays: string;
};

/** A notification body should be short. Cap the lines so the OS doesn't truncate
 *  mid-word; the tap opens the app for the full feed. */
const MAX_LINES = 6;

/**
 * Turn a Today feed into a push payload. Returns null for an empty feed so the
 * caller skips sending. Plain text (the OS renders the body as text — no HTML,
 * no escaping needed). Ordering is taken as-is from `feed` (already sorted by
 * the assembler).
 */
export function formatPushPayload(
  feed: FeedItem[],
  labels: PushLabels,
): PushPayload | null {
  if (feed.length === 0) return null;

  const lines: string[] = [];
  for (const item of feed) {
    if (lines.length >= MAX_LINES) break;
    if (item.type === "contact") {
      lines.push(item.prompt ? `${item.personName}: ${item.prompt}` : item.personName);
    } else if (item.type === "birthday") {
      lines.push(item.personName);
    } else if (item.type === "keydate") {
      const when =
        item.inDays === 0
          ? labels.keyDateToday
          : labels.keyDateInDays.replace("{n}", String(item.inDays));
      lines.push(
        labels.keyDate
          .replace("{name}", item.personName)
          .replace("{label}", item.label)
          .replace("{when}", when),
      );
    } else {
      // task
      const who = item.personName ? ` — ${item.personName}` : "";
      lines.push(`${item.title}${who}`);
    }
  }

  const remaining = feed.length - lines.length;
  if (remaining > 0) lines.push(`+${remaining}`);

  return { title: labels.header, body: lines.join("\n"), url: "/" };
}
