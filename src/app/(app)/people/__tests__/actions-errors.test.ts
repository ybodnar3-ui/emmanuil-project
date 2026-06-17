import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Error-degradation contract for the People server actions: when a data-layer
 * call throws (typically because assertPersonOwned fails — the row was deleted
 * between render and submit), the action must return a typed { status: "error" }
 * result (or, for the void/redirect actions, complete idempotently) AND log the
 * failure server-side — never crash to Next's error page.
 *
 * requireUser, next/cache, next/navigation, the data layer, storage and the AI
 * brief are all mocked so the tests exercise only the actions' own try/catch
 * wiring. No real DB or network.
 */

const requireUser = vi.fn();
const createPerson = vi.fn();
const updatePerson = vi.fn();
const deletePerson = vi.fn();
const addFact = vi.fn();
const logInteraction = vi.fn();
const setCadence = vi.fn();
const clearCadence = vi.fn();
const createTask = vi.fn();
const logError = vi.fn();

class RedirectError extends Error {}
// next/navigation's redirect throws to halt execution; emulate that so the
// void/redirect actions don't fall through.
const redirect = vi.fn(() => {
  throw new RedirectError("REDIRECT");
});

vi.mock("@/server/auth", () => ({
  requireUser: (...a: unknown[]) => requireUser(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (...a: unknown[]) => redirect(...a),
}));
vi.mock("@/i18n/locale", () => ({
  getLocaleFromCookie: vi.fn().mockResolvedValue("en"),
}));
vi.mock("@/server/log", () => ({
  logError: (...a: unknown[]) => logError(...a),
}));
vi.mock("@/server/data/people", () => ({
  createPerson: (...a: unknown[]) => createPerson(...a),
  updatePerson: (...a: unknown[]) => updatePerson(...a),
  deletePerson: (...a: unknown[]) => deletePerson(...a),
  updatePersonPhoto: vi.fn(),
  getPerson: vi.fn(),
}));
vi.mock("@/server/data/facts", () => ({
  addFact: (...a: unknown[]) => addFact(...a),
  deleteFact: vi.fn(),
}));
vi.mock("@/server/data/interactions", () => ({
  logInteraction: (...a: unknown[]) => logInteraction(...a),
}));
vi.mock("@/server/data/cadence", () => ({
  setCadence: (...a: unknown[]) => setCadence(...a),
  clearCadence: (...a: unknown[]) => clearCadence(...a),
}));
vi.mock("@/server/data/tasks", () => ({
  createTask: (...a: unknown[]) => createTask(...a),
}));
vi.mock("@/server/ai/brief", () => ({ generateBrief: vi.fn() }));
vi.mock("@/server/storage", () => ({
  ensureAvatarsBucket: vi.fn(),
  uploadAvatar: vi.fn(),
}));

import {
  createPersonAction,
  addFactAction,
  setCadenceAction,
  deletePersonAction,
  clearCadenceAction,
  createReminderAction,
} from "../actions";
import { fieldErrorsFromZod } from "../field-errors";
import { z } from "zod";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  for (const fn of [
    requireUser,
    createPerson,
    updatePerson,
    deletePerson,
    addFact,
    logInteraction,
    setCadence,
    clearCadence,
    createTask,
    logError,
    redirect,
  ]) {
    fn.mockReset();
  }
  requireUser.mockResolvedValue({ id: "u1" });
  redirect.mockImplementation(() => {
    throw new RedirectError("REDIRECT");
  });
});

describe("fieldErrorsFromZod (bare-key contract)", () => {
  // The People forms render field errors with useTranslations("people"), so the
  // stored values MUST be bare, namespace-relative keys (e.g. "errors.invalid").
  // A full path like "people.errors.invalid" would be re-prefixed by the scoped
  // translator to "people.people.errors.invalid" and leak the raw key string to
  // the user. This locks the contract so that regression can't silently return.
  function zodErrorFor(fields: string[]): z.ZodError {
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const f of fields) shape[f] = z.string().min(1);
    const result = z.object(shape).safeParse({});
    if (result.success) throw new Error("expected parse to fail");
    return result.error;
  }

  it("stores bare, people-relative keys (not full paths)", () => {
    const out = fieldErrorsFromZod(zodErrorFor(["fullName", "intervalDays"]));
    for (const value of Object.values(out)) {
      expect(value).toMatch(/^errors\./);
      expect(value).not.toMatch(/^people\./);
    }
    expect(out.fullName).toBe("errors.invalid");
  });

  it("surfaces a bare field-error key from a real action on empty input", async () => {
    const result = await createPersonAction(
      { status: "idle" },
      form({ fullName: "" }),
    );
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.fieldErrors?.fullName).toBe("errors.invalid");
    // createPerson must NOT run when validation fails.
    expect(createPerson).not.toHaveBeenCalled();
  });
});

describe("createPersonAction", () => {
  it("returns saveFailed and logs when createPerson throws", async () => {
    createPerson.mockRejectedValue(new Error("db down"));
    const result = await createPersonAction(
      { status: "idle" },
      form({ fullName: "Sam Smith" }),
    );
    expect(result).toEqual({
      status: "error",
      message: "people.errors.saveFailed",
    });
    expect(logError).toHaveBeenCalledWith(
      "action.createPerson",
      expect.any(Error),
      { userId: "u1" },
    );
  });
});

describe("addFactAction", () => {
  it("returns notFound and logs when addFact throws", async () => {
    addFact.mockRejectedValue(new Error("not owned"));
    const result = await addFactAction("p1", { status: "idle" }, form({
      category: "work",
      content: "Works at Acme",
    }));
    expect(result).toEqual({
      status: "error",
      message: "people.errors.notFound",
    });
    expect(logError).toHaveBeenCalledWith(
      "action.addFact",
      expect.any(Error),
      { userId: "u1", personId: "p1" },
    );
  });
});

describe("setCadenceAction", () => {
  it("returns notFound and logs when setCadence throws", async () => {
    setCadence.mockRejectedValue(new Error("not owned"));
    const result = await setCadenceAction("p1", { status: "idle" }, form({
      intervalDays: "30",
    }));
    expect(result).toEqual({
      status: "error",
      message: "people.errors.notFound",
    });
    expect(logError).toHaveBeenCalledWith(
      "action.setCadence",
      expect.any(Error),
      { userId: "u1", personId: "p1" },
    );
  });
});

describe("deletePersonAction (idempotent)", () => {
  it("logs but still redirects when deletePerson throws", async () => {
    deletePerson.mockRejectedValue(new Error("already gone"));
    await expect(
      deletePersonAction(form({ personId: "p1" })),
    ).rejects.toBeInstanceOf(RedirectError);
    expect(logError).toHaveBeenCalledWith(
      "action.deletePerson",
      expect.any(Error),
      { userId: "u1", personId: "p1" },
    );
    expect(redirect).toHaveBeenCalledWith("/people");
  });
});

describe("createReminderAction", () => {
  it("creates a reminder anchored to the bound person on the happy path", async () => {
    createTask.mockResolvedValue({ id: "t1" });
    const result = await createReminderAction(
      "p1",
      { status: "idle" },
      form({ title: "Send the article", dueAt: "2026-06-25" }),
    );
    expect(result).toEqual({ status: "ok" });
    expect(createTask).toHaveBeenCalledOnce();
    const [userId, input] = createTask.mock.calls[0];
    expect(userId).toBe("u1");
    expect(input.personId).toBe("p1");
    expect(input.title).toBe("Send the article");
  });

  it("returns bare reminder field-error keys on invalid input without touching the data layer", async () => {
    const result = await createReminderAction(
      "p1",
      { status: "idle" },
      form({ title: "", dueAt: "" }),
    );
    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.fieldErrors?.title).toBe("reminder.errors.invalid");
    expect(createTask).not.toHaveBeenCalled();
  });

  it("returns notFound and logs when createTask throws (person deleted / not owned)", async () => {
    createTask.mockRejectedValue(new Error("Person not found"));
    const result = await createReminderAction(
      "p1",
      { status: "idle" },
      form({ title: "Call them", dueAt: "2026-06-25" }),
    );
    expect(result).toEqual({
      status: "error",
      message: "people.reminder.errors.notFound",
    });
    expect(logError).toHaveBeenCalledWith(
      "action.createReminder",
      expect.any(Error),
      { userId: "u1", personId: "p1" },
    );
  });
});

describe("clearCadenceAction (idempotent)", () => {
  it("logs but does not throw when clearCadence throws", async () => {
    clearCadence.mockRejectedValue(new Error("already gone"));
    await expect(
      clearCadenceAction(form({ personId: "p1" })),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      "action.clearCadence",
      expect.any(Error),
      { userId: "u1", personId: "p1" },
    );
  });
});
