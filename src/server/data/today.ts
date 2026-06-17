import { prisma } from "@/server/db";
import { listOpenTasksDue } from "@/server/data/tasks";
import { getOrCreateReminderPrompt } from "@/server/data/reminders";
import { endOfUtcDay, daysUntilBirthday } from "@/server/today/dates";
import {
  assembleTodayFeed,
  type FeedSources,
  type FeedItem,
} from "@/server/today/feed";

/**
 * Map `items` through async `fn` in sequential batches of `size` (parallel within
 * a batch), preserving input order. A tiny hand-rolled concurrency limiter — no
 * dependency — used to bound simultaneous AI calls when baking contact prompts.
 */
async function mapInBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    out.push(...(await Promise.all(batch.map(fn))));
  }
  return out;
}

/**
 * Read-side for the Today feed. Every query is scoped to the authenticated
 * userId: cadences via the `person` relation (`person: { userId }`), people
 * directly, tasks through the already-scoped `listOpenTasksDue`. Nothing here
 * mutates; the feed is computed live on read (no cache, no cron).
 */

/**
 * Fetch the three raw feed sources for the user as of `now`.
 *
 * - contacts: cadences whose nextDueAt is on/before end of today, for this
 *   user's people (due or overdue).
 * - birthdays: this user's people with a birthday, filtered IN MEMORY to those
 *   within `birthdayWindowDays` (the next-occurrence math is pure + UTC, so it
 *   can't be expressed as a simple SQL range across the year boundary).
 * - tasks: open tasks due on/before today.
 */
export async function getTodayData(
  userId: string,
  now: Date,
  locale: string,
  birthdayWindowDays = 7,
): Promise<FeedSources> {
  const [dueCadences, peopleWithBirthday, dueTasks] = await Promise.all([
    prisma.cadence.findMany({
      where: {
        nextDueAt: { lte: endOfUtcDay(now) },
        person: { userId },
      },
      include: { person: { select: { id: true, fullName: true } } },
      // Bound how many due contacts we process per home load. After a vacation a
      // user could have dozens due at once; each may trigger an AI regeneration,
      // so cap the working set (most-overdue first) instead of fanning out over all.
      orderBy: { nextDueAt: "asc" },
      take: 25,
    }),
    prisma.person.findMany({
      where: { userId, birthday: { not: null } },
      select: { id: true, fullName: true, birthday: true },
    }),
    listOpenTasksDue(userId, now),
  ]);

  // Bake the personalized "what to ask" into each due contact. getOrCreateReminderPrompt
  // is cache-first (a fresh cycle costs no AI call) and never throws — on any AI/data
  // hiccup it returns a warm localized fallback, so a contact ALWAYS carries text.
  //
  // Concurrency is bounded: we process due contacts in small sequential batches
  // (parallel WITHIN a batch) so a worst case (e.g. many cadences regenerating at
  // once after a vacation) can't fire dozens of simultaneous Groq calls. For the
  // common all-cache-hit case behavior is identical (each resolves instantly).
  // trusted: true — ownership is already enforced by the scoped cadence query
  // (person: { userId }), so skip the redundant assertPersonOwned round-trip.
  const contacts: FeedSources["contacts"] = await mapInBatches(
    dueCadences,
    5,
    async (c) => ({
      personId: c.person.id,
      personName: c.person.fullName,
      nextDueAt: c.nextDueAt,
      intervalDays: c.intervalDays,
      prompt: await getOrCreateReminderPrompt(userId, c.person.id, locale, now, {
        trusted: true,
      }),
    }),
  );

  const birthdays: FeedSources["birthdays"] = peopleWithBirthday
    .filter(
      (p) =>
        p.birthday != null &&
        daysUntilBirthday(p.birthday, now) <= birthdayWindowDays,
    )
    .map((p) => ({
      personId: p.id,
      personName: p.fullName,
      birthday: p.birthday as Date,
    }));

  const tasks: FeedSources["tasks"] = dueTasks.map((t) => ({
    taskId: t.id,
    title: t.title,
    personId: t.personId,
    personName: t.person?.fullName ?? null,
    dueAt: t.dueAt,
  }));

  return { contacts, birthdays, tasks };
}

/**
 * Convenience: fetch sources then run the pure assembler into one ordered list.
 * `locale` flows through to the per-contact reminder prompt (the home page reads
 * it from the locale cookie; the cron passes the linked user's own locale).
 */
export async function getTodayFeed(
  userId: string,
  now: Date,
  locale: string,
): Promise<FeedItem[]> {
  const sources = await getTodayData(userId, now, locale);
  return assembleTodayFeed(sources, now);
}
