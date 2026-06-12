import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/**
 * Webhook contract (mocked data layer + Bot API client):
 *  - missing/wrong X-Telegram-Bot-Api-Secret-Token → 401, no side effects
 *  - valid `/start <code>` → linkChatByCode(code, chatId) + a reply, 200
 *  - non-/start message → 200 no-op (no link, no reply)
 *  - no bot token configured (but valid secret) → 200 skipped no-op
 */

const linkChatByCode = vi.fn();
const sendTelegramMessage = vi.fn();
const telegramConfigured = vi.fn();

vi.mock("@/server/data/telegram", () => ({
  linkChatByCode: (...a: unknown[]) => linkChatByCode(...a),
}));
vi.mock("@/server/telegram/client", () => ({
  telegramConfigured: () => telegramConfigured(),
  sendTelegramMessage: (...a: unknown[]) => sendTelegramMessage(...a),
}));

import { POST } from "../route";

const SECRET = "webhook-secret";

function req(body: unknown, secretHeader?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secretHeader !== undefined) {
    headers["x-telegram-bot-api-secret-token"] = secretHeader;
  }
  return new Request("https://app.test/api/telegram/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  linkChatByCode.mockReset();
  sendTelegramMessage.mockReset();
  telegramConfigured.mockReset();
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  telegramConfigured.mockReturnValue(true);
});

afterEach(() => {
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
});

describe("telegram webhook auth", () => {
  it("401s when the secret header is missing", async () => {
    const res = await POST(req({ message: { text: "/start abc" } }));
    expect(res.status).toBe(401);
    expect(linkChatByCode).not.toHaveBeenCalled();
  });

  it("401s when the secret header is wrong", async () => {
    const res = await POST(req({ message: { text: "/start abc" } }, "nope"));
    expect(res.status).toBe(401);
    expect(linkChatByCode).not.toHaveBeenCalled();
  });

  it("401s when no secret is configured server-side", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const res = await POST(req({ message: { text: "/start abc" } }, SECRET));
    expect(res.status).toBe(401);
  });
});

describe("telegram webhook behavior", () => {
  it("links the chat by code on /start <code> and replies, returning 200", async () => {
    linkChatByCode.mockResolvedValue(true);
    sendTelegramMessage.mockResolvedValue(true);
    const res = await POST(
      req({ message: { text: "/start abc123", chat: { id: 555 } } }, SECRET),
    );
    expect(res.status).toBe(200);
    expect(linkChatByCode).toHaveBeenCalledWith("abc123", "555");
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessage.mock.calls[0][0]).toBe("555");
  });

  it("still replies (invalid-code message) when the code does not match", async () => {
    linkChatByCode.mockResolvedValue(false);
    sendTelegramMessage.mockResolvedValue(true);
    const res = await POST(
      req({ message: { text: "/start bad", chat: { id: 7 } } }, SECRET),
    );
    expect(res.status).toBe(200);
    expect(linkChatByCode).toHaveBeenCalledWith("bad", "7");
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
  });

  it("is a 200 no-op for a non-/start message", async () => {
    const res = await POST(
      req({ message: { text: "hello there", chat: { id: 7 } } }, SECRET),
    );
    expect(res.status).toBe(200);
    expect(linkChatByCode).not.toHaveBeenCalled();
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("is a 200 skipped no-op when no bot token is configured", async () => {
    telegramConfigured.mockReturnValue(false);
    const res = await POST(
      req({ message: { text: "/start abc", chat: { id: 7 } } }, SECRET),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe("no token");
    expect(linkChatByCode).not.toHaveBeenCalled();
  });
});
