import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Error-degradation contract for the home feed-item server actions: when a
 * data-layer call throws (e.g. the person/task was deleted between page render
 * and the user's click, so an ownership assert fails), the action returns a
 * stable result shape instead of crashing to Next's error page.
 *
 * requireUser, revalidatePath and the data layer are mocked so the tests
 * exercise only the actions' own try/catch wiring. Reminder creation and the
 * (now baked-in) personalized prompt live elsewhere, so they're not tested here.
 */

const requireUser = vi.fn();
const markContacted = vi.fn();
const snoozeCadence = vi.fn();
const completeTask = vi.fn();
const snoozeTask = vi.fn();

vi.mock("@/server/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/data/cadenceActions", () => ({
  markContacted: (...a: unknown[]) => markContacted(...a),
  snoozeCadence: (...a: unknown[]) => snoozeCadence(...a),
}));
vi.mock("@/server/data/tasks", () => ({
  completeTask: (...a: unknown[]) => completeTask(...a),
  snoozeTask: (...a: unknown[]) => snoozeTask(...a),
}));

import {
  markContactedAction,
  snoozeContactAction,
  completeTaskAction,
  snoozeTaskAction,
} from "../actions";

beforeEach(() => {
  for (const fn of [requireUser, markContacted, snoozeCadence, completeTask, snoozeTask]) {
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

describe("completeTaskAction", () => {
  it("returns NOT_FOUND error when the data layer throws", async () => {
    completeTask.mockRejectedValue(new Error("boom"));
    const result = await completeTaskAction("t1");
    expect(result).toEqual({ status: "error", message: "NOT_FOUND" });
  });

  it("returns ok on success", async () => {
    completeTask.mockResolvedValue({ count: 1 });
    const result = await completeTaskAction("t1");
    expect(result).toEqual({ status: "ok" });
  });
});

describe("snoozeTaskAction", () => {
  it("returns NOT_FOUND error when the data layer throws", async () => {
    snoozeTask.mockRejectedValue(new Error("boom"));
    const result = await snoozeTaskAction("t1", 7);
    expect(result).toEqual({ status: "error", message: "NOT_FOUND" });
  });
});
