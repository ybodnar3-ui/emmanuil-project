"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/server/supabase/server";

export type SendMagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error" };

/**
 * Sends a passwordless magic link to the submitted email. The link points back to
 * /auth/confirm, which verifies the OTP and establishes the session.
 *
 * Google OAuth is deferred (Phase later): to add it, call
 * supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })
 * from a separate action and add a button on the login page.
 */
export async function sendMagicLink(
  _prev: SendMagicLinkState,
  formData: FormData,
): Promise<SendMagicLinkState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { status: "error" };

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      // Allow first-time visitors to create an account via the magic link.
      // Set to false for an invite-only deployment (links only sign in existing users).
      shouldCreateUser: true,
    },
  });

  if (error) return { status: "error" };
  return { status: "sent", email };
}
