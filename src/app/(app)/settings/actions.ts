"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { setLinkCode, unlinkTelegram } from "@/server/data/telegram";
import { telegramConfigured } from "@/server/telegram/client";
import { logError } from "@/server/log";

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
