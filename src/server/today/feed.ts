import { startOfUtcDay, daysUntilBirthday } from "./dates";

/**
 * One actionable row in the Today feed. The three sources (cadence-due contacts,
 * upcoming birthdays, due tasks) are normalized into this discriminated union so
 * the UI renders them uniformly.
 */
export type FeedItem =
  | {
      type: "contact";
      personId: string;
      personName: string;
      reason: "cadence";
      dueAt: Date;
      overdueDays: number;
    }
  | {
      type: "birthday";
      personId: string;
      personName: string;
      birthday: Date;
      inDays: number;
    }
  | {
      type: "task";
      taskId: string;
      title: string;
      personId: string | null;
      personName: string | null;
      dueAt: Date;
      overdueDays: number;
    };

/** Raw, already-scoped rows from the data layer, keyed by source. */
export type FeedSources = {
  contacts: {
    personId: string;
    personName: string;
    nextDueAt: Date;
    intervalDays: number;
  }[];
  birthdays: { personId: string; personName: string; birthday: Date }[];
  tasks: {
    taskId: string;
    title: string;
    personId: string | null;
    personName: string | null;
    dueAt: Date;
  }[];
};

/** Whole UTC days `dueAt` is before today's start; 0 if due today (or future). */
function overdueDays(dueAt: Date, now: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const diff = startOfUtcDay(now).getTime() - startOfUtcDay(dueAt).getTime();
  return diff > 0 ? Math.round(diff / MS_PER_DAY) : 0;
}

/**
 * Pure: merge the three sources into a single ordered list. No I/O.
 *
 * Sort key (deterministic): each item gets a numeric `rank` = days-from-today,
 * negative for overdue. Most-overdue first (smallest rank). For ties, contacts
 * and tasks (the "act now" items) sort before birthdays, then by name/title so
 * the order is stable across reads.
 *
 *   contact / task → rank = -overdueDays (0 when due today)
 *   birthday       → rank = inDays (0 today, positive upcoming)
 *
 * Result: most-overdue contacts/tasks, then today's items (due contacts/tasks
 * at rank 0 ahead of today's birthdays via the type tie-break), then upcoming
 * birthdays in ascending day order.
 */
export function assembleTodayFeed(sources: FeedSources, now: Date): FeedItem[] {
  const items: { item: FeedItem; rank: number }[] = [];

  for (const c of sources.contacts) {
    const od = overdueDays(c.nextDueAt, now);
    items.push({
      rank: -od,
      item: {
        type: "contact",
        personId: c.personId,
        personName: c.personName,
        reason: "cadence",
        dueAt: c.nextDueAt,
        overdueDays: od,
      },
    });
  }

  for (const t of sources.tasks) {
    const od = overdueDays(t.dueAt, now);
    items.push({
      rank: -od,
      item: {
        type: "task",
        taskId: t.taskId,
        title: t.title,
        personId: t.personId,
        personName: t.personName,
        dueAt: t.dueAt,
        overdueDays: od,
      },
    });
  }

  for (const b of sources.birthdays) {
    const inDays = daysUntilBirthday(b.birthday, now);
    items.push({
      rank: inDays,
      item: {
        type: "birthday",
        personId: b.personId,
        personName: b.personName,
        birthday: b.birthday,
        inDays,
      },
    });
  }

  // Tie-break order: contacts/tasks before birthdays at the same rank, then by
  // a stable label so equal-rank rows don't reorder between reads.
  const typeWeight = (i: FeedItem) => (i.type === "birthday" ? 1 : 0);
  const label = (i: FeedItem) =>
    i.type === "task" ? i.title : i.personName;

  items.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const tw = typeWeight(a.item) - typeWeight(b.item);
    if (tw !== 0) return tw;
    return label(a.item).localeCompare(label(b.item));
  });

  return items.map((entry) => entry.item);
}
