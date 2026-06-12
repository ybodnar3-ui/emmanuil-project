import Anthropic from "@anthropic-ai/sdk";

/**
 * Single source of truth for the model used to generate the AI brief.
 * Keep this as one constant so it is trivial to change later.
 */
export const BRIEF_MODEL = "claude-sonnet-4-6";

/**
 * Lazy-initialized Anthropic client singleton.
 *
 * Lazy-init is deliberate on two counts: tests that `vi.mock("./client")` never
 * call this, so importing the module does not require ANTHROPIC_API_KEY to be
 * set; and the key is read from process.env on the first call rather than at
 * module-evaluation time, so it works regardless of when the environment is
 * populated (e.g. a test setup file that loads .env after imports resolve).
 */
let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    client = new Anthropic({ apiKey });
  }
  return client;
}
