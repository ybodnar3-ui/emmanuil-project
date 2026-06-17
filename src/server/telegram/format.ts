import type { FeedItem } from "@/server/today/feed";

/**
 * Localized labels for the reminder message. The caller resolves these from
 * next-intl (the cron picks them per the linked user's locale) and passes them
 * in, so this module stays pure: no next-intl import, no I/O, no Date.now.
 */
export type ReminderLabels = {
  header: string;
  contacts: string;
  birthdays: string;
  tasks: string;
};

/**
 * Escape the five HTML-significant characters. The message is sent with
 * parse_mode "HTML", so any user-controlled text (person names, task titles)
 * MUST be escaped or a name like `<b>x</b>` would inject markup / break parsing.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Turn a Today feed into a Telegram HTML message, grouped by source type with
 * localized section headers. Returns null for an empty feed so the caller skips
 * sending entirely (Telegram rejects empty messages, and we don't want to ping
 * a user with nothing to do).
 *
 * Pure: ordering is taken as-is from `feed` (already sorted by the assembler);
 * no clock, no network. Bullet glyphs are plain text, safe under parse_mode HTML.
 */
export function formatReminderMessage(
  feed: FeedItem[],
  labels: ReminderLabels,
): string | null {
  if (feed.length === 0) return null;

  const contacts = feed.filter((i) => i.type === "contact");
  const birthdays = feed.filter((i) => i.type === "birthday");
  const tasks = feed.filter((i) => i.type === "task");

  const lines: string[] = [`<b>${escapeHtml(labels.header)}</b>`];

  if (contacts.length > 0) {
    lines.push("", `<b>${escapeHtml(labels.contacts)}</b>`);
    for (const c of contacts) {
      // Each due contact carries its personalized "what to ask" (baked in per
      // cadence cycle). Escape BOTH the name and the prompt — both are derived
      // from user-controlled data and the message is sent as parse_mode HTML.
      lines.push(`• <b>${escapeHtml(c.personName)}</b>`);
      if (c.type === "contact" && c.prompt) {
        lines.push(`  ${escapeHtml(c.prompt)}`);
      }
    }
  }

  if (birthdays.length > 0) {
    lines.push("", `<b>${escapeHtml(labels.birthdays)}</b>`);
    for (const b of birthdays) {
      lines.push(`• ${escapeHtml(b.personName)}`);
    }
  }

  if (tasks.length > 0) {
    lines.push("", `<b>${escapeHtml(labels.tasks)}</b>`);
    for (const t of tasks) {
      const who = t.personName ? ` — ${escapeHtml(t.personName)}` : "";
      lines.push(`• ${escapeHtml(t.title)}${who}`);
    }
  }

  return lines.join("\n");
}
