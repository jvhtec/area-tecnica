# UI/UX Audit — Area Tecnica (Sector Pro)

**Date:** 2026-06-25
**Scope:** Whole codebase — web (desktop) and mobile/PWA (Capacitor + responsive web)
**Branch:** `claude/ui-ux-audit-321wc9`
**Method:** Static analysis of `src/` (638 `.tsx` files), design-system review (`tailwind.config.ts`, `src/index.css`, `src/components/ui/`), layout/navigation review, and pattern sampling of representative pages.

---

## 0. Implementation Progress

This audit is being actioned on the same branch. Status as of the latest commit:

| Phase / Item | Status | Notes |
|---|---|---|
| **Phase 0 — Quick wins** | ✅ Done | `lang="es"`; light/dark `theme-color`; global reduced-motion + `:focus-visible` baseline; skip-to-content link; focus-ring token cleanup in `MobileNavBar`. |
| **Phase 1 — Shared primitives** | ✅ Done | `Loading`/`PageLoading`/`Spinner`, `EmptyState`, `SubmitButton` (a11y-correct, token-themed, unit-tested); adopted in `App.tsx` route fallback. |
| **C-3 — Document language** | ✅ Done | `lang="es"` (Phase 0, merged). |
| **C-2 — Dark mode (Auth)** | 🟡 Partial | Auth **signup/recovery** view tokenized (shipped). The **primary login** is an intentional dark-branded glassmorphic hero — deliberately deferred, not complete. |
| **C-2 — Dark mode (surfaces)** | 🟡 Triaged + genuine bugs fixed | The audit's **143 `bg-white` / 29 `text-black`** was heavily inflated: most are translucent overlays (`bg-white/5`), the *light branch* of an `isDark` ternary (functionally dark-aware), `print:`/wallboard/QR intentional white, or part of **light-themed islands** (status panels, green read-only/print-preview tables). Genuine *standalone* surface bugs fixed → tokens: `TourDefaultsManager` cards (`bg-card`), `FestivalGearManagement` stage popover (`bg-popover`), `StaffingAutoModePanel` counters (`bg-muted`). Remaining sites are intentional white or light-island clusters needing **holistic redesign + visual QA**, not piecemeal swaps (tracked). |
| **C-1 — Two theming systems** | 🟡 Tracked (maintainability) | The hand-rolled `isDark` pattern spans the technician/super-app module (40+ files). These **render correctly in both modes** — it's a consistency/maintainability concern, not a visible bug. Migrating means rewriting a deliberate dark aesthetic to generic tokens (a design change requiring visual QA), so it's tracked for a dedicated, reviewed effort rather than a same-day fix. |
| **M-1 — Native confirm/alert** | ✅ Done | `ConfirmDialogProvider` + `useConfirm` added & wired; **all** native `window.confirm` sites migrated (14 `.tsx` + 3 `.ts` job-card hooks). A source-scan test (`no-native-confirm.test.ts`) guards against regressions. |
| **L-2 — Double-submit guard** | 🟡 Partial | Auth forms (login, signup, forgot/reset password) **and** the festival scheduling dialogs (`CreateShiftDialog`, `EditShiftDialog`) migrated to the shared `SubmitButton` — adds `aria-busy` + spinner, removes duplicated loading markup. Broader app-wide adoption is a follow-up. |
| **M-9 — Empty states** | 🟡 Started | `EmptyState`/`Loading` primitives adopted in `FestivalScheduling` (no-shifts + loading states) — first adoption beyond the route fallback. Broader rollout is a follow-up. |
| **M-3 — Image alt text** | ✅ Verified (no change) | The audit's "~55" was a grep artifact (same-line miss; `alt` sits on adjacent lines in multiline JSX, and `>` inside `opt => …` truncated naive scans). A robust multiline-aware scan finds **0** genuine `<img>`-without-`alt` violations in `src/`. |
| **Phase 1 — Toast consolidation (H-2)** | ✅ Done | Single toast renderer (**Sonner**). `@/hooks/use-toast` is now a thin Sonner adapter (the ~200 `toast({title,description,variant})` call sites + the `import {toast} from "sonner"` sites all render the same way), the dead Radix `<Toaster>` + `ui/toaster.tsx` were removed, and the Sonner `<Toaster>` now mounts on **all** routes — fixing toasts that were silently dropped on public pages (auth, artist form). Guard test: `single-toaster.test.ts`. |
| **Phase 1 — ESLint guardrails** | ⬜ Pending | Needs `eslint-plugin-jsx-a11y` + color rules (dependency install). |
| **Phases 2–5** | ⬜ Pending | See roadmap below. |

All shipped changes verified with `vite build` and `vitest` (no regressions across 78 existing touched-area tests + 11 new primitive/confirm tests).

---

## 1. Executive Summary

Sector Pro is a large, mature, mobile-first PWA with a genuinely solid foundation: a token-based design system (HSL CSS variables + shadcn/ui), a shared `ViewportProvider` with consistent breakpoints, safe-area-aware mobile chrome, route-aware code-splitting, and an `ErrorBoundary` with chunk-recovery. The bones are good.

The problems are **consistency and accessibility debt accumulated across many parallel features**, not a broken architecture. The single most damaging theme: **two competing styling philosophies coexist** — the canonical CSS-variable token system *and* a sprawl of ad-hoc hardcoded palette colors / per-page `isDark` maps. This produces visible dark-mode breakage, inconsistent surfaces, and high maintenance cost. Accessibility is the second systemic gap: the app is functionally usable but fails several WCAG basics (wrong document language, no reduced-motion support, thin ARIA/live-region coverage).

**Severity tally (issue groups):** 3 Critical · 7 High · 9 Medium · 5 Low

### Headline metrics

| Signal | Count | Why it matters |
|---|---:|---|
| Hardcoded Tailwind palette classes (`text-gray-*`, `bg-white`, `text-red-*`, …) in TSX | **768** | Bypasses the theme token system; breaks dark mode & rebranding |
| Hardcoded hex colors in TSX | **252** | Same as above; not theme- or contrast-managed |
| `bg-white` with **no** `dark:` variant | **143** | White surfaces persist in dark mode → contrast/glare bugs |
| `text-black` with no `dark:` variant | **29** | Invisible/low-contrast text in dark mode |
| Files using **both** toast systems app-wide | Sonner **49** + shadcn `useToast` **155** | Two visually different notification UIs |
| Spinner-based loading (`animate-spin`/`Loader2`/`PageLoader`) | **151 files** | vs only **11** files using `Skeleton` → layout shift, jank |
| `aria-live` / `role="status"` / `role="alert"` regions | **5** | 1,076 loading strings + 174 async buttons go unannounced |
| `prefers-reduced-motion` / `motion-reduce` handling | **0** | 393 animation usages; no vestibular-safety escape hatch |
| Skip-to-content link | **0** | Keyboard users must tab through full nav every page |
| Tiny fixed fonts (`text-[8–11px]`) | **204** | Below legible/accessible minimums, esp. mobile |
| Fixed pixel widths (`w-[≥100px]`, `min-w-[≥100px]`) | **160 + 53** | Horizontal-overflow risk on small screens |
| Hardcoded loading/UI strings (`Cargando`, `Loading…`) | **1,076** | No i18n layer; inconsistent copy |

> Counts are static-grep heuristics meant to size each problem, not exact defect lists. Treat them as prioritization signal.

---

## 2. What's Working Well (Keep / Build On)

- **Token foundation exists** — `src/index.css` defines a complete light/dark HSL variable palette wired into `tailwind.config.ts` (`primary`, `muted`, `card`, `sidebar`, etc.). When components use it, theming "just works."
- **Unified responsive system** — `ViewportProvider` / `useViewport` / `useIsMobile` share one breakpoint scale aligned with Tailwind `screens`. No competing `window.innerWidth` checks scattered around.
- **Mobile chrome is thoughtfully built** — `MobileNavBar` handles `visualViewport` keyboard/browser-UI shifts, `env(safe-area-inset-*)`, `role="navigation"`, `aria-label`, and `aria-current`. Tailwind has dedicated `safe-*` spacing tokens.
- **Fluid typography** — `clamp()`-based `--text-*` scale on `body`/`h1–h4` adapts to viewport.
- **Resilience** — global `ErrorBoundary` + chunk-load auto-recovery; lazy routes with `Suspense` fallbacks.
- **Mature primitive library** — 61 shadcn/ui components already in place (dialog, drawer, sheet, command, sidebar, etc.).

---

## 3. Detailed Findings

Severity: **Critical** (broken/blocking for a user segment) · **High** (frequent friction or a11y failure) · **Medium** (inconsistency / polish) · **Low** (hygiene).

### 3.1 Theming & Dark Mode

**[CRITICAL] C-1 — Two competing theming systems.**
The canonical path is next-themes (`class` strategy) + CSS variable tokens. But several high-traffic pages reimplement theming by hand with `isDark` ternaries and hardcoded hex:
- `src/pages/TechnicianDashboard.tsx` — `nav/card/input/cluster` maps using `bg-[#0f1219]`, `bg-[#0a0c10]`, `bg-white`, `text-black`.
- `src/pages/TechnicianSuperApp.tsx` — same pattern (lines ~98–109, 412).
- `src/pages/SoundVisionFiles.tsx` — same pattern (lines ~87–98).

`isDark`/`useTheme`/`ThemeContext` is referenced in **54 files**. Two systems means a theme/brand change must be made twice, and the hand-rolled pages can drift out of sync with the token palette.

**[CRITICAL] C-2 — Dark mode visibly breaks on non-token surfaces.**
**143** `bg-white` and **29** `text-black` usages have **no** `dark:` variant. Concrete example: `src/pages/Auth.tsx` signup/recovery view uses `bg-slate-50`, `bg-white`, `text-slate-900` unconditionally — it renders as a light card even when the user's theme is dark. Multiply across 143 surfaces for the systemic glare/contrast problem.

**[HIGH] H-1 — Palette-class sprawl.**
**768** hardcoded `text-gray-*`/`bg-gray-*`/`text-red-*`/`bg-blue-*`-style classes and **252** raw hex values sit outside the token system. Even where a `dark:` pair exists, these encode color decisions inline instead of via semantic tokens (`muted-foreground`, `destructive`, `primary`), so contrast and brand are unmanaged.

### 3.2 Notifications / Toasts

**[HIGH] H-2 — Two toast systems mounted simultaneously.**
`src/routes/RouteAwareAppEffects.tsx` mounts **both** the shadcn `Toaster` and the Sonner `Toaster` (`top-right`). Components inconsistently call shadcn `useToast` (**155 files**) or Sonner `toast()` (**49 files**). Users see two different toast visual languages, positions, and stacking behaviors depending on which code path fired. Pick one (recommend Sonner for ergonomics) and migrate.

**[MEDIUM] M-1 — Native `window.confirm/alert` in UI.**
**14** usages of `window.confirm`/`window.alert` — unstyled, un-themeable, blocking dialogs that break the design language. Replace with `AlertDialog`.

### 3.3 Accessibility (WCAG)

**[CRITICAL] C-3 — Wrong document language.**
`index.html` declares `<html lang="en">` while UI/content is primarily Spanish. Screen readers will use the wrong pronunciation/voice. One-line fix (`lang="es"`), high impact. (WCAG 3.1.1)

**[HIGH] H-3 — No reduced-motion support.**
**0** occurrences of `prefers-reduced-motion`/`motion-reduce` against **393** animation usages, including infinite loops (`animate-pulse`, `animate-spin`, the `alien-flicker` keyframes, Auth blob `float`/`pulse`, celebration/confetti). Users with vestibular sensitivity have no escape hatch. (WCAG 2.3.3 / 2.2.2)

**[HIGH] H-4 — Thin live-region / status coverage.**
Only **5** `aria-live`/`role="status"`/`role="alert"` regions exist, yet there are **1,076** loading strings and **174** async-disabled buttons. Async state changes (saving, loading, errors) are largely silent to assistive tech. (WCAG 4.1.3)

**[HIGH] H-5 — No skip-to-content link.**
Keyboard and screen-reader users must traverse the entire sidebar/nav on every route. Add a visually-hidden, focus-revealed "Saltar al contenido" anchor in `Layout`. (WCAG 2.4.1)

**[MEDIUM] M-2 — Inconsistent focus styling.**
Focus rings split between `focus-visible:ring-ring` (token, 17) and `focus-visible:ring-blue-500` (hardcoded, e.g. `MobileNavBar`). No global `:focus-visible` baseline in `index.css`. Custom clickable elements may have weak/absent focus indication. (WCAG 2.4.7)

**[MEDIUM] M-3 — Images missing alt text.**
~**55** `<img>` lines without an `alt` attribute. Decorative images should have `alt=""`; informational ones need descriptions. (WCAG 1.1.1)

**[MEDIUM] M-4 — Custom interactive elements lack keyboard semantics.**
**1,664** `onClick` handlers but only **21** `onKeyDown`/`onKeyPress` and **5** `tabIndex`. The good news: only **4** are on `<div>`/`<span>` directly — most ride on `Button`/`Card`. Audit clickable `Card`s (job cards, list rows) for keyboard operability and `role`/`tabIndex`.

### 3.4 Loading & Feedback States

**[HIGH] H-6 — Spinner-heavy, skeleton-light.**
**151** files use spinners vs **11** using `Skeleton`. Full-screen/section spinners cause layout shift (CLS) and feel slower than skeletons that preserve layout. Standardize on skeletons for content regions, reserve spinners for inline button/action states.

**[MEDIUM] M-5 — Inconsistent loading copy.**
**1,076** ad-hoc "Cargando…"/"Loading…" strings with no shared component. Centralize via a `<Loading label>` / `<PageLoader>` pattern so copy, spacing, and a11y (`role="status"`) are uniform.

### 3.5 Mobile & Responsive

**[HIGH] H-7 — Horizontal-overflow risk from fixed widths.**
**160** `w-[≥100px]` and **53** `min-w-[≥100px]` fixed pixel widths. On 360px viewports these are prime suspects for horizontal scroll/cut-off. Audit against the `xs` (360px) breakpoint; prefer `max-w`, `w-full`, fluid grids.

**[MEDIUM] M-6 — Wide tables on mobile.**
**36** files render `<table>`/`<Table>`; **68** `overflow-x-auto` usages suggest the wrapper pattern exists but isn't universal. Tables that don't reflow to cards on mobile produce pinch-zoom/scroll friction. Adopt a consistent responsive-table or card-list strategy.

**[MEDIUM] M-7 — Very large page components.**
Several pages exceed maintainable size: `PayoutsDueFortnights.tsx` (1,225), `PesosTool.tsx` (1,150), `TourManagement.tsx` (1,118), `GlobalTasks.tsx` (887). Oversized components make consistent responsive/a11y treatment harder and invite divergence. Decompose into sections + hooks.

### 3.6 Ergonomics & Touch Targets

**[MEDIUM] M-8 — Touch targets below 44px.**
`button.tsx`: default `h-10` (40px), `sm` `h-9` (36px), `icon` `h-10 w-10` (40px). All below the 44×44px (iOS HIG) / 48px (Material) minimum. On a mobile-first product this matters; bump mobile sizes or add a touch-target-safe `icon` variant.

**[LOW] L-1 — Tiny fonts.**
**204** uses of `text-[8px]`–`text-[11px]`. Some are legitimately dense data views, but sub-12px text is hard to read and fails comfortable-reading guidance, especially on mobile/wallboard-at-distance.

### 3.7 Forms, Errors & Empty States

**[MEDIUM] M-9 — Validation/empty-state consistency.**
The app standardizes on react-hook-form + zod + shadcn `Form` (good), but error presentation and **empty states** ("no hay resultados") aren't centralized. Establish a shared `<EmptyState>` and verify every list/table has loading / empty / error / success states.

**[LOW] L-2 — Disabled-during-async is partial.**
**174** buttons disable on `isLoading`/`isPending`, but this isn't universal — double-submit is possible on un-guarded mutations. Standardize a `<SubmitButton loading>` that disables + shows a spinner + sets `aria-busy`.

### 3.8 Hygiene & PWA Polish

**[LOW] L-3 — Console noise.**
**2,770** `console.*` calls in `src/`. Stripped in prod builds via esbuild, but they clutter dev and risk leaking data in non-prod. Route through a `logger` with levels.

**[LOW] L-4 — Missing `theme-color` meta.**
`index.html` has rich PWA/OG meta but no `<meta name="theme-color">` (ideally light/dark via `media`). Affects mobile browser chrome color.

**[LOW] L-5 — Legacy "Alien terminal" CSS.**
`src/index.css` ships `--alien-*` variables, scanlines, vignette, and `alien-flicker` keyframes. If still used (wallboard?), confirm intentional and reduced-motion-guarded; otherwise prune dead CSS.

---

## 4. Remediation Plan

Grouped by effort. **Effort:** S = <½ day · M = 1–3 days · L = 1–2 weeks · XL = multi-sprint.

| ID | Issue | Sev | Effort | Action |
|----|-------|-----|:---:|--------|
| C-3 | Wrong `lang` | Crit | S | `index.html` → `lang="es"`. |
| H-5 | Skip link | High | S | Add focus-revealed skip anchor + `id="main"` in `Layout`. |
| L-4 | theme-color | Low | S | Add `<meta name="theme-color">` (light/dark via `media`). |
| H-3 | Reduced motion | High | S→M | Global `@media (prefers-reduced-motion: reduce){ *{animation/transition minimized} }` in `index.css`; guard confetti/flicker. |
| M-2 | Focus baseline | Med | S | Add global `:focus-visible` ring in `index.css`; replace `ring-blue-500` with `ring-ring`. |
| H-2 | Dual toasts | High | M | Choose one (rec. Sonner); codemod `useToast`→`toast`; unmount the other; keep one provider. |
| M-1 | Native confirm/alert | Med | M | Replace 14 `window.confirm/alert` with `AlertDialog`/`useConfirm` hook. |
| C-1/C-2/H-1 | Theming unification | Crit | L→XL | (1) Lint rule banning raw palette/hex + `bg-white`/`text-black` without `dark:`; (2) migrate the 3 `isDark` pages to tokens; (3) burn down `bg-white`/`text-black` sites; (4) sweep 768 palette classes → semantic tokens. |
| H-6/M-5 | Loading standardization | High | M→L | Shared `<Loading>`/skeleton components; convert section spinners to skeletons; one copy source. |
| H-4 | Live regions | High | M | Add `role="status"`/`aria-live` to page loaders, toasts already covered, and form submit feedback; `aria-busy` on async buttons. |
| H-7/M-6 | Mobile overflow & tables | High | L | Audit 213 fixed-width sites at 360px; responsive-table/card wrapper standard. |
| M-3/M-4 | Img alt & keyboard | Med | M | Add `alt`; audit clickable `Card`s for `role`/`tabIndex`/`onKeyDown`. |
| M-8/L-1 | Touch targets & fonts | Med | M | Raise mobile button/icon sizes to ≥44px; lift sub-12px fonts where not data-dense. |
| M-9/L-2 | Empty states & submit guard | Med | M | `<EmptyState>` + `<SubmitButton loading>` primitives; adopt across lists/forms. |
| M-7 | Component decomposition | Med | XL | Incrementally split 800+ line pages as they're touched. |
| L-3/L-5 | Console & dead CSS | Low | S→M | `logger` wrapper; verify/prune `alien-*` CSS. |

---

## 5. Roadmap

### Phase 0 — Quick Wins (≈1 day, ship immediately)
High-impact, low-risk, mostly one-liners. Establishes a11y baseline.
- C-3 `lang="es"` · L-4 theme-color · H-5 skip link · H-3 reduced-motion media query · M-2 global focus-visible baseline.
- **Exit:** Lighthouse a11y score jumps; reduced-motion respected app-wide.

### Phase 1 — Consistency Foundations (Sprint 1)
Stop the bleeding before mass migration.
- H-2 consolidate to one toast system.
- Add ESLint/Tailwind guardrails: ban raw hex & non-`dark:` `bg-white`/`text-black`; warn on palette classes (prevents *new* debt).
- Ship shared primitives: `<Loading>`, `<EmptyState>`, `<SubmitButton>`, `useConfirm`.
- **Exit:** New code can't reintroduce the top offenders; one notification language.

### Phase 2 — Dark Mode & Theming Cleanup (Sprints 2–3)
- C-1 migrate `TechnicianDashboard`, `TechnicianSuperApp`, `SoundVisionFiles` off `isDark`/hardcoded surfaces to tokens. (Auth: only the signup/recovery view is tokenized; the primary login is an intentional dark-branded hero — exclude unless a fully theme-aware login is explicitly wanted.)
- C-2 burn down 143 `bg-white` + 29 `text-black` non-`dark:` sites.
- H-1 sweep highest-traffic palette-class files → semantic tokens.
- **Exit:** Dark mode visually correct on all primary routes; theme/brand change is single-source.

### Phase 3 — Accessibility Hardening (Sprint 4)
- H-4 live regions · M-3 alt text · M-4 keyboard operability for custom interactives · M-8 touch targets.
- Bring in `eslint-plugin-jsx-a11y`; add an axe-core pass to Playwright smoke tests.
- **Exit:** WCAG 2.1 AA on core flows (auth, dashboard, assignments, timesheets); automated a11y gate in CI.

### Phase 4 — Mobile & Loading Polish (Sprint 5)
- H-6/M-5 skeletons everywhere · H-7/M-6 mobile overflow + responsive tables · L-1 fonts.
- Device-matrix QA at 360px (`xs`).
- **Exit:** No horizontal scroll on small screens; smooth perceived-performance loading.

### Phase 5 — Continuous (ongoing)
- M-7 decompose oversized pages opportunistically · M-9 empty-state coverage · L-2 submit guards · L-3/L-5 hygiene.
- Document the design system (token usage, do/don't) so the patterns above are discoverable.

---

## 6. Suggested Guardrails (prevent regression)

1. **Tailwind/ESLint rule** — disallow raw hex in `className`, and `bg-white`/`text-black` without a `dark:` counterpart.
2. **`eslint-plugin-jsx-a11y`** in the lint job (alt text, click-events-have-key-events, no-static-element-interactions).
3. **axe-core in Playwright** smoke tests for the critical routes.
4. **One toast import** — lint-ban the deprecated toast path post-migration.
5. **Design-system doc** in `docs/` describing semantic tokens and the loading/empty/submit primitives.

---

## 7. Appendix — Evidence Index

Representative locations cited above:
- Hand-rolled theming: `src/pages/TechnicianDashboard.tsx:79–90,415`, `src/pages/TechnicianSuperApp.tsx:98–109,412`, `src/pages/SoundVisionFiles.tsx:87–98`, `src/pages/Auth.tsx:163–183`.
- Dual toasts mounted: `src/routes/RouteAwareAppEffects.tsx:42–49,108–109`.
- Document language: `index.html:2`.
- Design tokens (source of truth): `src/index.css` (`:root` / `.dark`), `tailwind.config.ts`.
- Mobile chrome (good reference): `src/components/layout/MobileNavBar.tsx`, `src/hooks/use-mobile.tsx`.
- Button sizing: `src/components/ui/button.tsx`.

*All counts produced via repo-wide static grep over `src/` on 2026-06-25; they size each problem class for prioritization rather than enumerate exact defects.*
