import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { logError } from "@/server/log";

/**
 * Signs the current user out and redirects to /login.
 * POST-only (state-changing) — wired from a small form on the Settings page.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  // Log a failed sign-out server-side, but still redirect to /login regardless
  // (the client-side session is cleared either way).
  if (error) logError("auth.signOut", error);
  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}
