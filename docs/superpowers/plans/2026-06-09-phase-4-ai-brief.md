# Phase 4 — AI Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. The pure prompt-builder
> and the response parsing/error handling are **test-first**; the live API call is mocked in
> tests. Follow existing repo conventions (scoped data layer, `requireUser()`, next-intl keys
> EN+UK, shadcn/ui). **This is LLM code — use the official Anthropic TypeScript SDK
> (`@anthropic-ai/sdk`), never raw fetch.**

**Goal:** Wire up the "What do I know about this person?" button on the Person card to
generate a concise, structured AI brief (who they are, recent context, what to ask about,
why/whether to reconnect) from the person's facts + recent interactions + cadence, using
Claude.

**Architecture:**
- **Model:** `claude-sonnet-4-6` (fast/cheap, the user's choice; the brief is short). Make
  the model id a single constant so it's easy to change. No extended thinking needed for a
  short brief (omit `thinking`, or set `thinking: {type: "disabled"}`); keep `max_tokens`
  modest (~1024).
- **Separation:** a **pure** `buildBriefContext(person, locale)` assembles the model input
  from a person object (testable with no network); `generateBrief(person, locale)` calls
  Claude with **structured outputs** and returns a typed `Brief` or a typed error result.
- **Structured output:** define the `Brief` shape with zod and request it via
  `output_config.format` (use the SDK's zod helper, `messages.parse`). Verify the exact
  helper import + API against the installed `@anthropic-ai/sdk` and `zod` v4 (see notes).
- **Localized output:** the brief TEXT is generated in the signed-in user's locale (EN/UK)
  by instructing the model; the UI chrome (button, loading, error) uses next-intl keys.
- **Server action** `generateBriefAction(personId)`: `requireUser()` → `getPerson` (ownership)
  → `generateBrief` → return `{status:"ok", brief}` or `{status:"error", message}`. Never
  throw to the client; never leak the API key or raw provider errors.
- The brief is generated on demand and shown in the UI; **not persisted** in this phase.

**Tech Stack:** Next.js 16 · `@anthropic-ai/sdk` · zod 4 · shadcn/ui · next-intl · Vitest.
`ANTHROPIC_API_KEY` is already in `.env` (verified working against `claude-sonnet-4-6`).

---

## File Structure

- `src/server/ai/client.ts` — Anthropic client singleton + `BRIEF_MODEL` constant.
- `src/server/ai/brief.ts` — `Brief` zod schema + type, pure `buildBriefContext(person, locale)`, and `generateBrief(person, locale)`.
- `src/server/ai/__tests__/brief.test.ts` — pure builder tests + mocked-client generate/parse/error tests.
- `src/app/(app)/people/actions.ts` — add `generateBriefAction`.
- `src/app/(app)/people/[id]/_components/brief-panel.tsx` — client component: button → action → render brief, with loading + error states.
- `src/app/(app)/people/[id]/page.tsx` — replace the disabled placeholder button with `<BriefPanel personId={person.id} />`.
- i18n: add a `people.brief.*` namespace to `messages/en.json` + `messages/uk.json`.

---

## Task 1: Anthropic client + Brief schema + pure context builder (test-first)

**Files:** `src/server/ai/client.ts`, `src/server/ai/brief.ts`, `src/server/ai/__tests__/brief.test.ts`

- [ ] **Step 1: Install the SDK:** `pnpm add @anthropic-ai/sdk`.

- [ ] **Step 2:** `src/server/ai/client.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";

export const BRIEF_MODEL = "claude-sonnet-4-6";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey });
  return client;
}
```
  (Lazy-init so importing the module in a test that mocks it doesn't require the key.)

- [ ] **Step 3:** In `src/server/ai/brief.ts`, define the `Brief` schema + a `PersonForBrief`
  input type (the subset of a Person-with-relations the builder needs) and the pure builder:
```ts
import { z } from "zod";

export const briefSchema = z.object({
  summary: z.string(),               // 1-2 sentences: who this person is to you
  talkingPoints: z.array(z.string()),// things to bring up
  askAbout: z.array(z.string()),     // open questions / follow-ups (kids, mom, project...)
  reconnectReason: z.string().optional(), // why now / cadence note, if relevant
});
export type Brief = z.infer<typeof briefSchema>;

export type PersonForBrief = {
  fullName: string;
  howWeMet?: string | null;
  location?: string | null;
  birthday?: Date | null;
  relationshipTier?: string | null;
  tags: string[];
  facts: { category: string; content: string }[];
  interactions: { date: Date; channel?: string | null; summary: string }[];
  cadence?: { intervalDays: number; lastContactedAt?: Date | null; nextDueAt: Date } | null;
};

// Pure: assemble a compact, readable context block for the model. No network.
export function buildBriefContext(person: PersonForBrief, locale: string): string {
  const lines: string[] = [];
  lines.push(`Name: ${person.fullName}`);
  if (person.relationshipTier) lines.push(`Relationship: ${person.relationshipTier}`);
  if (person.location) lines.push(`Location: ${person.location}`);
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
```

- [ ] **Step 4 (test-first):** `src/server/ai/__tests__/brief.test.ts` — test `buildBriefContext`:
  - includes name, a fact line (`[work] ...`), an interaction line, and the cadence line for a
    fully-populated person;
  - handles a minimal person (only `fullName`, empty arrays) without throwing and without
    emitting `undefined`;
  - includes the locale instruction (`Respond in locale: uk` when locale is `uk`).
  Run `pnpm test` → these pass (builder is implemented). Commit:
  `feat: AI brief schema + pure context builder`.

---

## Task 2: generateBrief — structured call + graceful errors (mocked test)

**Files:** `src/server/ai/brief.ts` (add `generateBrief`); extend `brief.test.ts`

- [ ] **Step 1:** Add `generateBrief` to `brief.ts`. It builds the context, calls Claude with
  **structured output** matching `briefSchema`, and returns a discriminated result. VERIFY the
  exact structured-output API against the installed SDK + zod v4 — the intended shape is
  `messages.parse` with the zod output-format helper:
```ts
import { getAnthropic, BRIEF_MODEL } from "./client";
// import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"; // verify path for installed SDK

const SYSTEM = [
  "You are an assistant that prepares a concise pre-conversation brief about a person",
  "the user knows, to help them reconnect warmly and meaningfully.",
  "Use ONLY the provided facts/interactions — do not invent details.",
  "Keep it short and specific. Write all text in the requested locale.",
].join(" ");

export type BriefResult =
  | { status: "ok"; brief: Brief }
  | { status: "error"; message: string };

export async function generateBrief(person: PersonForBrief, locale: string): Promise<BriefResult> {
  const context = buildBriefContext(person, locale);
  try {
    const res = await getAnthropic().messages.parse({
      model: BRIEF_MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: `What do I know about this person?\n\n${context}` }],
      output_config: { format: zodOutputFormat(briefSchema) },
    });
    const parsed = res.parsed_output;
    if (!parsed) return { status: "error", message: "PARSE_FAILED" };
    return { status: "ok", brief: parsed };
  } catch {
    // Do NOT leak provider error text (may contain request details). Return a stable code;
    // the UI maps it to a localized message.
    return { status: "error", message: "REQUEST_FAILED" };
  }
}
```
  If `messages.parse` / `zodOutputFormat` differ in the installed SDK version, adapt: either
  use `output_config: {format: {type:"json_schema", schema: <jsonschema>}}` on
  `messages.create` and validate the returned text with `briefSchema.safeParse(JSON.parse(...))`,
  or a tool-use forced call. Keep the same `BriefResult` contract and the no-throw guarantee.

- [ ] **Step 2 (test):** Extend `brief.test.ts` — mock `./client`'s `getAnthropic` (via
  `vi.mock`) so no network is hit:
  - **success:** mock returns a payload whose parsed output matches `briefSchema`; assert
    `generateBrief` returns `{status:"ok", brief}` with the expected fields, and assert the
    person's facts text was passed into the request (capture the mock call args, check the
    context string contains a known fact).
  - **bad output:** mock returns no/invalid parsed output → assert `{status:"error"}` (no throw).
  - **API throws:** mock `messages.parse` to reject → assert `generateBrief` resolves to
    `{status:"error", message:"REQUEST_FAILED"}` (caught, not propagated) and the error text is
    NOT the raw provider message.

- [ ] **Step 3:** `pnpm test` → PASS. Commit: `feat: generateBrief with structured output and graceful errors`.

---

## Task 3: Server action + Person-card Brief panel

**Files:** `src/app/(app)/people/actions.ts`, `src/app/(app)/people/[id]/_components/brief-panel.tsx`, `src/app/(app)/people/[id]/page.tsx`

- [ ] **Step 1:** Add to `actions.ts`:
```ts
"use server";
// existing imports + getPerson, requireUser, generateBrief, normalizeLocale/getLocaleFromCookie
export async function generateBriefAction(personId: string) {
  const user = await requireUser();
  const person = await getPerson(user.id, personId); // ownership-scoped
  if (!person) return { status: "error" as const, message: "NOT_FOUND" };
  const locale = await getLocaleFromCookie();
  return generateBrief(person, locale); // returns BriefResult
}
```
  Confirm `getPerson` returns facts + interactions + cadence (it does, per Phase 3). Map its
  shape to `PersonForBrief` if the field names differ.

- [ ] **Step 2:** `brief-panel.tsx` (Client Component): a button labeled `people.brief.button`
  ("What do I know?"). On click, call `generateBriefAction(personId)` (via `useTransition` or
  `useActionState`), show a loading state (`people.brief.loading`), then render the returned
  brief — `summary`, a "Talking points" list, an "Ask about" list, and `reconnectReason` if
  present (section labels via next-intl keys). On `{status:"error"}`, show a localized message
  (`people.brief.error`) and allow retry. Keep it accessible (button, `aria-busy`, results in a
  `role="region"`).

- [ ] **Step 3:** In `[id]/page.tsx`, replace the disabled Phase-4 placeholder button with
  `<BriefPanel personId={person.id} />`.

- [ ] **Step 4:** `pnpm lint` + `pnpm build` clean. Commit: `feat: AI brief action + person-card brief panel`.

---

## Task 4: i18n + phase gate

- [ ] **Step 1:** Add a `people.brief` namespace to BOTH `messages/en.json` and
  `messages/uk.json` with keys: `button`, `loading`, `error`, `retry`, `summary`,
  `talkingPoints`, `askAbout`, `reconnectReason`, `empty`. Natural Ukrainian. Keep EN/UK key
  parity. No hardcoded strings in the new components.

- [ ] **Step 2: Full gate:** `pnpm lint && pnpm test && pnpm build` all green.

- [ ] **Step 3 (optional live smoke):** With `.env` present, a throwaway script may call
  `generateBrief` on a seeded person to confirm a real brief returns `{status:"ok"}`; delete
  the script and any seeded rows after. Do not commit it. (Skip if it risks flakiness; the
  mocked tests are the gate.)

- [ ] **Step 4: Push:** `git push origin main`.

---

## Phase 4 Done Criteria

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` all pass.
- [ ] The Person card "What do I know?" button generates and displays a structured brief
  (summary + talking points + ask-about + optional reconnect reason).
- [ ] The brief is built only from the person's own data (facts/interactions/cadence), scoped
  to the authenticated user (ownership-checked via `getPerson`).
- [ ] Prompt assembly and response parsing/error handling are unit-tested with a mocked client
  (no network in tests); failures degrade gracefully to a localized error, never a thrown 500
  or a leaked provider/error/key string.
- [ ] Brief text respects the user's locale (EN/UK); UI chrome via next-intl keys, EN/UK parity.
- [ ] `ANTHROPIC_API_KEY`/secrets never committed; all work committed and pushed to `origin/main`.

## Carried-forward notes
- Conversational assistant (free-form "add that her son studies in London" / ask-anything) is
  Phase 5 — this phase is the one-shot brief only.
- Brief caching/persistence and streaming can be added later if latency warrants.
