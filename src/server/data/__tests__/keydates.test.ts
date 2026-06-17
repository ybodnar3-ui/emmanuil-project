import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership + window contract for the key-dates data layer (mocked db + people):
 *  - addKeyDate asserts ownership BEFORE create, and creates with the given fields
 *  - deleteKeyDate loads the key date via its person's userId and rejects a
 *    cross-user delete (no delete); deletes when the userId matches
 *  - listKeyDates asserts ownership then lists scoped to the person
 *  - getUpcomingKeyDates scopes via person: { userId } and returns only entries
 *    within the window (annual by month/day via the pure daysUntilBirthday), sorted
 */

const keyDateCreate = vi.fn();
const keyDateFindUnique = vi.fn();
const keyDateFindMany = vi.fn();
const keyDateDelete = vi.fn();
const assertPersonOwned = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    keyDate: {
      create: (...a: unknown[]) => keyDateCreate(...a),
      findUnique: (...a: unknown[]) => keyDateFindUnique(...a),
      findMany: (...a: unknown[]) => keyDateFindMany(...a),
      delete: (...a: unknown[]) => keyDateDelete(...a),
    },
  },
}));
vi.mock("@/server/data/people", () => ({
  assertPersonOwned: (...a: unknown[]) => assertPersonOwned(...a),
}));

import {
  addKeyDate,
  deleteKeyDate,
  listKeyDates,
  getUpcomingKeyDates,
} from "@/server/data/keydates";

const now = new Date("2026-06-12T10:00:00.000Z");

beforeEach(() => {
  for (const fn of [
    keyDateCreate,
    keyDateFindUnique,
    keyDateFindMany,
    keyDateDelete,
    assertPersonOwned,
  ]) {
    fn.mockReset();
  }
  assertPersonOwned.mockResolvedValue({ id: "p1", userId: "u1" });
  keyDateCreate.mockResolvedValue({ id: "k1" });
  keyDateDelete.mockResolvedValue({ id: "k1" });
  keyDateFindMany.mockResolvedValue([]);
});

describe("addKeyDate", () => {
  it("asserts ownership BEFORE creating, and creates with personId/label/date", async () => {
    const date = new Date("1990-07-01T00:00:00.000Z");
    await addKeyDate("u1", "p1", { label: "son's birthday", date });

    expect(assertPersonOwned).toHaveBeenCalledWith("u1", "p1");
    expect(assertPersonOwned.mock.invocationCallOrder[0]).toBeLessThan(
      keyDateCreate.mock.invocationCallOrder[0],
    );
    expect(keyDateCreate.mock.calls[0]![0].data).toEqual({
      personId: "p1",
      label: "son's birthday",
      date,
    });
  });

  it("does not create when ownership assertion throws", async () => {
    assertPersonOwned.mockRejectedValue(new Error("Person not found"));
    await expect(
      addKeyDate("u1", "p1", { label: "x", date: now }),
    ).rejects.toThrow();
    expect(keyDateCreate).not.toHaveBeenCalled();
  });
});

describe("deleteKeyDate", () => {
  it("rejects (no delete) when the key date's person belongs to another user", async () => {
    keyDateFindUnique.mockResolvedValue({
      id: "k1",
      person: { userId: "someone-else" },
    });
    await expect(deleteKeyDate("u1", "k1")).rejects.toThrow();
    expect(keyDateDelete).not.toHaveBeenCalled();
  });

  it("rejects (no delete) when the key date does not exist", async () => {
    keyDateFindUnique.mockResolvedValue(null);
    await expect(deleteKeyDate("u1", "k1")).rejects.toThrow();
    expect(keyDateDelete).not.toHaveBeenCalled();
  });

  it("deletes when the key date's person belongs to the caller", async () => {
    keyDateFindUnique.mockResolvedValue({
      id: "k1",
      person: { userId: "u1" },
    });
    await deleteKeyDate("u1", "k1");
    expect(keyDateDelete).toHaveBeenCalledWith({ where: { id: "k1" } });
  });
});

describe("listKeyDates", () => {
  it("asserts ownership then lists scoped to the person", async () => {
    await listKeyDates("u1", "p1");
    expect(assertPersonOwned).toHaveBeenCalledWith("u1", "p1");
    expect(keyDateFindMany.mock.calls[0]![0].where).toEqual({ personId: "p1" });
  });
});

describe("getUpcomingKeyDates", () => {
  it("scopes via person: { userId } and filters to the window, sorted by inDays", async () => {
    keyDateFindMany.mockResolvedValue([
      {
        id: "k-far",
        personId: "p1",
        label: "anniversary",
        date: new Date("2000-09-01T00:00:00.000Z"), // far away → excluded
        person: { fullName: "Maria" },
      },
      {
        id: "k-soon",
        personId: "p2",
        label: "son's birthday",
        date: new Date("1990-06-15T00:00:00.000Z"), // in 3 days → included
        person: { fullName: "Bohdan" },
      },
      {
        id: "k-today",
        personId: "p3",
        label: "wedding day",
        date: new Date("2010-06-12T00:00:00.000Z"), // today → included
        person: { fullName: "Olena" },
      },
    ]);

    const upcoming = await getUpcomingKeyDates("u1", now);

    expect(keyDateFindMany.mock.calls[0]![0].where).toEqual({
      person: { userId: "u1" },
    });
    // Excludes the far-away one; includes today (0) before in-3-days, sorted.
    expect(upcoming.map((u) => u.id)).toEqual(["k-today", "k-soon"]);
    expect(upcoming[0]).toMatchObject({
      id: "k-today",
      personId: "p3",
      personName: "Olena",
      label: "wedding day",
      inDays: 0,
    });
    expect(upcoming[1]).toMatchObject({
      id: "k-soon",
      personName: "Bohdan",
      inDays: 3,
    });
  });

  it("respects a custom window", async () => {
    keyDateFindMany.mockResolvedValue([
      {
        id: "k-10",
        personId: "p1",
        label: "x",
        date: new Date("1990-06-22T00:00:00.000Z"), // in 10 days
        person: { fullName: "A" },
      },
    ]);
    expect((await getUpcomingKeyDates("u1", now, 7)).map((u) => u.id)).toEqual(
      [],
    );
    expect((await getUpcomingKeyDates("u1", now, 14)).map((u) => u.id)).toEqual([
      "k-10",
    ]);
  });
});
