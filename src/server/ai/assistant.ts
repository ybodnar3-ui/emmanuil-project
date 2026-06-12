import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic, BRIEF_MODEL } from "./client";
import { buildBriefContext, type PersonForBrief } from "./brief";
import { FACT_CATEGORIES, INTERACTION_CHANNELS } from "@/server/validation/person";

/**
 * The structured shape Claude returns when interpreting a user's message to the
 * assistant. The model is instructed to extract ONLY from the user's message and
 * to write `reply` in the user's locale. `personId` is resolved against the
 * roster we provide; `null` when no person clearly matches.
 */
export const interpretationSchema = z.object({
  intent: z.enum(["query", "capture", "clarify", "chat"]),
  personId: z.string().nullable(), // resolved from the provided roster, else null
  mentionedName: z.string().nullable(), // the name the user referred to, if any
  question: z.string().nullable(), // for intent="query": the question to answer
  proposedFacts: z
    .array(
      z.object({
        category: z.enum(FACT_CATEGORIES),
        content: z.string(),
      }),
    )
    .default([]),
  proposedInteraction: z
    .object({
      summary: z.string(),
      channel: z.enum(INTERACTION_CHANNELS).nullable().optional(),
    })
    .nullable()
    .default(null),
  reply: z.string(), // short natural-language message to show the user
});
export type Interpretation = z.infer<typeof interpretationSchema>;

/** A roster entry the model uses to resolve a referenced person to an id. */
export type RosterEntry = { id: string; fullName: string; tags: string[] };

/**
 * Pure: assemble the model input for interpretation. Lists the user's people
 * (id — name — tags) so the model can resolve a mentioned person to one of
 * those ids, then the user's message and the requested reply locale. No network,
 * no secrets — fully unit-testable. An empty roster renders "(none yet)".
 */
export function buildInterpretContext(
  roster: RosterEntry[],
  message: string,
  locale: string,
): string {
  const lines: string[] = [];
  lines.push(
    "People the user knows (id — name — tags). Resolve any person the user mentions to one of these ids; if none clearly match, set personId to null:",
  );
  if (roster.length === 0) lines.push("(none yet)");
  for (const p of roster) {
    lines.push(
      `- ${p.id} — ${p.fullName}${p.tags.length ? ` — ${p.tags.join(", ")}` : ""}`,
    );
  }
  lines.push("");
  lines.push(`User message: ${message}`);
  lines.push(`Reply in locale: ${locale}`);
  return lines.join("\n");
}

/**
 * Pure: assemble the model input for answering a question about a person.
 * `personBlock` is produced by `buildBriefContext` (reused) — the person's
 * stored data. The model is told to answer ONLY from that block.
 */
export function buildAnswerContext(
  personBlock: string,
  question: string,
  locale: string,
): string {
  return `${personBlock}\n\nQuestion: ${question}\nAnswer concisely in locale: ${locale}, using ONLY the data above.`;
}

const INTERPRET_SYSTEM = [
  "You interpret a user's message to their personal-CRM assistant.",
  "Classify intent: 'query' (asking what they know about someone), 'capture' (stating a new",
  "fact or a logged interaction to record about someone), 'clarify' (a person is referenced",
  "but you cannot resolve which), or 'chat' (anything else).",
  "Resolve any referenced person to an id from the provided roster, else personId=null.",
  "For 'capture', extract proposedFacts and/or a proposedInteraction ONLY from what the user",
  "stated — never invent. Always include a short 'reply'. Write reply in the requested locale.",
].join(" ");

/**
 * Discriminated result. `interpretMessage` NEVER throws to the caller and NEVER
 * leaks the API key or raw provider error text — on any failure it returns a
 * stable error code that the UI maps to a localized message (same contract as
 * Phase 4's `generateBrief`).
 */
export type InterpretResult =
  | { status: "ok"; interpretation: Interpretation }
  | { status: "error"; message: string };

/**
 * Interpret a user message against their roster via a structured Claude call.
 * Uses `messages.parse` + `zodOutputFormat` (the verified Phase 4 pattern):
 * the parsed, schema-validated value lands on `res.parsed_output`.
 */
export async function interpretMessage(
  roster: RosterEntry[],
  message: string,
  locale: string,
): Promise<InterpretResult> {
  try {
    const res = await getAnthropic().messages.parse({
      model: BRIEF_MODEL,
      max_tokens: 1024,
      system: INTERPRET_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildInterpretContext(roster, message, locale),
        },
      ],
      output_config: { format: zodOutputFormat(interpretationSchema) },
    });
    const parsed = res.parsed_output;
    // Defensive guard: `messages.parse` throws on malformed output (caught below
    // → REQUEST_FAILED). This only fires when the SDK returns no parseable block.
    if (!parsed) return { status: "error", message: "PARSE_FAILED" };
    return { status: "ok", interpretation: parsed };
  } catch {
    // Do NOT leak provider error text (may carry request details) or the key.
    return { status: "error", message: "REQUEST_FAILED" };
  }
}

const ANSWER_SYSTEM =
  "Answer the user's question about a person they know, using ONLY the provided data. Be concise and specific. If the data doesn't contain the answer, say so. Write in the requested locale.";

/**
 * Plain-text answer result. Same no-throw / no-leak contract as above.
 */
export type AnswerResult =
  | { status: "ok"; answer: string }
  | { status: "error"; message: string };

/**
 * Answer a question about a person, building the model input from the person's
 * stored data via `buildBriefContext`. Returns plain text in the user's locale.
 */
export async function answerQuestion(
  person: PersonForBrief,
  question: string,
  locale: string,
): Promise<AnswerResult> {
  try {
    const res = await getAnthropic().messages.create({
      model: BRIEF_MODEL,
      max_tokens: 1024,
      system: ANSWER_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildAnswerContext(
            buildBriefContext(person, locale),
            question,
            locale,
          ),
        },
      ],
    });
    const text = res.content
      .map((b) => ("text" in b ? b.text : ""))
      .join("")
      .trim();
    // An empty model response is an unknown-response failure; collapse it into
    // the single REQUEST_FAILED contract the UI already knows how to localize.
    if (!text) return { status: "error", message: "REQUEST_FAILED" };
    return { status: "ok", answer: text };
  } catch {
    return { status: "error", message: "REQUEST_FAILED" };
  }
}
