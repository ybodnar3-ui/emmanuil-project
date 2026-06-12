import { prisma } from "@/server/db";
import { assertPersonOwned } from "@/server/data/people";
import { computeNextDueAt } from "@/server/cadence";
import {
  factInputSchema,
  interactionInputSchema,
} from "@/server/validation/person";

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
};

/**
 * Persist a confirmed proposal: assert ownership, validate every item through
 * the Phase 3 zod schemas (never trust the client-sent shape), then create the
 * facts and (if present) the interaction in a single transaction. When an
 * interaction is logged we reuse the cadence-bump logic from `logInteraction`
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

  if (facts.length === 0 && interaction == null) {
    throw new Error("Empty proposal");
  }

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

    return { facts: createdFacts, interaction: createdInteraction };
  });
}
