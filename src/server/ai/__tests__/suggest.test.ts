import { describe, it, expect, vi, beforeEach } from "vitest";
import { suggestTalkingPoint } from "../suggest";
import type { PersonForBrief } from "../brief";

// Mock the client module so no real network call is made. `create` is a spy we
// reconfigure per test; `getAnthropic` returns a stub exposing it.
const create = vi.fn();
vi.mock("../client", () => ({
  BRIEF_MODEL: "claude-sonnet-4-6",
  getAnthropic: () => ({ messages: { create } }),
}));

function person(): PersonForBrief {
  return {
    fullName: "Maria Kovalenko",
    location: "Lviv",
    relationshipTier: "friend",
    tags: ["mentor"],
    facts: [{ category: "family", content: "Has a daughter named Sofia" }],
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

function textResponse(text: string) {
  return { content: [{ type: "text", text }] };
}

describe("suggestTalkingPoint (mocked client)", () => {
  beforeEach(() => {
    create.mockReset();
  });

  it("returns ok with the suggestion, and the person's data + occasion are in the request", async () => {
    create.mockResolvedValue(textResponse("Ask how Sofia is settling in."));

    const result = await suggestTalkingPoint(
      person(),
      "time to reconnect (cadence due)",
      "en",
    );

    expect(result).toEqual({
      status: "ok",
      suggestion: "Ask how Sofia is settling in.",
    });

    expect(create).toHaveBeenCalledOnce();
    const args = create.mock.calls[0]![0];
    expect(args.model).toBe("claude-sonnet-4-6");
    const userContent = args.messages[0].content as string;
    // Person data present
    expect(userContent).toContain("Has a daughter named Sofia");
    // Occasion present
    expect(userContent).toContain("time to reconnect (cadence due)");
    // Locale instruction present
    expect(userContent).toContain("Respond in locale: en");
  });

  it("returns an error when the model returns no text", async () => {
    create.mockResolvedValue({ content: [] });
    const result = await suggestTalkingPoint(person(), "birthday in 2 days", "en");
    expect(result).toEqual({ status: "error", message: "PARSE_FAILED" });
  });

  it("returns an error when the model returns empty/whitespace text", async () => {
    create.mockResolvedValue(textResponse("   "));
    const result = await suggestTalkingPoint(person(), "birthday in 2 days", "en");
    expect(result).toEqual({ status: "error", message: "PARSE_FAILED" });
  });

  it("resolves to a stable error code on throw, without leaking provider message/key", async () => {
    create.mockRejectedValue(new Error("401 invalid x-api-key sk-ant-secret"));

    const result = await suggestTalkingPoint(person(), "a task title", "uk");

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toBe("REQUEST_FAILED");
    }
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("x-api-key");
    expect(serialized).not.toContain("sk-ant");
    expect(serialized).not.toContain("401");
  });
});
