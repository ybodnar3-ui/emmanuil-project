"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { logError } from "@/server/log";

export type SendMagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error" };

export type SignInWithGoogleResult =
  | { status: "ok"; url: string }
  | { status: "error" };

/**
 * Starts the Google OAuth (PKCE) flow. We don't redirect server-side: with the
 * `@supabase/ssr` server client, `signInWithOAuth` returns the provider
 * authorization URL (and sets the PKCE code-verifier cookie via the client's
 * setAll), and the client navigates the browser to it. Google then redirects
 * back to /auth/confirm with a `code`, which we exchange for a session.
 *
 * Requires the Google provider to be enabled in the Supabase dashboard. If it
 * isn't, the provider returns an error and we surface the stable "error" state
 * (the UI shows auth.googleError) rather than crashing.
 */
export async function signInWithGoogleAction(): Promise<SignInWithGoogleResult> {
  const supabase = await createSupabaseServerClient();
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/confirm` },
    });
    if (error || !data?.url) {
      if (error) logError("auth.signInWithGoogle", error);
      return { status: "error" };
    }
    return { status: "ok", url: data.url };
  } catch (err) {
    logError("auth.signInWithGoogle", err);
    return { status: "error" };
  }
}

/**
 * Sends a passwordless magic link to the submitted email. The link points back to
 * /auth/confirm, which verifies the OTP and establishes the session.
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

  // signInWithOtp returns (not throws) on failure; log the provider error
  // server-side and surface only the generic stable status to the client.
  if (error) {
    logError("auth.signInWithOtp", error);
    return { status: "error" };
  }
  return { status: "sent", email };
}
