import { describe, it, expect } from "vitest";
import { computeNextDueAt, INTERVAL_PRESETS } from "@/server/cadence";

describe("computeNextDueAt", () => {
  it("adds intervalDays to the from date (UTC)", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(computeNextDueAt(from, 14).toISOString()).toBe(
      "2026-01-15T00:00:00.000Z",
    );
    expect(computeNextDueAt(from, 30).toISOString()).toBe(
      "2026-01-31T00:00:00.000Z",
    );
  });
  it("rejects non-positive intervals", () => {
    expect(() => computeNextDueAt(new Date(), 0)).toThrow();
    expect(() => computeNextDueAt(new Date(), -5)).toThrow();
  });
  it("exposes presets 14/30/90/365", () => {
    expect(INTERVAL_PRESETS).toEqual([14, 30, 90, 365]);
  });
});
