import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Scoping contract for the people data layer (mocked db):
 *  - countPeople counts only the caller's people (where: { userId }).
 */

const personCount = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    person: {
      count: (...a: unknown[]) => personCount(...a),
    },
  },
}));

import { countPeople } from "../people";

beforeEach(() => {
  personCount.mockReset();
});

describe("countPeople", () => {
  it("counts only the caller's people", async () => {
    personCount.mockResolvedValue(3);
    const n = await countPeople("u1");
    expect(personCount).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(n).toBe(3);
  });
});
