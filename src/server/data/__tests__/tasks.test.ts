import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ownership + scoping contract for the Task data layer (mocked @/server/db):
 *  - createTask injects userId and ALWAYS gates on assertPersonOwned (reminders
 *    are person-anchored; personId is required)
 *  - completeTask / snoozeTask scope mutations by { id, userId } so another
 *    user's task can't be touched
 *  - listOpenTasksDue filters by userId + status + dueAt
 */

const personFindFirst = vi.fn();
const taskCreate = vi.fn();
const taskFindMany = vi.fn();
const taskUpdateMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    person: {
      findFirst: (...a: unknown[]) => personFindFirst(...a),
    },
    task: {
      create: (...a: unknown[]) => taskCreate(...a),
      findMany: (...a: unknown[]) => taskFindMany(...a),
      updateMany: (...a: unknown[]) => taskUpdateMany(...a),
    },
  },
}));

import {
  createTask,
  listOpenTasksDue,
  completeTask,
  snoozeTask,
} from "@/server/data/tasks";
import { endOfUtcDay } from "@/server/today/dates";

beforeEach(() => {
  for (const fn of [personFindFirst, taskCreate, taskFindMany, taskUpdateMany]) {
    fn.mockReset();
  }
});

describe("createTask", () => {
  it("asserts person ownership BEFORE creating (personId is required)", async () => {
    personFindFirst.mockResolvedValue({ id: "p1", userId: "u1" });
    taskCreate.mockResolvedValue({ id: "t1" });
    await createTask("u1", {
      title: "Call Ada",
      dueAt: new Date("2026-06-12T00:00:00.000Z"),
      personId: "p1",
      note: null,
    });
    expect(personFindFirst.mock.calls[0][0].where).toMatchObject({
      id: "p1",
      userId: "u1",
    });
    expect(personFindFirst.mock.invocationCallOrder[0]).toBeLessThan(
      taskCreate.mock.invocationCallOrder[0],
    );
    expect(taskCreate.mock.calls[0][0].data.personId).toBe("p1");
  });

  it("refuses (throws) when the linked person is not owned", async () => {
    personFindFirst.mockResolvedValue(null);
    await expect(
      createTask("u1", {
        title: "x",
        dueAt: new Date(),
        personId: "p-other",
        note: null,
      }),
    ).rejects.toThrow();
    expect(taskCreate).not.toHaveBeenCalled();
  });
});

describe("listOpenTasksDue", () => {
  it("scopes by userId + status todo + dueAt <= end of today", () => {
    const now = new Date("2026-06-12T10:00:00.000Z");
    listOpenTasksDue("u1", now);
    const where = taskFindMany.mock.calls[0][0].where;
    expect(where.userId).toBe("u1");
    expect(where.status).toBe("todo");
    expect(where.dueAt.lte.toISOString()).toBe(endOfUtcDay(now).toISOString());
  });
});

describe("completeTask", () => {
  it("scopes the update by { id, userId } and sets status done", () => {
    taskUpdateMany.mockResolvedValue({ count: 1 });
    completeTask("u1", "t1");
    expect(taskUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "t1", userId: "u1" },
      data: { status: "done" },
    });
  });
});

describe("snoozeTask", () => {
  it("scopes by { id, userId } and pushes dueAt to now + days", () => {
    taskUpdateMany.mockResolvedValue({ count: 1 });
    const now = new Date("2026-06-12T10:00:00.000Z");
    snoozeTask("u1", "t1", 3, now);
    const arg = taskUpdateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "t1", userId: "u1" });
    expect(arg.data.dueAt.toISOString()).toBe("2026-06-15T10:00:00.000Z");
  });
});
