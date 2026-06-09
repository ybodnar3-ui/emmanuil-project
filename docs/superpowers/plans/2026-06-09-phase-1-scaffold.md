# Phase 1 — Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Emmanuil web app skeleton — Next.js + TypeScript + Tailwind +
shadcn/ui + next-intl + Prisma — with a mobile-first bottom-nav shell (Today / People /
Assistant / Settings), EN-default + UK locale switching, and green tests/lint/build.

**Architecture:** Next.js App Router app in `src/`. Cookie-based locale via next-intl
(no `[locale]` URL segment — simpler for an app, PWA-friendly). Bottom tab navigation is
the app shell; each tab is a placeholder route this phase. Prisma is installed with a
datasource/generator config only; models and DB connection come in Phase 2.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, next-intl v3, Prisma,
Vitest + Testing Library, pnpm.

---

## File Structure (created this phase)

- `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `eslint.config.mjs` — toolchain config.
- `src/app/layout.tsx` — root layout (html/body, providers, bottom nav).
- `src/app/page.tsx` — Today (home) placeholder.
- `src/app/people/page.tsx`, `src/app/assistant/page.tsx`, `src/app/settings/page.tsx` — tab placeholders.
- `src/app/globals.css` — Tailwind + theme tokens.
- `src/components/bottom-nav.tsx` — bottom tab bar.
- `src/i18n/request.ts` — next-intl request config (reads locale cookie).
- `src/i18n/locale.ts` — locale constants + `getLocaleFromCookie` helper.
- `messages/en.json`, `messages/uk.json` — translations.
- `src/components/locale-switcher.tsx` — EN/UK toggle (sets cookie).
- `src/app/actions/locale.ts` — server action to set the locale cookie.
- `prisma/schema.prisma` — datasource + generator (models deferred to Phase 2).
- `vitest.config.ts`, `vitest.setup.ts` — test config.
- `src/components/__tests__/bottom-nav.test.tsx`, `src/i18n/__tests__/locale.test.ts` — tests.

---

## Task 1: Scaffold Next.js into the existing repo

The repo already contains `docs/`, `.planning/`, `.gitignore`, `README.md`, `.git/`.
`create-next-app` refuses a directory with conflicting entries, so scaffold into a temp
dir and merge the generated files in.

**Files:**
- Create: entire Next.js scaffold (package.json, tsconfig.json, src/app/*, etc.)

- [ ] **Step 1: Scaffold into a temp directory**

```bash
rm -rf /tmp/emmanuil-scaffold
pnpm dlx create-next-app@latest /tmp/emmanuil-scaffold \
  --ts --tailwind --eslint --app --src-dir --use-pnpm \
  --import-alias "@/*" --no-turbopack --skip-install
```
Expected: scaffold completes, prints "Success! Created ... at /tmp/emmanuil-scaffold".

- [ ] **Step 2: Merge generated files into the repo (without clobbering docs/.planning/.git)**

```bash
cd /Users/yura.mac/emmanuil-project
# copy everything except the scaffold's own git metadata
rsync -a --exclude='.git' /tmp/emmanuil-scaffold/ ./
# create-next-app overwrites README/.gitignore — restore our richer .gitignore additions
grep -qxF '.env' .gitignore || printf '%s\n' '.env' '.env*.local' '.planning/' >> .gitignore
```
Expected: `src/app/page.tsx`, `package.json`, `next.config.ts` now exist in the repo.

- [ ] **Step 3: Install dependencies**

```bash
cd /Users/yura.mac/emmanuil-project && pnpm install
```
Expected: install succeeds, `node_modules/` present.

- [ ] **Step 4: Verify dev build compiles**

```bash
cd /Users/yura.mac/emmanuil-project && pnpm build
```
Expected: "Compiled successfully", build exits 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/yura.mac/emmanuil-project
git add -A
git commit -m "chore: scaffold Next.js app (ts, tailwind, app router, src dir)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Add Vitest + Testing Library and a smoke test

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `src/lib/__tests__/smoke.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install test deps**

```bash
cd /Users/yura.mac/emmanuil-project
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```
Expected: packages added to devDependencies.

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Write `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add test script to `package.json`**

In the `"scripts"` block add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write the failing smoke test `src/lib/__tests__/smoke.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and dedupes tailwind conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe("text-sm font-bold");
  });
});
```
(`src/lib/utils.ts` with `cn` is generated by shadcn in Task 4; if running tests before
Task 4, create it now:)
```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
```bash
pnpm add clsx tailwind-merge
```

- [ ] **Step 6: Run the test**

```bash
cd /Users/yura.mac/emmanuil-project && pnpm test
```
Expected: PASS (1 file, 1 test).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: add vitest + testing-library with smoke test

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: next-intl with EN default + UK (cookie-based locale)

**Files:**
- Create: `src/i18n/locale.ts`, `src/i18n/request.ts`, `messages/en.json`, `messages/uk.json`, `src/app/actions/locale.ts`, `src/i18n/__tests__/locale.test.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Install next-intl**

```bash
cd /Users/yura.mac/emmanuil-project && pnpm add next-intl
```

- [ ] **Step 2: Write `src/i18n/locale.ts`**

```ts
import { cookies } from "next/headers";

export const LOCALES = ["en", "uk"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "EMMANUIL_LOCALE";

export function normalizeLocale(value: string | undefined | null): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export async function getLocaleFromCookie(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}
```

- [ ] **Step 3: Write `src/i18n/request.ts`**

```ts
import { getRequestConfig } from "next-intl/server";
import { getLocaleFromCookie } from "./locale";

export default getRequestConfig(async () => {
  const locale = await getLocaleFromCookie();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 4: Wire the plugin in `next.config.ts`**

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 5: Write `messages/en.json`**

```json
{
  "nav": { "today": "Today", "people": "People", "assistant": "Assistant", "settings": "Settings" },
  "today": { "title": "Today", "empty": "Nothing for today yet." },
  "people": { "title": "People", "empty": "No people yet." },
  "assistant": { "title": "Assistant", "placeholder": "Ask about someone, or add a fact…" },
  "settings": { "title": "Settings", "language": "Language" }
}
```

- [ ] **Step 6: Write `messages/uk.json`**

```json
{
  "nav": { "today": "Сьогодні", "people": "Люди", "assistant": "Асистент", "settings": "Налаштування" },
  "today": { "title": "Сьогодні", "empty": "Поки що нічого на сьогодні." },
  "people": { "title": "Люди", "empty": "Поки що немає людей." },
  "assistant": { "title": "Асистент", "placeholder": "Запитай про когось або додай факт…" },
  "settings": { "title": "Налаштування", "language": "Мова" }
}
```

- [ ] **Step 7: Write `src/app/actions/locale.ts` (server action to switch locale)**

```ts
"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, normalizeLocale } from "@/i18n/locale";

export async function setLocale(value: string) {
  const locale = normalizeLocale(value);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/");
}
```

- [ ] **Step 8: Write the failing test `src/i18n/__tests__/locale.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { normalizeLocale, DEFAULT_LOCALE, LOCALES } from "@/i18n/locale";

describe("normalizeLocale", () => {
  it("returns the locale when supported", () => {
    expect(normalizeLocale("uk")).toBe("uk");
    expect(normalizeLocale("en")).toBe("en");
  });
  it("falls back to default for unknown or empty values", () => {
    expect(normalizeLocale("fr")).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
  });
  it("defaults to English", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALES).toContain("uk");
  });
});
```

- [ ] **Step 9: Run the test**

```bash
cd /Users/yura.mac/emmanuil-project && pnpm test
```
Expected: PASS (all locale tests green).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add next-intl with EN default + UK locale (cookie-based)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Initialize shadcn/ui

**Files:**
- Create: `components.json`, `src/lib/utils.ts` (if not already), shadcn primitives
- Modify: `src/app/globals.css`, `tailwind.config.ts`

- [ ] **Step 1: Init shadcn/ui (non-interactive)**

```bash
cd /Users/yura.mac/emmanuil-project
pnpm dlx shadcn@latest init -d
```
Expected: writes `components.json`, updates `globals.css` with theme tokens, ensures `src/lib/utils.ts`.

- [ ] **Step 2: Add the button component (used by nav/locale switcher)**

```bash
pnpm dlx shadcn@latest add button
```
Expected: creates `src/components/ui/button.tsx`.

- [ ] **Step 3: Verify build still compiles**

```bash
pnpm build
```
Expected: build exits 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: initialize shadcn/ui with button primitive

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: App shell — root layout, bottom nav, four tab routes

**Files:**
- Create: `src/components/bottom-nav.tsx`, `src/components/locale-switcher.tsx`, `src/app/people/page.tsx`, `src/app/assistant/page.tsx`, `src/app/settings/page.tsx`, `src/components/__tests__/bottom-nav.test.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Write `src/components/bottom-nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", key: "today" as const },
  { href: "/people", key: "people" as const },
  { href: "/assistant", key: "assistant" as const },
  { href: "/settings", key: "settings" as const },
];

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Write `src/components/locale-switcher.tsx`**

```tsx
import { getLocaleFromCookie, LOCALES } from "@/i18n/locale";
import { setLocale } from "@/app/actions/locale";

export async function LocaleSwitcher() {
  const current = await getLocaleFromCookie();
  return (
    <div className="flex gap-2">
      {LOCALES.map((loc) => (
        <form key={loc} action={setLocale.bind(null, loc)}>
          <button
            type="submit"
            aria-pressed={loc === current}
            className={`rounded-md border px-3 py-1 text-sm uppercase ${
              loc === current ? "bg-foreground text-background" : "bg-background"
            }`}
          >
            {loc}
          </button>
        </form>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emmanuil",
  description: "Your relationship portfolio + AI assistant",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          <main className="mx-auto max-w-md px-4 pb-24 pt-6">{children}</main>
          <BottomNav />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Rewrite `src/app/page.tsx` (Today placeholder)**

```tsx
import { useTranslations } from "next-intl";

export default function TodayPage() {
  const t = useTranslations("today");
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("empty")}</p>
    </section>
  );
}
```

- [ ] **Step 5: Create `src/app/people/page.tsx`**

```tsx
import { useTranslations } from "next-intl";

export default function PeoplePage() {
  const t = useTranslations("people");
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("empty")}</p>
    </section>
  );
}
```

- [ ] **Step 6: Create `src/app/assistant/page.tsx`**

```tsx
import { useTranslations } from "next-intl";

export default function AssistantPage() {
  const t = useTranslations("assistant");
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("placeholder")}</p>
    </section>
  );
}
```

- [ ] **Step 7: Create `src/app/settings/page.tsx` (with locale switcher)**

```tsx
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  return (
    <section>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="mt-6">
        <p className="mb-2 text-sm font-medium">{t("language")}</p>
        <LocaleSwitcher />
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Write the failing test `src/components/__tests__/bottom-nav.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { BottomNav } from "@/components/bottom-nav";
import en from "../../../messages/en.json";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

describe("BottomNav", () => {
  it("renders all four localized tabs", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <BottomNav />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("Assistant")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("marks the active tab with aria-current", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <BottomNav />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Today").closest("a")).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 9: Run tests**

```bash
cd /Users/yura.mac/emmanuil-project && pnpm test
```
Expected: PASS (smoke + locale + bottom-nav tests).

- [ ] **Step 10: Verify dev server renders and locale switch works (manual gate)**

```bash
pnpm dev
```
Visit http://localhost:3000 → Today renders; bottom nav shows 4 tabs; on /settings, clicking
"UK" switches all nav/page copy to Ukrainian; "EN" switches back. Stop the server after checking.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: app shell with bottom nav, four tabs, and locale switcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Install Prisma (config only; models deferred to Phase 2)

**Files:**
- Create: `prisma/schema.prisma`, `.env.example`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install Prisma**

```bash
cd /Users/yura.mac/emmanuil-project
pnpm add -D prisma && pnpm add @prisma/client
```

- [ ] **Step 2: Write `prisma/schema.prisma` (datasource + generator only)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// Models are added in Phase 2 (Auth + data layer) once Supabase is connected.
```

- [ ] **Step 3: Write `.env.example`**

```bash
# Supabase Postgres (Phase 2)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"

# Supabase Auth/client (Phase 2)
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""

# Anthropic (Phase 4)
ANTHROPIC_API_KEY=""
```

- [ ] **Step 4: Add prisma scripts to `package.json`**

In `"scripts"` add:
```json
"db:generate": "prisma generate",
"db:format": "prisma format"
```

- [ ] **Step 5: Validate the schema parses**

```bash
cd /Users/yura.mac/emmanuil-project && pnpm db:format
```
Expected: "Formatted prisma/schema.prisma" with no errors (no DB connection required).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: install Prisma with datasource config and env template

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Phase gate — update README, full green check, push

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Emmanuil

Personal relationship CRM + AI assistant. Your "portfolio of people": store what you know
about everyone, get AI briefs before meetings, and proactive reminders to stay in touch.

## Stack
Next.js (App Router, TS) · Tailwind + shadcn/ui · Supabase · Prisma · Anthropic Claude ·
next-intl (EN default + UK) · Vercel.

## Develop
```bash
pnpm install
pnpm dev      # http://localhost:3000
pnpm test     # vitest
pnpm lint
pnpm build
```

See `docs/superpowers/specs` for the design and `docs/superpowers/plans` for the roadmap.
```

- [ ] **Step 2: Full verification gate**

```bash
cd /Users/yura.mac/emmanuil-project
pnpm lint && pnpm test && pnpm build
```
Expected: lint clean, tests pass, build exits 0.

- [ ] **Step 3: Commit and push the phase**

```bash
git add -A
git commit -m "docs: project README for Phase 1 scaffold

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```
Expected: push succeeds to `origin/main`.

---

## Phase 1 Done Criteria (verify before moving to Phase 2)

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` all pass.
- [ ] `pnpm dev` serves an app with a mobile-first bottom nav: Today / People / Assistant / Settings.
- [ ] Locale switcher on Settings toggles the whole UI between English (default) and Ukrainian.
- [ ] Prisma schema parses (`pnpm db:format`); `.env.example` documents required secrets.
- [ ] All work committed and pushed to `origin/main`.
