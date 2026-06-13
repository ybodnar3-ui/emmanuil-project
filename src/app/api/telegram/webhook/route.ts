import { linkChatByCode } from "@/server/data/telegram";
import {
  telegramConfigured,
  sendTelegramMessage,
} from "@/server/telegram/client";
import { logError } from "@/server/log";

/**
 * Telegram webhook. Security + robustness contract:
 *  - Verifies the X-Telegram-Bot-Api-Secret-Token header == TELEGRAM_WEBHOOK_SECRET;
 *    a missing/wrong secret gets 401 (this is the only thing standing between the
 *    public internet and the link flow).
 *  - When no bot token is configured, returns 200 no-op (the route is harmless
 *    and present even before the bot exists).
 *  - Parses the update; on `/start <code>` it links the chat by code and replies
 *    connected/invalid. Any other message that has a chat id (bare `/start`,
 *    `/start` with no arg, or arbitrary text) gets a short help reply so the bot
 *    is never silent. Updates without a chat id are a 200 no-op.
 *  - Always returns 200 quickly on the happy/parse paths (Telegram retries on
 *    non-200). Never throws to the caller; never logs or returns the bot token.
 *
 * Route handlers aren't cached for POST, so no extra cache config is needed.
 */

const START_RE = /^\/start\s+(\S+)$/;

export async function POST(request: Request): Promise<Response> {
  // 1) Secret-token gate. Constant-ish compare is fine here; the secret is high
  // entropy and this isn't a timing-sensitive credential check at our scale.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const provided = request.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || provided !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  // 2) No token → nothing to send with; accept-and-ignore so Telegram stops retrying.
  if (!telegramConfigured()) {
    return Response.json({ ok: true, skipped: "no token" });
  }

  try {
    const update = (await request.json()) as {
      message?: { text?: string; chat?: { id?: number | string } };
    };
    const text = update.message?.text;
    const chatId = update.message?.chat?.id;

    if (typeof text === "string" && chatId != null) {
      const match = START_RE.exec(text.trim());
      if (match) {
        const code = match[1];
        const linked = await linkChatByCode(code, String(chatId));
        // Reply text is static (no user data), so no escaping needed here.
        const reply = linked
          ? "✅ Connected. You'll get your daily reminders here."
          : "⚠️ That link looks invalid or expired — generate a fresh one in the app.";
        await sendTelegramMessage(String(chatId), reply);
      } else {
        // Bare `/start`, `/start` with no arg, or any other text: never stay
        // silent — point the user at the linking flow. The origin is derived
        // from the request so the URL stays correct across domains.
        const origin = new URL(request.url).origin;
        const help = `👋 To connect Emmanuil, open ${origin}/settings on the web app, tap "Connect Telegram", and follow the link there — it carries a one-time code that links this chat to your account.`;
        await sendTelegramMessage(String(chatId), help);
      }
    }
  } catch (err) {
    // Swallow + log: returning non-200 would make Telegram retry a poison update.
    logError("telegram.webhook", err);
  }

  // Always 200 once authenticated, so Telegram doesn't retry.
  return Response.json({ ok: true });
}
