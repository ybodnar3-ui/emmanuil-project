"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getLocaleFromCookie } from "@/i18n/locale";
import { getPerson } from "@/server/data/people";
import { markContacted, snoozeCadence } from "@/server/data/cadenceActions";
import {
  createTask,
  completeTask,
  snoozeTask,
} from "@/server/data/tasks";
import { taskInputSchema } from "@/server/validation/task";
import { suggestTalkingPoint, type SuggestResult } from "@/server/ai/suggest";
import { logError } from "@/server/log";

/**
 * Server actions for the Today feed. Each one calls requireUser() FIRST, then
 * passes user.id into a scoped data function — no action trusts a client-passed
 * userId. Mutations revalidate "/" (the feed) and, where a person is involved,
 * "/people/[id]". Action results are typed; AI/data failures degrade to a stable
 * code rather than throwing a 500 to the client.
 */

export type ActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export type CreateTaskState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "error"; fieldErrors?: Record<string, string>; message?: string };

/** Map a ZodError into the flat fieldErrors shape the form renders inline. */
function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key] = "tasks.errors.invalid";
    }
  }
  return out;
}

export async function markContactedAction(
  personId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    // Throws if the person was deleted between render and this click.
    await markContacted(user.id, personId, new Date());
  } catch (err) {
    logError("action.markContacted", err, { userId: user.id, personId });
    return { status: "error" as const, message: "NOT_FOUND" };
  }
  revalidatePath("/");
  revalidatePath(`/people/${personId}`);
  return { status: "ok" };
}

export async function snoozeContactAction(
  personId: string,
  days: number,
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    // Throws if the person was deleted between render and this click.
    await snoozeCadence(user.id, personId, days, new Date());
  } catch (err) {
    logError("action.snoozeContact", err, { userId: user.id, personId });
    return { status: "error" as const, message: "NOT_FOUND" };
  }
  revalidatePath("/");
  revalidatePath(`/people/${personId}`);
  return { status: "ok" };
}

export async function completeTaskAction(
  taskId: string,
): Promise<ActionResult> {
  const user = await requireUser();
  await completeTask(user.id, taskId);
  revalidatePath("/");
  return { status: "ok" };
}

export async function snoozeTaskAction(
  taskId: string,
  days: number,
): Promise<ActionResult> {
  const user = await requireUser();
  await snoozeTask(user.id, taskId, days, new Date());
  revalidatePath("/");
  return { status: "ok" };
}

export async function createTaskAction(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const user = await requireUser();
  const parsed = taskInputSchema.safeParse({
    title: formData.get("title") ?? "",
    dueAt: formData.get("dueAt") || "",
    personId: formData.get("personId") || null,
    note: formData.get("note") || null,
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  // createTask asserts ownership of personId (if set) before writing; it throws
  // if the selected person was deleted between render and submit.
  try {
    await createTask(user.id, parsed.data);
  } catch (err) {
    logError("action.createTask", err, { userId: user.id });
    return { status: "error", fieldErrors: { personId: "NOT_FOUND" } };
  }
  revalidatePath("/");
  return { status: "ok" };
}

/**
 * On-demand AI suggestion. Auth + ownership enforced: requireUser() then
 * getPerson(user.id, …) — the suggestion is built only from a person the caller
 * owns. Never throws to the client; suggestTalkingPoint returns a stable error
 * code on failure, which the UI maps to a localized message.
 */
export async function suggestTalkingPointAction(
  personId: string,
  occasion: string,
): Promise<SuggestResult> {
  const user = await requireUser();
  const person = await getPerson(user.id, personId); // ownership-scoped
  if (!person) return { status: "error", message: "NOT_FOUND" };
  const locale = await getLocaleFromCookie();
  return suggestTalkingPoint(person, occasion, locale);
}
