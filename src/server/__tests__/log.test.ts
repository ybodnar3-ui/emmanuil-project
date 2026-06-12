import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "../log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logError", () => {
  it("emits a single valid JSON line containing scope, message and meta", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("test.scope", new Error("boom"), { userId: "u1", count: 3 });

    expect(spy).toHaveBeenCalledTimes(1);
    const raw = spy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed).toMatchObject({
      level: "error",
      scope: "test.scope",
      message: "boom",
      name: "Error",
      userId: "u1",
      count: 3,
    });
  });

  it("does not throw when given a non-Error value", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => logError("s", "a plain string")).not.toThrow();
    expect(() => logError("s", { weird: true })).not.toThrow();
    expect(() => logError("s", null)).not.toThrow();
    expect(() => logError("s", undefined)).not.toThrow();

    // Each call still produced parseable JSON with a string message.
    for (const call of spy.mock.calls) {
      const parsed = JSON.parse(call[0] as string);
      expect(typeof parsed.message).toBe("string");
      expect(parsed.scope).toBe("s");
    }
  });

  it("includes a `code` field when the error carries a string code", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("nope"), { code: "P2025" });
    logError("db.scope", err);
    const parsed = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(parsed.code).toBe("P2025");
  });
});
