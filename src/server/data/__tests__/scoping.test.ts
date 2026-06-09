import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Prisma client so the test asserts the query shape without a live DB.
const findMany = vi.fn();
const create = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    person: {
      findMany: (...args: unknown[]) => findMany(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

import { createPerson, listPeople } from "@/server/data/people";

describe("scoped people data-access", () => {
  beforeEach(() => {
    findMany.mockReset();
    create.mockReset();
  });

  it("listPeople scopes the query by the given userId", () => {
    listPeople("user-123");
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      orderBy: { fullName: "asc" },
    });
  });

  it("createPerson injects the userId and never lets input override it", () => {
    createPerson("user-123", {
      fullName: "Ada Lovelace",
      // Attempt to spoof another owner — must be ignored/overridden.
      ...({ userId: "attacker" } as unknown as { fullName: string }),
    });
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0] as { data: { userId: string } };
    expect(arg.data.userId).toBe("user-123");
  });
});
