import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Integration test: proves RLS deny-by-default blocks the public anon/PostgREST path.
// Reads keys from the environment and SKIPS when they are absent (so CI without
// secrets stays green). Runs locally where .env is loaded.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasEnv = Boolean(url && anonKey);

describe.skipIf(!hasEnv)("RLS deny-by-default (anon path)", () => {
  it("cannot read Person via the anon key", async () => {
    const supabase = createClient(url!, anonKey!);
    const { data, error } = await supabase.from("Person").select("*").limit(1);

    // RLS with no policies denies the anon role. Acceptable outcomes:
    //  - an error (permission denied / table not exposed), or
    //  - a successful call that returns zero rows (never leaks data).
    if (error) {
      expect(error).toBeTruthy();
    } else {
      expect(data ?? []).toHaveLength(0);
    }
  });
});
