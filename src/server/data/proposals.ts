import { prisma } from "@/server/db";
import { assertPersonOwned } from "@/server/data/people";
import { computeNextDueAt } from "@/server/cadence";
import {
  factInputSchema,
  interactionInputSchema,
} from "@/server/validation/person";
import { keyDateInputSchema } from "@/server/validation/keydate";
import { logError } from "@/server/log";

/**
 * The assistant's confirm-before-persist write path. The conversational layer
 * NEVER writes during interpretation; only `applyProposal` — invoked by an
 * explicit user Confirm — persists, and it is ownership-checked exactly like the
 * rest of the Phase 3 data layer (assertPersonOwned before any write).
 */

/** Roster used by the interpreter to resolve a mentioned person to an id. */
export function listRoster(userId: string) {
  return prisma.person.findMany({
    where: { userId },
    select: { id: true, fullName: true, tags: true },
    orderBy: { fullName: "asc" },
  });
}

export type ProposalInput = {
  facts: { category: string; content: string }[];
  interaction?: { summary: string; channel?: string | null } | null;
  // Assistant-extracted labeled dates. `date` is an untrusted ISO string; each is
  // re-validated server-side via keyDateInputSchema and a bad/unparseable date is
  // skipped (never persisted), not thrown.
  keyDates?: { label: string; date: string }[];
};

/**
 * Persist a confirmed proposal: assert ownership, validate every item through
 * the Phase 3 zod schemas (never trust the client-sent shape), then create the
 * facts, any valid key dates, and (if present) the interaction in a single
 * transaction. Invalid proposed key dates are skipped (re-validated, not trusted).
 * When an interaction is logged we reuse the cadence-bump logic from `logInteraction`
 * (lastContactedAt := date, nextDueAt := computeNextDueAt) rather than
 * duplicating the cadence math. Rejects an empty proposal.
 */
export async function applyProposal(
  userId: string,
  personId: string,
  input: ProposalInput,
) {
  await assertPersonOwned(userId, personId);

  // Validate untrusted input up front. factInputSchema/interactionInputSchema
  // trim + enforce the allowed category/channel enums.
  const facts = (input.facts ?? []).map((f) => factInputSchema.parse(f));
  const interaction =
    input.interaction == null
      ? null
      : interactionInputSchema.parse({
          summary: input.interaction.summary,
          channel: input.interaction.channel ?? null,
        });

  // Key dates carry a client/AI-supplied ISO date string: re-validate (coerce) each
  // and SKIP invalid ones (don't throw) so one malformed date can't sink the whole
  // confirmed proposal. Never trust the client-sent shape.
  const keyDates = (input.keyDates ?? []).flatMap((k) => {
    const parsed = keyDateInputSchema.safeParse({ label: k.label, date: k.date });
    if (parsed.success) return [parsed.data];
    // Log only the offending date string (not the label, which is user/AI-authored
    // content) so a systematic AI date-format regression is visible in prod logs.
    logError("proposals.invalidKeyDate", parsed.error, { date: k.date });
    return [];
  });

  if (facts.length === 0 && interaction == null && keyDates.length === 0) {
    throw new Error("Empty proposal");
  }

  // interaction timestamp = confirmation time (server); never trust a client-supplied date
  const date = new Date();

  return prisma.$transaction(async (tx) => {
    const createdFacts = [];
    for (const f of facts) {
      createdFacts.push(
        await tx.fact.create({
          data: { personId, category: f.category, content: f.content },
        }),
      );
    }

    const createdKeyDates = [];
    for (const k of keyDates) {
      createdKeyDates.push(
        await tx.keyDate.create({
          data: { personId, label: k.label, date: k.date },
        }),
      );
    }

    let createdInteraction = null;
    if (interaction) {
      createdInteraction = await tx.interaction.create({
        data: {
          personId,
          date,
          channel: interaction.channel ?? null,
          summary: interaction.summary,
        },
      });

      // Same cadence bump as logInteraction: read inside the tx so a concurrent
      // clearCadence can't roll back the write; only bump if it still exists.
      const cadence = await tx.cadence.findUnique({ where: { personId } });
      if (cadence) {
        await tx.cadence.update({
          where: { personId },
          data: {
            lastContactedAt: date,
            nextDueAt: computeNextDueAt(date, cadence.intervalDays),
          },
        });
      }
    }

    return {
      facts: createdFacts,
      interaction: createdInteraction,
      keyDates: createdKeyDates,
    };
  });
}
