/**
 * Pure UTC date helpers for the Today feed — no I/O, fully unit-testable.
 *
 * The whole app pins date logic to UTC (Phase 3 convention): a `birthday` or a
 * cadence `nextDueAt` is a calendar fact, not a wall-clock instant, so every
 * "is it today / how many days" question is answered against UTC day boundaries.
 * Doing the math in local time would shift answers by ±1 day for users east/west
 * of UTC, which is why these helpers never touch the local timezone.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 00:00:00.000Z of `d`'s UTC calendar date. Does not mutate `d`. */
export function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

/** 23:59:59.999Z of `d`'s UTC calendar date. Does not mutate `d`. */
export function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

/** `from + days` as a new Date (UTC ms arithmetic). Negative days subtract. */
export function addUtcDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

/**
 * True iff a cadence's `nextDueAt` falls on or before the end of `now`'s UTC
 * day — i.e. it is due today or overdue. Comparing against the END of the day
 * (not the instant `now`) means an item dated 09:00 today still counts as due
 * when the feed is read at 08:00.
 */
export function isCadenceDue(nextDueAt: Date, now: Date): boolean {
  return nextDueAt.getTime() <= endOfUtcDay(now).getTime();
}

/**
 * Whole UTC days until the next occurrence of a birthday's month/day, ignoring
 * the year. 0 means the birthday is today. The result is always >= 0 (a date
 * that already passed this year rolls over to next year).
 *
 * Feb 29 birthdays: in a non-leap target year there is no Feb 29, so the next
 * occurrence is normalized to Mar 1 (via Date.UTC overflow). In a leap year the
 * real Feb 29 is used.
 */
export function daysUntilBirthday(birthday: Date, now: Date): number {
  const todayStart = startOfUtcDay(now);
  const year = todayStart.getUTCFullYear();
  const month = birthday.getUTCMonth();
  const day = birthday.getUTCDate();

  // Date.UTC normalizes Feb 29 in a common year to Mar 1 automatically.
  let next = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  if (next.getTime() < todayStart.getTime()) {
    next = new Date(Date.UTC(year + 1, month, day, 0, 0, 0, 0));
  }
  return Math.round((next.getTime() - todayStart.getTime()) / MS_PER_DAY);
}
