import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Telegram data layer contract (mocked @/server/db):
 *  - linkChatByCode finds the user by code, sets chatId + nulls the code, and
 *    reports success by the updateMany count (false when no row matched)
 *  - setLinkCode / unlinkTelegram scope mutations by the user id
 *  - listLinkedUsers selects only id/chatId/locale for linked users
 */

const userUpdate = vi.fn();
const userUpdateMany = vi.fn();
const userFindMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      update: (...a: unknown[]) => userUpdate(...a),
      updateMany: (...a: unknown[]) => userUpdateMany(...a),
      findMany: (...a: unknown[]) => userFindMany(...a),
    },
  },
}));

import {
  setLinkCode,
  linkChatByCode,
  unlinkTelegram,
  listLinkedUsers,
} from "@/server/data/telegram";

beforeEach(() => {
  for (const fn of [userUpdate, userUpdateMany, userFindMany]) fn.mockReset();
});

describe("setLinkCode", () => {
  it("stores the code scoped to the user id", async () => {
    userUpdate.mockResolvedValue({});
    await setLinkCode("u1", "abc123");
    expect(userUpdate.mock.calls[0][0]).toEqual({
      where: { id: "u1" },
      data: { telegramLinkCode: "abc123" },
    });
  });
});

describe("linkChatByCode", () => {
  it("matches by code, sets chatId + nulls the code, returns true on a hit", async () => {
    userUpdateMany.mockResolvedValue({ count: 1 });
    const ok = await linkChatByCode("abc123", "555");
    expect(ok).toBe(true);
    expect(userUpdateMany.mock.calls[0][0]).toEqual({
      where: { telegramLinkCode: "abc123" },
      data: { telegramChatId: "555", telegramLinkCode: null },
    });
  });

  it("returns false when no row matched the code", async () => {
    userUpdateMany.mockResolvedValue({ count: 0 });
    const ok = await linkChatByCode("nope", "555");
    expect(ok).toBe(false);
  });
});

describe("unlinkTelegram", () => {
  it("clears chatId + code scoped to the user id", async () => {
    userUpdate.mockResolvedValue({});
    await unlinkTelegram("u1");
    expect(userUpdate.mock.calls[0][0]).toEqual({
      where: { id: "u1" },
      data: { telegramChatId: null, telegramLinkCode: null },
    });
  });
});

describe("listLinkedUsers", () => {
  it("filters to linked users and selects only id/chatId/locale", async () => {
    userFindMany.mockResolvedValue([
      { id: "u1", telegramChatId: "555", locale: "uk" },
    ]);
    const rows = await listLinkedUsers();
    expect(rows).toEqual([{ id: "u1", telegramChatId: "555", locale: "uk" }]);
    const arg = userFindMany.mock.calls[0][0];
    expect(arg.where).toEqual({ telegramChatId: { not: null } });
    expect(arg.select).toEqual({ id: true, telegramChatId: true, locale: true });
  });
});
