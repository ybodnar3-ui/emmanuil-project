import { describe, it, expect } from "vitest";
import { normalizeLocale, DEFAULT_LOCALE, LOCALES } from "@/i18n/locale";

describe("normalizeLocale", () => {
  it("returns the locale when supported", () => {
    expect(normalizeLocale("uk")).toBe("uk");
    expect(normalizeLocale("en")).toBe("en");
  });
  it("falls back to default for unknown or empty values", () => {
    expect(normalizeLocale("fr")).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
  });
  it("defaults to English", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toContain("uk");
  });
});
