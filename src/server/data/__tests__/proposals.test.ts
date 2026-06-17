import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership + persistence-shape contract for the assistant's confirm-before-
 * persist write path. We mock @/server/db so these assert the query shape and
 * the ownership gate without a live DB:
 *  - listRoster scopes by userId
 *  - applyProposal asserts ownership (findFirst {id,userId}) BEFORE any create
 *  - a non-owned person is rejected with no writes
 *  - facts are created with the resolved personId
 *  - an included interaction advances the cadence nextDueAt
 *  - an empty proposal is rejected
 */

const personFindFirst = vi.fn();
const personFindMany = vi.fn();
const transaction = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    person: {
      findFirst: (...a: unknown[]) => personFindFirst(...a),
      findMany: (...a: unknown[]) => personFindMany(...a),
    },
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

import { listRoster, applyProposal } from "@/server/data/proposals";

beforeEach(() => {
  personFindFirst.mockReset();
  personFindMany.mockReset();
  transaction.mockReset();
});

describe("listRoster", () => {
  it("scopes by userId and selects id/fullName/tags", () => {
    listRoster("u1");
    const arg = personFindMany.mock.calls[0]![0];
    expect(arg.where).toEqual({ userId: "u1" });
    expect(arg.select).toEqual({ id: true, fullName: true, tags: true });
  });
});

describe("applyProposal ownership + persistence", () => {
  function txClient() {
    const factCreate = vi.fn(async ({ data }: { data: unknown }) => ({
      id: "f1",
      ...(data as object),
    }));
    const interactionCreate = vi.fn(async () => ({ id: "i1" }));
    const keyDateCreate = vi.fn(async ({ data }: { data: unknown }) => ({
      id: "k1",
      ...(data as object),
    }));
    const cadenceFindUnique = vi.fn();
    const cadenceUpdate = vi.fn(async () => ({ id: "c1" }));
    const tx = {
      fact: { create: factCreate },
      interaction: { create: interactionCreate },
      keyDate: { create: keyDateCreate },
      cadence: { findUnique: cadenceFindUnique, update: cadenceUpdate },
    };
    transaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));
    return {
      factCreate,
      interactionCreate,
      keyDateCreate,
      cadenceFindUnique,
      cadenceUpdate,
    };
  }

  it("asserts ownership BEFORE creating, and creates facts with the resolved personId", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    const { factCreate } = txClient();

    await applyProposal("u1", "p1", {
      facts: [{ category: "family", content: "son studies in London" }],
      interaction: null,
    });

    expect(personFindFirst.mock.calls[0]![0].where).toMatchObject({
      id: "p1",
      userId: "u1",
    });
    expect(personFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.mock.invocationCallOrder[0],
    );
    expect(factCreate).toHaveBeenCalledOnce();
    expect(factCreate.mock.calls[0]![0].data).toMatchObject({
      personId: "p1",
      category: "family",
      content: "son studies in London",
    });
  });

  it("rejects (throws) and writes nothing when the person is not owned", async () => {
    personFindFirst.mockResolvedValue(null);
    await expect(
      applyProposal("u1", "p1", {
        facts: [{ category: "work", content: "x" }],
      }),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("advances the cadence nextDueAt when an interaction is included", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    const { interactionCreate, cadenceFindUnique, cadenceUpdate } = txClient();
    cadenceFindUnique.mockResolvedValue({
      id: "c1",
      personId: "p1",
      intervalDays: 30,
    });

    await applyProposal("u1", "p1", {
      facts: [],
      interaction: { summary: "Called about her new role", channel: "call" },
    });

    expect(interactionCreate).toHaveBeenCalledOnce();
    const created = interactionCreate.mock.calls[0]![0].data;
    expect(created).toMatchObject({ personId: "p1", summary: "Called about her new role", channel: "call" });
    // cadence advanced to interaction date + 30 days
    const cadenceArg = cadenceUpdate.mock.calls[0]![0];
    expect(cadenceArg.data.nextDueAt.getTime()).toBe(
      cadenceArg.data.lastContactedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
    );
  });

  it("does not bump cadence when none exists (no throw)", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    const { interactionCreate, cadenceFindUnique, cadenceUpdate } = txClient();
    cadenceFindUnique.mockResolvedValue(null);

    await applyProposal("u1", "p1", {
      interaction: { summary: "Quick note" },
    });

    expect(interactionCreate).toHaveBeenCalledOnce();
    expect(cadenceUpdate).not.toHaveBeenCalled();
  });

  it("creates a valid key date (ownership asserted first) coercing the ISO date", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    const { keyDateCreate, factCreate } = txClient();

    await applyProposal("u1", "p1", {
      facts: [],
      interaction: null,
      keyDates: [{ label: "son's birthday", date: "2026-03-03" }],
    });

    // Ownership is asserted before the write.
    expect(personFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.mock.invocationCallOrder[0],
    );
    expect(factCreate).not.toHaveBeenCalled();
    expect(keyDateCreate).toHaveBeenCalledOnce();
    const data = keyDateCreate.mock.calls[0]![0].data;
    expect(data.personId).toBe("p1");
    expect(data.label).toBe("son's birthday");
    expect(data.date).toBeInstanceOf(Date);
    expect(data.date.toISOString()).toBe("2026-03-03T00:00:00.000Z");
  });

  it("skips an invalid key date without throwing (still creates the valid one)", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    const { keyDateCreate } = txClient();

    await applyProposal("u1", "p1", {
      facts: [],
      interaction: null,
      keyDates: [
        { label: "bad", date: "not-a-date" },
        { label: "anniversary", date: "2010-07-01" },
      ],
    });

    // The unparseable date is dropped; only the valid one is persisted.
    expect(keyDateCreate).toHaveBeenCalledOnce();
    expect(keyDateCreate.mock.calls[0]![0].data.label).toBe("anniversary");
  });

  it("rejects a proposal whose only key date is invalid (empty after validation)", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    const { keyDateCreate } = txClient();

    await expect(
      applyProposal("u1", "p1", {
        facts: [],
        interaction: null,
        keyDates: [{ label: "bad", date: "not-a-date" }],
      }),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
    expect(keyDateCreate).not.toHaveBeenCalled();
  });

  it("rejects an empty proposal before opening a transaction", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    await expect(applyProposal("u1", "p1", { facts: [], interaction: null })).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid fact category (zod) before writing", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    await expect(
      applyProposal("u1", "p1", {
        facts: [{ category: "not-a-category", content: "x" }],
      }),
    ).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
});
