# Mobile UI Refurb — Audit & Plan

**Date:** 2026-07-13
**Branch:** `claude/mobile-ui-audit-refurb-7p6bsx`
**Scope:** Mobile UI/UX only (<768px, `MOBILE_BREAKPOINT` in `src/hooks/use-mobile.tsx`). Web/PWA and Capacitor share the same responsive UI, so everything here applies to both.
**Method:** Static analysis of `src/` **plus live mobile-viewport screenshots** (iPhone 13, 390×844) of 11 key routes captured through the e2e mock-auth harness (`tests/e2e/support/app.ts`), reviewed one by one. Reproduction recipe at the end of this doc.

**Relationship to prior work:** This is the deep-dive that `docs/UI_UX_AUDIT.md` (June 2026) deferred to its "Phase 4 — Mobile & Loading Polish". Phases 0–1 of that audit (toasts, `useConfirm`, `Loading`/`EmptyState`/`SubmitButton` primitives, reduced motion, skip link) are shipped and are **not** re-litigated here. `docs/MOBILE_SAFE_AREA_AUDIT.md` fixed safe-area handling at the primitive level — also done. This plan covers what neither did: the mobile *experience* — language, interaction patterns, information architecture, and per-route usability.

---

## 1. Executive summary

The mobile foundations are genuinely good: a shared `ViewportProvider` with sane breakpoints, a safe-area-aware bottom `MobileNavBar` with a battle-hardened keyboard/viewport workaround, dedicated mobile hubs for the dashboard and department pages, and a full mobile suite for festival artist management. The bones are not the problem.

The "ugly/clunky" feeling comes from four systemic gaps, all confirmed on screenshots:

1. **The flagship mobile screens speak English.** The mobile dashboard hub, department hub, project management page, tours page, and settings page are riddled with hardcoded English ("Quick Actions", "Today", "Create New Job", "Search projects…", "Needs Root Folders", "Settings", "Connecting…"). Spanish is the app's only supported UI language; on mobile-first surfaces this reads as unfinished.
2. **Desktop interaction patterns are served raw to mobile.** 139 files use centered `Dialog` modals vs 14 `Sheet` / 1 `Drawer`; there is no responsive dialog primitive. Worst case: the expanded mobile job card renders `JobCardActionButtons` (639 lines, ~30 buttons) as an unlabeled icon-soup grid.
3. **Most pages have no mobile information architecture.** Only 13 of 49 pages consult the viewport at all. Profile renders as one ~24,000px-tall scroll on mobile. Tour management stacks 13 near-identical full-width cards. The assignment matrix serves an overflowing desktop toolbar and dense grid to a 390px screen.
4. **Ergonomic debt is regressing, not shrinking.** Touch targets are still below 44px (unchanged since the June audit flagged M-8), and sub-12px font usage *grew* from 204 to 266 occurrences. Skeleton usage is static at 11 files.

None of this needs a rewrite. It needs (a) three shared mobile primitives, (b) an i18n sweep of the mobile-first surfaces, and (c) targeted IA redesigns of ~6 high-traffic screens — phased below.

---

## 2. What's working — keep and build on

| Asset | Where | Notes |
|---|---|---|
| Viewport system | `src/hooks/use-mobile.tsx` | `ViewportProvider`, breakpoint helpers, visualViewport-aware. Reference quality. |
| Bottom nav | `src/components/layout/MobileNavBar.tsx` | Role-aware primary items + "Más" tray, safe-area padding, documented iOS keyboard workaround, portal-rendered. |
| Mobile hubs | `DashboardMobileHub`, `DepartmentMobileHub` | Real mobile-designed screens (header, quick actions, day pager, job cards) — the *pattern* to replicate. Their flaw is language, not layout. |
| Festival mobile suite | `src/components/festival/mobile/*` | `MobileArtistList`/`Card`/`ConfigEditor`/`FormSheet` — proof the team can do full mobile flows. |
| Safe-area infra | `src/index.css`, `tailwind.config.ts`, primitives | Fixed at the primitive level per `MOBILE_SAFE_AREA_AUDIT.md`. |
| Route chrome metadata | `src/routes/app-route-manifest.tsx` | `chrome.mobileFullscreen`, `nav.mobileLabel` — the manifest already models mobile concerns. |
| Shared UX primitives | `Loading`, `EmptyState`, `SubmitButton`, `useConfirm` | Shipped in UI_UX_AUDIT Phase 1; reuse them in every refurb below. |

---

## 3. Findings

Severity: 🔴 high (visible on every session) · 🟠 medium · 🟡 low. Each finding lists evidence — screenshots referenced by route name are reproducible with the recipe in §6.

### F1 🔴 English strings dominate the flagship mobile screens

Spanish is the only supported UI language (CLAUDE.md "Learned Rules"), yet the screens a mobile user sees first are the worst offenders. Observed on screenshots:

- **Dashboard hub** (`/dashboard`): "DASHBOARD", "Quick Actions" (`src/components/dashboard/DashboardMobileHub.tsx:250`), "Type", "Status", "Today" (`:380`), "Mon".
- **Department hub** (`/sound`): "DEPARTMENT", "QUICK TOOLS", "Create New Job" (`src/components/department/DepartmentMobileHub.tsx:479`), "No jobs scheduled for this date." (`:486`).
- **Project management** (`/project-management`): "Project Management" title, "Search projects…", "Single"/"Confirmed" badges, "Edit requirements", "Sound: 0/0".
- **Tours** (`/tours`): "Tours 2026", "Create Tour", "0 dates", "Needs Root Folders", "Legacy Tours Detected", "Verify" — including an internal-sounding diagnostic panel ("This might be a display issue if folders already exist.") shown to every user.
- **Settings** (`/settings`): "Settings", "Import Users", "Add User", "Push notifications", "Company settings", "Dry hire folders", "Version info" — interleaved with Spanish cards, so the page is visibly half-and-half.
- **Global chrome**: connection widget "Connecting…"/"Refresh"/"Data may be stale" (`src/components/ui/connection-status.tsx:102–106,146–156`); toast "Data refreshed successfully" (seen on `/festivals`).

This is the single highest-leverage "ugly" fix: it requires no design work, only translation, and `/i18n-check` already exists to gate regressions.

### F2 🔴 No responsive dialog strategy — desktop modals served to mobile

Counts (2026-07-13): **139** files use `DialogContent`, **14** use `SheetContent`, **1** uses `DrawerContent` (vaul is already a dependency via shadcn `drawer.tsx`). `DialogContent` (`src/components/ui/dialog.tsx:39`) is a centered `max-w-lg` modal — on a phone this gives cramped forms, awkward close affordance (32px-ish X in the corner), and no swipe-to-dismiss, where every native app trains users to expect a bottom sheet.

The safe-area audit already made `Sheet`/`Drawer` inset-correct, so the missing piece is purely a **`ResponsiveDialog` primitive**: renders `Dialog` at `≥md`, vaul `Drawer` below it, one API. This is a well-trodden shadcn pattern (Credenza-style). With it, migration is mechanical per call site.

### F3 🔴 Icon-soup action surfaces on mobile job cards

The expanded job card on `/project-management` (mobile) renders `JobCardActionButtons` — `src/components/jobs/cards/job-card-actions/JobCardActionButtons.tsx`, 639 lines, ~30 `Button`s — as a wrapping grid of unlabeled 40px icon buttons (screenshot: rows of print/upload/delete/Flex/refresh/archive icons with no text). Also present, smaller-scale, in the assignment matrix cells.

Icon-only toolbars need hover tooltips to be learnable; mobile has no hover. The fix is a **mobile action sheet**: on `<md`, the card exposes 2–3 labeled primary actions plus a "⋯ Más acciones" trigger opening a grouped, labeled bottom sheet (Documentos / Flex / Personal / Peligro). Desktop keeps the toolbar.

### F4 🔴 No mobile information architecture on heavyweight pages

Only 13/49 pages use viewport hooks; the rest rely on Tailwind `md:` tweaks at best. Confirmed pain on screenshots:

- **Profile** (`src/pages/Profile.tsx`, 772 lines): renders profile form + folder-structure editor + achievements + ICS calendar + email-digest prefs + password change + privacy as **one ~24,000px scroll**. Needs sectioning (accordion or sub-routes) on mobile.
- **Tour management** (`src/pages/TourManagement.tsx`, 1,118 lines): 13 near-identical "Áreas de Gestión" cards stacked full-width, each ~180px tall, below a stats block and three stacked action buttons — a screen and a half of scrolling before content. Needs a compact grid (2-col) or grouped list.
- **Settings** (`src/pages/Settings.tsx`, 571 lines): accordion list works, but see F1.
- Untouched-on-mobile heavyweights (0 viewport signals): `PayoutsDueFortnights` (1,225), `PesosTool` (1,149), `GlobalTasks` (898), `Expenses` (752), `Timesheets` (375), `FestivalGearManagement` (634).

### F5 🟠 Assignment matrix is served to mobile as-is

`/job-assignment-matrix` on 390px (screenshot): the filter toolbar overflows off-screen (the "1 técnicos" pill is clipped mid-word, more controls invisible), grid cells expose ~20px icon targets, and the technician column + date columns leave ~1 job column visible. The matrix is inherently a desktop power tool; the mobile answer is either (a) a purpose-built "assignments by day" list view for `<md`, or (b) an explicit redirect to that day-list with a "usa escritorio para la matriz completa" note. Option (a) reuses `DepartmentMobileHub`'s day-pager pattern.

### F6 🟠 Touch targets still below 44px (regression watch from June audit M-8)

`src/components/ui/button.tsx:23–26`: `default h-10` (40px), `sm h-9` (36px), `icon h-10 w-10` (40px). Unchanged since flagged. Compounded by dense icon rows (F3) and matrix cells (F5). iOS HIG minimum is 44px, Material 48px.

Fix at the primitive: keep visual sizes, add mobile hit-area — e.g. `min-h-[44px] min-w-[44px]` on `icon`/`sm` variants under a `@media (pointer: coarse)` rule (or Tailwind `pointer-coarse:` plugin/arbitrary variant), rather than sweeping every call site.

### F7 🟠 Sub-12px text is growing

`text-[8–11px]` occurrences: **204 (June) → 266 (now)**. New debt is being added faster than it's cleaned. Needs a lint guardrail, not just cleanup — otherwise the refurb will be eroded within a quarter.

### F8 🟠 Tables have no mobile fallback standard

23 files render shadcn `Table`; 43 use `overflow-x-auto` wrappers somewhere. Scroll-wrapping is the *minimum*; timesheet/expense/payout rows on mobile should reflow to the card-list pattern (the app already does this well in `MobileArtistList`). Pick per-table: wrap (dense reference data) vs reflow (task lists).

### F9 🟠 Connection status widget: English, floating, overlap-prone

`src/components/ui/connection-status.tsx`: fixed `bottom … right-4 z-50` — its z-50 sits **above** the mobile nav (z-40) and its bottom offset doesn't account for the nav's height, so the card variant can cover the "Más"/Festivales items; the inline variant renders English "Connecting…"+"Refresh" inside page headers (seen on `/festivals`). Redesign as a compact Spanish pill anchored *above* the nav (`bottom-[calc(nav+safe-area)]`), auto-dismissing.

### F10 🟡 Perceived performance: spinners, not skeletons

Skeleton usage flat at 11 files vs 150+ spinner sites. On mobile connections the hubs pop from spinner→content with layout shift. The June audit's H-6 covers this; on mobile prioritize skeletons for the 3 hubs and job cards only — don't boil the ocean.

### Noted, not findings

- The floating circular "island" button in every screenshot is **TanStack Query Devtools** — dev-mode only (`src/App.tsx:30–36` gates on `import.meta.env.DEV`). Not a product bug.
- `/timesheets` crashed under the harness ("hourlyRateModes.map is not a function") — a mock-shape artifact of this audit's stubs, not a reproduced product bug. Worth noting the `ErrorBoundary` fallback screen itself was excellent (Spanish, retry + reload actions).
- The technician super-app (`TechnicianSuperApp`, 691 lines, 32 `isDark` sites) renders decently on mobile (screenshot: clean cards, Spanish, minor English leaks "TOURS"/"SoundVision Database") — its theming migration stays tracked under UI_UX_AUDIT C-1, out of scope here.
- **Tooling bug found during this audit:** the `mobile-chromium` Playwright project (`playwright.config.ts`) spreads `devices["iPhone 13"]`, whose `defaultBrowserType` is **webkit** — so `npm run test:e2e:mobile` actually launches WebKit (and fails outright where only Chromium is installed). Fix: add `browserName: "chromium"` (or `defaultBrowserType` override) to that project. Included in Phase M0.

---

## 4. Refurb plan

Four phases, ordered so each ships user-visible value and later phases get cheaper. Effort: S <½ day · M 1–3 days · L 1–2 weeks.

### Phase M0 — Foundations & the language fix (≈1 sprint)

*The "stop looking unfinished" phase. No visual redesign yet.*

| # | Item | Effort | Detail |
|---|---|---:|---|
| M0.1 | **i18n sweep of mobile-first surfaces** | M | Translate every user-facing string in: `DashboardMobileHub`, `MobileDayCalendar`, `MobileJobCard`, `DepartmentMobileHub`, `ProjectManagement` (+ its filter/card children), Tours page components (incl. demoting/renaming the "Legacy Tours Detected" panel), `Settings` cards, `connection-status.tsx`, refresh toasts. Run `/i18n-check` per file; also localize `date-fns` `format()` calls (pass `{ locale: es }` — "Mon"/"Jul 15, 26" leaks come from unlocalized format calls). |
| M0.2 | **`ResponsiveDialog` primitive** | M | `src/components/ui/responsive-dialog.tsx`: Dialog ≥md, vaul Drawer <md, single API (`Root/Trigger/Content/Header/Footer/Title/Description`). Unit test + doc in `docs/mobile-guidelines.md`. Don't migrate call sites yet — new code adopts it immediately. |
| M0.3 | **`MobileActionSheet` primitive** | M | Grouped, labeled action list in a bottom drawer (icon + label + optional destructive styling), built on M0.2. This is the F3 fix vehicle. |
| M0.4 | **Touch-target floor** | S | `button.tsx`: coarse-pointer `min-h`/`min-w` 44px on `sm`/`icon`/`default`; verify no layout breakage in dense toolbars (desktop unaffected — fine pointer). |
| M0.5 | **Type floor guardrail** | S | ESLint `no-restricted-syntax` (same mechanism as the existing native-confirm ban) erroring on new `text-[8px]`–`text-[11px]` in `className`; baseline-ratchet existing 266. |
| M0.6 | **Fix `mobile-chromium` Playwright project** | S | Force `browserName: "chromium"`; add a 3-route mobile smoke spec (dashboard, project-management, department hub) asserting no horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`) and nav visibility. Wire into CI as a non-blocking job first. |

**Exit:** every screenshot in §3 renders 100% Spanish; primitives exist and are documented; CI can see mobile.

### Phase M1 — Flagship flow redesigns (sprint 2)

*The screens every user touches daily.*

| # | Item | Effort | Detail |
|---|---|---:|---|
| M1.1 | **Mobile job card actions → action sheet** | M–L | On `<md`, `JobCardActions` shows 2–3 labeled primaries (contextual: Hoja de Ruta, Notas, Asignar) + "Más acciones" opening `MobileActionSheet` with grouped labeled entries (Documentos / Impresión / Flex / Peligro). Desktop toolbar untouched. Kills F3 where it hurts most. |
| M1.2 | **Project management mobile pass** | M | With M1.1 done: title/search/status chips already fine structurally — translate (M0.1), tighten the expanded-card layout, verify FAB doesn't occlude the last card (add bottom padding = nav + FAB height). |
| M1.3 | **Tour management IA** | M | Replace the 13 stacked "Áreas de Gestión" cards with a 2-column icon grid (or grouped list: Planificación / Equipo / Documentos / Configuración) on `<md`; collapse the header action row into the primary action + overflow. |
| M1.4 | **Dashboard/department hub polish** | S–M | Post-translation: fix "QUICK TOOLS" carousel clipping (peek affordance), skeletons for day view (from F10), consistent date-pill row. |

**Exit:** the three highest-traffic management screens feel designed-for-phone; icon-soup gone from job cards.

### Phase M2 — Heavy pages & data views (sprint 3–4)

| # | Item | Effort | Detail |
|---|---|---:|---|
| M2.1 | **Profile restructure** | M | Section the page: sticky section switcher (reuse `MobileSectionSwitcher` pattern from hoja-de-ruta) or accordion-per-section on `<md`; lazy-render heavy sections (folder editor). |
| M2.2 | **Responsive table standard** | M–L | Document the two patterns (scroll-wrap vs card-reflow) in `docs/mobile-guidelines.md`; apply card-reflow to Timesheets, Expenses, Payouts lists; scroll-wrap+sticky-first-column for reference tables. |
| M2.3 | **Matrix mobile strategy** | L | Build the `<md` "asignaciones por día" list view (day pager + technician cards with status chips, reusing hub patterns); matrix grid becomes ≥md only. |
| M2.4 | **Dialog migration wave** | M (mechanical) | Migrate the ~25 highest-traffic `Dialog` call sites (job details, assignment, document upload, filters, confirmations already on `useConfirm`) to `ResponsiveDialog`. Track the long tail opportunistically. |

### Phase M3 — Polish & lock-in (ongoing)

- Connection status redesign (F9): Spanish pill above nav, auto-hide, `aria-live="polite"`.
- Skeletons for remaining mobile lists (F10, scoped by traffic).
- Sub-12px cleanup burn-down against the M0.5 ratchet.
- Promote the M0.6 mobile smoke job to blocking once green for 2 weeks.
- Per-PR habit: `/ui-check <route>` at mobile viewport for any PR touching a page component; `/i18n-check` on changed UI files (both commands already exist).

---

## 5. Priority map (finding → phase)

| Finding | Severity | Fixed in |
|---|---|---|
| F1 English on mobile surfaces | 🔴 | M0.1 |
| F2 No responsive dialog | 🔴 | M0.2 + M2.4 |
| F3 Icon-soup actions | 🔴 | M0.3 + M1.1 |
| F4 No mobile IA (Profile/Tour mgmt/…) | 🔴 | M1.3, M2.1 |
| F5 Matrix on mobile | 🟠 | M2.3 |
| F6 Touch targets | 🟠 | M0.4 |
| F7 Tiny fonts growing | 🟠 | M0.5 + M3 |
| F8 Tables | 🟠 | M2.2 |
| F9 Connection widget | 🟠 | M0.1 (strings) + M3 (redesign) |
| F10 Spinners not skeletons | 🟡 | M1.4 + M3 |

Dependencies: M1.1 needs M0.3 needs M0.2. M2.3 benefits from M1.4 patterns. Everything else is parallelizable — good fit for the parallel-worktree workflow (one worktree per M-item).

---

## 6. Reproducing the screenshot audit

The screenshots behind §3 were captured with a throwaway spec (deliberately not committed, per `/ui-check` policy):

1. Create `tests/e2e/_manual-ui-check.spec.ts` importing `bootstrapApp` from `./support/app`; seed `auth: { role: "management", department: "sound" }` plus minimal `jobs`/`tours`/`profiles` rows (copy shapes from `project-management.spec.ts` / `tour-management.spec.ts`), `page.goto()` each route, `page.screenshot({ fullPage: true })`.
2. Force iPhone metrics onto Chromium (see the `mobile-chromium`/WebKit bug in §3 "Noted"): `test.use({ ...devices["iPhone 13"], but with browserName/executable pinned to chromium })`.
3. Run `npx playwright test tests/e2e/_manual-ui-check.spec.ts --project=chromium`, read the PNGs, delete the spec.

Routes audited: `/dashboard`, `/sound`, `/project-management`, `/tour-management/:id`, `/job-assignment-matrix`, `/timesheets`, `/festivals`, `/tours`, `/profile`, `/settings` (management persona) and `/tech-app` (technician persona).
