import { getAnthropic, BRIEF_MODEL } from "./client";
import { buildBriefContext, type PersonForBrief } from "./brief";
import { logError } from "@/server/log";

/**
 * On-demand "what to say" suggestion for one feed item. Reuses the Phase 4
 * brief plumbing: the same model (BRIEF_MODEL), the same compact context block
 * (buildBriefContext), and the same no-throw / no-leak contract as generateBrief.
 *
 * Unlike the brief, this returns a single short sentence (plain text), so it
 * uses messages.create rather than the structured messages.parse helper. Each
 * call is paid, so callers fire it only when the user clicks "what to say" —
 * never automatically on render.
 */

export type SuggestResult =
  | { status: "ok"; suggestion: string }
  | { status: "error"; message: string };

const SYSTEM = [
  "You help the user reconnect with someone they know.",
  "Given what the user knows about the person and the occasion, suggest ONE short,",
  "specific thing to say or ask — a single sentence, no preamble, no quotes.",
  "Use ONLY the provided facts/interactions — do not invent details.",
  "Write the suggestion in the requested locale.",
].join(" ");

/**
 * `occasion` is a short natural-language reason, e.g.
 *   "time to reconnect (cadence due)" | "birthday in 2 days" | a task title.
 *
 * Never throws to the caller and never leaks the API key or raw provider error
 * text — on any failure it returns a stable error code the UI maps to a
 * localized message. `max_tokens` is kept small (one sentence).
 */
export async function suggestTalkingPoint(
  person: PersonForBrief,
  occasion: string,
  locale: string,
): Promise<SuggestResult> {
  const context = buildBriefContext(person, locale);
  try {
    const res = await getAnthropic().messages.create({
      model: BRIEF_MODEL,
      max_tokens: 256,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Occasion: ${occasion}\n\n${context}\n\nSuggest one short thing to say or ask.`,
        },
      ],
    });

    const text = res.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    if (!text) return { status: "error", message: "PARSE_FAILED" };
    return { status: "ok", suggestion: text };
  } catch (err) {
    // Log server-side; do NOT leak provider error text or the key. Stable code only.
    logError("ai.suggest", err);
    return { status: "error", message: "REQUEST_FAILED" };
  }
}
