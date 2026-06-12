/**
 * Server-only structured error logger.
 *
 * - DO NOT import this from a client component. It writes to `console.error`
 *   (server logs only) and is never returned to the client.
 * - Logging is NOT leaking: callers must still return their stable client error
 *   codes (`REQUEST_FAILED`, `NOT_FOUND`, …) to the UI. It's fine to log the raw
 *   `err.message` here because these logs never reach the browser.
 * - Emits exactly one JSON line per call so log aggregators can parse it.
 *
 * The `console.error` sink is the seam to swap for a real aggregator (Sentry/
 * Logtail) post-MVP without touching call sites.
 */

type Meta = Record<string, string | number | boolean | null | undefined>;

export function logError(scope: string, err: unknown, meta?: Meta): void {
  const base =
    err instanceof Error
      ? {
          message: err.message,
          name: err.name,
          ...(typeof (err as { code?: unknown }).code === "string"
            ? { code: (err as { code: string }).code }
            : {}),
        }
      : { message: String(err) };
  const entry = {
    level: "error",
    scope,
    ...base,
    ...(meta ?? {}),
    ...(process.env.NODE_ENV !== "production" && err instanceof Error
      ? { stack: err.stack }
      : {}),
  };
  // server-only sink; structured for log aggregators
  console.error(JSON.stringify(entry));
}
