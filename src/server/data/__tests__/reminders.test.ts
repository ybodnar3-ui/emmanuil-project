import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Caching / ownership / fallback contract for getOrCreateReminderPrompt
 * (db + AI both mocked — no real network/DB):
 *  - cache hit (fresh prompt) → returns it WITHOUT calling the AI or writing
 *  - new cycle (stale/null reminderPromptAt) → asserts ownership, calls the AI,
 *    persists the result on the Cadence, returns it
 *  - AI failure → returns the deterministic localized fallback (non-empty),
 *    still persisted
 *  - not owned → assertPersonOwned throws BEFORE any generation/write
 */

const cadenceFindUnique = vi.fn();
const cadenceUpdate = vi.fn();
const personFindFirst = vi.fn();
const assertPersonOwned = vi.fn();
const suggestTalkingPoint = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    cadence: {
      findUnique: (...a: unknown[]) => cadenceFindUnique(...a),
      update: (...a: unknown[]) => cadenceUpdate(...a),
    },
    person: { findFirst: (...a: unknown[]) => personFindFirst(...a) },
  },
}));
vi.mock("@/server/data/people", () => ({
  assertPersonOwned: (...a: unknown[]) => assertPersonOwned(...a),
}));
vi.mock("@/server/ai/suggest", () => ({
  suggestTalkingPoint: (...a: unknown[]) => suggestTalkingPoint(...a),
}));

import { getOrCreateReminderPrompt, fallbackPrompt } from "@/server/data/reminders";

const now = new Date("2026-06-17T10:00:00.000Z");

const personRow = {
  id: "p1",
  userId: "u1",
  fullName: "Ada Lovelace",
  howWeMet: null,
  location: null,
  birthday: null,
  relationshipTier: null,
  tags: [],
  facts: [{ category: "work", content: "Started a new role" }],
  interactions: [
    { date: new Date("2026-05-01T00:00:00.000Z"), channel: "call", summary: "Caught up" },
  ],
};

beforeEach(() => {
  for (const fn of [
    cadenceFindUnique,
    cadenceUpdate,
    personFindFirst,
    assertPersonOwned,
    suggestTalkingPoint,
  ]) {
    fn.mockReset();
  }
  assertPersonOwned.mockResolvedValue({ id: "p1", userId: "u1" });
  personFindFirst.mockResolvedValue(personRow);
  cadenceUpdate.mockResolvedValue({});
});

describe("getOrCreateReminderPrompt", () => {
  it("returns the cached prompt on a fresh cycle WITHOUT calling the AI or writing", async () => {
    cadenceFindUnique.mockResolvedValue({
      personId: "p1",
      reminderPrompt: "Ask about her new role.",
      reminderPromptAt: new Date("2026-06-16T00:00:00.000Z"),
      lastContactedAt: new Date("2026-06-10T00:00:00.000Z"),
    });
    const out = await getOrCreateReminderPrompt("u1", "p1", "en", now);
    expect(out).toBe("Ask about her new role.");
    expect(suggestTalkingPoint).not.toHaveBeenCalled();
    expect(cadenceUpdate).not.toHaveBeenCalled();
  });

  it("treats reminderPromptAt before lastContactedAt as stale and regenerates", async () => {
    cadenceFindUnique.mockResolvedValue({
      personId: "p1",
      reminderPrompt: "Old prompt",
      reminderPromptAt: new Date("2026-06-01T00:00:00.000Z"), // before last contact
      lastContactedAt: new Date("2026-06-10T00:00:00.000Z"),
    });
    suggestTalkingPoint.mockResolvedValue({ status: "ok", suggestion: "Fresh prompt" });
    const out = await getOrCreateReminderPrompt("u1", "p1", "en", now);
    expect(out).toBe("Fresh prompt");
    expect(suggestTalkingPoint).toHaveBeenCalledOnce();
    expect(cadenceUpdate.mock.calls[0][0]).toMatchObject({
      where: { personId: "p1" },
      data: { reminderPrompt: "Fresh prompt", reminderPromptAt: now },
    });
  });

  it("generates, persists and returns the AI suggestion when no prompt is cached", async () => {
    cadenceFindUnique.mockResolvedValue({
      personId: "p1",
      reminderPrompt: null,
      reminderPromptAt: null,
      lastContactedAt: null,
    });
    suggestTalkingPoint.mockResolvedValue({ status: "ok", suggestion: "  Ask about the move.  " });
    const out = await getOrCreateReminderPrompt("u1", "p1", "en", now);
    expect(assertPersonOwned).toHaveBeenCalledWith("u1", "p1");
    expect(suggestTalkingPoint).toHaveBeenCalledOnce();
    // The person handed to the AI is the owned, scoped row (facts/interactions).
    expect(suggestTalkingPoint.mock.calls[0][0]).toMatchObject({ fullName: "Ada Lovelace" });
    expect(out).toBe("Ask about the move."); // trimmed
    expect(cadenceUpdate.mock.calls[0][0].data.reminderPrompt).toBe("Ask about the move.");
  });

  it("falls back to the deterministic localized line when the AI errors, and persists it", async () => {
    cadenceFindUnique.mockResolvedValue({
      personId: "p1",
      reminderPrompt: null,
      reminderPromptAt: null,
      lastContactedAt: null,
    });
    suggestTalkingPoint.mockResolvedValue({ status: "error", message: "REQUEST_FAILED" });
    const out = await getOrCreateReminderPrompt("u1", "p1", "en", now);
    expect(out).toBe(fallbackPrompt("en"));
    expect(out.length).toBeGreaterThan(0);
    expect(cadenceUpdate.mock.calls[0][0].data.reminderPrompt).toBe(fallbackPrompt("en"));
  });

  it("uses the Ukrainian fallback for uk locale", async () => {
    cadenceFindUnique.mockResolvedValue({
      personId: "p1",
      reminderPrompt: null,
      reminderPromptAt: null,
      lastContactedAt: null,
    });
    suggestTalkingPoint.mockResolvedValue({ status: "ok", suggestion: "   " }); // empty → fallback
    const out = await getOrCreateReminderPrompt("u1", "p1", "uk", now);
    expect(out).toBe(fallbackPrompt("uk"));
    expect(fallbackPrompt("uk")).not.toBe(fallbackPrompt("en"));
  });

  it("returns the fallback (no generation, no write) when the person has no cadence", async () => {
    cadenceFindUnique.mockResolvedValue(null);
    const out = await getOrCreateReminderPrompt("u1", "p1", "en", now);
    expect(out).toBe(fallbackPrompt("en"));
    expect(suggestTalkingPoint).not.toHaveBeenCalled();
    expect(cadenceUpdate).not.toHaveBeenCalled();
  });

  it("does NOT generate or write for a person the caller does not own", async () => {
    assertPersonOwned.mockRejectedValue(new Error("Person not found"));
    await expect(getOrCreateReminderPrompt("u1", "p-other", "en", now)).rejects.toThrow();
    expect(suggestTalkingPoint).not.toHaveBeenCalled();
    expect(cadenceUpdate).not.toHaveBeenCalled();
    expect(cadenceFindUnique).not.toHaveBeenCalled();
  });
});
