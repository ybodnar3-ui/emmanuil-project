import { z } from "zod";

/**
 * Validation for one-off tasks (reminders). Server actions parse untrusted
 * FormData through this before the data layer touches the DB.
 *
 * `personId` is optional: a task may be standalone or attached to a person.
 * Empty-string form values are normalized to null so the DB stores absence
 * consistently rather than "".
 */
export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  dueAt: z.coerce.date(),
  personId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
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
