import { prisma } from "@/server/db";
import { assertPersonOwned } from "@/server/data/people";
import { suggestTalkingPoint } from "@/server/ai/suggest";
import type { PersonForBrief } from "@/server/ai/brief";

/**
 * Per-cadence-cycle personalized reminder prompt: the "what to ask" line baked
 * into each due contact on the home feed and in the Telegram reminder.
 *
 * Generated once per cycle and cached on the Cadence row (reminderPrompt /
 * reminderPromptAt). A cache hit costs nothing (no AI call); regeneration only
 * happens on a new cycle — i.e. when reminderPromptAt is null or predates
 * lastContactedAt (the user reached out, so the next reminder should be fresh).
 *
 * Contract (mirrors the AI no-throw / no-leak rule): this NEVER throws for an
 * AI/data hiccup and ALWAYS returns non-empty text — on any AI error or empty
 * suggestion it returns a deterministic warm localized fallback. Ownership IS
 * enforced (assertPersonOwned) and a not-owned person propagates that error,
 * so the function never generates or writes for someone the caller doesn't own.
 *
 * `trusted` opt-out: when the caller has ALREADY proven ownership (e.g. the Today
 * feed loads cadences via a `person: { userId }`-scoped query), pass
 * { trusted: true } to skip the redundant assertPersonOwned round-trip. Default
 * is false so standalone callers stay ownership-safe.
 */

// fallbackPrompt: hardcoded en/uk is acceptable for our two locales (no generic
// per-locale lookup table needed yet); revisit if a third locale is added.
export function fallbackPrompt(locale: string): string {
  return locale === "uk"
    ? "Час написати — дізнайтесь, як справи, і підтримайте зв'язок."
    : "Time to reach out — check in and see how they're doing.";
}

export async function getOrCreateReminderPrompt(
  userId: string,
  personId: string,
  locale: string,
  now: Date,
  options: { trusted?: boolean } = {},
): Promise<string> {
  // Ownership first: never generate/cache for a person the caller doesn't own.
  // A trusted caller (ownership already enforced upstream by a scoped query) may
  // skip this extra DB round-trip; the default-safe path still checks.
  if (!options.trusted) {
    await assertPersonOwned(userId, personId);
  }

  const cadence = await prisma.cadence.findUnique({ where: { personId } });
  // No cadence means nothing to anchor the cycle on — give the warm fallback
  // without writing (there's no row to cache on).
  if (!cadence) return fallbackPrompt(locale);

  // Fresh = we have a cached prompt generated at/after the last contact (this
  // cycle). Stale (regenerate) when reminderPromptAt is null or predates the
  // last contact.
  const fresh =
    cadence.reminderPromptAt != null &&
    (cadence.lastContactedAt == null ||
      cadence.reminderPromptAt >= cadence.lastContactedAt);
  if (fresh && cadence.reminderPrompt) return cadence.reminderPrompt;

  // Re-fetch the person scoped to the user with the facts/interactions the AI
  // needs, mapped down to the PersonForBrief shape suggestTalkingPoint expects.
  const person = await prisma.person.findFirst({
    where: { id: personId, userId },
    select: {
      fullName: true,
      howWeMet: true,
      location: true,
      birthday: true,
      relationshipTier: true,
      tags: true,
      facts: {
        orderBy: { createdAt: "desc" },
        select: { category: true, content: true },
      },
      interactions: {
        orderBy: { date: "desc" },
        take: 5,
        select: { date: true, channel: true, summary: true },
      },
    },
  });

  let text = fallbackPrompt(locale);
  if (person) {
    const occasion =
      locale === "uk"
        ? "Час відновити контакт за каденцією"
        : "Time to reconnect (cadence due)";
    const personForBrief: PersonForBrief = person;
    const result = await suggestTalkingPoint(personForBrief, occasion, locale);
    if (result.status === "ok" && result.suggestion.trim()) {
      text = result.suggestion.trim();
    }
  }

  // Cache-write race (accepted for MVP): a concurrent home-render and the cron
  // may both find the prompt stale and regenerate, so this update is last-write-
  // wins. That's idempotent enough — both produce an equivalent prompt for the
  // same cycle. Future hardening: write a 'generating' sentinel to claim the
  // cycle before the AI call so only one writer proceeds. No locking needed now.
  await prisma.cadence.update({
    where: { personId },
    data: { reminderPrompt: text, reminderPromptAt: now },
  });
  return text;
}
