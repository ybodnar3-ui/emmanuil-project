import { prisma } from "@/server/db";
import { assertPersonOwned } from "@/server/data/people";
import type { FactInput } from "@/server/validation/person";

/**
 * Facts are nested under a Person. Every read/write first proves the caller owns
 * the Person (or, for fact-id operations, that the fact's person belongs to them).
 */

export async function listFacts(userId: string, personId: string) {
  await assertPersonOwned(userId, personId);
  return prisma.fact.findMany({
    where: { personId },
    orderBy: { createdAt: "desc" },
  });
}

export async function addFact(
  userId: string,
  personId: string,
  input: FactInput,
) {
  await assertPersonOwned(userId, personId);
  return prisma.fact.create({
    data: { personId, category: input.category, content: input.content },
  });
}

export async function deleteFact(userId: string, factId: string) {
  // A fact is identified by its own id, so we verify ownership through its person.
  const fact = await prisma.fact.findFirst({
    where: { id: factId },
    include: { person: { select: { userId: true } } },
  });
  if (!fact || fact.person.userId !== userId) {
    throw new Error("Fact not found");
  }
  return prisma.fact.delete({ where: { id: factId } });
}
