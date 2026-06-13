# Quiet Luxury — Design System (Emmanuil premium redesign)

**Date:** 2026-06-13 · **Direction chosen by user:** Quiet Luxury (warm ivory + graphite +
bronze, editorial serif headings). Audience: high-value networkers / wealthy CEOs. Bilingual
EN + UK → **all fonts must support Cyrillic.** Keep light + dark, mobile-first, accessible.

This is a **visual** overhaul: retheme design tokens + typography + component styling across the
app. **No business logic, data, auth, or API behavior changes.** All tests must stay green; only
presentation changes.

## Aesthetic
"Quiet luxury / stealth wealth": warmth, restraint, generous whitespace, hairline borders, an
editorial serif for headings, a single understated bronze accent. Calm, bespoke, expensive —
never loud. Think Aesop / Bottega / a private-concierge app. Avoid generic shadcn-default look.

## Typography (Google Fonts via `next/font/google`, subsets `["latin","cyrillic"]`)
- **Display / headings (serif):** `Playfair Display` (has Cyrillic). CSS var `--font-serif`.
  Use for `h1`/`h2` page titles, person name on the card, section titles, login title.
  Weights 500–700. `font-display: swap`.
- **Body / UI (sans):** `Manrope` (has Cyrillic). CSS var `--font-sans`. Everything else:
  body text, buttons, labels, inputs, nav, badges. Weights 400/500/600.
- Headings: tighten tracking slightly (`letter-spacing: -0.01em`), comfortable line-height.
- Small UPPERCASE labels (e.g. fact category, tier): `letter-spacing: 0.08em`, 12px, muted.
- Keep ≥12px everywhere; `-webkit-font-smoothing: antialiased`.

## Color tokens (retheme shadcn vars in `globals.css`, both `:root` and `.dark`)
Map these to the existing shadcn token names (`--background`, `--foreground`, `--card`,
`--card-foreground`, `--popover*`, `--primary`, `--primary-foreground`, `--secondary`,
`--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--border`, `--input`,
`--ring`, `--destructive`). Use these target colors (hex ok, or convert to oklch — keep format
consistent with the file):

**Light:**
- background (page): `#F4F0E9` (warm bone) — slightly deeper than cards for layering
- card / surface: `#FBF9F4` (warm ivory)
- foreground (text): `#1F1D18` (warm graphite)
- muted-foreground: `#6E6A60`
- primary (bronze): `#8A6D43`; primary-foreground: `#FBF9F4`
- accent surface (hover/selected): `#EBE4D7`; accent-foreground: `#3A3326`
- border: `#E2DACB` (warm hairline)
- ring (focus): `#8A6D43` at ~0.5 alpha
- destructive: keep a muted brick `#9E4A3C` (not bright red)
- tier badge VIP: bronze text on `#EFE7D6`; friend/acquaintance: graphite on `#EBE7DE`

**Dark:**
- background: `#16140F` (warm near-black); card: `#1E1B14`
- foreground: `#ECE7DC`; muted-foreground: `#9C968A`
- primary (gold): `#C9A227`; primary-foreground: `#16140F`
- accent surface: `#2A261C`; accent-foreground: `#ECE7DC`
- border: `#332E22` (warm); ring: `#C9A227`/0.5
- destructive: `#C2705F`

## Shape, spacing, depth
- Radius: cards `14px`, inputs/buttons `10px`, pills/badges full. (Set `--radius` ≈ `0.75rem`.)
- Borders: hairline `1px` in the warm border color. Prefer borders over heavy shadows.
- Shadows: at most ONE soft, low shadow on raised cards (e.g. `0 1px 2px rgba(31,29,24,.04), 0 8px 24px rgba(31,29,24,.04)`); none in dark (use border + slightly lighter surface).
- Generous padding: cards `1.25rem 1.5rem`; sections spaced `1.5–2rem`. Mobile keeps `max-w-md` shell but with airier rhythm.
- Custom scrollbar + selection color tinted bronze.

## Component direction (apply cohesively to every screen)
- **Headings** (`h1`/`h2`/person name/section titles): serif (`--font-serif`), graphite.
- **Buttons:** primary = bronze fill, ivory text, subtle hover darken; secondary/outline =
  hairline border + warm hover surface. shadcn Button variants retuned via tokens.
- **Cards** (person card sections, brief panel, feed items, list rows): ivory surface, hairline
  border, radius-lg, the single soft shadow. Calm internal spacing.
- **Badges / tiers / fact categories:** small pill, warm tint, UPPERCASE micro-label styling for
  categories. VIP uses bronze.
- **Avatar / initials:** circle with warm tint bg + graphite/bronze initials (no loud colors).
- **Bottom nav:** hairline top border, warm surface; active tab in bronze (text + a small
  indicator); keep the four labels (icons optional via lucide if already available — don't add a
  dep just for this; if added, keep them thin/minimal).
- **Login page:** elevate — serif title, refined card, the Google button + email form styled to
  the system (Google button tasteful, not the stock blue), warm background.
- **Empty states** (Today "nothing yet", People empty, Assistant placeholder): a calm, elegant
  empty state — a light line of serif copy + muted helper text (and where it fits, a subtle
  thin icon). Make absence feel intentional, not broken.
- **AI brief panel & assistant bubbles:** refined cards; brief section titles in the small
  UPPERCASE label style; keep the markdown rendering.

## Motion (subtle — "quiet")
- Page/content load: gentle fade + 8–12px rise, short stagger (respect `prefers-reduced-motion`).
- Hover: soft, quick (150–200ms) background/border shifts; no flashy transforms.
- Use `cubic-bezier(0.16,1,0.3,1)` for entrances. Nothing bouncy or attention-grabbing.

## Constraints
- Don't break logic/tests. The bottom-nav test asserts the 4 localized labels — keep them.
- Keep EN/UK parity; any new copy via next-intl keys.
- Keep accessibility: focus-visible rings, sufficient contrast in BOTH modes (test mentally
  against near-black and near-white), aria intact.
- Mobile-first; verify the `max-w-md` shell still feels right with the new rhythm.

## Acceptance
- `pnpm lint`, `pnpm test`, `pnpm build` all green.
- Every screen (login, Today, People list, Person card, new/edit, Assistant, Settings, error/
  not-found, empty states) reflects the Quiet Luxury system cohesively in light AND dark.
- Headings render in Playfair Display incl. Ukrainian (Cyrillic) text; body in Manrope.
- No hardcoded colors that break dark mode; all via the retheme tokens.
