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
  /** "+N more" line appended when items are dropped to stay under the length cap.
   *  Caller passes a localized template with an `{n}` placeholder (resolved here). */
  more: string;
};

/**
 * Telegram rejects messages over 4096 chars (the send silently fails). Cap the
 * built message well under that so HTML entities / multi-byte names never push us
 * over: we stop adding items once the running length would exceed this budget and
 * append a localized "+N more" line for the remainder.
 */
const MAX_MESSAGE_CHARS = 3900;

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

  // Running budget: track length as we go and stop adding items (across all
  // sections) once the next item would push the message over MAX_MESSAGE_CHARS.
  // `dropped` counts the feed items we never rendered so we can append "+N more".
  // joinedLength accounts for the "\n" join between lines.
  let dropped = 0;
  const joinedLength = (ls: string[]) =>
    ls.reduce((n, l) => n + l.length, 0) + Math.max(0, ls.length - 1);

  /** Try to add `block` (the lines for one item). Returns false if it wouldn't fit. */
  const tryAdd = (block: string[]): boolean => {
    const next = [...lines, ...block];
    if (joinedLength(next) > MAX_MESSAGE_CHARS) return false;
    lines.push(...block);
    return true;
  };

  if (contacts.length > 0) {
    lines.push("", `<b>${escapeHtml(labels.contacts)}</b>`);
    for (const c of contacts) {
      // Each due contact carries its personalized "what to ask" (baked in per
      // cadence cycle). Escape BOTH the name and the prompt — both are derived
      // from user-controlled data and the message is sent as parse_mode HTML.
      const block = [`• <b>${escapeHtml(c.personName)}</b>`];
      if (c.type === "contact" && c.prompt) {
        block.push(`  ${escapeHtml(c.prompt)}`);
      }
      if (!tryAdd(block)) dropped++;
    }
  }

  if (birthdays.length > 0) {
    lines.push("", `<b>${escapeHtml(labels.birthdays)}</b>`);
    for (const b of birthdays) {
      if (!tryAdd([`• ${escapeHtml(b.personName)}`])) dropped++;
    }
  }

  if (tasks.length > 0) {
    lines.push("", `<b>${escapeHtml(labels.tasks)}</b>`);
    for (const t of tasks) {
      const who = t.personName ? ` — ${escapeHtml(t.personName)}` : "";
      if (!tryAdd([`• ${escapeHtml(t.title)}${who}`])) dropped++;
    }
  }

  if (dropped > 0) {
    // The caller supplies a localized template with an `{n}` placeholder. The
    // text is trusted (from our own message catalog), but escape it anyway for
    // consistency, then substitute the (numeric, safe) count.
    const moreLine = escapeHtml(labels.more).replace("{n}", String(dropped));
    lines.push("", moreLine);
  }

  return lines.join("\n");
}
