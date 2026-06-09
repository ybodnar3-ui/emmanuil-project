import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { resolveDefaultLocale } from "@/server/auth";

describe("resolveDefaultLocale", () => {
  it("passes through a supported locale", () => {
    expect(resolveDefaultLocale("uk")).toBe("uk");
    expect(resolveDefaultLocale("en")).toBe("en");
  });

  it("falls back to the default locale for unsupported values", () => {
    expect(resolveDefaultLocale("fr")).toBe(DEFAULT_LOCALE);
    expect(resolveDefaultLocale("")).toBe(DEFAULT_LOCALE);
  });

  it("falls back to the default locale when undefined/null", () => {
    expect(resolveDefaultLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveDefaultLocale(null)).toBe(DEFAULT_LOCALE);
  });
});
