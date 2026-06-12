import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Read a required env var at point-of-use (per request), not at import time, so
 * a missing value fails with a clear message — caught by the error boundary —
 * rather than a cryptic deep failure inside @supabase/ssr. Keeping the check off
 * the module top level also avoids breaking the build/tests when the var is unset.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * Server-side Supabase client (RSC, route handlers, server actions).
 * Uses the @supabase/ssr getAll/setAll cookie adapter against Next 16's async cookies().
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only — safe to
            // ignore; the middleware (updateSession) refreshes the auth cookies.
          }
        },
      },
    },
  );
}
