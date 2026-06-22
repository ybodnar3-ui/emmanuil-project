"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { logError } from "@/server/log";
import { pushSubscriptionSchema } from "@/server/validation/push";
import { saveSubscription, deleteSubscription } from "@/server/data/push";

/**
 * Settings server actions for Web Push subscriptions. Each calls requireUser()
 * FIRST, then scopes the data mutation by user.id — no client-passed userId is
 * trusted. No-throw/no-leak: failures are logged server-side and a typed
 * { status: "error" } is returned.
 */

type PushActionResult = { status: "ok" } | { status: "error" };

/** Store a browser push subscription for the current user (re-validated server-
 *  side; the client shape is never trusted). No-throw: returns a typed result. */
export async function subscribePushAction(
  raw: unknown,
): Promise<PushActionResult> {
  const user = await requireUser();
  const parsed = pushSubscriptionSchema.safeParse(raw);
  if (!parsed.success) return { status: "error" };
  try {
    await saveSubscription(user.id, parsed.data);
    revalidatePath("/settings");
    return { status: "ok" };
  } catch (err) {
    logError("action.subscribePush", err, { userId: user.id });
    return { status: "error" };
  }
}

/** Remove this device's subscription (scoped to the caller). */
export async function unsubscribePushAction(
  endpoint: string,
): Promise<PushActionResult> {
  const user = await requireUser();
  try {
    await deleteSubscription(user.id, endpoint);
    revalidatePath("/settings");
    return { status: "ok" };
  } catch (err) {
    logError("action.unsubscribePush", err, { userId: user.id });
    return { status: "error" };
  }
}
