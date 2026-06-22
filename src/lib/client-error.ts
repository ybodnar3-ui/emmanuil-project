/**
 * Browser-only error reporter. Posts a small payload to /api/client-error so
 * client errors reach the same Vercel logs as server errors. Best-effort: it
 * MUST never throw or surface to the user — all failures are swallowed. No-ops
 * during SSR.
 */
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

export function reportClientError(error: unknown, scope: string): void {
  try {
    if (typeof window === "undefined") return;
    const err = error instanceof Error ? error : new Error(String(error));
    const payload = {
      message: trunc(err.message || "Unknown client error", 1000),
      stack: err.stack ? trunc(err.stack, 4000) : undefined,
      url: trunc(window.location.href, 500),
      scope,
    };
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting must never break the app.
  }
}
