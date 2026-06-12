import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropic, BRIEF_MODEL } from "./client";
import { logError } from "@/server/log";

/**
 * The structured shape we ask Claude to return. The model is instructed to
 * write every text field in the signed-in user's locale.
 */
export const briefSchema = z.object({
  summary: z.string(), // 1-2 sentences: who this person is to you
  talkingPoints: z.array(z.string()), // things to bring up
  askAbout: z.array(z.string()), // open questions / follow-ups (kids, mom, project...)
  reconnectReason: z.string().optional(), // why now / cadence note, if relevant
});
export type Brief = z.infer<typeof briefSchema>;

/**
 * The subset of a Person-with-relations the brief builder needs. `getPerson`
 * (Phase 3) returns a superset of this; the action maps it down to this shape.
 */
export type PersonForBrief = {
  fullName: string;
  howWeMet?: string | null;
  location?: string | null;
  birthday?: Date | null;
  relationshipTier?: string | null;
  tags: string[];
  facts: { category: string; content: string }[];
  interactions: { date: Date; channel?: string | null; summary: string }[];
  cadence?: {
    intervalDays: number;
    lastContactedAt?: Date | null;
    nextDueAt: Date;
  } | null;
};

/**
 * Pure: assemble a compact, readable context block for the model. No network,
 * no secrets — fully unit-testable. Optional/empty fields are simply omitted so
 * the block never contains the string "undefined".
 */
export function buildBriefContext(person: PersonForBrief, locale: string): string {
  const lines: string[] = [];
  lines.push(`Name: ${person.fullName}`);
  if (person.relationshipTier) lines.push(`Relationship: ${person.relationshipTier}`);
  if (person.location) lines.push(`Location: ${person.location}`);
  if (person.birthday) lines.push(`Birthday: ${person.birthday.toISOString().slice(0, 10)}`);
  if (person.howWeMet) lines.push(`How we met: ${person.howWeMet}`);
  if (person.tags.length) lines.push(`Tags: ${person.tags.join(", ")}`);
  if (person.facts.length) {
    lines.push("Facts:");
    for (const f of person.facts) lines.push(`- [${f.category}] ${f.content}`);
  }
  if (person.interactions.length) {
    lines.push("Recent interactions (newest first):");
    for (const i of person.interactions.slice(0, 10)) {
      const d = i.date.toISOString().slice(0, 10);
      lines.push(`- ${d}${i.channel ? ` (${i.channel})` : ""}: ${i.summary}`);
    }
  }
  if (person.cadence) {
    const due = person.cadence.nextDueAt.toISOString().slice(0, 10);
    lines.push(`Cadence: every ${person.cadence.intervalDays} days; next due ${due}`);
  }
  lines.push(`Respond in locale: ${locale}`);
  return lines.join("\n");
}

const SYSTEM = [
  "You are an assistant that prepares a concise pre-conversation brief about a person",
  "the user knows, to help them reconnect warmly and meaningfully.",
  "Use ONLY the provided facts/interactions — do not invent details.",
  "Keep it short and specific. Write all text in the requested locale.",
].join(" ");

/**
 * Discriminated result. `generateBrief` NEVER throws to the caller and NEVER
 * leaks the API key or raw provider error text — on any failure it returns a
 * stable error code that the UI maps to a localized message.
 */
export type BriefResult =
  | { status: "ok"; brief: Brief }
  | { status: "error"; message: string };

/**
 * Calls Claude with structured output matching `briefSchema`. Uses the SDK's
 * `messages.parse` + `zodOutputFormat` helper (verified against the installed
 * @anthropic-ai/sdk + zod v4): the parsed, schema-validated value is on
 * `res.parsed_output`. A short brief needs no extended thinking, so `thinking`
 * is left off; `max_tokens` is kept modest.
 */
export async function generateBrief(
  person: PersonForBrief,
  locale: string,
): Promise<BriefResult> {
  const context = buildBriefContext(person, locale);
  try {
    const res = await getAnthropic().messages.parse({
      model: BRIEF_MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `What do I know about this person?\n\n${context}`,
        },
      ],
      output_config: { format: zodOutputFormat(briefSchema) },
    });
    const parsed = res.parsed_output;
    // Defensive guard, not the main parse-failure path: `messages.parse` +
    // `zodOutputFormat` THROW on malformed/invalid JSON (caught below →
    // REQUEST_FAILED). This only fires for the rare case where the SDK returns
    // a response with no text/content block to parse, leaving parsed_output null.
    if (!parsed) return { status: "error", message: "PARSE_FAILED" };
    return { status: "ok", brief: parsed };
  } catch (err) {
    // Log server-side for observability, but do NOT leak provider error text
    // (may contain request details) or the key. Return a stable code; the UI
    // maps it to a localized message.
    logError("ai.brief", err);
    return { status: "error", message: "REQUEST_FAILED" };
  }
}
