import type { z } from "zod";

/**
 * Map a ZodError into our flat fieldErrors shape (first issue per field). Values
 * are BARE, `people`-namespace-relative keys (e.g. "errors.invalid") because the
 * forms render them with a namespace-scoped translator — useTranslations("people").
 * A full path like "people.errors.invalid" would be re-prefixed by that scoped
 * translator to "people.people.errors.invalid" and fail to resolve, leaking the
 * raw key string to the user.
 *
 * Kept in its own (non-"use server") module so it can be unit-tested directly and
 * imported by the People server actions without violating the "Server Actions
 * must be async" constraint.
 */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key] = "errors.invalid";
    }
  }
  return out;
}
