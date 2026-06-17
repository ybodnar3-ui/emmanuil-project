import { prisma } from "@/server/db";
import { assertPersonOwned } from "@/server/data/people";
import { daysUntilBirthday } from "@/server/today/dates";
import type { KeyDateInput } from "@/server/validation/keydate";

/**
 * Key dates are nested under a Person (mirrors facts.ts). Every read/write first
 * proves the caller owns the Person (or, for key-date-id operations, that the key
 * date's person belongs to them) — the same ownership contract as the rest of the
 * data layer. "Upcoming" reuses the pure UTC daysUntilBirthday so a key date
 * recurs annually by month/day, ignoring the stored year (age/context only).
 */

export async function listKeyDates(userId: string, personId: string) {
  await assertPersonOwned(userId, personId);
  return prisma.keyDate.findMany({
    where: { personId },
    orderBy: { date: "asc" },
  });
}

export async function addKeyDate(
  userId: string,
  personId: string,
  input: KeyDateInput,
) {
  await assertPersonOwned(userId, personId);
  return prisma.keyDate.create({
    data: { personId, label: input.label, date: input.date },
  });
}

export async function deleteKeyDate(userId: string, keyDateId: string) {
  // A key date is identified by its own id, so verify ownership through its person
  // (cross-table check, like deleteFact).
  const kd = await prisma.keyDate.findUnique({
    where: { id: keyDateId },
    include: { person: { select: { userId: true } } },
  });
  if (!kd || kd.person.userId !== userId) {
    throw new Error("Key date not found");
  }
  return prisma.keyDate.delete({ where: { id: keyDateId } });
}

export type UpcomingKeyDate = {
  id: string;
  personId: string;
  personName: string;
  label: string;
  date: Date;
  inDays: number;
};

/**
 * This user's key dates whose next annual occurrence is within `windowDays`.
 * Scoped via the person relation (person: { userId }); the window filter is done
 * in memory because the next-occurrence math is pure + UTC and can't be expressed
 * as a simple SQL range across the year boundary (same shape as the birthday read).
 * Sorted soonest-first (inDays ascending).
 */
export async function getUpcomingKeyDates(
  userId: string,
  now: Date,
  windowDays = 7,
): Promise<UpcomingKeyDate[]> {
  const rows = await prisma.keyDate.findMany({
    where: { person: { userId } },
    select: {
      id: true,
      personId: true,
      label: true,
      date: true,
      person: { select: { fullName: true } },
    },
  });
  return rows
    .map((r) => ({
      id: r.id,
      personId: r.personId,
      personName: r.person.fullName,
      label: r.label,
      date: r.date,
      inDays: daysUntilBirthday(r.date, now),
    }))
    .filter((r) => r.inDays <= windowDays)
    .sort((a, b) => a.inDays - b.inDays);
}
