import { prisma } from "@/server/db";
import { assertPersonOwned } from "@/server/data/people";
import { computeNextDueAt } from "@/server/cadence";
import { addUtcDays } from "@/server/today/dates";

/**
 * Feed actions that mutate a Person's Cadence. Both gate on assertPersonOwned
 * before any write, so a cadence belonging to another user's person can never
 * be advanced or rescheduled.
 *
 * These reuse the pure cadence math (`computeNextDueAt`, Phase 3) rather than
 * duplicating the interval arithmetic.
 */

/**
 * "I just reached out." Sets lastContactedAt = now and advances nextDueAt by the
 * cadence's own interval (computeNextDueAt(now, intervalDays)).
 *
 * If the person has no cadence there is nothing to advance — a deliberate no-op
 * (returns null), not an error. For MVP we only bump the cadence; logging a full
 * Interaction record ("Reached out") is intentionally left out to keep history
 * fidelity opt-in (noted in the plan's carried-forward notes).
 */
export async function markContacted(
  userId: string,
  personId: string,
  now: Date = new Date(),
) {
  await assertPersonOwned(userId, personId);
  const cadence = await prisma.cadence.findUnique({ where: { personId } });
  if (!cadence) return null;
  return prisma.cadence.update({
    where: { personId },
    data: {
      lastContactedAt: now,
      nextDueAt: computeNextDueAt(now, cadence.intervalDays),
    },
  });
}

/**
 * Push a due contact's nextDueAt forward by `days` from now. Does NOT touch
 * lastContactedAt (a snooze means "remind me later", not "I reached out").
 * No-op (returns null) when the person has no cadence.
 */
export async function snoozeCadence(
  userId: string,
  personId: string,
  days: number,
  now: Date = new Date(),
) {
  await assertPersonOwned(userId, personId);
  const cadence = await prisma.cadence.findUnique({ where: { personId } });
  if (!cadence) return null;
  return prisma.cadence.update({
    where: { personId },
    data: { nextDueAt: addUtcDays(now, days) },
  });
}
