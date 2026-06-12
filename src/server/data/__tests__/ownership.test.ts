import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership + scoping contract for the Person data layer and its nested entities.
 * We mock @/server/db so these assert the *query shape* without a live DB:
 *  - every owned-row query carries userId in its where
 *  - mutations gate on assertPersonOwned (a findFirst scoped by {id,userId}) BEFORE writing
 *  - nested entities are unreachable cross-user
 */

const personFindFirst = vi.fn();
const personFindMany = vi.fn();
const personUpdate = vi.fn();
const personDelete = vi.fn();
const factCreate = vi.fn();
const factFindFirst = vi.fn();
const factFindMany = vi.fn();
const factDelete = vi.fn();
const interactionCreate = vi.fn();
const interactionFindMany = vi.fn();
const cadenceUpsert = vi.fn();
const cadenceDelete = vi.fn();
const cadenceFindUnique = vi.fn();
const transaction = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    person: {
      findFirst: (...a: unknown[]) => personFindFirst(...a),
      findMany: (...a: unknown[]) => personFindMany(...a),
      update: (...a: unknown[]) => personUpdate(...a),
      delete: (...a: unknown[]) => personDelete(...a),
    },
    fact: {
      create: (...a: unknown[]) => factCreate(...a),
      findFirst: (...a: unknown[]) => factFindFirst(...a),
      findMany: (...a: unknown[]) => factFindMany(...a),
      delete: (...a: unknown[]) => factDelete(...a),
    },
    interaction: {
      create: (...a: unknown[]) => interactionCreate(...a),
      findMany: (...a: unknown[]) => interactionFindMany(...a),
    },
    cadence: {
      upsert: (...a: unknown[]) => cadenceUpsert(...a),
      delete: (...a: unknown[]) => cadenceDelete(...a),
      findUnique: (...a: unknown[]) => cadenceFindUnique(...a),
    },
    // Run the transaction callback against the same mocked client.
    $transaction: (...a: unknown[]) => transaction(...a),
  },
}));

import {
  getPerson,
  updatePerson,
  deletePerson,
  searchPeople,
  assertPersonOwned,
} from "@/server/data/people";
import { addFact, deleteFact, listFacts } from "@/server/data/facts";
import { logInteraction, listInteractions } from "@/server/data/interactions";
import { setCadence, clearCadence } from "@/server/data/cadence";

function resetAll() {
  for (const fn of [
    personFindFirst,
    personFindMany,
    personUpdate,
    personDelete,
    factCreate,
    factFindFirst,
    factFindMany,
    factDelete,
    interactionCreate,
    interactionFindMany,
    cadenceUpsert,
    cadenceDelete,
    cadenceFindUnique,
    transaction,
  ]) {
    fn.mockReset();
  }
}

beforeEach(resetAll);

describe("Person query scoping", () => {
  it("getPerson scopes by userId", () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    getPerson("u1", "p1");
    expect(personFindFirst.mock.calls[0][0].where).toMatchObject({
      id: "p1",
      userId: "u1",
    });
  });

  it("searchPeople scopes by userId and applies insensitive name filter", () => {
    searchPeople("u1", { query: "ada" });
    const where = personFindMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u1");
    expect(where.fullName).toEqual({ contains: "ada", mode: "insensitive" });
  });

  it("assertPersonOwned throws when no owned row is found", async () => {
    personFindFirst.mockResolvedValue(null);
    await expect(assertPersonOwned("u1", "p1")).rejects.toThrow();
  });
});

describe("Person mutations gate on ownership first", () => {
  it("updatePerson checks ownership before updating", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    personUpdate.mockResolvedValue({ id: "p1" });
    await updatePerson("u1", "p1", { fullName: "X", tags: [] });
    // ownership check uses a scoped findFirst, and it happened before update
    expect(personFindFirst.mock.calls[0][0].where).toMatchObject({
      id: "p1",
      userId: "u1",
    });
    expect(personFindFirst).toHaveBeenCalled();
    expect(personUpdate).toHaveBeenCalled();
    expect(personFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      personUpdate.mock.invocationCallOrder[0],
    );
  });

  it("updatePerson refuses (throws) when the person is not owned", async () => {
    personFindFirst.mockResolvedValue(null);
    await expect(
      updatePerson("u1", "p1", { fullName: "X", tags: [] }),
    ).rejects.toThrow();
    expect(personUpdate).not.toHaveBeenCalled();
  });

  it("deletePerson checks ownership before deleting", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    personDelete.mockResolvedValue({ id: "p1" });
    await deletePerson("u1", "p1");
    expect(personFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      personDelete.mock.invocationCallOrder[0],
    );
  });
});

describe("Facts ownership", () => {
  it("addFact asserts person ownership before creating", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    factCreate.mockResolvedValue({ id: "f1" });
    await addFact("u1", "p1", { category: "work", content: "hi" });
    expect(personFindFirst.mock.calls[0][0].where).toMatchObject({
      id: "p1",
      userId: "u1",
    });
    expect(personFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      factCreate.mock.invocationCallOrder[0],
    );
  });

  it("listFacts asserts ownership and scopes by personId", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    await listFacts("u1", "p1");
    expect(personFindFirst).toHaveBeenCalled();
  });

  it("deleteFact rejects a fact whose person belongs to another user", async () => {
    factFindFirst.mockResolvedValue({
      id: "f1",
      person: { userId: "someone-else" },
    });
    await expect(deleteFact("u1", "f1")).rejects.toThrow();
    expect(factDelete).not.toHaveBeenCalled();
  });

  it("deleteFact deletes when the fact's person belongs to the user", async () => {
    factFindFirst.mockResolvedValue({
      id: "f1",
      person: { userId: "u1" },
    });
    factDelete.mockResolvedValue({ id: "f1" });
    await deleteFact("u1", "f1");
    expect(factDelete).toHaveBeenCalledWith({ where: { id: "f1" } });
  });
});

describe("Interactions ownership + cadence bump", () => {
  it("logInteraction asserts ownership and advances nextDueAt from the interaction date", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    cadenceFindUnique.mockResolvedValue({
      id: "c1",
      personId: "p1",
      intervalDays: 30,
    });
    // Run the $transaction callback against a tx client we capture writes from.
    const txInteractionCreate = vi.fn().mockResolvedValue({ id: "i1" });
    const txCadenceUpdate = vi.fn().mockResolvedValue({ id: "c1" });
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        interaction: { create: txInteractionCreate },
        cadence: { update: txCadenceUpdate },
      }),
    );

    const date = new Date("2026-02-01T00:00:00.000Z");
    await logInteraction("u1", "p1", { summary: "Coffee", date });

    expect(personFindFirst.mock.calls[0][0].where).toMatchObject({
      id: "p1",
      userId: "u1",
    });
    expect(txInteractionCreate).toHaveBeenCalled();
    // cadence advanced to date + 30 days
    const cadenceArg = txCadenceUpdate.mock.calls[0][0];
    expect(cadenceArg.data.lastContactedAt).toEqual(date);
    expect(cadenceArg.data.nextDueAt.toISOString()).toBe(
      "2026-03-03T00:00:00.000Z",
    );
  });

  it("logInteraction does not error when there is no cadence", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    cadenceFindUnique.mockResolvedValue(null);
    const txInteractionCreate = vi.fn().mockResolvedValue({ id: "i1" });
    const txCadenceUpdate = vi.fn();
    transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        interaction: { create: txInteractionCreate },
        cadence: { update: txCadenceUpdate },
      }),
    );
    await logInteraction("u1", "p1", { summary: "Note" });
    expect(txInteractionCreate).toHaveBeenCalled();
    expect(txCadenceUpdate).not.toHaveBeenCalled();
  });

  it("listInteractions asserts ownership", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    await listInteractions("u1", "p1");
    expect(personFindFirst).toHaveBeenCalled();
  });
});

describe("Cadence ownership", () => {
  it("setCadence asserts ownership and upserts nextDueAt from now + interval", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    cadenceUpsert.mockResolvedValue({ id: "c1" });
    const now = new Date("2026-01-01T00:00:00.000Z");
    await setCadence("u1", "p1", 14, now);
    expect(personFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      cadenceUpsert.mock.invocationCallOrder[0],
    );
    const arg = cadenceUpsert.mock.calls[0][0];
    expect(arg.where).toEqual({ personId: "p1" });
    expect(arg.create.nextDueAt.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("clearCadence asserts ownership before deleting", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    cadenceDelete.mockResolvedValue({ id: "c1" });
    await clearCadence("u1", "p1");
    expect(personFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      cadenceDelete.mock.invocationCallOrder[0],
    );
  });
});
