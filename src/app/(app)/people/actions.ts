"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { fieldErrorsFromZod } from "./field-errors";
import {
  createPerson,
  updatePerson,
  deletePerson,
  updatePersonPhoto,
  getPerson,
} from "@/server/data/people";
import { generateBrief, type BriefResult } from "@/server/ai/brief";
import { getLocaleFromCookie } from "@/i18n/locale";
import { addFact, deleteFact } from "@/server/data/facts";
import { addKeyDate, deleteKeyDate } from "@/server/data/keydates";
import { keyDateInputSchema } from "@/server/validation/keydate";
import { logInteraction } from "@/server/data/interactions";
import { setCadence, clearCadence } from "@/server/data/cadence";
import { createTask } from "@/server/data/tasks";
import {
  personInputSchema,
  factInputSchema,
  interactionInputSchema,
  cadenceInputSchema,
} from "@/server/validation/person";
import { taskInputSchema } from "@/server/validation/task";
import { ensureAvatarsBucket, uploadAvatar } from "@/server/storage";
import { logError } from "@/server/log";

/**
 * Shared form-action result. `ok` is the happy path; `error` carries an optional
 * top-level message plus per-field messages for inline display. All copy keys are
 * resolved client-side via next-intl — `message`/`fieldErrors` hold i18n keys, not
 * user-facing English.
 */
export type FormState =
  | { status: "idle" }
  | { status: "ok" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Record<string, string>;
    };

/** Parse the comma-separated tags input into a trimmed, de-duped string[]. */
function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

function personInputFromForm(formData: FormData) {
  return personInputSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    howWeMet: formData.get("howWeMet") ?? "",
    location: formData.get("location") ?? "",
    birthday: formData.get("birthday") || null,
    tags: parseTags(formData.get("tags")),
    relationshipTier: formData.get("relationshipTier") || null,
  });
}

/** Upload an optional avatar; failures are non-fatal and reported via fieldErrors. */
async function maybeUploadPhoto(
  userId: string,
  file: FormDataEntryValue | null,
): Promise<{ photoUrl?: string; photoError?: boolean }> {
  if (!(file instanceof File) || file.size === 0) return {};
  try {
    await ensureAvatarsBucket();
    const photoUrl = await uploadAvatar(userId, file);
    return { photoUrl };
  } catch (err) {
    logError("action.photoUpload", err, { userId });
    return { photoError: true };
  }
}

export async function createPersonAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = personInputFromForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  // Commit the row first. From here the person ALWAYS exists, so every exit path
  // redirects to the card — never back to the empty /new form (which would let a
  // resubmit create a duplicate). A failed photo upload is surfaced non-fatally
  // via ?photoError=1 rather than blocking the save.
  let person: Awaited<ReturnType<typeof createPerson>>;
  try {
    person = await createPerson(user.id, parsed.data);
  } catch (err) {
    logError("action.createPerson", err, { userId: user.id });
    return { status: "error", message: "people.errors.saveFailed" };
  }

  const { photoUrl, photoError } = await maybeUploadPhoto(
    user.id,
    formData.get("photo"),
  );
  if (photoUrl) await updatePersonPhoto(user.id, person.id, photoUrl);

  revalidatePath("/people");
  redirect(`/people/${person.id}${photoError ? "?photoError=1" : ""}`);
}

export async function updatePersonAction(
  personId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = personInputFromForm(formData);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  // Save the edits first, then upload. A failed photo upload never blocks the
  // save: we redirect to the card with ?photoError=1 for a non-fatal notice.
  try {
    await updatePerson(user.id, personId, parsed.data);
  } catch (err) {
    logError("action.updatePerson", err, { userId: user.id, personId });
    return { status: "error", message: "people.errors.saveFailed" };
  }

  const { photoUrl, photoError } = await maybeUploadPhoto(
    user.id,
    formData.get("photo"),
  );
  if (photoUrl) await updatePersonPhoto(user.id, personId, photoUrl);

  revalidatePath(`/people/${personId}`);
  revalidatePath("/people");
  redirect(`/people/${personId}${photoError ? "?photoError=1" : ""}`);
}

export async function deletePersonAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const personId = String(formData.get("personId") ?? "");
  if (personId) {
    try {
      await deletePerson(user.id, personId);
    } catch (err) {
      // Idempotent: a stale/already-deleted id is treated as success. Log it,
      // then fall through to the same revalidate + redirect.
      logError("action.deletePerson", err, { userId: user.id, personId });
    }
  }
  revalidatePath("/people");
  redirect("/people");
}

export async function addFactAction(
  personId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = factInputSchema.safeParse({
    category: formData.get("category"),
    content: formData.get("content") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  try {
    await addFact(user.id, personId, parsed.data);
  } catch (err) {
    logError("action.addFact", err, { userId: user.id, personId });
    return { status: "error", message: "people.errors.notFound" };
  }
  revalidatePath(`/people/${personId}`);
  return { status: "ok" };
}

export async function deleteFactAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const factId = String(formData.get("factId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  if (factId) await deleteFact(user.id, factId);
  if (personId) revalidatePath(`/people/${personId}`);
}

export async function addKeyDateAction(
  personId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = keyDateInputSchema.safeParse({
    label: formData.get("label") ?? "",
    date: formData.get("date") || undefined,
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  try {
    await addKeyDate(user.id, personId, parsed.data);
  } catch (err) {
    logError("action.addKeyDate", err, { userId: user.id, personId });
    return { status: "error", message: "people.errors.notFound" };
  }
  revalidatePath(`/people/${personId}`);
  return { status: "ok" };
}

export async function deleteKeyDateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const keyDateId = String(formData.get("keyDateId") ?? "");
  const personId = String(formData.get("personId") ?? "");
  if (keyDateId) {
    try {
      await deleteKeyDate(user.id, keyDateId);
    } catch (err) {
      // Not idempotent at the data layer (deleteKeyDate throws on a missing/
      // not-owned id); the action treats both as non-fatal — it logs and still
      // revalidates, so a stale id is a no-op from the user's perspective.
      logError("action.deleteKeyDate", err, { userId: user.id, keyDateId });
    }
  }
  if (personId) revalidatePath(`/people/${personId}`);
}

export async function logInteractionAction(
  personId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = interactionInputSchema.safeParse({
    date: formData.get("date") || undefined,
    channel: formData.get("channel") || null,
    summary: formData.get("summary") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  try {
    await logInteraction(user.id, personId, parsed.data);
  } catch (err) {
    logError("action.logInteraction", err, { userId: user.id, personId });
    return { status: "error", message: "people.errors.notFound" };
  }
  revalidatePath(`/people/${personId}`);
  return { status: "ok" };
}

export async function setCadenceAction(
  personId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = cadenceInputSchema.safeParse({
    intervalDays: formData.get("intervalDays"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  try {
    await setCadence(user.id, personId, parsed.data.intervalDays);
  } catch (err) {
    logError("action.setCadence", err, { userId: user.id, personId });
    return { status: "error", message: "people.errors.notFound" };
  }
  revalidatePath(`/people/${personId}`);
  return { status: "ok" };
}

/**
 * Generate the on-demand AI brief for a person. Auth + ownership are enforced:
 * requireUser() then getPerson(user.id, …) — the brief is built only from a
 * person the caller owns. Never throws to the client; generateBrief returns a
 * stable BriefResult error code on failure, which the UI maps to a localized
 * message. The brief is not persisted in this phase.
 */
export async function generateBriefAction(
  personId: string,
): Promise<BriefResult> {
  const user = await requireUser();
  const person = await getPerson(user.id, personId); // ownership-scoped
  if (!person) return { status: "error", message: "NOT_FOUND" };
  const locale = await getLocaleFromCookie();
  return generateBrief(person, locale);
}

/**
 * Create a one-off reminder anchored to THIS person. Reminders are always
 * person-tied now (no generic add-task), so personId comes bound from the card,
 * never picked client-side. requireUser() → zod-validate (taskInputSchema, which
 * requires personId) → createTask (asserts ownership of the person before the
 * write). Field errors are returned as bare `reminder`-relative keys for the
 * form's useTranslations("people") translator (people.reminder.errors.*).
 */
export async function createReminderAction(
  personId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = taskInputSchema.safeParse({
    title: formData.get("title") ?? "",
    dueAt: formData.get("dueAt") || "",
    personId,
    note: formData.get("note") || null,
  });
  if (!parsed.success) {
    // Map zod issues to the reminder form's namespace-relative keys. personId is
    // bound (not user-editable), so a personId issue still surfaces generically.
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key] = "reminder.errors.invalid";
      }
    }
    return { status: "error", fieldErrors };
  }
  try {
    await createTask(user.id, parsed.data);
  } catch (err) {
    logError("action.createReminder", err, { userId: user.id, personId });
    return { status: "error", message: "people.reminder.errors.notFound" };
  }
  // The reminder shows on the home feed (its person is due as a follow-up).
  revalidatePath("/");
  revalidatePath(`/people/${personId}`);
  return { status: "ok" };
}

export async function clearCadenceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const personId = String(formData.get("personId") ?? "");
  if (personId) {
    try {
      await clearCadence(user.id, personId);
    } catch (err) {
      // Idempotent: clearing a cadence that's already gone is a no-op success.
      logError("action.clearCadence", err, { userId: user.id, personId });
    }
    revalidatePath(`/people/${personId}`);
  }
}
