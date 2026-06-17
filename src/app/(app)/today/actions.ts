"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { markContacted, snoozeCadence } from "@/server/data/cadenceActions";
import { completeTask, snoozeTask } from "@/server/data/tasks";
import { logError } from "@/server/log";

/**
 * Server actions for the home feed items. Each one calls requireUser() FIRST,
 * then passes user.id into a scoped data function — no action trusts a
 * client-passed userId. Mutations revalidate "/" (the feed) and, where a person
 * is involved, "/people/[id]". Action results are typed; data failures degrade
 * to a stable code rather than throwing a 500 to the client.
 *
 * Reminder creation lives on the person card (people/actions.ts#createReminderAction);
 * the personalized "what to ask" is now baked into each contact at feed-build
 * time (server/data/reminders.ts), so there is no on-demand suggestion action here.
 */

export type ActionResult =
  | { status: "ok" }
  | { status: "error"; message: string };

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
  try {
    // The underlying updateMany is no-op-safe, but wrapping aligns the contract
    // with the other actions and adds logging if the call itself fails.
    await completeTask(user.id, taskId);
  } catch (err) {
    logError("action.completeTask", err, { userId: user.id, taskId });
    return { status: "error" as const, message: "NOT_FOUND" };
  }
  revalidatePath("/");
  return { status: "ok" };
}

export async function snoozeTaskAction(
  taskId: string,
  days: number,
): Promise<ActionResult> {
  const user = await requireUser();
  try {
    await snoozeTask(user.id, taskId, days, new Date());
  } catch (err) {
    logError("action.snoozeTask", err, { userId: user.id, taskId });
    return { status: "error" as const, message: "NOT_FOUND" };
  }
  revalidatePath("/");
  return { status: "ok" };
}
