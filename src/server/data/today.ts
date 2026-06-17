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
  // Parallelized across due contacts so cache hits resolve effectively instantly.
  const contacts: FeedSources["contacts"] = await Promise.all(
    dueCadences.map(async (c) => ({
      personId: c.person.id,
      personName: c.person.fullName,
      nextDueAt: c.nextDueAt,
      intervalDays: c.intervalDays,
      prompt: await getOrCreateReminderPrompt(userId, c.person.id, locale, now),
    })),
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
