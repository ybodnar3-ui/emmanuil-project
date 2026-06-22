// @vitest-environment node
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
const TEST_KEYDATE_ID = "rls-test-keydate";

describe.skipIf(!hasEnv)("RLS deny-by-default (anon path)", () => {
  afterAll(async () => {
    // Always clean up, even if assertions failed. Deleting the User cascades to Person.
    // Do NOT $disconnect() here: `prisma` is the shared module singleton, so
    // disconnecting would break any later test that uses the real client. Vitest's
    // process teardown closes the pool when the run ends.
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
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
    // This test only uses the PostgREST (HTTP) path. Under the node test env on
    // Node 20 there is no global WebSocket, and supabase-js eagerly initializes its
    // realtime client in the constructor, which would throw. We never open a realtime
    // channel, so we inject a dummy transport to skip the global-WebSocket lookup.
    const supabase = createClient(url!, anonKey!, {
      realtime: { transport: class {} as never },
    });
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

  it("hides a Prisma-seeded KeyDate row from the anon Supabase client", async () => {
    // Seed via the privileged Prisma path (bypasses RLS). FK chain: User → Person → KeyDate.
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
    await prisma.user.create({
      data: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
    });
    await prisma.person.create({
      data: { id: TEST_PERSON_ID, userId: TEST_USER_ID, fullName: "RLS Probe" },
    });
    await prisma.keyDate.create({
      data: {
        id: TEST_KEYDATE_ID,
        personId: TEST_PERSON_ID,
        label: "RLS Probe Date",
        date: new Date("2000-01-01T00:00:00.000Z"),
      },
    });

    // Positive control: the row really exists and is visible to the privileged path.
    const seeded = await prisma.keyDate.findUnique({
      where: { id: TEST_KEYDATE_ID },
    });
    expect(seeded?.id).toBe(TEST_KEYDATE_ID);

    // The real proof: the anon client must NOT see the row that definitely exists.
    // (See the Person probe above for why we inject a dummy realtime transport.)
    const supabase = createClient(url!, anonKey!, {
      realtime: { transport: class {} as never },
    });
    const { data, error } = await supabase
      .from("KeyDate")
      .select("*")
      .eq("id", TEST_KEYDATE_ID);

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
