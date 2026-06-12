import { prisma } from "@/server/db";
import { assertPersonOwned } from "@/server/data/people";
import type { TaskInput } from "@/server/validation/task";
import { endOfUtcDay, addUtcDays } from "@/server/today/dates";

/**
 * Scoped data-access for Task. Like every owned-row module, each query/mutation
 * is scoped to the authenticated userId; mutations scope by `{ id, userId }` in
 * the `where` so one user can never touch another user's task. A task may be
 * attached to a Person — when it is, ownership of that Person is asserted before
 * the write (a task can't reference someone else's person).
 */

/**
 * Create a task for the user. If `personId` is set, ownership of that person is
 * asserted first (throws "Person not found" otherwise). `userId` is always
 * forced from the caller — never taken from input.
 */
export async function createTask(userId: string, input: TaskInput) {
  if (input.personId) {
    await assertPersonOwned(userId, input.personId);
  }
  return prisma.task.create({
    data: {
      userId,
      title: input.title,
      dueAt: input.dueAt,
      personId: input.personId ?? null,
      note: input.note ?? null,
    },
  });
}

/**
 * Open ("todo") tasks due on or before the end of `now`'s UTC day, scoped to the
 * user. Includes the linked person's name (if any) so the feed can label them.
 */
export function listOpenTasksDue(userId: string, now: Date) {
  return prisma.task.findMany({
    where: {
      userId,
      status: "todo",
      dueAt: { lte: endOfUtcDay(now) },
    },
    orderBy: { dueAt: "asc" },
    include: { person: { select: { id: true, fullName: true } } },
  });
}

/**
 * Mark a task done. Scoped by `{ id, userId }` in the where, so another user's
 * task can't be completed. updateMany returns count 0 (no-op) when the task
 * isn't found or isn't owned — it never throws P2025 on a stale/forged id.
 */
export function completeTask(userId: string, taskId: string) {
  return prisma.task.updateMany({
    where: { id: taskId, userId },
    data: { status: "done" },
  });
}

/**
 * Push a task's due date forward by `days`. Base is `now` (snooze = "remind me
 * again in N days from now", regardless of how overdue it already was — simplest
 * and most predictable). Scoped by `{ id, userId }`; no-op if not owned.
 */
export function snoozeTask(
  userId: string,
  taskId: string,
  days: number,
  now: Date = new Date(),
) {
  return prisma.task.updateMany({
    where: { id: taskId, userId },
    data: { dueAt: addUtcDays(now, days) },
  });
}
