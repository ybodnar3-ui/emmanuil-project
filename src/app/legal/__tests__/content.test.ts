import { describe, expect, it } from "vitest";
import { PRIVACY, TERMS, OPERATOR, EFFECTIVE_DATE } from "../content";

describe("legal content", () => {
  it("privacy has matching section counts across locales", () => {
    expect(PRIVACY.uk.sections.length).toBe(PRIVACY.en.sections.length);
    expect(PRIVACY.en.sections.length).toBeGreaterThan(0);
  });
  it("terms has matching section counts across locales", () => {
    expect(TERMS.uk.sections.length).toBe(TERMS.en.sections.length);
    expect(TERMS.en.sections.length).toBeGreaterThan(0);
  });
  it("every section has a heading and at least one paragraph (both locales)", () => {
    for (const doc of [PRIVACY.en, PRIVACY.uk, TERMS.en, TERMS.uk]) {
      for (const s of doc.sections) {
        expect(s.heading.length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(0);
      }
    }
  });
  it("exposes operator contact + effective date", () => {
    expect(OPERATOR.contact).toContain("@");
    expect(EFFECTIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
