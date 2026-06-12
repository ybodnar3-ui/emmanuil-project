import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership + correctness contract for the Today cadence actions (mocked db):
 *  - markContacted gates on ownership BEFORE writing, sets lastContactedAt=now
 *    and nextDueAt = computeNextDueAt(now, interval)
 *  - snoozeCadence gates on ownership and sets nextDueAt = now + days (leaving
 *    lastContactedAt untouched)
 *  - both no-op (return null, no write) when the person has no cadence
 */

const personFindFirst = vi.fn();
const cadenceFindUnique = vi.fn();
const cadenceUpdate = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    person: { findFirst: (...a: unknown[]) => personFindFirst(...a) },
    cadence: {
      findUnique: (...a: unknown[]) => cadenceFindUnique(...a),
      update: (...a: unknown[]) => cadenceUpdate(...a),
    },
  },
}));

import { markContacted, snoozeCadence } from "@/server/data/cadenceActions";

beforeEach(() => {
  for (const fn of [personFindFirst, cadenceFindUnique, cadenceUpdate]) {
    fn.mockReset();
  }
});

describe("markContacted", () => {
  it("checks ownership before write and advances nextDueAt by the interval", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    cadenceFindUnique.mockResolvedValue({ personId: "p1", intervalDays: 30 });
    cadenceUpdate.mockResolvedValue({ personId: "p1" });
    const now = new Date("2026-06-12T00:00:00.000Z");

    await markContacted("u1", "p1", now);

    expect(personFindFirst.mock.calls[0][0].where).toMatchObject({
      id: "p1",
      userId: "u1",
    });
    expect(personFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      cadenceUpdate.mock.invocationCallOrder[0],
    );
    const arg = cadenceUpdate.mock.calls[0][0];
    expect(arg.where).toEqual({ personId: "p1" });
    expect(arg.data.lastContactedAt).toEqual(now);
    // now + 30 days
    expect(arg.data.nextDueAt.toISOString()).toBe("2026-07-12T00:00:00.000Z");
  });

  it("is a no-op (no update) when the person has no cadence", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    cadenceFindUnique.mockResolvedValue(null);
    const result = await markContacted("u1", "p1", new Date());
    expect(result).toBeNull();
    expect(cadenceUpdate).not.toHaveBeenCalled();
  });

  it("refuses (throws) when the person is not owned", async () => {
    personFindFirst.mockResolvedValue(null);
    await expect(markContacted("u1", "p1", new Date())).rejects.toThrow();
    expect(cadenceUpdate).not.toHaveBeenCalled();
  });
});

describe("snoozeCadence", () => {
  it("checks ownership and sets nextDueAt to now + days without touching lastContactedAt", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    cadenceFindUnique.mockResolvedValue({ personId: "p1", intervalDays: 30 });
    cadenceUpdate.mockResolvedValue({ personId: "p1" });
    const now = new Date("2026-06-12T00:00:00.000Z");

    await snoozeCadence("u1", "p1", 7, now);

    expect(personFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      cadenceUpdate.mock.invocationCallOrder[0],
    );
    const arg = cadenceUpdate.mock.calls[0][0];
    expect(arg.data.nextDueAt.toISOString()).toBe("2026-06-19T00:00:00.000Z");
    expect(arg.data.lastContactedAt).toBeUndefined();
  });

  it("refuses (throws) when the person is not owned", async () => {
    personFindFirst.mockResolvedValue(null);
    await expect(snoozeCadence("u1", "p1", 7, new Date())).rejects.toThrow();
    expect(cadenceUpdate).not.toHaveBeenCalled();
  });
});
