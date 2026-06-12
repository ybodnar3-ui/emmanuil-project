import Anthropic from "@anthropic-ai/sdk";

/**
 * Single source of truth for the model used to generate the AI brief.
 * Keep this as one constant so it is trivial to change later.
 */
export const BRIEF_MODEL = "claude-sonnet-4-6";

const apiKey = process.env.ANTHROPIC_API_KEY;

/**
 * Lazy-initialized Anthropic client singleton.
 *
 * Lazy-init is deliberate: tests that `vi.mock("./client")` never call this,
 * so importing the module does not require ANTHROPIC_API_KEY to be set. The
 * key is only read/validated on the first real call.
 */
let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  if (!client) client = new Anthropic({ apiKey });
  return client;
}
