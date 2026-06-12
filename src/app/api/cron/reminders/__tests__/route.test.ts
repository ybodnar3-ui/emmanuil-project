import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "@/server/today/feed";

/**
 * Cron contract (mocked data + client + next-intl):
 *  - missing/incorrect bearer → 401 (no work)
 *  - correct secret but no bot token → 200 { skipped: "no token" }
 *  - correct secret + a linked user with feed items → sendTelegramMessage called,
 *    counted in `sent`
 *  - a user with an empty feed is skipped (no send)
 *  - a per-user send failure is counted in `failed` and does NOT abort others
 */

const listLinkedUsers = vi.fn();
const getTodayFeed = vi.fn();
const sendTelegramMessage = vi.fn();
const telegramConfigured = vi.fn();

vi.mock("@/server/data/telegram", () => ({
  listLinkedUsers: (...a: unknown[]) => listLinkedUsers(...a),
}));
vi.mock("@/server/data/today", () => ({
  getTodayFeed: (...a: unknown[]) => getTodayFeed(...a),
}));
vi.mock("@/server/telegram/client", () => ({
  telegramConfigured: () => telegramConfigured(),
  sendTelegramMessage: (...a: unknown[]) => sendTelegramMessage(...a),
}));
// Stub next-intl so the cron stays pure/offline; labels are exercised by format.test.ts.
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import { GET } from "../route";

const SECRET = "cron-secret";

function req(bearer?: string): Request {
  const headers: Record<string, string> = {};
  if (bearer !== undefined) headers["authorization"] = bearer;
  return new Request("https://app.test/api/cron/reminders", { headers });
}

const taskItem: FeedItem = {
  type: "task",
  taskId: "t1",
  title: "Send proposal",
  personId: null,
  personName: null,
  dueAt: new Date("2026-06-13T00:00:00.000Z"),
  overdueDays: 0,
};

beforeEach(() => {
  for (const fn of [
    listLinkedUsers,
    getTodayFeed,
    sendTelegramMessage,
    telegramConfigured,
  ]) {
    fn.mockReset();
  }
  process.env.CRON_SECRET = SECRET;
  telegramConfigured.mockReturnValue(true);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("cron auth", () => {
  it("401s when the bearer is missing", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(listLinkedUsers).not.toHaveBeenCalled();
  });

  it("401s when the bearer is wrong", async () => {
    const res = await GET(req("Bearer nope"));
    expect(res.status).toBe(401);
    expect(listLinkedUsers).not.toHaveBeenCalled();
  });

  it("401s when CRON_SECRET is not configured server-side", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(401);
  });
});

describe("cron behavior", () => {
  it("200 skipped no-op when no bot token is configured", async () => {
    telegramConfigured.mockReturnValue(false);
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe("no token");
    expect(listLinkedUsers).not.toHaveBeenCalled();
  });

  it("sends a message to a linked user with feed items and computes their OWN feed", async () => {
    listLinkedUsers.mockResolvedValue([
      { id: "u1", telegramChatId: "555", locale: "en" },
    ]);
    getTodayFeed.mockResolvedValue([taskItem]);
    sendTelegramMessage.mockResolvedValue(true);

    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(getTodayFeed.mock.calls[0][0]).toBe("u1");
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(sendTelegramMessage.mock.calls[0][0]).toBe("555");
    expect(await res.json()).toEqual({ sent: 1, skipped: 0, failed: 0 });
  });

  it("skips a user whose feed is empty (no send)", async () => {
    listLinkedUsers.mockResolvedValue([
      { id: "u1", telegramChatId: "555", locale: "en" },
    ]);
    getTodayFeed.mockResolvedValue([]);

    const res = await GET(req(`Bearer ${SECRET}`));
    expect(sendTelegramMessage).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ sent: 0, skipped: 1, failed: 0 });
  });

  it("counts a per-user failure without aborting the others", async () => {
    listLinkedUsers.mockResolvedValue([
      { id: "u1", telegramChatId: "111", locale: "en" },
      { id: "u2", telegramChatId: "222", locale: "uk" },
    ]);
    getTodayFeed.mockResolvedValue([taskItem]);
    // u1 throws, u2 succeeds — the run must continue past u1.
    sendTelegramMessage
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(true);

    const res = await GET(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(sendTelegramMessage).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({ sent: 1, skipped: 0, failed: 1 });
  });
});
