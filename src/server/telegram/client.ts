import { logError } from "@/server/log";

/**
 * Server-only Telegram Bot API helpers.
 *
 * Token-gated, no-throw, no-leak:
 *  - When TELEGRAM_BOT_TOKEN is absent, sendTelegramMessage is a clean no-op
 *    returning false; nothing throws to the caller.
 *  - The bot token is NEVER logged or returned (logError meta carries only the
 *    chatId, which is the user's own DM target, not a secret).
 *  - Any network/API failure is caught, logged via the server-only logger, and
 *    surfaced only as a boolean — callers (webhook, cron) stay 200/no-throw.
 */

const API = "https://api.telegram.org";

/** True iff a bot token is configured. Gate UI/flows on this. */
export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

/**
 * Send an HTML-formatted DM. Returns true on a 2xx Bot API response, false on
 * any missing token / non-OK status / thrown error. Never throws; never leaks
 * the token. `text` MUST already be HTML-escaped where it contains user data
 * (see format.ts) — parse_mode is "HTML".
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logError("telegram.send", new Error("TELEGRAM_BOT_TOKEN not set"));
    return false;
  }
  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      // Status only — do NOT include the response body, which echoes the URL
      // (and thus the token) on some Bot API errors.
      logError("telegram.send", new Error(`HTTP ${res.status}`), { chatId });
      return false;
    }
    return true;
  } catch (err) {
    logError("telegram.send", err, { chatId });
    return false;
  }
}
