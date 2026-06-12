import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildInterpretContext,
  buildAnswerContext,
  interpretMessage,
  answerQuestion,
  type RosterEntry,
} from "../assistant";
import type { PersonForBrief } from "../brief";

// Mock the client module so no real network call is made. `parse` (structured
// interpretation) and `create` (plain-text answer) are spies reconfigured per
// test; `getAnthropic` returns a stub exposing both.
const parse = vi.fn();
const create = vi.fn();
vi.mock("../client", () => ({
  BRIEF_MODEL: "claude-sonnet-4-6",
  getAnthropic: () => ({ messages: { parse, create } }),
}));

function roster(): RosterEntry[] {
  return [
    { id: "p1", fullName: "Maria Kovalenko", tags: ["mentor", "design"] },
    { id: "p2", fullName: "Bohdan Tkachenko", tags: [] },
  ];
}

describe("buildInterpretContext", () => {
  it("includes each roster entry (id + name + tags), the message, and the locale", () => {
    const ctx = buildInterpretContext(roster(), "what do I know about Maria?", "en");
    expect(ctx).toContain("- p1 — Maria Kovalenko — mentor, design");
    expect(ctx).toContain("- p2 — Bohdan Tkachenko");
    expect(ctx).toContain("User message: what do I know about Maria?");
    expect(ctx).toContain("Reply in locale: en");
  });

  it("renders an empty roster as '(none yet)' without throwing", () => {
    const ctx = buildInterpretContext([], "hi", "uk");
    expect(ctx).toContain("(none yet)");
    expect(ctx).toContain("User message: hi");
    expect(ctx).toContain("Reply in locale: uk");
    expect(ctx).not.toContain("undefined");
  });
});

describe("buildAnswerContext", () => {
  it("includes the person block, the question, and the locale", () => {
    const ctx = buildAnswerContext(
      "Name: Maria Kovalenko\nFacts:\n- [work] Leads design",
      "where does she work?",
      "uk",
    );
    expect(ctx).toContain("Name: Maria Kovalenko");
    expect(ctx).toContain("Question: where does she work?");
    expect(ctx).toContain("locale: uk");
    expect(ctx).toContain("ONLY the data above");
  });
});

describe("interpretMessage (mocked client)", () => {
  beforeEach(() => {
    parse.mockReset();
  });

  it("query: returns the interpretation intact and includes the roster name in the request", async () => {
    const interpretation = {
      intent: "query",
      personId: "p1",
      mentionedName: "Maria",
      question: "Where does she work?",
      proposedFacts: [],
      proposedInteraction: null,
      reply: "Here is what you know about Maria.",
    };
    parse.mockResolvedValue({ parsed_output: interpretation });

    const result = await interpretMessage(roster(), "what do I know about Maria?", "en");

    expect(result).toEqual({ status: "ok", interpretation });
    expect(parse).toHaveBeenCalledOnce();
    const args = parse.mock.calls[0]![0];
    expect(args.model).toBe("claude-sonnet-4-6");
    const userContent = args.messages[0].content as string;
    expect(userContent).toContain("Maria Kovalenko");
    expect(userContent).toContain("what do I know about Maria?");
    // The no-invention system instruction must be present.
    expect(args.system).toContain("never invent");
  });

  it("capture: returns the extracted proposed facts intact", async () => {
    const interpretation = {
      intent: "capture",
      personId: "p1",
      mentionedName: "Maria",
      question: null,
      proposedFacts: [{ category: "family", content: "son studies in London" }],
      proposedInteraction: null,
      reply: "Want me to save that?",
    };
    parse.mockResolvedValue({ parsed_output: interpretation });

    const result = await interpretMessage(
      roster(),
      "add that her son studies in London",
      "en",
    );

    expect(result).toEqual({ status: "ok", interpretation });
  });

  it("clarify: returns an unresolved (personId=null) interpretation intact", async () => {
    const interpretation = {
      intent: "clarify",
      personId: null,
      mentionedName: "Alex",
      question: null,
      proposedFacts: [],
      proposedInteraction: null,
      reply: "Which Alex do you mean?",
    };
    parse.mockResolvedValue({ parsed_output: interpretation });

    const result = await interpretMessage(roster(), "Alex got a new job", "en");

    expect(result).toEqual({ status: "ok", interpretation });
  });

  it("returns PARSE_FAILED (no throw) when the model returns no parsed output", async () => {
    parse.mockResolvedValue({ parsed_output: null });
    const result = await interpretMessage(roster(), "hi", "en");
    expect(result).toEqual({ status: "error", message: "PARSE_FAILED" });
  });

  it("returns REQUEST_FAILED on throw without leaking the provider message or key", async () => {
    parse.mockRejectedValue(new Error("401 invalid x-api-key sk-ant-secret"));
    const result = await interpretMessage(roster(), "hi", "en");
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.message).toBe("REQUEST_FAILED");
    expect(JSON.stringify(result)).not.toContain("sk-ant");
    expect(JSON.stringify(result)).not.toContain("x-api-key");
  });
});

describe("answerQuestion (mocked client)", () => {
  beforeEach(() => {
    create.mockReset();
  });

  function person(): PersonForBrief {
    return {
      fullName: "Maria Kovalenko",
      tags: [],
      facts: [{ category: "work", content: "Leads design at a fintech startup" }],
      interactions: [],
    };
  }

  it("returns ok with joined text blocks and passes the person's data into the request", async () => {
    create.mockResolvedValue({
      content: [
        { type: "text", text: "She leads design " },
        { type: "text", text: "at a fintech startup." },
      ],
    });

    const result = await answerQuestion(person(), "Where does she work?", "en");

    expect(result).toEqual({
      status: "ok",
      answer: "She leads design at a fintech startup.",
    });
    const args = create.mock.calls[0]![0];
    expect(args.model).toBe("claude-sonnet-4-6");
    const userContent = args.messages[0].content as string;
    expect(userContent).toContain("Leads design at a fintech startup");
    expect(userContent).toContain("Where does she work?");
    expect(args.system).toContain("ONLY the provided data");
  });

  it("returns REQUEST_FAILED when the response has no text content", async () => {
    create.mockResolvedValue({ content: [] });
    const result = await answerQuestion(person(), "q", "en");
    expect(result).toEqual({ status: "error", message: "REQUEST_FAILED" });
  });

  it("returns REQUEST_FAILED on throw without leaking the key", async () => {
    create.mockRejectedValue(new Error("500 sk-ant-leak"));
    const result = await answerQuestion(person(), "q", "en");
    expect(result.status).toBe("error");
    if (result.status === "error") expect(result.message).toBe("REQUEST_FAILED");
    expect(JSON.stringify(result)).not.toContain("sk-ant");
  });
});
