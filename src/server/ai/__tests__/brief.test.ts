import { describe, it, expect } from "vitest";
import { buildBriefContext, type PersonForBrief } from "../brief";

function fullPerson(): PersonForBrief {
  return {
    fullName: "Maria Kovalenko",
    howWeMet: "Met at a conference in Kyiv",
    location: "Lviv",
    birthday: new Date("1990-05-01T00:00:00.000Z"),
    relationshipTier: "friend",
    tags: ["mentor", "design"],
    facts: [
      { category: "work", content: "Leads design at a fintech startup" },
      { category: "family", content: "Has a daughter named Sofia" },
    ],
    interactions: [
      {
        date: new Date("2026-05-10T00:00:00.000Z"),
        channel: "call",
        summary: "Caught up about her new role",
      },
    ],
    cadence: {
      intervalDays: 30,
      lastContactedAt: new Date("2026-05-10T00:00:00.000Z"),
      nextDueAt: new Date("2026-06-09T00:00:00.000Z"),
    },
  };
}

describe("buildBriefContext", () => {
  it("includes name, a fact line, an interaction line, and the cadence line", () => {
    const ctx = buildBriefContext(fullPerson(), "en");
    expect(ctx).toContain("Name: Maria Kovalenko");
    expect(ctx).toContain("- [work] Leads design at a fintech startup");
    expect(ctx).toContain("2026-05-10 (call): Caught up about her new role");
    expect(ctx).toContain("Cadence: every 30 days; next due 2026-06-09");
  });

  it("handles a minimal person without throwing and without emitting 'undefined'", () => {
    const minimal: PersonForBrief = {
      fullName: "Solo Person",
      tags: [],
      facts: [],
      interactions: [],
    };
    const ctx = buildBriefContext(minimal, "en");
    expect(ctx).toContain("Name: Solo Person");
    expect(ctx).not.toContain("undefined");
    // No facts/interactions/cadence sections when those are empty/absent.
    expect(ctx).not.toContain("Facts:");
    expect(ctx).not.toContain("Recent interactions");
    expect(ctx).not.toContain("Cadence:");
  });

  it("includes the locale instruction for the requested locale", () => {
    expect(buildBriefContext(fullPerson(), "uk")).toContain(
      "Respond in locale: uk",
    );
  });

  it("caps the interaction list at 10 entries", () => {
    const person = fullPerson();
    person.interactions = Array.from({ length: 12 }, (_, n) => ({
      date: new Date("2026-05-10T00:00:00.000Z"),
      channel: null,
      summary: `interaction ${n}`,
    }));
    const ctx = buildBriefContext(person, "en");
    expect(ctx).toContain("interaction 9");
    expect(ctx).not.toContain("interaction 10");
    expect(ctx).not.toContain("interaction 11");
  });
});
