import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildBriefContext, generateBrief, type PersonForBrief } from "../brief";

// Mock the client module so no real network call is made. `parse` is a spy we
// reconfigure per test; `getAnthropic` returns a stub exposing it.
const parse = vi.fn();
vi.mock("../client", () => ({
  BRIEF_MODEL: "claude-sonnet-4-6",
  getAnthropic: () => ({ messages: { parse } }),
}));

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

describe("generateBrief (mocked client)", () => {
  beforeEach(() => {
    parse.mockReset();
  });

  it("returns ok with the parsed brief and passes the person's facts into the request", async () => {
    const brief = {
      summary: "A close friend who leads design.",
      talkingPoints: ["Her new role"],
      askAbout: ["How is Sofia?"],
      reconnectReason: "It has been a month.",
    };
    parse.mockResolvedValue({ parsed_output: brief });

    const result = await generateBrief(fullPerson(), "en");

    expect(result).toEqual({ status: "ok", brief });

    // The person's facts must have been included in the model input.
    expect(parse).toHaveBeenCalledOnce();
    const args = parse.mock.calls[0]![0];
    expect(args.model).toBe("claude-sonnet-4-6");
    const userContent = args.messages[0].content as string;
    expect(userContent).toContain("Leads design at a fintech startup");
    expect(userContent).toContain("Respond in locale: en");
  });

  it("returns an error (no throw) when the model returns no parsed output", async () => {
    parse.mockResolvedValue({ parsed_output: null });

    const result = await generateBrief(fullPerson(), "en");

    expect(result).toEqual({ status: "error", message: "PARSE_FAILED" });
  });

  it("resolves to a stable error code when the API throws, without leaking the provider message", async () => {
    parse.mockRejectedValue(new Error("401 invalid x-api-key sk-ant-secret"));

    const result = await generateBrief(fullPerson(), "en");

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toBe("REQUEST_FAILED");
      // The raw provider error / any secret must NOT be surfaced.
      expect(result.message).not.toContain("x-api-key");
      expect(result.message).not.toContain("sk-ant");
      expect(result.message).not.toContain("401");
    }
  });
});
