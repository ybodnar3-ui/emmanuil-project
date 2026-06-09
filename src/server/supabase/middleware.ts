import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every matched request and propagates any
 * rotated auth cookies onto both the request (for downstream RSC reads) and the
 * response (back to the browser). Follows the @supabase/ssr Next.js middleware pattern.
 *
 * IMPORTANT: do not run logic between client creation and the auth call below, and
 * always return the `supabaseResponse` object as-is so cookies are not dropped.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the user to trigger a token refresh when needed; this writes rotated
  // cookies via setAll above. Route protection is handled by requireUser() in the
  // (app) layout, so we do not redirect here.
  await supabase.auth.getUser();

  return supabaseResponse;
}
