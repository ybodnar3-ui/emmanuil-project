import { z } from "zod";
import { logError } from "@/server/log";

// logError is server-only (console.error). Node runtime.
export const runtime = "nodejs";

// Hard cap on the raw body so this public endpoint can't be used to flood logs.
const MAX_BODY_BYTES = 8192;

const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

const payloadSchema = z.object({
  message: z.string().min(1),
  stack: z.string().optional(),
  url: z.string().optional(),
  scope: z.string().optional(),
  digest: z.string().optional(),
});

/**
 * Bridge so browser errors land in the same Vercel logs as server errors. Public
 * (errors happen pre-auth on /login too) but it only writes to the server log —
 * no DB, no secrets. Oversized → silently dropped (204). Invalid → 400. Never
 * throws to the caller; never lets a malformed report break anything.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      // Too big to be a real error report — drop it without logging.
      return new Response(null, { status: 204 });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return new Response(null, { status: 400 });
    }
    const result = payloadSchema.safeParse(parsed);
    if (!result.success) {
      return new Response(null, { status: 400 });
    }
    const { message, stack, url, scope, digest } = result.data;
    const err = new Error(trunc(message, 1000));
    if (stack) err.stack = trunc(stack, 4000);
    logError("client", err, {
      scope: scope ? trunc(scope, 50) : "client",
      ...(url ? { url: trunc(url, 500) } : {}),
      ...(digest ? { digest: trunc(digest, 100) } : {}),
    });
    return new Response(null, { status: 204 });
  } catch {
    // Monitoring must never break: swallow anything unexpected.
    return new Response(null, { status: 400 });
  }
}
