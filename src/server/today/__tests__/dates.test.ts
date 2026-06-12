import { describe, it, expect } from "vitest";
import {
  startOfUtcDay,
  endOfUtcDay,
  addUtcDays,
  isCadenceDue,
  daysUntilBirthday,
} from "../dates";

describe("startOfUtcDay / endOfUtcDay", () => {
  it("returns 00:00:00.000Z of the UTC date", () => {
    const d = new Date("2026-06-12T14:37:22.123Z");
    expect(startOfUtcDay(d).toISOString()).toBe("2026-06-12T00:00:00.000Z");
  });

  it("returns 23:59:59.999Z of the UTC date", () => {
    const d = new Date("2026-06-12T14:37:22.123Z");
    expect(endOfUtcDay(d).toISOString()).toBe("2026-06-12T23:59:59.999Z");
  });

  it("does not mutate its input", () => {
    const d = new Date("2026-06-12T14:37:22.123Z");
    startOfUtcDay(d);
    expect(d.toISOString()).toBe("2026-06-12T14:37:22.123Z");
  });
});

describe("addUtcDays", () => {
  it("adds whole days using UTC ms math", () => {
    const d = new Date("2026-06-12T08:00:00.000Z");
    expect(addUtcDays(d, 3).toISOString()).toBe("2026-06-15T08:00:00.000Z");
  });

  it("rolls across month boundaries", () => {
    const d = new Date("2026-01-30T00:00:00.000Z");
    expect(addUtcDays(d, 3).toISOString()).toBe("2026-02-02T00:00:00.000Z");
  });
});

describe("isCadenceDue", () => {
  const now = new Date("2026-06-12T10:00:00.000Z");

  it("is true when nextDueAt is earlier today (overdue/today)", () => {
    expect(isCadenceDue(new Date("2026-06-12T00:00:00.000Z"), now)).toBe(true);
  });

  it("is true at the very end of today's UTC day", () => {
    expect(isCadenceDue(new Date("2026-06-12T23:59:59.999Z"), now)).toBe(true);
  });

  it("is true when nextDueAt is in the past", () => {
    expect(isCadenceDue(new Date("2026-06-01T00:00:00.000Z"), now)).toBe(true);
  });

  it("is false when nextDueAt is tomorrow or later", () => {
    expect(isCadenceDue(new Date("2026-06-13T00:00:00.000Z"), now)).toBe(false);
  });
});

describe("daysUntilBirthday", () => {
  // now is mid-day to prove the helper compares whole UTC days, not instants.
  const now = new Date("2026-06-12T15:00:00.000Z");

  it("returns 0 when the birthday is today (year ignored)", () => {
    expect(daysUntilBirthday(new Date("1990-06-12T00:00:00.000Z"), now)).toBe(0);
  });

  it("returns the whole-day count for a birthday later this month", () => {
    expect(daysUntilBirthday(new Date("1985-06-15T00:00:00.000Z"), now)).toBe(3);
  });

  it("rolls over to next year when the birthday already passed this year", () => {
    // June 1 has passed; next occurrence is 2027-06-01.
    expect(daysUntilBirthday(new Date("1970-06-01T00:00:00.000Z"), now)).toBe(354);
  });

  it("treats a Feb 29 birthday as Mar 1 in a common (non-leap) year", () => {
    // 2026 is not a leap year. From Jan 1 2026, Feb 29 → Mar 1 = day 59 (0-indexed).
    const jan1 = new Date("2026-01-01T00:00:00.000Z");
    const mar1 = new Date("2026-03-01T00:00:00.000Z");
    const expected = Math.round(
      (mar1.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000),
    );
    expect(daysUntilBirthday(new Date("2000-02-29T00:00:00.000Z"), jan1)).toBe(
      expected,
    );
  });

  it("returns 0 for a Feb 29 birthday when today IS Feb 29 in a leap year", () => {
    const feb29 = new Date("2028-02-29T00:00:00.000Z"); // 2028 is a leap year
    expect(daysUntilBirthday(new Date("2000-02-29T00:00:00.000Z"), feb29)).toBe(
      0,
    );
  });
});
