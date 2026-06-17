import { prisma } from "@/server/db";
import type { PersonInput } from "@/server/validation/person";

/**
 * Scoped data-access for Person. This module establishes the isolation contract
 * for the whole app:
 *
 *   Every owned-row query MUST be scoped by userId; never expose an unscoped query.
 *
 * App-layer userId scoping is the PRIMARY data-isolation guard (RLS deny-by-default
 * is the secondary lock). Nested entities (Fact/Interaction/Cadence) are reached
 * only via a Person that belongs to the user — enforced by assertPersonOwned().
 */

/**
 * Map validated PersonInput → Prisma data. Optional empty strings become null so
 * the DB stores absence consistently rather than "".
 */
function toPersonData(input: PersonInput) {
  return {
    fullName: input.fullName,
    howWeMet: input.howWeMet ? input.howWeMet : null,
    location: input.location ? input.location : null,
    birthday: input.birthday ?? null,
    tags: input.tags ?? [],
    relationshipTier: input.relationshipTier ?? null,
  };
}

export function listPeople(userId: string) {
  return prisma.person.findMany({
    where: { userId },
    orderBy: { fullName: "asc" },
  });
}

/**
 * Loads a Person only if it belongs to userId. Throws otherwise. The single gate
 * every nested-entity mutation funnels through before touching Fact/Interaction/Cadence.
 */
export async function assertPersonOwned(userId: string, personId: string) {
  const person = await prisma.person.findFirst({
    where: { id: personId, userId },
  });
  if (!person) throw new Error("Person not found");
  return person;
}

export function getPerson(userId: string, personId: string) {
  return prisma.person.findFirst({
    where: { id: personId, userId },
    include: {
      facts: { orderBy: { createdAt: "desc" } },
      interactions: { orderBy: { date: "desc" } },
      cadence: true,
      keyDates: { orderBy: { date: "asc" } },
    },
  });
}

export function createPerson(userId: string, input: PersonInput) {
  // userId is always forced from the authenticated caller — never taken from input.
  return prisma.person.create({
    data: { ...toPersonData(input), userId },
  });
}

export async function updatePerson(
  userId: string,
  personId: string,
  input: PersonInput,
) {
  await assertPersonOwned(userId, personId);
  return prisma.person.update({
    where: { id: personId },
    data: toPersonData(input),
  });
}

export async function deletePerson(userId: string, personId: string) {
  await assertPersonOwned(userId, personId);
  return prisma.person.delete({ where: { id: personId } });
}

/** Update only the photoUrl (used by the photo-upload action), ownership-checked. */
export async function updatePersonPhoto(
  userId: string,
  personId: string,
  photoUrl: string,
) {
  await assertPersonOwned(userId, personId);
  return prisma.person.update({
    where: { id: personId },
    data: { photoUrl },
  });
}

export function searchPeople(
  userId: string,
  opts: { query?: string; tag?: string; tier?: string } = {},
) {
  return prisma.person.findMany({
    where: {
      userId,
      ...(opts.query
        ? { fullName: { contains: opts.query, mode: "insensitive" as const } }
        : {}),
      ...(opts.tag ? { tags: { has: opts.tag } } : {}),
      ...(opts.tier ? { relationshipTier: opts.tier } : {}),
    },
    orderBy: { fullName: "asc" },
  });
}
