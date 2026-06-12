import { describe, it, expect } from "vitest";
import {
  personInputSchema,
  cadenceInputSchema,
} from "@/server/validation/person";

describe("personInputSchema", () => {
  it("rejects an empty fullName", () => {
    const result = personInputSchema.safeParse({ fullName: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a minimal valid object and defaults tags to []", () => {
    const result = personInputSchema.safeParse({ fullName: "Ada Lovelace" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Ada Lovelace");
      expect(result.data.tags).toEqual([]);
    }
  });

  it("coerces a birthday string into a Date", () => {
    const result = personInputSchema.safeParse({
      fullName: "Ada",
      birthday: "1990-12-10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.birthday).toBeInstanceOf(Date);
      expect(result.data.birthday?.toISOString()).toBe(
        "1990-12-10T00:00:00.000Z",
      );
    }
  });

  it("rejects an invalid relationshipTier", () => {
    const result = personInputSchema.safeParse({
      fullName: "Ada",
      relationshipTier: "enemy",
    });
    expect(result.success).toBe(false);
  });
});

describe("cadenceInputSchema", () => {
  it("rejects zero and negative intervals", () => {
    expect(cadenceInputSchema.safeParse({ intervalDays: 0 }).success).toBe(
      false,
    );
    expect(cadenceInputSchema.safeParse({ intervalDays: -5 }).success).toBe(
      false,
    );
  });

  it("coerces a numeric string interval", () => {
    const result = cadenceInputSchema.safeParse({ intervalDays: "30" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.intervalDays).toBe(30);
  });
});
