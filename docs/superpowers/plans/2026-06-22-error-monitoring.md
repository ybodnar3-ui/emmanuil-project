# Error Monitoring (Vercel-native) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make browser errors visible in Vercel logs (server errors already are) via a tiny client-error bridge — no third-party vendor.

**Architecture:** A public, size-capped `POST /api/client-error` route validates a small payload and writes it through the existing `logError` (→ structured `console.error` → Vercel Logs). A browser-only `reportClientError` helper posts to it; it's called from the three error boundaries (React render crashes) and from a global listener component mounted in the root layout (uncaught errors + unhandled rejections). Best-effort, never throws.

**Tech Stack:** Next.js 16 (App Router, route handlers, RSC), TypeScript, zod 4, Vitest 4 (jsdom).

**Spec:** `docs/superpowers/specs/2026-06-22-error-monitoring-design.md`

---

## File Structure
- Create: `src/app/api/client-error/route.ts` — the bridge endpoint.
- Create: `src/app/api/client-error/__tests__/route.test.ts`.
- Create: `src/lib/client-error.ts` — browser reporter helper.
- Create: `src/lib/__tests__/client-error.test.ts`.
- Create: `src/app/_components/client-error-reporter.tsx` — global listener (renders null).
- Modify: `src/app/layout.tsx` — mount the reporter.
- Modify: `src/app/global-error.tsx`, `src/app/error.tsx`, `src/app/(app)/error.tsx` — report on mount.
- Modify: `README.md` — note where client errors show up.

---

## Task 1: `/api/client-error` bridge endpoint (test-first)

**Files:**
- Create: `src/app/api/client-error/route.ts`
- Test: `src/app/api/client-error/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/api/client-error/__tests__/route.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const logError = vi.fn();
vi.mock("@/server/log", () => ({ logError: (...a: unknown[]) => logError(...a) }));

import { POST } from "../route";

function post(body: string): Request {
  return new Request("https://app.test/api/client-error", {
    method: "POST",
    body,
  });
}

beforeEach(() => logError.mockReset());

describe("POST /api/client-error", () => {
  it("logs a valid payload under scope 'client' and returns 204", async () => {
    const res = await POST(
      post(JSON.stringify({ message: "boom", scope: "window", url: "/x" })),
    );
    expect(res.status).toBe(204);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toBe("client");
    // meta carries the reported scope + url
    expect(logError.mock.calls[0][2]).toMatchObject({ scope: "window", url: "/x" });
  });

  it("returns 400 without logging on a missing message", async () => {
    const res = await POST(post(JSON.stringify({ url: "/x" })));
    expect(res.status).toBe(400);
    expect(logError).not.toHaveBeenCalled();
  });

  it("returns 400 without logging on invalid JSON", async () => {
    const res = await POST(post("not json"));
    expect(res.status).toBe(400);
    expect(logError).not.toHaveBeenCalled();
  });

  it("drops an oversized body (204, no log)", async () => {
    const huge = JSON.stringify({ message: "x".repeat(20000) });
    const res = await POST(post(huge));
    expect(res.status).toBe(204);
    expect(logError).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    await expect(POST(post("{}"))).resolves.toBeInstanceOf(Response);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm test src/app/api/client-error`
Expected: FAIL (`../route` not found).

- [ ] **Step 3: Implement the route**

`src/app/api/client-error/route.ts`:
```ts
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
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm test src/app/api/client-error`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/client-error
git commit -m "feat(monitoring): client-error bridge endpoint (size-capped, no-throw)"
```

---

## Task 2: `reportClientError` browser helper (test-first)

**Files:**
- Create: `src/lib/client-error.ts`
- Test: `src/lib/__tests__/client-error.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/client-error.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportClientError } from "../client-error";

describe("reportClientError", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs a JSON payload with the message and scope to the bridge", () => {
    reportClientError(new Error("kaboom"), "window");
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/client-error");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.message).toContain("kaboom");
    expect(body.scope).toBe("window");
  });

  it("never throws when fetch rejects", () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("offline"));
    expect(() => reportClientError(new Error("x"), "boundary")).not.toThrow();
  });

  it("handles a non-Error value without throwing", () => {
    expect(() => reportClientError("just a string", "window")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm test src/lib/__tests__/client-error.test.ts`
Expected: FAIL (`../client-error` not found).

- [ ] **Step 3: Implement the helper**

`src/lib/client-error.ts`:
```ts
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
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm test src/lib/__tests__/client-error.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/client-error.ts src/lib/__tests__/client-error.test.ts
git commit -m "feat(monitoring): reportClientError browser helper (best-effort)"
```

---

## Task 3: Global listener + wire the error boundaries

**Files:**
- Create: `src/app/_components/client-error-reporter.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/global-error.tsx`, `src/app/error.tsx`, `src/app/(app)/error.tsx`

- [ ] **Step 1: Create the global listener component**

`src/app/_components/client-error-reporter.tsx`:
```tsx
"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error";

/**
 * Renders nothing. Registers global handlers so uncaught errors and unhandled
 * promise rejections (outside React's render path) reach Vercel logs via the
 * client-error bridge. React render crashes are covered by the error boundaries.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) =>
      reportClientError(e.error ?? e.message, "window");
    const onRejection = (e: PromiseRejectionEvent) =>
      reportClientError(e.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
```

- [ ] **Step 2: Mount it in the root layout**

In `src/app/layout.tsx`, add the import and render it inside `<body>` (inside the
`NextIntlClientProvider`, before/after `{children}` — either is fine):
```tsx
import { ClientErrorReporter } from "./_components/client-error-reporter";
```
```tsx
        <NextIntlClientProvider messages={messages}>
          <ClientErrorReporter />
          {children}
        </NextIntlClientProvider>
```

- [ ] **Step 3: Report from the error boundaries**

In each of `src/app/error.tsx` and `src/app/(app)/error.tsx`, add the import and call the reporter
in the existing `useEffect`:
```tsx
import { reportClientError } from "@/lib/client-error";
```
```tsx
  useEffect(() => {
    console.error(error);
    reportClientError(error, "boundary");
  }, [error]);
```
In `src/app/global-error.tsx` do the same (it has no i18n but the same `useEffect` shape):
```tsx
import { reportClientError } from "@/lib/client-error";
```
```tsx
  useEffect(() => {
    console.error(error);
    reportClientError(error, "global-error");
  }, [error]);
```

- [ ] **Step 4: Verify build + tests**

Run: `pnpm test && pnpm build`
Expected: all tests pass; build succeeds (`/api/client-error` appears in the route list).

- [ ] **Step 5: Commit**

```bash
git add "src/app/_components/client-error-reporter.tsx" "src/app/layout.tsx" "src/app/global-error.tsx" "src/app/error.tsx" "src/app/(app)/error.tsx"
git commit -m "feat(monitoring): global listener + boundary reporting for client errors"
```

---

## Task 4: Document + final gate + push

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document where client errors appear**

Add a short "Monitoring" note to `README.md` (find the existing structure; append a section):
```markdown
## Monitoring

Errors are observed via Vercel logs (no third-party service). Server errors are written by
`logError` as structured `console.error` lines. Browser errors (React render crashes, uncaught
errors, unhandled rejections) are POSTed to `/api/client-error`, which logs them the same way.
View them in the Vercel dashboard → the project → **Logs** / **Observability** (filter on
`"scope":"client"`, `"window"`, `"unhandledrejection"`, or `"global-error"`).
```

- [ ] **Step 2: Full gate**

Run:
```bash
pnpm lint && pnpm test && pnpm build
```
Expected: lint clean; all tests pass; build success.

- [ ] **Step 3: Commit + push**

```bash
git add README.md
git commit -m "docs(monitoring): note where client + server errors appear in Vercel"
git push origin main
```

---

## Done criteria
- `pnpm lint`, `pnpm test`, `pnpm build` green.
- `POST /api/client-error` validates + size-caps + logs via `logError("client", …)`; never throws.
- `reportClientError` posts best-effort and never throws; mounted globally (uncaught + rejections)
  and called from all three error boundaries (render crashes).
- Server-error logging unchanged; README documents where to view errors in Vercel.
- No DB change; no secrets; pushed to `main`.
```
