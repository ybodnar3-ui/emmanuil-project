/**
 * Pure cadence math — no I/O, fully unit-testable.
 *
 * A Cadence says "I want to stay in touch every N days." Given the last-contacted
 * date (or now), the next due date is simply that date plus the interval.
 */

/** Preset reminder intervals offered in the UI (days). */
export const INTERVAL_PRESETS = [14, 30, 90, 365] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns `from + intervalDays` as a new Date. Throws on non-positive / non-finite
 * intervals so callers never silently produce a due date in the past.
 */
export function computeNextDueAt(from: Date, intervalDays: number): Date {
  if (!Number.isFinite(intervalDays) || intervalDays <= 0) {
    throw new Error("intervalDays must be a positive number");
  }
  return new Date(from.getTime() + intervalDays * MS_PER_DAY);
}
