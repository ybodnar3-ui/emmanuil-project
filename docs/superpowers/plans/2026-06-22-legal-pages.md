# Legal Pages (Privacy + Terms) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public, bilingual Privacy Policy + Terms of Service pages (honest draft templates describing the app's real data practices), linked from /login and Settings.

**Architecture:** Two public route pages under `src/app/legal/` (outside the `(app)` auth group) share a layout that renders a "draft / not legal advice" notice. The prose lives in a typed per-locale content module; only nav labels go through next-intl. Static, no DB, no mutations.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Tailwind v4, next-intl 4, Vitest 4 (jsdom).

**Spec:** `docs/superpowers/specs/2026-06-22-legal-pages-design.md`

**Note on content:** the legal text below is a plain-English starting draft, not lawyer-reviewed. Use it verbatim. The "draft notice" banner makes its status explicit to readers.

---

## File Structure
- Create: `src/app/legal/content.ts` — `OPERATOR`, `EFFECTIVE_DATE`, `PRIVACY`, `TERMS`, types.
- Create: `src/app/legal/__tests__/content.test.ts` — EN/UK section-count parity.
- Create: `src/app/legal/layout.tsx` — shared legal layout (title, draft notice, back link).
- Create: `src/app/legal/privacy/page.tsx`, `src/app/legal/terms/page.tsx`.
- Create: `src/app/legal/__tests__/pages.test.tsx` — render smoke for both pages.
- Modify: `src/app/login/login-form.tsx` — footer links.
- Modify: `src/app/(app)/settings/page.tsx` — Legal card with links.
- Modify: `messages/en.json`, `messages/uk.json` — `legal.*` labels.

---

## Task 1: Legal content module + parity test

**Files:**
- Create: `src/app/legal/content.ts`
- Test: `src/app/legal/__tests__/content.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/legal/__tests__/content.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { PRIVACY, TERMS, OPERATOR, EFFECTIVE_DATE } from "../content";

describe("legal content", () => {
  it("privacy has matching section counts across locales", () => {
    expect(PRIVACY.uk.sections.length).toBe(PRIVACY.en.sections.length);
    expect(PRIVACY.en.sections.length).toBeGreaterThan(0);
  });
  it("terms has matching section counts across locales", () => {
    expect(TERMS.uk.sections.length).toBe(TERMS.en.sections.length);
    expect(TERMS.en.sections.length).toBeGreaterThan(0);
  });
  it("every section has a heading and at least one paragraph (both locales)", () => {
    for (const doc of [PRIVACY.en, PRIVACY.uk, TERMS.en, TERMS.uk]) {
      for (const s of doc.sections) {
        expect(s.heading.length).toBeGreaterThan(0);
        expect(s.body.length).toBeGreaterThan(0);
      }
    }
  });
  it("exposes operator contact + effective date", () => {
    expect(OPERATOR.contact).toContain("@");
    expect(EFFECTIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `pnpm test src/app/legal/__tests__/content.test.ts`
Expected: FAIL (`../content` not found).

- [ ] **Step 3: Implement the content module**

`src/app/legal/content.ts` (use this text verbatim):
```ts
/**
 * Legal copy for the Privacy Policy and Terms pages, keyed by locale. This is a
 * plain-language STARTING DRAFT that describes the app's actual data practices —
 * NOT lawyer-reviewed legal advice. The pages render a visible notice saying so.
 * Operator identity lives here so it is trivial to change later.
 */
export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; sections: LegalSection[] };

export const OPERATOR = {
  name: "Yurii Bodnar",
  contact: "ybodnar3@gmail.com",
  jurisdiction: "Ukraine",
} as const;

export const EFFECTIVE_DATE = "2026-06-22";

export const PRIVACY: Record<"en" | "uk", LegalDoc> = {
  en: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "Who we are",
        body: [
          `Emmanuil is operated by ${OPERATOR.name}, an individual developer. For any privacy question, contact ${OPERATOR.contact}.`,
        ],
      },
      {
        heading: "What we collect",
        body: [
          "Your account email address, provided when you sign in.",
          "The information you choose to store about the people in your network: names, notes and facts, interactions, key dates, and any photos you upload.",
          "When you use voice capture, your audio is sent for transcription and is not stored after the text is produced.",
        ],
      },
      {
        heading: "How we use your data",
        body: [
          "To provide the service: storing your network, generating reminders, and answering your questions about the people you track.",
          "We do not sell your data and do not use it for advertising.",
        ],
      },
      {
        heading: "Service providers",
        body: [
          "We share data with providers only as needed to run the app: Anthropic (Claude) powers the AI assistant and suggestions; Groq (Whisper) transcribes voice; Supabase provides the database, file storage, and authentication; Vercel hosts the application.",
          "These providers process your data on our behalf to deliver their part of the service.",
        ],
      },
      {
        heading: "Cookies",
        body: [
          "We use only essential cookies: one to keep you signed in, and one to remember your language. We do not use analytics or advertising cookies.",
        ],
      },
      {
        heading: "Retention and deletion",
        body: [
          "We keep your data for as long as your account exists.",
          `You can ask us to delete your account and associated data at any time by writing to ${OPERATOR.contact}.`,
        ],
      },
      {
        heading: "Your responsibility for others' data",
        body: [
          "You decide what to store about other people. You are responsible for having a lawful basis to keep that information and for honouring any request from those people regarding their data.",
        ],
      },
      {
        heading: "Governing law and contact",
        body: [
          `This policy is governed by the laws of ${OPERATOR.jurisdiction}. Questions: ${OPERATOR.contact}.`,
        ],
      },
    ],
  },
  uk: {
    title: "Політика конфіденційності",
    sections: [
      {
        heading: "Хто ми",
        body: [
          `Emmanuil керує ${OPERATOR.name}, незалежний розробник-фізособа. З будь-яких питань щодо конфіденційності пишіть на ${OPERATOR.contact}.`,
        ],
      },
      {
        heading: "Які дані ми збираємо",
        body: [
          "Електронну адресу вашого акаунта, яку ви вказуєте під час входу.",
          "Інформацію, яку ви самі зберігаєте про людей зі свого оточення: імена, нотатки й факти, взаємодії, ключові дати та завантажені фото.",
          "Коли ви користуєтеся голосовим введенням, ваше аудіо надсилається на транскрибацію і не зберігається після отримання тексту.",
        ],
      },
      {
        heading: "Як ми використовуємо дані",
        body: [
          "Щоб надавати сервіс: зберігати ваше оточення, формувати нагадування та відповідати на запитання про людей, яких ви ведете.",
          "Ми не продаємо ваші дані й не використовуємо їх для реклами.",
        ],
      },
      {
        heading: "Постачальники послуг",
        body: [
          "Ми передаємо дані постачальникам лише в обсязі, потрібному для роботи застосунку: Anthropic (Claude) забезпечує AI-асистента та підказки; Groq (Whisper) транскрибує голос; Supabase надає базу даних, сховище файлів і автентифікацію; Vercel хостить застосунок.",
          "Ці постачальники обробляють ваші дані від нашого імені, щоб виконати свою частину сервісу.",
        ],
      },
      {
        heading: "Файли cookie",
        body: [
          "Ми використовуємо лише необхідні cookie: один — щоб тримати вас у системі, інший — щоб запам’ятати мову. Аналітичних чи рекламних cookie ми не використовуємо.",
        ],
      },
      {
        heading: "Зберігання та видалення",
        body: [
          "Ми зберігаємо ваші дані, доки існує ваш акаунт.",
          `Ви можете будь-коли попросити видалити акаунт і пов’язані дані, написавши на ${OPERATOR.contact}.`,
        ],
      },
      {
        heading: "Ваша відповідальність за дані інших",
        body: [
          "Ви вирішуєте, що зберігати про інших людей. Ви відповідаєте за наявність законної підстави зберігати цю інформацію та за виконання запитів цих людей щодо їхніх даних.",
        ],
      },
      {
        heading: "Застосовне право і контакт",
        body: [
          `Ця політика регулюється законодавством: ${OPERATOR.jurisdiction}. Питання: ${OPERATOR.contact}.`,
        ],
      },
    ],
  },
};

export const TERMS: Record<"en" | "uk", LegalDoc> = {
  en: {
    title: "Terms of Service",
    sections: [
      {
        heading: "Acceptance",
        body: [
          "By using Emmanuil you agree to these terms. If you do not agree, do not use the service.",
        ],
      },
      {
        heading: "The service is provided “as is”",
        body: [
          "Emmanuil is provided without warranties of any kind. We do not guarantee it will be uninterrupted or error-free.",
        ],
      },
      {
        heading: "AI output",
        body: [
          "The assistant's answers, briefs, and suggested reminders are generated by AI and may be inaccurate or incomplete. Do not rely on them as professional advice.",
        ],
      },
      {
        heading: "Your responsibilities",
        body: [
          "You are responsible for the data you enter and for using the service lawfully, including any consent needed to store information about other people.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Do not use the service for unlawful purposes, to harass anyone, or to attempt to disrupt or reverse-engineer it. We may suspend or terminate accounts that abuse the service.",
        ],
      },
      {
        heading: "Limitation of liability",
        body: [
          "To the maximum extent permitted by law, we are not liable for any indirect or consequential damages arising from your use of the service.",
        ],
      },
      {
        heading: "Changes and governing law",
        body: [
          "We may update these terms; continued use after a change means you accept it.",
          `These terms are governed by the laws of ${OPERATOR.jurisdiction}. Questions: ${OPERATOR.contact}.`,
        ],
      },
    ],
  },
  uk: {
    title: "Умови користування",
    sections: [
      {
        heading: "Прийняття умов",
        body: [
          "Користуючись Emmanuil, ви погоджуєтеся з цими умовами. Якщо не згодні — не користуйтеся сервісом.",
        ],
      },
      {
        heading: "Сервіс надається “як є”",
        body: [
          "Emmanuil надається без жодних гарантій. Ми не гарантуємо безперебійної чи безпомилкової роботи.",
        ],
      },
      {
        heading: "Результати AI",
        body: [
          "Відповіді асистента, довідки та запропоновані нагадування генеруються AI і можуть бути неточними чи неповними. Не покладайтеся на них як на фахову пораду.",
        ],
      },
      {
        heading: "Ваші обов’язки",
        body: [
          "Ви відповідаєте за дані, які вводите, і за законне використання сервісу, зокрема за згоду, потрібну для зберігання інформації про інших людей.",
        ],
      },
      {
        heading: "Допустиме використання",
        body: [
          "Не використовуйте сервіс для незаконних цілей, переслідування або спроб порушити чи зворотно розробити його. Ми можемо призупиняти чи закривати акаунти, що зловживають сервісом.",
        ],
      },
      {
        heading: "Обмеження відповідальності",
        body: [
          "У максимально дозволених законом межах ми не відповідаємо за непрямі чи похідні збитки, що виникли через використання сервісу.",
        ],
      },
      {
        heading: "Зміни та застосовне право",
        body: [
          "Ми можемо оновлювати ці умови; продовження користування після зміни означає вашу згоду.",
          `Ці умови регулюються законодавством: ${OPERATOR.jurisdiction}. Питання: ${OPERATOR.contact}.`,
        ],
      },
    ],
  },
};
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `pnpm test src/app/legal/__tests__/content.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/legal/content.ts src/app/legal/__tests__/content.test.ts
git commit -m "feat(legal): Privacy + Terms content module (EN/UK) + parity test"
```

---

## Task 2: Legal layout + pages

**Files:**
- Create: `src/app/legal/layout.tsx`, `src/app/legal/privacy/page.tsx`, `src/app/legal/terms/page.tsx`
- Modify: `messages/en.json`, `messages/uk.json` (the `legal.*` labels this task needs)
- Test: `src/app/legal/__tests__/pages.test.tsx`

- [ ] **Step 1: Add the i18n labels**

In `messages/en.json` add a top-level `"legal"` block (place it after `"settings"`):
```json
  "legal": {
    "title": "Legal",
    "privacy": "Privacy Policy",
    "terms": "Terms of Service",
    "back": "← Back",
    "effective": "Effective {date}",
    "draftNotice": "This is a plain-language draft describing how the app handles data. It is not legal advice; have a professional review it before any commercial launch."
  },
```
In `messages/uk.json` add the parity block:
```json
  "legal": {
    "title": "Юридичне",
    "privacy": "Політика конфіденційності",
    "terms": "Умови користування",
    "back": "← Назад",
    "effective": "Чинна з {date}",
    "draftNotice": "Це чернетка простою мовою про те, як застосунок працює з даними. Це не юридична консультація; перед комерційним запуском дайте її на перевірку фахівцю."
  },
```

- [ ] **Step 2: Implement the layout**

`src/app/legal/layout.tsx`:
```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EFFECTIVE_DATE } from "./content";

/**
 * Shared layout for the public legal pages. Renders the Quiet-Luxury container,
 * the "not legal advice" draft notice, the effective date, and a back link. The
 * pages themselves render the locale-specific content.
 */
export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("legal");
  return (
    <section className="mx-auto max-w-2xl px-5 py-10">
      <Link
        href="/login"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {t("back")}
      </Link>
      <p className="mt-4 rounded-lg border border-border bg-accent/40 px-4 py-3 text-sm text-muted-foreground">
        {t("draftNotice")}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("effective", { date: EFFECTIVE_DATE })}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
```

- [ ] **Step 3: Implement a shared doc renderer + the two pages**

`src/app/legal/privacy/page.tsx`:
```tsx
import { getLocaleFromCookie } from "@/i18n/locale";
import { PRIVACY, type LegalDoc } from "../content";

export default async function PrivacyPage() {
  const locale = await getLocaleFromCookie();
  const doc: LegalDoc = PRIVACY[locale === "uk" ? "uk" : "en"];
  return <LegalArticle doc={doc} />;
}

function LegalArticle({ doc }: { doc: LegalDoc }) {
  return (
    <article className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold">{doc.title}</h1>
      {doc.sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h2 className="text-lg font-semibold">{s.heading}</h2>
          {s.body.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
```
`src/app/legal/terms/page.tsx` — identical shape, importing `TERMS` instead:
```tsx
import { getLocaleFromCookie } from "@/i18n/locale";
import { TERMS, type LegalDoc } from "../content";

export default async function TermsPage() {
  const locale = await getLocaleFromCookie();
  const doc: LegalDoc = TERMS[locale === "uk" ? "uk" : "en"];
  return <LegalArticle doc={doc} />;
}

function LegalArticle({ doc }: { doc: LegalDoc }) {
  return (
    <article className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold">{doc.title}</h1>
      {doc.sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h2 className="text-lg font-semibold">{s.heading}</h2>
          {s.body.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
```
(The small `LegalArticle` is duplicated in both files to keep each page self-contained; it is tiny.
If you prefer, extract it to `src/app/legal/legal-article.tsx` and import — either is fine.)

- [ ] **Step 4: Write the render smoke test**

`src/app/legal/__tests__/pages.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/locale", () => ({ getLocaleFromCookie: async () => "en" }));

import PrivacyPage from "../privacy/page";
import TermsPage from "../terms/page";

describe("legal pages", () => {
  it("privacy renders its title and sections", async () => {
    render(await PrivacyPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Who we are")).toBeInTheDocument();
  });
  it("terms renders its title", async () => {
    render(await TermsPage());
    expect(
      screen.getByRole("heading", { level: 1, name: "Terms of Service" }),
    ).toBeInTheDocument();
  });
});
```
(The page components are async server components; `await PrivacyPage()` returns the element tree,
which Testing Library can render — follow the import-and-await pattern. The layout is not exercised
here, so `getTranslations` is not needed in this test.)

- [ ] **Step 5: Run tests + build**

Run: `pnpm test src/app/legal && pnpm test src/i18n && pnpm build`
Expected: content + page tests PASS; i18n parity PASS; build succeeds with `/legal/privacy` and
`/legal/terms` in the route list.

- [ ] **Step 6: Commit**

```bash
git add src/app/legal messages/en.json messages/uk.json
git commit -m "feat(legal): public Privacy + Terms pages with draft notice"
```

---

## Task 3: Links from /login and Settings

**Files:**
- Modify: `src/app/login/login-form.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Add footer links to the login form**

In `src/app/login/login-form.tsx`, add `import Link from "next/link";` at the top. The component
uses `const t = useTranslations("auth")`; add a second translator for legal labels:
`const tLegal = useTranslations("legal");`. Then, immediately AFTER the closing `</div>` of the
card (the `rounded-2xl border …` div) and BEFORE `</section>`, add:
```tsx
      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/legal/privacy" className="underline-offset-4 hover:underline">
          {tLegal("privacy")}
        </Link>
        {" · "}
        <Link href="/legal/terms" className="underline-offset-4 hover:underline">
          {tLegal("terms")}
        </Link>
      </p>
```

- [ ] **Step 2: Add a Legal card to Settings**

In `src/app/(app)/settings/page.tsx`, add `import Link from "next/link";` if not already present.
The page uses `const t = await getTranslations("settings")`; add
`const tLegal = await getTranslations("legal");`. Add a new card (after the Push card, before the
sign-out form):
```tsx
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(31,29,24,0.04),0_8px_24px_rgba(31,29,24,0.04)] dark:shadow-none">
        <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {tLegal("title")}
        </p>
        <div className="flex flex-col gap-2 text-sm">
          <Link href="/legal/privacy" className="text-primary underline-offset-4 hover:underline">
            {tLegal("privacy")}
          </Link>
          <Link href="/legal/terms" className="text-primary underline-offset-4 hover:underline">
            {tLegal("terms")}
          </Link>
        </div>
      </div>
```

- [ ] **Step 3: Verify build + parity**

Run: `pnpm test src/i18n && pnpm build`
Expected: parity PASS; build success.

- [ ] **Step 4: Commit**

```bash
git add "src/app/login/login-form.tsx" "src/app/(app)/settings/page.tsx"
git commit -m "feat(legal): link Privacy + Terms from login and Settings"
```

---

## Task 4: Final gate + push

- [ ] **Step 1: Full gate**

Run:
```bash
pnpm lint && pnpm test && pnpm build
```
Expected: lint clean; all tests pass; build success; i18n parity green; `/legal/privacy` and
`/legal/terms` appear in the build's route list.

- [ ] **Step 2: Push**

```bash
git push origin main
```

---

## Done criteria
- `pnpm lint`, `pnpm test`, `pnpm build` green; EN/UK parity (labels + content section counts).
- `/legal/privacy` and `/legal/terms` render logged-out in both locales, each showing the draft
  notice, effective date, and accurate data-practice descriptions.
- Privacy + Terms links work from `/login` and Settings; Quiet-Luxury styling; no DB change.
- Pushed to `main`.
```
