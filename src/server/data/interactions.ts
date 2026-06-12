import { prisma } from "@/server/db";
import { assertPersonOwned } from "@/server/data/people";
import { computeNextDueAt } from "@/server/cadence";
import type { InteractionInput } from "@/server/validation/person";

/**
 * Interactions are nested under a Person. Logging one also bumps the Person's
 * Cadence (if set): lastContactedAt := the interaction date, nextDueAt recomputed
 * from that date. Create + cadence update run in a single transaction.
 */

export async function listInteractions(userId: string, personId: string) {
  await assertPersonOwned(userId, personId);
  return prisma.interaction.findMany({
    where: { personId },
    orderBy: { date: "desc" },
  });
}

export async function logInteraction(
  userId: string,
  personId: string,
  input: InteractionInput,
) {
  await assertPersonOwned(userId, personId);
  const date = input.date ?? new Date();

  return prisma.$transaction(async (tx) => {
    const interaction = await tx.interaction.create({
      data: {
        personId,
        date,
        channel: input.channel ?? null,
        summary: input.summary,
      },
    });

    // Read the cadence INSIDE the transaction so a concurrent clearCadence can't
    // make the update below throw P2025 and roll back the interaction. We only
    // bump it if it still exists.
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

    return interaction;
  });
}
