import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Error-degradation contract for the Today server actions: when a data-layer
 * call throws (e.g. the person/task was deleted between page render and the
 * user's click, so an ownership assert fails), the action returns a stable
 * result shape instead of crashing to Next's error page.
 *
 * requireUser, revalidatePath, locale and the data layer are all mocked so the
 * tests exercise only the actions' own try/catch wiring.
 */

const requireUser = vi.fn();
const markContacted = vi.fn();
const snoozeCadence = vi.fn();
const createTask = vi.fn();

vi.mock("@/server/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/i18n/locale", () => ({
  getLocaleFromCookie: vi.fn().mockResolvedValue("en"),
}));
vi.mock("@/server/data/cadenceActions", () => ({
  markContacted: (...a: unknown[]) => markContacted(...a),
  snoozeCadence: (...a: unknown[]) => snoozeCadence(...a),
}));
vi.mock("@/server/data/tasks", () => ({
  createTask: (...a: unknown[]) => createTask(...a),
  completeTask: vi.fn(),
  snoozeTask: vi.fn(),
}));
vi.mock("@/server/data/people", () => ({ getPerson: vi.fn() }));
vi.mock("@/server/ai/suggest", () => ({ suggestTalkingPoint: vi.fn() }));

import {
  markContactedAction,
  snoozeContactAction,
  createTaskAction,
} from "../actions";

beforeEach(() => {
  for (const fn of [requireUser, markContacted, snoozeCadence, createTask]) {
    fn.mockReset();
  }
  requireUser.mockResolvedValue({ id: "u1" });
});

describe("markContactedAction", () => {
  it("returns NOT_FOUND error when the data layer throws", async () => {
    markContacted.mockRejectedValue(new Error("Person not found"));
    const result = await markContactedAction("p1");
    expect(result).toEqual({ status: "error", message: "NOT_FOUND" });
  });

  it("returns ok on success", async () => {
    markContacted.mockResolvedValue(undefined);
    const result = await markContactedAction("p1");
    expect(result).toEqual({ status: "ok" });
  });
});

describe("snoozeContactAction", () => {
  it("returns NOT_FOUND error when the data layer throws", async () => {
    snoozeCadence.mockRejectedValue(new Error("Person not found"));
    const result = await snoozeContactAction("p1", 3);
    expect(result).toEqual({ status: "error", message: "NOT_FOUND" });
  });
});

describe("createTaskAction", () => {
  function form(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return fd;
  }

  it("returns a personId field error when createTask throws", async () => {
    createTask.mockRejectedValue(new Error("Person not found"));
    const result = await createTaskAction(
      { status: "idle" },
      form({ title: "Call Sam", dueAt: "2026-06-20", personId: "p1" }),
    );
    expect(result).toEqual({
      status: "error",
      fieldErrors: { personId: "NOT_FOUND" },
    });
  });

  it("returns zod field errors without calling the data layer on invalid input", async () => {
    const result = await createTaskAction(
      { status: "idle" },
      form({ title: "", dueAt: "" }),
    );
    expect(result.status).toBe("error");
    expect(createTask).not.toHaveBeenCalled();
  });
});
