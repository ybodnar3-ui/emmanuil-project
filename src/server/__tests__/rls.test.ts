import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";

// Integration test: proves RLS deny-by-default blocks the public anon/PostgREST path.
//
// The earlier version queried the empty Person table and asserted zero rows — which
// passes whether or not RLS is enabled, proving nothing. This version SEEDS a row via
// Prisma (which connects as `postgres` and BYPASSes RLS), then proves the anon client
// cannot see that row. A row that definitely exists being invisible to anon is the real
// proof. A positive control (Prisma can see it) guards against a false pass from a
// silently-failed seed.
//
// SKIPS when the required env vars are absent (so CI without secrets stays green).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasEnv = Boolean(url && anonKey && process.env.DATABASE_URL);

const TEST_USER_ID = "rls-test-user";
const TEST_USER_EMAIL = "rls-test@example.invalid";
const TEST_PERSON_ID = "rls-test-person";

describe.skipIf(!hasEnv)("RLS deny-by-default (anon path)", () => {
  afterAll(async () => {
    // Always clean up, even if assertions failed. Deleting the User cascades to Person.
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.$disconnect();
  });

  it("hides a Prisma-seeded Person row from the anon Supabase client", async () => {
    // Seed via the privileged Prisma path (bypasses RLS). FK requires a User first.
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.user.create({
      data: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
    });
    await prisma.person.create({
      data: { id: TEST_PERSON_ID, userId: TEST_USER_ID, fullName: "RLS Probe" },
    });

    // Positive control: the row really exists and is visible to the privileged path.
    const seeded = await prisma.person.findUnique({ where: { id: TEST_PERSON_ID } });
    expect(seeded?.id).toBe(TEST_PERSON_ID);

    // The real proof: the anon client must NOT see the row that definitely exists.
    const supabase = createClient(url!, anonKey!);
    const { data, error } = await supabase
      .from("Person")
      .select("*")
      .eq("id", TEST_PERSON_ID);

    // RLS with no policies denies the anon role. Acceptable outcomes:
    //  - an error (permission denied / table not exposed), or
    //  - a successful call returning no rows (the row is invisible, never leaked).
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(data ?? []).toHaveLength(0);
    }
  });
});
