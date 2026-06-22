import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { FeedItem } from "@/server/today/feed";

/**
 * Cron contract (mocked data + sender + next-intl):
 *  - missing/incorrect bearer → 401 (no work)
 *  - correct secret but VAPID unconfigured → 200 { skipped: "no vapid" }
 *  - a target with feed items → sendPush called per subscription, counted in `sent`
 *  - an empty feed → skipped (no send)
 *  - a "gone" subscription is pruned and counted in `pruned`
 *  - a per-target failure does NOT abort the others
 */

const listPushTargets = vi.fn();
const getTodayFeed = vi.fn();
const sendPush = vi.fn();
const pushConfigured = vi.fn();
const deleteSubscriptionByEndpoint = vi.fn();

vi.mock("@/server/data/push", () => ({
  listPushTargets: (...a: unknown[]) => listPushTargets(...a),
  deleteSubscriptionByEndpoint: (...a: unknown[]) => deleteSubscriptionByEndpoint(...a),
}));
vi.mock("@/server/data/today", () => ({
  getTodayFeed: (...a: unknown[]) => getTodayFeed(...a),
}));
vi.mock("@/server/push/send", () => ({
  pushConfigured: () => pushConfigured(),
  sendPush: (...a: unknown[]) => sendPush(...a),
}));
vi.mock("@/server/push/format", () => ({
  // Simple deterministic stub: non-empty feed → a payload, empty feed → null.
  formatPushPayload: (feed: FeedItem[]) =>
    feed.length ? { title: "t", body: "b", url: "/" } : null,
}));
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
  dueAt: new Date("2026-06-22T00:00:00.000Z"),
  overdueDays: 0,
};
const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "p", auth: "a" } });

beforeEach(() => {
  for (const fn of [listPushTargets, getTodayFeed, sendPush, pushConfigured, deleteSubscriptionByEndpoint])
    fn.mockReset();
  process.env.CRON_SECRET = SECRET;
  pushConfigured.mockReturnValue(true);
});
afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("cron auth", () => {
  it("401s when the bearer is missing", async () => {
    expect((await GET(req())).status).toBe(401);
    expect(listPushTargets).not.toHaveBeenCalled();
  });
  it("401s when the bearer is wrong", async () => {
    expect((await GET(req("Bearer nope"))).status).toBe(401);
  });
  it("401s when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(req(`Bearer ${SECRET}`))).status).toBe(401);
  });
});

describe("cron behavior", () => {
  it("200 skipped no-op when VAPID is unconfigured", async () => {
    pushConfigured.mockReturnValue(false);
    const res = await GET(req(`Bearer ${SECRET}`));
    expect((await res.json()).skipped).toBe("no vapid");
    expect(listPushTargets).not.toHaveBeenCalled();
  });

  it("sends to each subscription of a target with feed items (own feed)", async () => {
    listPushTargets.mockResolvedValue([
      { userId: "u1", locale: "en", subscriptions: [sub("e1"), sub("e2")] },
    ]);
    getTodayFeed.mockResolvedValue([taskItem]);
    sendPush.mockResolvedValue("ok");
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(getTodayFeed.mock.calls[0][0]).toBe("u1");
    expect(sendPush).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({ sent: 2, skipped: 0, failed: 0, pruned: 0 });
  });

  it("skips a target whose feed is empty", async () => {
    listPushTargets.mockResolvedValue([
      { userId: "u1", locale: "en", subscriptions: [sub("e1")] },
    ]);
    getTodayFeed.mockResolvedValue([]);
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(sendPush).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ sent: 0, skipped: 1, failed: 0, pruned: 0 });
  });

  it("prunes a 'gone' subscription", async () => {
    listPushTargets.mockResolvedValue([
      { userId: "u1", locale: "en", subscriptions: [sub("e1")] },
    ]);
    getTodayFeed.mockResolvedValue([taskItem]);
    sendPush.mockResolvedValue("gone");
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(deleteSubscriptionByEndpoint).toHaveBeenCalledWith("e1");
    expect(await res.json()).toEqual({ sent: 0, skipped: 0, failed: 0, pruned: 1 });
  });

  it("counts a per-target failure without aborting others", async () => {
    listPushTargets.mockResolvedValue([
      { userId: "u1", locale: "en", subscriptions: [sub("e1")] },
      { userId: "u2", locale: "uk", subscriptions: [sub("e2")] },
    ]);
    getTodayFeed.mockResolvedValue([taskItem]);
    // u1's getTodayFeed-or-send throws via sendPush rejection; u2 succeeds.
    sendPush.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    const res = await GET(req(`Bearer ${SECRET}`));
    expect(sendPush).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({ sent: 1, skipped: 0, failed: 1, pruned: 0 });
  });
});
