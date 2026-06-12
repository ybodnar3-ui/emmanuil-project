# Phase 5 — Conversational AI (Text + Voice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or
> superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. The pure builders,
> intent interpretation parsing, and the proposal-apply data layer are **test-first** (mocked
> Claude, mocked Prisma — no network/DB in tests). Follow existing conventions: scoped data
> layer + ownership checks, `requireUser()`, next-intl EN+UK keys, shadcn/ui. **This is LLM
> code — invoke the `claude-api` skill and use the official `@anthropic-ai/sdk`, never raw
> fetch.** Reuse the Phase 4 AI plumbing (`src/server/ai/client.ts`, structured outputs).

**Goal:** A conversational Assistant tab where the user types (or speaks) natural language and
the assistant either (a) **answers a question** about a person ("what do I know about
Maria?") or (b) **proposes a card update** from a statement ("add that her son studies in
London") — extracting `{person, category, fact}` and showing it for **explicit confirmation
before anything is persisted**. Voice input (Web Speech API) fills the same text box.

**Architecture:**
- **Two-step, roster-aware:** the assistant first **interprets** the message against the
  user's people roster (id + name + tags) via a structured Claude call → `{intent, personId,
  mentionedName, question, proposedFacts[], proposedInteraction, reply}`. Then:
  - `intent="query"` + resolved person → fetch the person (ownership-scoped) and **answer** the
    question from that person's data (second Claude call, plain text in the user's locale).
  - `intent="capture"` + resolved person → return the extracted proposals to the UI as a
    **confirmable proposal** (NOT persisted).
  - person not resolved but a name was mentioned → **clarify** (ask the user to pick/create).
  - otherwise → return the assistant's `reply` as a chat message.
- **Persist only on confirm:** a separate `applyProposalAction` writes facts/interactions via
  the existing Phase 3 data layer (`addFact`/`logInteraction`), ownership-checked.
- **No invention:** the model may only extract from the user's message and answer from the
  person's stored data; it must not fabricate facts.
- **No-throw / no-leak:** all AI calls return typed results; never throw to the client, never
  leak the API key or raw provider errors (same contract as Phase 4).
- **Chat history is ephemeral** (client state) this phase; `ChatMessage` persistence is
  deferred (carried-forward).
- **Voice:** a client `useSpeechRecognition` hook using the browser `SpeechRecognition` /
  `webkitSpeechRecognition`; the mic button transcribes into the input. Gracefully
  hidden/disabled where unsupported. Locale passed to recognition (`en-US` / `uk-UA`).

**Tech Stack:** Next.js 16 · `@anthropic-ai/sdk` (`claude-sonnet-4-6`) · zod 4 · Web Speech
API · shadcn/ui · next-intl · Vitest. `ANTHROPIC_API_KEY` already in `.env`.

---

## File Structure

- `src/server/ai/assistant.ts` — schemas (`interpretationSchema`), pure `buildInterpretContext(roster, message, locale)` + `buildAnswerContext(person, question, locale)`, `interpretMessage(...)`, `answerQuestion(...)`.
- `src/server/ai/__tests__/assistant.test.ts` — pure builders + mocked interpret/answer (success/bad/throw).
- `src/server/data/proposals.ts` — `applyProposal(userId, personId, {facts, interaction})` (ownership-checked, transactional) + `listRoster(userId)` (id, fullName, tags).
- `src/server/data/__tests__/proposals.test.ts` — ownership + persistence shape (mocked prisma).
- `src/app/(app)/assistant/actions.ts` — `assistantSendAction(message)`, `applyProposalAction(...)`.
- `src/app/(app)/assistant/page.tsx` — replace placeholder with the chat UI (server shell).
- `src/app/(app)/assistant/_components/assistant-chat.tsx` — client chat (thread + input + send).
- `src/app/(app)/assistant/_components/mic-button.tsx` + `src/app/(app)/assistant/_components/use-speech-recognition.ts` — voice input.
- `src/app/(app)/assistant/_components/proposal-card.tsx` — renders a capture proposal with confirm/dismiss.
- i18n: `assistant.*` namespace in `messages/en.json` + `messages/uk.json`.

---

## Task 1: Interpretation schema + pure context builders (test-first)

**Files:** `src/server/ai/assistant.ts`, `src/server/ai/__tests__/assistant.test.ts`

- [ ] **Step 1:** Define schema + types + pure builders in `assistant.ts` (reuse `FACT_CATEGORIES`/`INTERACTION_CHANNELS` from `src/server/validation/person.ts`):
```ts
import { z } from "zod";
import { FACT_CATEGORIES, INTERACTION_CHANNELS } from "@/server/validation/person";

export const interpretationSchema = z.object({
  intent: z.enum(["query", "capture", "clarify", "chat"]),
  personId: z.string().nullable(),       // resolved from the provided roster, else null
  mentionedName: z.string().nullable(),  // the name the user referred to, if any
  question: z.string().nullable(),       // for intent="query": the question to answer
  proposedFacts: z.array(z.object({
    category: z.enum(FACT_CATEGORIES),
    content: z.string(),
  })).default([]),
  proposedInteraction: z.object({
    summary: z.string(),
    channel: z.enum(INTERACTION_CHANNELS).nullable().optional(),
  }).nullable().default(null),
  reply: z.string(),                     // short natural-language message to show the user
});
export type Interpretation = z.infer<typeof interpretationSchema>;

export type RosterEntry = { id: string; fullName: string; tags: string[] };

export function buildInterpretContext(roster: RosterEntry[], message: string, locale: string): string {
  const lines: string[] = [];
  lines.push("People the user knows (id — name — tags). Resolve any person the user mentions to one of these ids; if none clearly match, set personId to null:");
  if (roster.length === 0) lines.push("(none yet)");
  for (const p of roster) lines.push(`- ${p.id} — ${p.fullName}${p.tags.length ? ` — ${p.tags.join(", ")}` : ""}`);
  lines.push("");
  lines.push(`User message: ${message}`);
  lines.push(`Reply in locale: ${locale}`);
  return lines.join("\n");
}

export function buildAnswerContext(personBlock: string, question: string, locale: string): string {
  // personBlock is produced by buildBriefContext (reused) — the person's data.
  return `${personBlock}\n\nQuestion: ${question}\nAnswer concisely in locale: ${locale}, using ONLY the data above.`;
}
```

- [ ] **Step 2 (test-first):** test `buildInterpretContext` — includes each roster entry
  (id + name), includes the message and locale, and handles an empty roster ("(none yet)")
  without throwing. Test `buildAnswerContext` includes the question + locale + the person block.
  Run `pnpm test` → pass. Commit: `feat: assistant interpretation schema + pure builders`.

---

## Task 2: interpretMessage + answerQuestion (mocked tests, no-throw)

**Files:** `src/server/ai/assistant.ts` (add functions); extend `assistant.test.ts`

- [ ] **Step 1:** Add the two AI functions, reusing `getAnthropic`, `BRIEF_MODEL`, the zod
  output-format helper, and `buildBriefContext` from Phase 4. Verify the structured-output
  API against the installed SDK (Phase 4 used `messages.parse` + `zodOutputFormat` from
  `@anthropic-ai/sdk/helpers/zod` successfully — reuse that exact approach).
```ts
import { getAnthropic, BRIEF_MODEL } from "./client";
import { buildBriefContext, type PersonForBrief } from "./brief";
// import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"; // verify path

const INTERPRET_SYSTEM = [
  "You interpret a user's message to their personal-CRM assistant.",
  "Classify intent: 'query' (asking what they know about someone), 'capture' (stating a new",
  "fact or a logged interaction to record about someone), 'clarify' (a person is referenced",
  "but you cannot resolve which), or 'chat' (anything else).",
  "Resolve any referenced person to an id from the provided roster, else personId=null.",
  "For 'capture', extract proposedFacts and/or a proposedInteraction ONLY from what the user",
  "stated — never invent. Always include a short 'reply'. Write reply in the requested locale.",
].join(" ");

export type InterpretResult =
  | { status: "ok"; interpretation: Interpretation }
  | { status: "error"; message: string };

export async function interpretMessage(roster: RosterEntry[], message: string, locale: string): Promise<InterpretResult> {
  try {
    const res = await getAnthropic().messages.parse({
      model: BRIEF_MODEL,
      max_tokens: 1024,
      system: INTERPRET_SYSTEM,
      messages: [{ role: "user", content: buildInterpretContext(roster, message, locale) }],
      output_config: { format: zodOutputFormat(interpretationSchema) },
    });
    const parsed = res.parsed_output;
    if (!parsed) return { status: "error", message: "PARSE_FAILED" };
    return { status: "ok", interpretation: parsed };
  } catch {
    return { status: "error", message: "REQUEST_FAILED" };
  }
}

const ANSWER_SYSTEM = "Answer the user's question about a person they know, using ONLY the provided data. Be concise and specific. If the data doesn't contain the answer, say so. Write in the requested locale.";

export type AnswerResult = { status: "ok"; answer: string } | { status: "error"; message: string };

export async function answerQuestion(person: PersonForBrief, question: string, locale: string): Promise<AnswerResult> {
  try {
    const res = await getAnthropic().messages.create({
      model: BRIEF_MODEL,
      max_tokens: 1024,
      system: ANSWER_SYSTEM,
      messages: [{ role: "user", content: buildAnswerContext(buildBriefContext(person, locale), question, locale) }],
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim();
    if (!text) return { status: "error", message: "EMPTY" };
    return { status: "ok", answer: text };
  } catch {
    return { status: "error", message: "REQUEST_FAILED" };
  }
}
```

- [ ] **Step 2 (test):** extend `assistant.test.ts` with `vi.mock("../client")`:
  - **interpret/query:** mock returns `{intent:"query", personId:"p1", question:"...", ...}` → assert `interpretMessage` returns it and that the roster (a known name) was included in the request content.
  - **interpret/capture:** mock returns `proposedFacts:[{category:"family",content:"son studies in London"}]` → assert returned intact.
  - **interpret unresolved:** mock returns `{intent:"clarify", personId:null, mentionedName:"X"}` → returned intact.
  - **interpret throws / bad output:** `REQUEST_FAILED` / `PARSE_FAILED`, no throw, no raw-error leak (assert `JSON.stringify(result)` has no `sk-ant`).
  - **answerQuestion:** mocked `messages.create` returns text blocks → `{status:"ok", answer}`; empty content → `EMPTY`; throw → `REQUEST_FAILED`.

- [ ] **Step 3:** `pnpm test` → PASS. Commit: `feat: interpretMessage + answerQuestion (no-throw, mocked tests)`.

---

## Task 3: Proposal data layer + server actions

**Files:** `src/server/data/proposals.ts`, `src/server/data/__tests__/proposals.test.ts`, `src/app/(app)/assistant/actions.ts`

- [ ] **Step 1:** `proposals.ts`:
  - `listRoster(userId)` → `prisma.person.findMany({ where:{userId}, select:{id:true, fullName:true, tags:true}, orderBy:{fullName:"asc"} })`.
  - `applyProposal(userId, personId, input: { facts: {category,content}[]; interaction?: {summary, channel?} | null })`:
    `assertPersonOwned(userId, personId)`, then in a `prisma.$transaction` create each fact and (if present) the interaction, reusing the cadence-bump logic from `logInteraction` (import/compose it; do NOT duplicate the cadence math). Validate inputs with the Phase 3 zod schemas (`factInputSchema`, `interactionInputSchema`) before writing; reject empty proposals.

- [ ] **Step 2 (test):** `proposals.test.ts` (mock `@/server/db`): assert `applyProposal` calls
  `assertPersonOwned` (findFirst with `{id, userId}`) BEFORE any create; rejects when the person
  is not owned (findFirst → null → throws/returns error, no create); creates facts with the
  resolved `personId`; when an interaction is included, the cadence `nextDueAt` is advanced
  (same assertion style as Phase 3). `listRoster` includes `userId` in the where.

- [ ] **Step 3:** `assistant/actions.ts`:
```ts
"use server";
// requireUser, getLocaleFromCookie, listRoster, getPerson, interpretMessage, answerQuestion, applyProposal
export async function assistantSendAction(message: string) {
  const user = await requireUser();
  const text = String(message ?? "").trim();
  if (!text) return { kind: "error" as const, code: "EMPTY_INPUT" };
  const locale = await getLocaleFromCookie();
  const roster = await listRoster(user.id);
  const interp = await interpretMessage(roster, text, locale);
  if (interp.status === "error") return { kind: "error" as const, code: interp.message };
  const i = interp.interpretation;
  if (i.intent === "query" && i.personId) {
    const person = await getPerson(user.id, i.personId);     // ownership-scoped
    if (!person) return { kind: "chat" as const, reply: i.reply };
    const ans = await answerQuestion(person, i.question ?? text, locale);
    return ans.status === "ok"
      ? { kind: "answer" as const, personId: i.personId, answer: ans.answer }
      : { kind: "error" as const, code: ans.message };
  }
  if (i.intent === "capture" && i.personId && (i.proposedFacts.length || i.proposedInteraction)) {
    const person = await getPerson(user.id, i.personId);
    if (!person) return { kind: "chat" as const, reply: i.reply };
    return {
      kind: "proposal" as const,
      personId: i.personId,
      personName: person.fullName,
      facts: i.proposedFacts,
      interaction: i.proposedInteraction ?? null,
      reply: i.reply,
    };
  }
  if (i.intent === "clarify") return { kind: "clarify" as const, reply: i.reply, mentionedName: i.mentionedName };
  return { kind: "chat" as const, reply: i.reply };
}

export async function applyProposalAction(input: { personId: string; facts: {category:string;content:string}[]; interaction: {summary:string;channel?:string|null}|null }) {
  const user = await requireUser();
  try {
    await applyProposal(user.id, input.personId, { facts: input.facts as any, interaction: input.interaction as any });
    revalidatePath(`/people/${input.personId}`);
    return { status: "ok" as const };
  } catch {
    return { status: "error" as const };
  }
}
```
  (Cast/validate the proposal payload through the Phase 3 zod schemas inside `applyProposal`;
  never trust the client-sent shape.)

- [ ] **Step 4:** `pnpm test` + `pnpm build` + `pnpm lint` green. Commit: `feat: proposal data layer + assistant server actions`.

---

## Task 4: Assistant chat UI (text)

**Files:** `src/app/(app)/assistant/page.tsx`, `src/app/(app)/assistant/_components/assistant-chat.tsx`, `src/app/(app)/assistant/_components/proposal-card.tsx`

- [ ] **Step 1:** `page.tsx` (server): `requireUser()`, render `<AssistantChat/>` under the
  localized title.

- [ ] **Step 2:** `assistant-chat.tsx` (client): an ephemeral message thread in `useState`
  (entries: user text, and assistant responses by `kind`). An input + send button (`useTransition`).
  On send: append the user message, call `assistantSendAction`, append the response:
  - `answer` → assistant text bubble.
  - `chat` / `clarify` → assistant text bubble (clarify may include a link to `/people/new`).
  - `proposal` → render `<ProposalCard>` with the facts/interaction + Confirm / Dismiss.
  - `error` → localized error bubble (map `code` to `assistant.errors.*`).
  All chrome via next-intl. Accessible (log region, `aria-busy`, labelled input).

- [ ] **Step 3:** `proposal-card.tsx` (client): lists the proposed facts (category + content)
  and the interaction summary; **Confirm** calls `applyProposalAction(...)` (loading state),
  on success shows a confirmation + a link to the person card; **Dismiss** removes it. Nothing
  is written until Confirm.

- [ ] **Step 4:** `pnpm build` + `pnpm lint` green. Manual gate (optional, needs a session):
  type "what do I know about <existing person>?" → answer; type "add that <person>'s son
  studies in London" → a proposal appears; Confirm → the fact shows on the person card. Commit:
  `feat: assistant chat UI with confirmable proposals`.

---

## Task 5: Voice input (Web Speech API)

**Files:** `src/app/(app)/assistant/_components/use-speech-recognition.ts`, `src/app/(app)/assistant/_components/mic-button.tsx`; wire into `assistant-chat.tsx`

- [ ] **Step 1:** `use-speech-recognition.ts` (client hook): feature-detect
  `window.SpeechRecognition ?? window.webkitSpeechRecognition`; expose `{ supported, listening,
  start, stop, transcript }`. Set `recognition.lang` from the current locale (`uk` → `uk-UA`,
  else `en-US`), `interimResults` for live feedback, and clean up on unmount. Type the Web
  Speech globals locally (no DOM lib types guaranteed) — declare a minimal interface; avoid `any`
  where reasonable.

- [ ] **Step 2:** `mic-button.tsx` (client): if `!supported`, render nothing (or a disabled mic
  with a tooltip `assistant.voice.unsupported`). Otherwise a toggle button (`assistant.voice.start`
  / `assistant.voice.stop`, `aria-pressed`); while listening, push the transcript into the chat
  input (via a callback prop). Respect reduced-motion; show a subtle listening indicator.

- [ ] **Step 3:** Wire the mic button into `assistant-chat.tsx` next to the input; the transcript
  fills the same input box the user can then edit and send.

- [ ] **Step 4:** `pnpm build` + `pnpm lint` green. Commit: `feat: voice input via Web Speech API`.

---

## Task 6: i18n + phase gate

- [ ] **Step 1:** Add an `assistant.*` namespace to BOTH `messages/en.json` + `messages/uk.json`:
  `title`, `inputPlaceholder`, `send`, `thinking`, `errors.EMPTY_INPUT`, `errors.REQUEST_FAILED`,
  `errors.PARSE_FAILED`, `errors.generic`, `proposal.title`, `proposal.confirm`,
  `proposal.dismiss`, `proposal.applied`, `proposal.viewPerson`, `clarify.createPerson`,
  `voice.start`, `voice.stop`, `voice.unsupported`, `voice.listening`. Natural Ukrainian; keep
  EN/UK parity. No hardcoded strings.

- [ ] **Step 2: Full gate:** `pnpm lint && pnpm test && pnpm build` all green.

- [ ] **Step 3: Push:** `git push origin main`.

---

## Phase 5 Done Criteria

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` all pass.
- [ ] In the Assistant tab, a typed question about an existing person returns a relevant answer
  built from that person's data (ownership-scoped).
- [ ] A typed statement ("add that her son studies in London") produces a **proposed** card
  update that the user must **confirm**; nothing is persisted until Confirm; on Confirm the
  fact/interaction appears on the person card (cadence advances if an interaction was logged).
- [ ] Person resolution maps a mentioned name to one of the user's people; unresolved names
  produce a clarify response (no wrong-person writes).
- [ ] Voice input transcribes into the chat input where supported and degrades gracefully where
  not.
- [ ] Intent interpretation + answer + proposal-apply (ownership) are unit-tested with mocked
  Claude and mocked Prisma; AI failures degrade to localized errors, never a thrown 500 or a
  leaked key/provider message.
- [ ] All new copy is EN+UK via next-intl keys; secrets never committed; pushed to `origin/main`.

## Carried-forward notes
- `ChatMessage` persistence (durable history) is deferred; chat is ephemeral this phase.
- Creating a brand-new person directly from the assistant (when unresolved) is out of scope —
  clarify links to the existing `/people/new` flow.
- Today feed / cadence reminders / tasks are Phase 6.
