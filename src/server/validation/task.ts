import { z } from "zod";

/**
 * Validation for one-off reminders. Server actions parse untrusted FormData
 * through this before the data layer touches the DB.
 *
 * `personId` is REQUIRED: reminders are always anchored to a person (created
 * from that person's card). The empty-string note is normalized to null so the
 * DB stores absence consistently rather than "".
 */
export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  dueAt: z.coerce.date(),
  personId: z.string().trim().min(1),
  note: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});
export type TaskInput = z.infer<typeof taskInputSchema>;
