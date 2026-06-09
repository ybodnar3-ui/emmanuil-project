import type { NextRequest } from "next/server";
import { updateSession } from "@/server/supabase/middleware";

// Next 16 renamed the root `middleware` file convention to `proxy`. The file must
// live at `src/proxy.ts` and export a `proxy` function (named or default). We keep
// delegating to the existing @supabase/ssr `updateSession` helper (that filename is
// unaffected by the rename).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico and other static image assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
