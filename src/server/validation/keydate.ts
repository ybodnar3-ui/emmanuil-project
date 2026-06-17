import { z } from "zod";

/**
 * A key date is a free-text `label` (e.g. "son's birthday", "anniversary") plus a
 * calendar `date`. Recurrence is annual by month/day — the stored year is for
 * age/context only and is ignored when computing "upcoming" (see daysUntilBirthday).
 *
 * `date` uses z.coerce.date() so both an ISO string (from the assistant, or a date
 * input) and a Date coerce/validate uniformly; an unparseable value fails the parse
 * (and is skipped, never persisted, on the assistant path).
 */
export const keyDateInputSchema = z.object({
  label: z.string().trim().min(1).max(200),
  date: z.coerce.date(),
});

export type KeyDateInput = z.infer<typeof keyDateInputSchema>;
