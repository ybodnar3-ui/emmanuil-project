"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import {
  createPerson,
  updatePerson,
  deletePerson,
  updatePersonPhoto,
} from "@/server/data/people";
import { addFact, deleteFact } from "@/server/data/facts";
import { logInteraction } from "@/server/data/interactions";
import { setCadence, clearCadence } from "@/server/data/cadence";
import {
  personInputSchema,
  factInputSchema,
  interactionInputSchema,
  cadenceInputSchema,
} from "@/server/validation/person";
import { ensureAvatarsBucket, uploadAvatar } from "@/server/storage";

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

/** Map a ZodError into our flat fieldErrors shape (first issue per field). */
function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key] = "people.errors.invalid";
    }
  }
  return out;
}

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
  } catch {
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

  const person = await createPerson(user.id, parsed.data);

  const { photoUrl, photoError } = await maybeUploadPhoto(
    user.id,
    formData.get("photo"),
  );
  if (photoUrl) await updatePersonPhoto(user.id, person.id, photoUrl);

  revalidatePath("/people");
  if (photoError) {
    return { status: "error", fieldErrors: { photo: "people.errors.photo" } };
  }
  redirect(`/people/${person.id}`);
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

  await updatePerson(user.id, personId, parsed.data);

  const { photoUrl, photoError } = await maybeUploadPhoto(
    user.id,
    formData.get("photo"),
  );
  if (photoUrl) await updatePersonPhoto(user.id, personId, photoUrl);

  revalidatePath(`/people/${personId}`);
  revalidatePath("/people");
  if (photoError) {
    return { status: "error", fieldErrors: { photo: "people.errors.photo" } };
  }
  redirect(`/people/${personId}`);
}

export async function deletePersonAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const personId = String(formData.get("personId") ?? "");
  if (personId) {
    await deletePerson(user.id, personId);
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
  await addFact(user.id, personId, parsed.data);
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
  await logInteraction(user.id, personId, parsed.data);
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
  await setCadence(user.id, personId, parsed.data.intervalDays);
  revalidatePath(`/people/${personId}`);
  return { status: "ok" };
}

export async function clearCadenceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const personId = String(formData.get("personId") ?? "");
  if (personId) {
    await clearCadence(user.id, personId);
    revalidatePath(`/people/${personId}`);
  }
}
