# Codebase Tech-Debt Audit — 2026-09-09

**Audit date:** 2026-09-09
**Baseline:** `main` at `38479ad` (after PRs #929–#934: Flex provisioning unification, PDF design-system opening, bundle headroom work)
**Previous audit:** [`docs/CODEBASE_AUDIT_2026-09-04.md`](CODEBASE_AUDIT_2026-09-04.md)
**Scope:** app source, 74 Edge Functions, 208 migrations, governance gates, tests, bundle, static assets.
**Method:** every gate and suite re-run locally on this commit. Dead-code and duplication findings verified by
exhaustive grep for dynamic and string references, not by a single import scan. No production database access
this round — SQL/RLS findings are carried from 2026-09-04, not re-verified.

---

## Executive assessment

The security programme closed. Every P0 from the 2026-09-04 audit has a landed migration, all twelve
governance gates pass, the full suite is green, `strict: true` type-checks clean, and the bundle now meets
PERF-01's 15%-reserve target for the first time. There is no new critical finding, and I could not
manufacture one.

What is left is **structural debt, and it has a single recurring shape**: the repo is very good at building
the right primitive and then not adopting it. Three independent instances, none of them noted before:

| Primitive | Adoption |
| --- | --- |
| `src/lib/errorTracking.ts` (`trackError`) | **3 non-test importers**, against 995 `catch` blocks — 620 of which log only to `console`, which the production build strips |
| `optimizedInvalidation` (`src/lib/optimized-react-query.ts:169`) | **12 call sites**, against 425 raw `invalidateQueries()` |
| `src/services/dataLayerClient.ts` | 176 UI importers — but the module is a **10-line alias** for the Supabase client, so it encapsulates nothing |

This is the same class the last audit named for `structuredLogger.ts` on the Edge side ("good primitives with
partial adoption"). It was fixed for that one module and not swept for. It is now the dominant pattern in the
app tier.

The second theme is **debt that the gates cannot see**. The file-size budget stops at `src/`, so the largest
file in the repo outside generated types is a 1,819-line privileged Edge Function. And where the gates *do*
look, the 800-line budget is increasingly satisfied at the margin: 24 files now sit between 780 and 800 lines,
six of them within two lines of the ceiling.

**Nothing here is urgent. All of it is the kind of debt that makes the next feature slower**, and two items
(H1, H3) are actively dangerous to correctness because they leave two implementations of the same rule where
only one is reachable.

---

## Scorecard — measured on this commit

| Signal | 2026-09-04 | 2026-09-09 | Verdict |
| --- | --- | --- | --- |
| `npm run governance` | passes, 11 sub-gates | **passes, 12 sub-gates** | held |
| `npm run typecheck` (`strict: true`) | passes | **passes** | held |
| Vitest full suite | 360 files / 1,995 tests | **387 files / 2,138 tests, all pass** | improving |
| `npm run lint` warnings | 1,216 | **1,093** (783 app + 310 functions) | −10%; baseline 1,122, so 29 warnings of headroom |
| — `no-explicit-any` | 1,037 | **914** | draining |
| — `react-hooks/exhaustive-deps` | 78 | **74** | effectively static |
| Production build | passes | **passes** | held |
| Bundle (js gzip) | 3.10 MB | **2.83 MB** | **PERF-01's 15% reserve met** — by 10 kB |
| `ui-data-layer-client-import` | 195 | **176** | see H4 — the metric overstates the progress |
| `scheduling-new-date` | 67 | **43** | genuine progress |
| File size >800 lines (`src/`) | 0 | **0** — but 24 files at 95–100% | see M1 |
| Manual Edge entrypoints | 33 | **33** | static |
| Migrations | 203 | **208**, unique/ordered | ok |
| Dependency advisories | 0 | **0** | held |

### One correction to the previous audit

2026-09-04 recorded coverage thresholds as **"5 files, and CI never runs coverage"** — inert. That is no
longer accurate, and appears to have been slightly wrong when written. `package.json:21` chains
`test:critical` into `test:critical:coverage`, and `.github/workflows/tests.yml:189` runs `test:critical` on
every PR. The thresholds on the six `_shared/` security modules (`auth`, `rateLimit`, `hojaLinkToken`,
`emailHtmlPolicy`, `memoriaSecurity`, `memoriaContext`) **are enforced in CI**. REL-02's broader point — that
there is no coverage floor for app code — still stands.

---

## Critical

None. Every P0 and P1 security item from 2026-09-04 has a landed migration
(`20260904160000`–`20260905134547`) with pgTAP coverage. DB-06 (policy-count reconciliation) remains open
and needs production access this audit did not have.

---

## High

### H1 — 1,856 lines of dead Flex folder-creation code that duplicates the Edge Function, still under test

**Files:** `src/utils/flex-folders/folder-creation/` — `createStandardJobFolders.ts` (459),
`createTourdateFolders.ts` (556), `createDryhireFolders.ts` (243), `createComercialExtras.ts` (195),
`createEstructuraFolders.ts` (123), `helpers.ts` (280).

PR #932 moved Flex provisioning behind durable server operations. `createAllFoldersForJob` is now a 26-line
wrapper that invokes the `create-flex-folders` Edge Function
(`folder-creation/createAllFoldersForJob.ts:9-26`). The client-side implementations it used to call were
never removed. Verified dead: no import, dynamic import, or string reference to any of the three entry
points exists anywhere in `src/`, `supabase/`, `scripts/`, `tests/`, or `docs/`. The remaining three modules
are reachable only from those dead entry points and from their own tests.

Two things make this worse than ordinary dead code:

1. **The dead code duplicates live business rules.** Document-number formats, dryhire parent-folder lookup,
   comercial-extras creation and estructura folder hierarchy now exist in both
   `supabase/functions/create-flex-folders/index.ts` (lines 220–459) and in the orphaned client modules. The
   Flex folder hierarchy is one of this repo's five documented "don't bypass" invariants; having two
   divergent expressions of it is exactly the failure mode CLAUDE.md warns about.
2. **Its tests still run and still pass.** `folder-creation/createComercialExtras.test.ts` and
   `src/utils/flex-folders/__tests__/folders.estructura.test.ts` exercise code no user path reaches. They
   contribute green checks that assert nothing about production behaviour.

**Action:** delete the six modules and the two test files. Keep `createAllFoldersForJob.ts` and `types.ts`
(the latter is imported for its `FlexFolderJob` type by three live modules). Confirm the Edge Function has
equivalent coverage before deleting the tests, and port any assertion that has no server-side counterpart.

### H2 — The client error-tracking primitive has three importers; 620 catch blocks log to a stripped console

`src/lib/errorTracking.ts` exports `trackError` and `trackUnhandledError` with redaction, a per-page-load
budget, and its own test file. Non-test importers, in full:

- `src/components/ErrorBoundary.tsx:211` — boundary crashes
- `src/main.tsx` — global `window.onerror` / unhandled rejection handlers
- `src/hooks/useJobs.ts:126` — **the only domain call site in the codebase**

Meanwhile `src/` contains 995 `catch` blocks, 620 of which reach `console.error` on the line following the
catch. `vite.config.ts:133-134` sets `drop: ['console', 'debugger']` for production builds. So roughly
**62% of the application's error handling produces no artefact whatsoever in production** — no console line,
no `system_errors` row, nothing queryable. The ErrorBoundary's own doc comment (lines 195–200) states the
problem precisely for its own case; the reasoning was never generalised.

The worst-affected modules are the ones where a silent failure is hardest to diagnose from user reports:
`useHojaDeRutaPersistence.ts` (56 console calls), `flexUuidService.ts` (45), `useTimesheets.ts` (45),
`useTourDateMutations.ts` (41).

**Action:** this does not need 620 edits. Route the mutation and persistence layers first — Hoja de Ruta
persistence, timesheets, tour-date mutations, Flex UUID resolution — then add a governance rule in the shape
of the existing `check-edge-logging.mjs`: a ratcheted baseline of console-only catch sites in `src/`, so the
count can only fall.

### H3 — Department triplication: 3,995 lines across two component families

The cross-file duplication scan (6-line normalised windows) puts these at the top of the codebase by a wide
margin:

| Family | Files | Lines | Shared blocks |
| --- | --- | ---: | ---: |
| Memoria Técnica | `sound/MemoriaTecnica.tsx`, `lights/LightMemoriaTecnica.tsx`, `video/VideoMemoriaTecnica.tsx` | 704 / 679 / 671 | 153, 111, 98 pairwise |
| Task dialogs | `sound/SoundTaskDialog.tsx`, `lights/LightsTaskDialog.tsx`, `video/VideoTaskDialog.tsx` | 680 / 629 / 632 | 68, 18, 18 pairwise |

QLT-04 called for consolidating "duplicated PDF generator logic" and it was done — on the server, in
`_shared/memoriaAssembly.ts`, `memoriaCover.ts`, `memoriaInput.ts`, `memoriaSecurity.ts`. The client
components that drive those functions were not touched, and they still carry three copies of upload
handling, progress state, file validation and error surfacing.

`pages/Lights.tsx` and `pages/Video.tsx` (43 shared blocks) are the same story one level up.

**Action:** the department-specific parts are genuinely department-specific — do not collapse the templates.
Extract the shared shell (file selection, upload progress, validation, submission, error toasts) into one
`MemoriaTecnicaShell` taking a department config, and the same for the task dialogs. Roughly 1,200 lines
should come out without touching a single visual template.

### H4 — `dataLayerClient` is a rename, not a data layer

`src/services/dataLayerClient.ts` is ten lines:

```ts
export const dataLayerClient: typeof typedSupabase = runtimeSupabase as typeof typedSupabase;
```

Its own docstring is honest about being a staging post. The problem is what the metrics do with it.
`pages-supabase-client-import` reads **0** and is described as "cleared"; `ui-data-layer-client-import` fell
213 → 176. But 25 pages and 151 components now import the alias and still own raw table names, filters,
cache keys and error handling. Swapping `supabase` for `dataLayerClient` satisfies one gate, increments the
other, and changes nothing about coupling.

The related React Query story is consistent with that: `createQueryKey` appears in 94 of 269 `useQuery`
call sites (~35%), and key roots are spelled inconsistently (`['jobs'` 16 times, `["jobs"` 9 times, plus
`job-a`, `job-typed`, `job-staff` and a dozen other ad-hoc namespaces).

**Action:** stop treating `ui-data-layer-client-import` as a progress metric — it measures alias adoption.
Pick the two highest-count domains (jobs, assignments), move their queries into feature services behind
`createQueryKey`, and measure *those* files leaving the count. Retiring `dataLayerClient` entirely is the
end state; until then the gate should be described as a freeze, not a burn-down.

---

## Medium

### M1 — 24 files sit at 95–100% of the 800-line budget

`src/pages/Profile.tsx` is exactly 800. `AmpRackDesigner.tsx` 799. `AdminPanel.tsx`, `TimesheetView.tsx`,
`Expenses.tsx`, `flexWorkOrders.ts` all 798. The "retire oversized modules" PRs (#877, #879) did real work,
but the result is a cluster pressed against the ceiling rather than a distribution with room in it. Any
feature touching those files now forces either a cosmetic trim or a rushed extraction, and the gate reports
green either way.

**Action:** the gate is fine; the reporting is not. Have `check-file-size-budgets.mjs` fail on *net growth*
within the 95–100% band, or publish the count in that band as a tracked metric alongside the over-threshold
count, so "0 over budget / 24 at the wall" is visible without reading the log.

### M2 — Edge Functions have no size budget, and 65 of 74 run as service role

`check-file-size-budgets.mjs` scans `src/` only. Outside generated types, the largest source file in the
repository is `supabase/functions/send-staffing-email/index.ts` at **1,819 lines** — 2.3× the app ceiling.
Five more exceed 800: `staffing-orchestrator` (1,288), `create-whatsapp-group` (1,002), `staffing-click`
(964), `upload-public-artist-rider` (905), `send-corporate-email` (878).

This is the highest-privilege code in the system: 65 of 74 functions reference the service-role key, 30
still define their own `Access-Control-Allow-Origin` (against 4 importing `_shared/cors`), and 31 parse
authorization headers themselves. `createHttpHandler` adoption has been static at 38/71 since the last audit.

**Action:** extend the file-size gate to `supabase/functions/` with its own baseline (start at current, so
nothing breaks), and treat the five 800+ files as extraction cards. `send-staffing-email` and
`staffing-orchestrator` between them hold the campaign state machine, another documented invariant.

### M3 — Abandoned sidebar refactor: 461 lines with zero importers

`src/components/ui/sidebar.tsx` (774 lines) has exactly one importer, `components/layout/Layout.tsx:17`.
`src/components/ui/sidebar/` — `index.tsx`, `sidebar-context.tsx`, `sidebar-components.tsx`,
`sidebar-layout.tsx`, `sidebar-menu.tsx`, 461 lines — has **none**. Someone split the monolith, never
switched the consumer, and left both. The monolith at 774 lines is itself in the M1 danger band.

**Action:** finish or revert. Pointing `Layout.tsx` at `@/components/ui/sidebar/` and deleting the monolith
is one import change plus a smoke test, and it takes a 774-line file off the budget wall.

### M4 — RLS behavioural coverage is roughly one table family in seven

Migrations enable row-level security on ~185 tables and define 706 policies. `supabase/tests/database/`
holds 26 pgTAP files, concentrated on the table families touched by recent security work. That is exactly
right as a remediation record and insufficient as a safety net: the twelve `USING (true)` authenticated-scope
policies the last audit enumerated (`jobs`, `job_assignments`, `venues`, `achievements`, …) still have no
deny test pinning them, so a future policy edit on any of them fails silently.

DB-02 has been open across three audits. **Action:** generate the roles × actions × tables matrix
mechanically from the catalog, check it in, and let CI fail when an RLS-enabled table appears with no
corresponding pgTAP file — the shape of the existing exposure-classification gate.

### M5 — 6.4 MB of unreferenced images ship on every deploy

38 of 80 images under `public/` (6,690,952 bytes) are referenced nowhere in `src/`, `index.html`, or the
manifest. The bulk is `public/lovable-uploads/` — 56 files, 6.5 MB, mostly marketing screenshots
(`assignmentMatrix.jpg` 417 kB, `dashboardHero.jpg` 267 kB, `festivalManagement*.jpg`, `tourManagement*.jpg`,
`IMG_7834/7835/7836.jpeg` 1.68 MB combined) left over from the Lovable scaffold. Some `.webp` files in the
same directory *are* live (`AboutModal.tsx:28-35`), so the directory cannot be deleted wholesale.

Two files are byte-identical (`md5 33b76668…`): `public/og-image.png` and
`public/8067C0A4-0C71-4CDF-952B-0E699DA25A74.png`, 315 kB each. Neither is referenced — `index.html:20`
points `og:image` at `area-tecnica-logo.png`.

Nothing here is in the JS bundle, so the budget never sees it; it is repo weight, deploy time and
Cloudflare storage. **Action:** delete the 38 unreferenced files, then convert the survivors to WebP —
`src/utils/imageOptimization.ts` exists for runtime images but static assets never went through it.

### M6 — Spanish-only is a documented rule with no gate

271 toast calls use an English `title: "Error" | "Success" | "Warning" | "Loading"`, and 37 JSX text nodes
are bare English UI verbs across ~20 components (`rack-builder/*`, `pages/rack-builder/*`,
`tours/TourDeleteSection.tsx`, `users/DeleteUserDialog.tsx`, `pages/Announcements.tsx`). CLAUDE.md calls
this "a live, recurring slip, not a hypothetical" and points at `/i18n-check` — which is a slash command a
developer has to remember to run. There is no CI gate.

**Action:** ratchet it like the lint baseline. A per-file count of English UI strings that can only fall
turns a discipline problem into a mechanical one.

### M7 — Two navigation entries both read "Panel técnico"

`src/routes/app-route-primary-routes.tsx` registers `/tech-app` → `TechnicianSuperApp` (nav label
"Panel técnico", mobile "Panel") at line 110, and `/technician-dashboard` → `TechnicianDashboard` (nav label
"Panel técnico", mobile "Panel") at line 178. The two pages share 62 duplicated 6-line blocks across 1,207
lines. A technician with both access flags sees two identically-named entries leading to different screens.

**Action:** decide which one is the survivor. If both must exist, the labels have to differentiate — this is
user-facing, not just debt.

---

## Low

- **12 unused shadcn components, 1,731 lines** — `carousel` (260), `chart` (365), `menubar` (234),
  `connection-status` (179), `timeout-loader` (143), `navigation-menu` (128), `drawer` (116),
  `date-time-picker` (76), `input-otp` (69), `resizable` (43), `subscription-status` (113),
  `aspect-ratio` (5). Zero importers each. Five npm dependencies exist **only** to serve them: `recharts`,
  `embla-carousel-react`, `input-otp`, `vaul`, `react-resizable-panels`. They tree-shake out of the bundle,
  so this is install time, lockfile size and advisory surface, not payload.
- **Duplicate `PrintDialog`, already diverged** — `dashboard/PrintDialog.tsx` (105 lines, used by
  `MobileDayCalendar.tsx:22`) and `dashboard/calendar-section/PrintDialog.tsx` (96 lines, used by
  `CalendarSection.tsx:8`). Same dialog; one says "Export to Excel" (line 88) and the other "Export to XLS"
  (line 81); one declares `PrintSettings` inline, the other imports the shared type. Both are also M6
  offenders ("Select Print Range", "Current Month").
- **74 `react-hooks/exhaustive-deps` warnings in one undifferentiated bucket.** Spot-checking shows the mix
  matters: `JobPayoutTotalsPanel.tsx:50,97` enumerate `data.*` sub-fields deliberately and are *more*
  precise than the rule wants, while `DirectMessagesList.tsx:60,147` (missing `fetchMessages`) and
  `CreateJobDialog.tsx:154` (missing `getRandomColor`) look like genuine omissions. Because they share a
  bucket, a real stale-closure bug is indistinguishable from an intentional narrowing. Triage once, then
  `eslint-disable-next-line` with a one-line reason on the deliberate ones so the remaining count means
  something.
- **Bundle headroom is 10 kB.** `js gzip with 15% reserve`: 2.83 MB current against 2.84 MB allowed. PERF-01
  is met, but the next library lands on the wrong side of it. Worth knowing before the next feature, not
  worth acting on now.
- **5 `@ts-ignore` / `@ts-expect-error` sites**, each with a justifying comment
  (`SignUpForm.tsx:80`, `OptimizedAssignmentMatrixView.tsx:415`, `useLgScreensaverBlock.ts:7`,
  `Auth.tsx:246`, `send-vacation-decision/index.ts:37`). Listed for completeness; all defensible.
- **Zero `TODO` / `FIXME` / `HACK` comments** in `src/` and `supabase/functions/`. Noted because it is
  unusual and worth keeping.

---

## Suggested order

Judged by risk removed per hour, not by severity label.

| # | Item | Why first | Rough size |
| --- | --- | --- | --- |
| 1 | **H1** — delete the dead Flex subtree | Removes a divergent copy of an invariant and two tests that assert nothing. Pure deletion. | Half a day |
| 2 | **M3** — finish the sidebar split | One import change; takes a 774-line file off the budget wall and deletes 461 dead lines. | An hour |
| 3 | **M5** — delete unreferenced images | 6.4 MB, mechanical, zero behavioural risk. | An hour |
| 4 | **H2** — route mutation-layer errors through `trackError`, then gate it | Buys production diagnosability where outages actually get reported. | 2–3 days |
| 5 | **M7** — resolve the duplicate "Panel técnico" | User-facing; cheap once the survivor is chosen. | Half a day |
| 6 | **M2** — extend the size gate to Edge Functions | Stops the 1,819-line file growing while extraction is scheduled. | A day |
| 7 | **H3** — extract the Memoria Técnica and task-dialog shells | Largest single lines-removed win, but needs care and visual regression checks. | A week |
| 8 | **M6** — ratchet the i18n check | Converts a remembered discipline into a gate. | A day |
| 9 | **H4 / M4** — real data-layer extraction, RLS matrix | Both are multi-release programmes. Re-scope rather than schedule. | Ongoing |

Items 1–3 are roughly a day together and delete about 2,300 lines and 6.4 MB.

---

## What I did not check

- **No production database access this round.** DB-06 (the 590-vs-552 policy count) and every SQL finding
  from 2026-09-04 are carried forward unverified. DB-06 still needs the normalised catalog diff that audit
  specified.
- **No Deno on this machine**, so `npm run typecheck:functions` did not run. It passes in CI on this commit.
- **Playwright not run** — no Chromium in this environment. `e2e_smoke` passes in CI.
- **Edge Function deployment smoke tests** (REL-03) remain open, as they have across all three audits.
