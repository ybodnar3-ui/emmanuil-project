# Lightweight Onboarding / Empty States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the app's empty screens into a state-derived "light" onboarding so a new user knows to add their first person and discovers the assistant/voice — no wizard, no persistence.

**Architecture:** A shared presentational `EmptyState` component (Quiet-Luxury card) drives the People-list and Today-feed empty states; the Today branch uses a cheap `countPeople` helper to tell a brand-new user from a returning one with nothing due. The assistant shows example prompts before the first message. Person-card empty sections get warmer copy. All copy is next-intl EN+UK. No DB changes.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Tailwind v4, next-intl 4, Prisma 7, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-06-22-onboarding-design.md`

---

## File Structure
- Create: `src/app/(app)/_components/empty-state.tsx` — shared empty-state card.
- Create: `src/app/(app)/_components/__tests__/empty-state.test.tsx` — render test.
- Modify: `src/server/data/people.ts` — add `countPeople(userId)`.
- Modify: `src/server/data/__tests__/people.test.ts` (or create if absent) — scope test.
- Modify: `src/app/(app)/people/page.tsx`, `src/app/(app)/page.tsx` — use `EmptyState`.
- Modify: `src/app/(app)/assistant/_components/assistant-chat.tsx` — first-run examples.
- Modify: `messages/en.json`, `messages/uk.json` — new keys + warmer card copy.

---

## Task 1: `EmptyState` component

**Files:**
- Create: `src/app/(app)/_components/empty-state.tsx`
- Test: `src/app/(app)/_components/__tests__/empty-state.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/app/(app)/_components/__tests__/empty-state.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  it("renders the title always", () => {
    render(<EmptyState title="Add your first person" />);
    expect(screen.getByText("Add your first person")).toBeInTheDocument();
  });

  it("renders the CTA link with href + label when provided", () => {
    render(
      <EmptyState
        title="t"
        action={{ href: "/people/new", label: "Add person" }}
      />,
    );
    const link = screen.getByRole("link", { name: "Add person" });
    expect(link).toHaveAttribute("href", "/people/new");
  });

  it("renders the secondary link when provided", () => {
    render(
      <EmptyState
        title="t"
        secondary={{ href: "/assistant", label: "Tell the assistant" }}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Tell the assistant" }),
    ).toHaveAttribute("href", "/assistant");
  });

  it("omits CTA + secondary when not provided", () => {
    render(<EmptyState title="t" description="d" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("d")).toBeInTheDocument();
  });
});
```
(Infra is already in place: `@testing-library/react`, `@testing-library/jest-dom`, and `jsdom` are dev deps and Vitest's `environment` is `"jsdom"`. Follow the existing render-test pattern in `src/components/__tests__/bottom-nav.test.tsx` — including however it imports the jest-dom matchers.)

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm test src/app/(app)/_components/__tests__/empty-state.test.tsx`
Expected: FAIL (`../empty-state` not found).

- [ ] **Step 3: Implement the component**

`src/app/(app)/_components/empty-state.tsx`:
```tsx
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Shared empty-state card (Quiet Luxury). Drives the app's "light" onboarding:
 * a Playfair title, an optional muted description, an optional primary CTA, and
 * an optional secondary link. Purely presentational — callers pass already-
 * localized strings.
 */
export function EmptyState({
  title,
  description,
  action,
  secondary,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <p className="font-heading text-xl text-foreground">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-5">
          <Button render={<Link href={action.href} />} nativeButton={false} size="sm">
            {action.label}
          </Button>
        </div>
      ) : null}
      {secondary ? (
        <Link
          href={secondary.href}
          className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          {secondary.label}
        </Link>
      ) : null}
    </div>
  );
}
```
(Match the `Button render={<Link/>}` pattern already used on the People page. Remove the
`buttonVariants` import if unused.)

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm test src/app/(app)/_components/__tests__/empty-state.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/_components/empty-state.tsx" "src/app/(app)/_components/__tests__/empty-state.test.tsx" package.json pnpm-lock.yaml vitest.config.ts 2>/dev/null
git commit -m "feat(onboarding): shared EmptyState component"
```

---

## Task 2: `countPeople` data-layer helper

**Files:**
- Modify: `src/server/data/people.ts`
- Test: `src/server/data/__tests__/people.test.ts` (add to it; create if it does not exist)

- [ ] **Step 1: Write the failing test**

Add to `src/server/data/__tests__/people.test.ts` (mirror the file's existing prisma mock; if the
file does not exist, create it following the mock style of `src/server/data/__tests__/keydates.test.ts`):
```ts
describe("countPeople", () => {
  it("counts only the caller's people", async () => {
    personCount.mockResolvedValue(3);
    const n = await countPeople("u1");
    expect(personCount).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(n).toBe(3);
  });
});
```
Wire a `personCount = vi.fn()` into the existing `@/server/db` mock for this file as
`prisma.person.count`, and import `countPeople` from `../people`.

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm test src/server/data/__tests__/people.test.ts`
Expected: FAIL (`countPeople` not exported).

- [ ] **Step 3: Implement**

Add to `src/server/data/people.ts`:
```ts
/** Number of people the user has — for the Today onboarding branch (new user vs
 *  returning user with nothing due today). Scoped to the caller. */
export function countPeople(userId: string): Promise<number> {
  return prisma.person.count({ where: { userId } });
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm test src/server/data/__tests__/people.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/data/people.ts src/server/data/__tests__/people.test.ts
git commit -m "feat(onboarding): countPeople helper (userId-scoped)"
```

---

## Task 3: People + Today empty states use `EmptyState` + i18n

**Files:**
- Modify: `messages/en.json`, `messages/uk.json`
- Modify: `src/app/(app)/people/page.tsx`, `src/app/(app)/page.tsx`

- [ ] **Step 1: Add the i18n keys**

In `messages/en.json` — inside `"people"` add (keep the existing `"empty"`, still used nowhere-else-safe to leave):
```json
    "emptyTitle": "Add your first person",
    "emptyHint": "Save a contact and a few facts — Emmanuil reminds you when to reach out and what to ask.",
    "emptyAssistant": "…or just tell the assistant — type or speak",
```
Inside `"today"` add:
```json
    "emptyNewTitle": "Add your first person",
    "emptyNewHint": "Once you add someone, Emmanuil tells you here who to reconnect with and what to ask.",
    "emptyNewCta": "Add a person",
```
In `messages/uk.json` — inside `"people"`:
```json
    "emptyTitle": "Додайте першу людину",
    "emptyHint": "Збережіть контакт і кілька фактів — Emmanuil нагадає, коли звʼязатися і про що спитати.",
    "emptyAssistant": "…або просто скажіть асистенту — текстом чи голосом",
```
Inside `"today"`:
```json
    "emptyNewTitle": "Додайте першу людину",
    "emptyNewHint": "Щойно додасте когось, Emmanuil показуватиме тут, з ким звʼязатися і про що спитати.",
    "emptyNewCta": "Додати людину",
```

- [ ] **Step 2: People page — use `EmptyState`**

In `src/app/(app)/people/page.tsx`, add `import { EmptyState } from "../_components/empty-state";`
and replace the empty branch (the `people.length === 0` div) with:
```tsx
      {people.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyHint")}
          action={{ href: "/people/new", label: t("add") }}
          secondary={{ href: "/assistant", label: t("emptyAssistant") }}
        />
      ) : (
```
Leave the populated `<ul>` branch unchanged.

- [ ] **Step 3: Today page — branch on `countPeople`, use `EmptyState`**

In `src/app/(app)/page.tsx`: import `EmptyState` (`./_components/empty-state`) and `countPeople`
(`@/server/data/people`). When `items.length === 0`, decide the variant:
```tsx
  const items = await getTodayFeed(user.id, now, locale);
  // Distinguish a brand-new user (no people yet) from a returning user with a
  // quiet day, so the empty state can guide the former and reassure the latter.
  const hasPeople = items.length > 0 ? true : (await countPeople(user.id)) > 0;
```
Replace the empty branch:
```tsx
      {items.length === 0 ? (
        hasPeople ? (
          <EmptyState title={t("empty")} />
        ) : (
          <EmptyState
            title={t("emptyNewTitle")}
            description={t("emptyNewHint")}
            action={{ href: "/people/new", label: t("emptyNewCta") }}
          />
        )
      ) : (
        <TodayFeed items={items} />
      )}
```
Use the existing `today` translator `t` — `t("emptyNewCta")` was added under `today` in Step 1.

- [ ] **Step 4: Verify build + parity**

Run: `pnpm test src/i18n && pnpm build`
Expected: parity PASS; build success.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/people/page.tsx" "src/app/(app)/page.tsx" messages/en.json messages/uk.json
git commit -m "feat(onboarding): guiding empty states on People + Today"
```

---

## Task 4: Assistant first-run example prompts

**Files:**
- Modify: `src/app/(app)/assistant/_components/assistant-chat.tsx`
- Modify: `messages/en.json`, `messages/uk.json`

- [ ] **Step 1: Add the i18n keys**

In `messages/en.json` inside `"assistant"` add:
```json
    "examples": {
      "captureLabel": "Try capturing a fact:",
      "capture": "Maria's son Andrii just started at LSE",
      "queryLabel": "Or ask about someone:",
      "query": "What do I know about Maria?",
      "voiceHint": "Type, or tap the mic to dictate."
    },
```
In `messages/uk.json` inside `"assistant"` add:
```json
    "examples": {
      "captureLabel": "Спробуйте зафіксувати факт:",
      "capture": "У Марії син Андрій щойно вступив до LSE",
      "queryLabel": "Або спитайте про когось:",
      "query": "Що я знаю про Марію?",
      "voiceHint": "Друкуйте або натисніть мікрофон і надиктуйте."
    },
```

- [ ] **Step 2: Render the examples when the thread is empty**

In `assistant-chat.tsx`, replace the empty-thread block (the `entries.length === 0 ?` branch
around lines 106–112) with a version that keeps the existing placeholder heading and adds the
examples + voice hint:
```tsx
        {entries.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="font-heading text-lg text-foreground">
              {t("placeholder")}
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                {t("examples.captureLabel")}{" "}
                <span className="text-foreground">“{t("examples.capture")}”</span>
              </p>
              <p>
                {t("examples.queryLabel")}{" "}
                <span className="text-foreground">“{t("examples.query")}”</span>
              </p>
              <p className="text-xs">{t("examples.voiceHint")}</p>
            </div>
          </div>
        ) : null}
```
No logic change — the block already only renders when `entries.length === 0`, so it disappears as
soon as the conversation starts.

- [ ] **Step 3: Verify build + parity**

Run: `pnpm test src/i18n && pnpm build`
Expected: parity PASS; build success.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/assistant/_components/assistant-chat.tsx" messages/en.json messages/uk.json
git commit -m "feat(onboarding): assistant first-run example prompts + voice hint"
```

---

## Task 5: Warmer person-card empty copy + final gate

**Files:**
- Modify: `messages/en.json`, `messages/uk.json`

- [ ] **Step 1: Update the copy (keys already rendered by the card)**

In `messages/en.json`, change the existing facts/interactions empty strings (under `person.facts`
and `person.interactions`):
```json
"empty": "Add what you know — family, work, what to ask about."
```
(facts) and
```json
"empty": "Log a call or meeting to start the timeline."
```
(interactions). Make the parity-matching edits in `messages/uk.json`:
```json
"empty": "Додайте, що знаєте — сімʼя, робота, про що спитати."
```
(facts) and
```json
"empty": "Запишіть дзвінок чи зустріч, щоб почати стрічку."
```
(interactions).
Do not rename the keys — only change the values, so the card renders the new copy with no code
change.

- [ ] **Step 2: Full gate**

Run:
```bash
pnpm lint && pnpm test && pnpm build
```
Expected: lint clean; all tests pass; build success; i18n parity green.

- [ ] **Step 3: Commit + push**

```bash
git add messages/en.json messages/uk.json
git commit -m "feat(onboarding): warmer empty copy on person-card sections"
git push origin main
```

---

## Done criteria
- `pnpm lint`, `pnpm test`, `pnpm build` green; EN/UK parity.
- A new user (0 people) sees a clear "Add your first person" CTA on both Today and People, an
  assistant hint with example prompts + a voice mention, and warmer card copy; all of it vanishes
  once they have data.
- No DB schema change; Quiet-Luxury styling preserved; pushed to `main`.
```
