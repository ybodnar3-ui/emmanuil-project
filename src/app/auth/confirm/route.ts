import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * Magic-link / OTP callback. Supabase appends `token_hash` + `type` to the
 * emailRedirectTo URL. We verify the OTP (which sets the session cookies via the
 * server client's setAll) and redirect to the post-login destination.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Sanitize `next`: only accept a same-origin relative path so a crafted
  // `?next=https://evil.com` (or protocol-relative `//evil.com`) can't redirect
  // off-site after a successful auth.
  const rawNext = searchParams.get("next") ?? "/";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Verification failed or params missing — send the user back to login.
  return NextResponse.redirect(new URL("/login", origin));
}
