"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { setLinkCode, unlinkTelegram } from "@/server/data/telegram";
import { telegramConfigured } from "@/server/telegram/client";
import { logError } from "@/server/log";
import { pushSubscriptionSchema } from "@/server/validation/push";
import { saveSubscription, deleteSubscription } from "@/server/data/push";

/**
 * Settings server actions for Telegram linking. Each calls requireUser() FIRST,
 * then scopes the data mutation by user.id — no client-passed userId is trusted.
 *
 * connectTelegramAction mints a crypto-random one-time code (randomness lives
 * here, in server runtime, NOT in any unit-tested pure fn) and returns a
 * t.me/<bot>?start=<code> deep link. When the bot isn't configured (no token or
 * no public username) it returns a stable "telegram.notConfigured" code the UI
 * localizes — it never throws and never leaks the token.
 */

export type ConnectResult =
  | { status: "ok"; url: string }
  | { status: "error"; message: string };

export type DisconnectResult =
  | { status: "ok" }
  | { status: "error"; message: string };

export async function connectTelegramAction(): Promise<ConnectResult> {
  const user = await requireUser();

  const username = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  if (!telegramConfigured() || !username) {
    return { status: "error", message: "telegram.notConfigured" };
  }

  try {
    const code = randomBytes(16).toString("hex");
    await setLinkCode(user.id, code);
    return {
      status: "ok",
      url: `https://t.me/${username}?start=${code}`,
    };
  } catch (err) {
    logError("action.connectTelegram", err, { userId: user.id });
    return { status: "error", message: "telegram.error" };
  }
}

export async function disconnectTelegramAction(): Promise<DisconnectResult> {
  const user = await requireUser();
  try {
    await unlinkTelegram(user.id);
  } catch (err) {
    logError("action.disconnectTelegram", err, { userId: user.id });
    return { status: "error", message: "telegram.error" };
  }
  revalidatePath("/settings");
  return { status: "ok" };
}

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
