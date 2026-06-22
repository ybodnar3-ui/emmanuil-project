import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn();
const deleteMany = vi.fn();
const findMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    pushSubscription: {
      upsert: (...a: unknown[]) => upsert(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
      findMany: (...a: unknown[]) => findMany(...a),
    },
  },
}));

import {
  saveSubscription,
  deleteSubscription,
  listSubscriptions,
  deleteSubscriptionByEndpoint,
  listPushTargets,
} from "../push";

const sub = {
  endpoint: "https://push.example/abc",
  keys: { p256dh: "key-p", auth: "key-a" },
};

beforeEach(() => {
  for (const fn of [upsert, deleteMany, findMany]) fn.mockReset();
});

describe("saveSubscription", () => {
  it("upserts by endpoint, owned by the user", async () => {
    upsert.mockResolvedValue({});
    await saveSubscription("u1", sub);
    expect(upsert).toHaveBeenCalledWith({
      where: { endpoint: sub.endpoint },
      create: {
        userId: "u1",
        endpoint: sub.endpoint,
        p256dh: "key-p",
        auth: "key-a",
      },
      update: { userId: "u1", p256dh: "key-p", auth: "key-a" },
    });
  });
});

describe("deleteSubscription", () => {
  it("deletes only the caller's row (userId + endpoint scoped)", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    await deleteSubscription("u1", sub.endpoint);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", endpoint: sub.endpoint },
    });
  });

  it("does not delete another user's subscription (count 0, no throw)", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteSubscription("u1", sub.endpoint)).resolves.toBeUndefined();
  });
});

describe("listSubscriptions", () => {
  it("scopes to the user", async () => {
    findMany.mockResolvedValue([]);
    await listSubscriptions("u1");
    expect(findMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
  });
});

describe("deleteSubscriptionByEndpoint", () => {
  it("prunes by unique endpoint (no user scope; used by the cron)", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    await deleteSubscriptionByEndpoint(sub.endpoint);
    expect(deleteMany).toHaveBeenCalledWith({ where: { endpoint: sub.endpoint } });
  });
});

describe("listPushTargets", () => {
  it("groups subscriptions by user with their locale", async () => {
    findMany.mockResolvedValue([
      {
        endpoint: "e1",
        p256dh: "p1",
        auth: "a1",
        user: { id: "u1", locale: "en" },
      },
      {
        endpoint: "e2",
        p256dh: "p2",
        auth: "a2",
        user: { id: "u1", locale: "en" },
      },
      {
        endpoint: "e3",
        p256dh: "p3",
        auth: "a3",
        user: { id: "u2", locale: "uk" },
      },
    ]);
    const targets = await listPushTargets();
    expect(targets).toEqual([
      {
        userId: "u1",
        locale: "en",
        subscriptions: [
          { endpoint: "e1", keys: { p256dh: "p1", auth: "a1" } },
          { endpoint: "e2", keys: { p256dh: "p2", auth: "a2" } },
        ],
      },
      {
        userId: "u2",
        locale: "uk",
        subscriptions: [{ endpoint: "e3", keys: { p256dh: "p3", auth: "a3" } }],
      },
    ]);
  });
});
