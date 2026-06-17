"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { getLocaleFromCookie } from "@/i18n/locale";
import { getPerson } from "@/server/data/people";
import {
  interpretMessage,
  answerQuestion,
} from "@/server/ai/assistant";
import { listRoster, applyProposal } from "@/server/data/proposals";
import { transcribeAudio } from "@/server/stt/groq";
import { logError } from "@/server/log";

/**
 * Two-step, roster-aware conversational entry point. The assistant first
 * interprets the message against the user's roster (ownership-scoped), then:
 *  - query + resolved person → fetch the person (ownership-scoped) and ANSWER
 *  - capture + resolved person + proposals → return a confirmable PROPOSAL (NOT
 *    persisted — only applyProposalAction writes, on explicit Confirm)
 *  - clarify → ask the user to pick/create a person
 *  - otherwise → return the assistant's chat reply
 *
 * AI failures degrade to a localized error code; nothing throws to the client,
 * no key or raw provider error is leaked.
 */
export type AssistantResult =
  | { kind: "answer"; personId: string; answer: string }
  | {
      kind: "proposal";
      personId: string;
      personName: string;
      facts: { category: string; content: string }[];
      interaction: { summary: string; channel?: string | null } | null;
      keyDates: { label: string; date: string }[];
      reply: string;
    }
  | { kind: "clarify"; reply: string; mentionedName: string | null }
  | { kind: "chat"; reply: string }
  | { kind: "error"; code: string };

export async function assistantSendAction(
  message: string,
): Promise<AssistantResult> {
  const user = await requireUser();
  const text = String(message ?? "").trim();
  if (!text) return { kind: "error", code: "EMPTY_INPUT" };

  const locale = await getLocaleFromCookie();
  const roster = await listRoster(user.id);

  const interp = await interpretMessage(roster, text, locale);
  if (interp.status === "error") return { kind: "error", code: interp.message };
  const i = interp.interpretation;

  if (i.intent === "query" && i.personId) {
    const person = await getPerson(user.id, i.personId); // ownership-scoped
    if (!person) return { kind: "chat", reply: i.reply };
    const ans = await answerQuestion(person, i.question ?? text, locale);
    return ans.status === "ok"
      ? { kind: "answer", personId: i.personId, answer: ans.answer }
      : { kind: "error", code: ans.message };
  }

  if (
    i.intent === "capture" &&
    i.personId &&
    (i.proposedFacts.length ||
      i.proposedInteraction ||
      i.proposedKeyDates.length)
  ) {
    const person = await getPerson(user.id, i.personId); // ownership-scoped
    if (!person) return { kind: "chat", reply: i.reply };
    return {
      kind: "proposal",
      personId: i.personId,
      personName: person.fullName,
      facts: i.proposedFacts,
      interaction: i.proposedInteraction ?? null,
      keyDates: i.proposedKeyDates,
      reply: i.reply,
    };
  }

  if (i.intent === "clarify") {
    return { kind: "clarify", reply: i.reply, mentionedName: i.mentionedName };
  }

  // A query/capture intent whose personId couldn't be resolved (or whose person
  // isn't owned) intentionally falls through to a chat reply: the model's reply
  // already asks the user to clarify which person they mean.
  return { kind: "chat", reply: i.reply };
}

export type ApplyProposalResult = { status: "ok" } | { status: "error" };

/**
 * Persist a confirmed proposal. Auth + ownership are enforced inside
 * applyProposal (assertPersonOwned + zod validation of every item). Never trusts
 * the client-sent shape; never throws to the client.
 */
export async function applyProposalAction(input: {
  personId: string;
  facts: { category: string; content: string }[];
  interaction: { summary: string; channel?: string | null } | null;
  keyDates?: { label: string; date: string }[];
}): Promise<ApplyProposalResult> {
  const user = await requireUser();
  try {
    await applyProposal(user.id, input.personId, {
      facts: input.facts,
      interaction: input.interaction,
      keyDates: input.keyDates,
    });
    revalidatePath(`/people/${input.personId}`);
    return { status: "ok" };
  } catch (err) {
    logError("action.applyProposal", err, { userId: user.id });
    return { status: "error" };
  }
}

export type CaptureVoiceResult =
  | { status: "ok"; text: string }
  | { status: "error"; code: string };

/**
 * Auth-gated voice → transcript. Transcribes an uploaded audio blob server-side
 * via Groq Whisper and returns the (editable) transcript text for the chat input.
 *
 * - `requireUser()` runs first: only authenticated users transcribe.
 * - Audio is never persisted — the blob is transcribed and then dropped.
 * - No-throw/no-leak: `transcribeAudio` returns stable codes; the Groq key and raw
 *   provider error never reach the client. With no key it returns `NO_KEY` and the
 *   UI degrades to text-only.
 * - The transcript reuses the existing assistantSendAction/applyProposal pipeline
 *   unchanged (confirm-before-persist stays).
 */
export async function captureVoiceAction(
  formData: FormData,
): Promise<CaptureVoiceResult> {
  await requireUser(); // ensures only authed users transcribe
  const audio = formData.get("audio");
  if (!(audio instanceof Blob)) return { status: "error", code: "NO_AUDIO" };
  const locale = await getLocaleFromCookie();
  const r = await transcribeAudio(audio, locale);
  return r.status === "ok"
    ? { status: "ok", text: r.text }
    : { status: "error", code: r.message };
}
