import { prisma } from "@/server/db";
import { assertPersonOwned } from "@/server/data/people";
import { computeNextDueAt } from "@/server/cadence";

/**
 * Cadence is a one-per-Person record. Setting it (re)computes nextDueAt from the
 * last-contacted date if known, otherwise from `now` (injectable for tests).
 */

export async function setCadence(
  userId: string,
  personId: string,
  intervalDays: number,
  now: Date = new Date(),
) {
  await assertPersonOwned(userId, personId);

  const existing = await prisma.cadence.findUnique({ where: { personId } });
  const base = existing?.lastContactedAt ?? now;
  const nextDueAt = computeNextDueAt(base, intervalDays);

  return prisma.cadence.upsert({
    where: { personId },
    create: { personId, intervalDays, nextDueAt },
    update: { intervalDays, nextDueAt },
  });
}

export async function clearCadence(userId: string, personId: string) {
  await assertPersonOwned(userId, personId);
  return prisma.cadence.delete({ where: { personId } });
}
