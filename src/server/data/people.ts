import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

/**
 * Scoped data-access for Person. This module establishes the isolation contract
 * for the whole app:
 *
 *   Every owned-row query MUST be scoped by userId; never expose an unscoped query.
 *
 * App-layer userId scoping is the PRIMARY data-isolation guard (RLS deny-by-default
 * is the secondary lock). Full Person CRUD lands in Phase 3 on top of this pattern.
 */

export function listPeople(userId: string) {
  return prisma.person.findMany({
    where: { userId },
    orderBy: { fullName: "asc" },
  });
}

/** Fields a caller may set when creating a Person (userId is injected, never accepted). */
export type CreatePersonInput = Omit<
  Prisma.PersonUncheckedCreateInput,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export function createPerson(userId: string, data: CreatePersonInput) {
  // userId is always forced from the authenticated caller — it is never taken from
  // untrusted input.
  return prisma.person.create({
    data: { ...data, userId },
  });
}
