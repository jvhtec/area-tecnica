# Code Quality Audit — 2026-06-27

## Scope and method

- **Branch audited:** a `codebase-quality-audit` feature branch off `main`
- **Focus:** Code quality — maintainability, type safety, structure, duplication,
  error handling, and test depth. This deliberately **complements** the recent
  security/infrastructure-focused `docs/ENTERPRISE_CODEBASE_AUDIT_2026-06-23.md`
  and does not re-litigate its auth/RLS/secret findings.
- **What was actually run** (not estimated):
  - `npm run typecheck` (the project-standard `tsc -p tsconfig.app.json`, which CI
    gates on — not a bare `tsc --noEmit`) → **passes, 0 errors**
  - `npx eslint src tests vite.config.ts` → **0 errors, 1770 warnings**
  - `npm audit` (prod and full)
  - Static metrics across 1,279 TS/TSX source files (~287K LOC), 67 edge functions,
    154 SQL migrations.

## Executive verdict

The codebase is **healthier than its size suggests**. Type checking is clean, the
linter reports zero errors, there are no hardcoded secrets in source, and the data
layer is well-abstracted (components rarely touch Supabase directly). The dominant
quality issues are **breadth, not depth**: pervasive `any`, a long tail of oversized
modules, and shallow test coverage relative to surface area.

| Dimension | Grade | One-line summary |
| --- | --- | --- |
| Type safety | C | Compiles clean, but 1,543 `any` warnings erode the value of TS |
| Module size / structure | C+ | 49 files >800 lines; a few 1,500–2,100-line god files |
| Correctness hygiene | B− | One real Rules-of-Hooks bug; 38 empty catch blocks |
| Duplication | B− | Some genuine forks (PDF exporters, two `TimesheetView`) |
| Error handling | C+ | Good toast patterns, but silent swallowing in places |
| Test depth | C | 954 tests is solid, but ~13% of files are covered |
| Tooling/gates | B+ | Strong governance scripts, lint/typecheck/CI all wired |
| Dependency health | B− | No prod criticals; known dev-only highs accepted in SECURITY.md |

## What is working well

- **Typecheck is green** and CI gates on the strict `tsconfig.app.json` (per CLAUDE.md).
- **Zero lint errors** — all 1,770 findings are warnings, so the bar is enforced
  without blocking, and there are only **21** `eslint-disable`/`ts-ignore` escapes
  across the whole `src` tree.
- **No hardcoded secrets** detected in source (all keys flow through `import.meta.env`).
- **Minimal XSS surface** in app code: only 2 `dangerouslySetInnerHTML` usages.
- **Data-layer discipline:** only ~4 components/pages call `supabase.*` directly;
  the rest go through hooks and `dataLayerClient`. 242 files use React Query.
- **Governance tooling** (`npm run governance`) enforces source boundaries, edge-function
  rules, SQL grants, action pinning, and migration ordering — unusually mature for an app
  this size.

## Findings

### CQ-01 — High — Rules-of-Hooks violation in `Disponibilidad.tsx` (real bug)

`src/pages/Disponibilidad.tsx` returns early at lines **60–69** (management-restricted)
and **72–74** (`if (!department) return null`) **before** calling hooks:

- `useOptimizedJobs(...)` — line 81
- `useQuery(...)` — line 83
- `useMemo(...)` — line 123
- `useState(...)` / `useEffect(...)` — lines 131–132

ESLint flags 5 `react-hooks/rules-of-hooks` violations here. Because `department`
can be `null` on one render and non-null on the next (it depends on async auth state:
`userRole`, `userDepartment`), the **number of hooks called changes between renders**,
which can corrupt React's hook state and throw "rendered fewer hooks than expected".
This is the only place in the codebase with this pattern and should be fixed by moving
all hook calls above the early returns (gate behavior via `enabled`/conditional logic
inside the hooks instead).

**Fix:** Hoist `useState`/`useEffect`/`useQuery`/`useMemo` above the guards; keep the
JSX early-returns but make the data hooks no-op via their `enabled` flags when
`department` is null.

### CQ-02 — Medium — Pervasive `any` undermines type safety

- **1,543** `@typescript-eslint/no-explicit-any` warnings across **~457 files** —
  87% of all lint output.
- Worst offenders: `src/components/jobs/job-details-dialog/tabs/JobDetailsInfoTab.tsx` (27),
  `src/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView.tsx` (26),
  `src/components/jobs/cards/job-card-new/JobCardNewView.tsx` (23),
  `src/pages/JobAssignmentMatrix.tsx` (22).
- This is compounded by the intentionally relaxed `tsconfig` (`noImplicitAny: false`,
  `strictNullChecks: false`, per CLAUDE.md). The generated `supabase/types.ts` (11.6K lines)
  already provides rich row types, so most `any` on query results is **avoidable**.

**Recommendation:** Treat `any` as a budget, not a default. Pick the top-20 files and
replace query-result `any` with `Database['public']['Tables'][...]['Row']` types. Do **not**
flip global strict flags (CLAUDE.md explicitly warns against this) — tighten file-by-file.

### CQ-03 — Medium — Oversized modules (god files)

**49 source files exceed 800 lines** (excluding generated `types.ts`). The extreme tail:

| Lines | File |
| --- | --- |
| 2,116 | `src/features/tour-ops/TourOpsManagementHub.tsx` |
| 1,885 | `src/features/tour-ops/tourSchedulingService.ts` |
| 1,820 | `src/features/technical-tools/power/consumos/useConsumosTool.ts` |
| 1,722 | `src/components/tours/TourDefaultsManager.tsx` |
| 1,438 | `src/components/jobs/cards/JobCardNew.tsx` |
| 1,342 | `src/components/tours/TourDateManagementDialog.tsx` |
| 1,297 | `src/components/matrix/StaffingCampaignPanel.tsx` |

These concentrate risk: they are the hardest to test, review, and reason about, and they
correlate with the `any`/hook-warning hotspots above. The largest hooks are also heavy —
`useOptimizedAuth.tsx` (846), `useGlobalTaskMutations.ts` (843), `useHojaDeRutaPersistence.ts` (777).

**Recommendation:** No big-bang rewrite. Freeze the debt, then pay it down opportunistically
(extract sub-components, move pure logic to colocated modules) when files are next touched.

**Status (update):**
- A **ratcheting file-size budget** now enforces this: `scripts/governance/check-file-size-budget.mjs`
  (wired into `npm run governance` as `governance:filesize`) fails CI if any new source file
  crosses 800 lines or a baselined file grows past its recorded ceiling. Baseline:
  `scripts/governance/file-size-baseline.json` (regenerate with `npm run governance:filesize -- --write-baseline`).
- First paydown: `src/utils/gearComparisonService.ts` (1,068 lines, **0 tests**) was split into
  a focused `src/utils/gear-comparison/` module set (`types`, `availableGear`,
  `compareArtistRequirements`, `calculateEquipmentNeeds`, `getMismatchSummary`; largest 568 lines)
  behind a backward-compatible barrel, and given its first characterization tests. God-file count
  over 800 lines: **46 → 45**.

### CQ-04 — Medium — Duplicated / forked modules

- **Two `TimesheetView.tsx`** — `src/components/timesheet/TimesheetView.tsx` (1,137 lines)
  and `src/components/technician/TimesheetView.tsx` (980 lines). Worth confirming these are
  intentionally distinct views vs. a drifted fork; if forked, extract shared rows/calc.
- **22 PDF-export modules** under `src/utils/` (`artistPdfExport`, `artistTablePdfExport`,
  `rfIemTablePdfExport`, `rates-pdf-export`, `gearSetupPdfExport`, …). Several are 800–1,200
  lines and likely repeat layout/branding/QR boilerplate. CLAUDE.md already prescribes
  `src/utils/pdf/` as the shared engine — consolidation of common header/footer/logo logic
  would cut hundreds of lines.

**Recommendation:** Audit the PDF exporters for a shared `withCorporateLayout()` helper;
resolve the `TimesheetView` duplication explicitly (rename to clarify, or merge).

### CQ-05 — Medium — Silent error swallowing

- **38 empty/near-empty catch blocks** in `src` (e.g. `catch { /* ignore */ }`).
  Examples: `src/components/jobs/CrewCallLinker.tsx:88`, `src/components/auth/SignUpForm.tsx:292`.
- Some are legitimately benign (clipboard fallback in `EditUserDialog.tsx:269`), but a
  blanket `// ignore` on network/Supabase calls hides real failures from users and from any
  future telemetry (the enterprise audit already flags the absence of external error
  reporting).

**Recommendation:** Replace bare swallows with at least a `console.warn` + comment stating
*why* it's safe to ignore. When error telemetry is added (per ENT audit), these become the
first blind spots.

### CQ-06 — Low — Console noise

- **2,787** `console.*` calls in `src`. Production builds drop these via esbuild
  (`drop: console/debugger`, per CLAUDE.md), so this is not a prod-leak risk, but it is
  signal-to-noise debt during development and in any path not covered by the drop.
- Concentrated in `src/components` (138 files) and `src/utils`.

**Recommendation:** Route intentional diagnostics through a thin `logger` wrapper so they
can be levelled/filtered, and let the drop handle the rest. Low priority.

### CQ-07 — Low — Test coverage breadth

- **954 test cases / 236 describe blocks across 163 test files** — a genuinely good absolute
  count and the critical workflows (auth, assignments, timesheets, matrix) are covered.
- But that's tests in **~13% of source files** (163 / 1,279). The enterprise audit's "good
  test count, very low effective coverage" holds: breadth is thin, and the largest/riskiest
  modules (CQ-03) are largely untested.

**Recommendation:** Tie new tests to the god-file split work — every file extracted from a
god module should leave its pure logic in a tested `*.service.ts`. Run `npm run test:coverage`
in CI to make the number visible (currently not gated).

### CQ-08 — Low — Dependency vulnerabilities

- `npm audit --omit=dev`: **4 moderate, 0 high/critical** (production runtime).
- `npm audit` (incl. dev): **6 high, 5 moderate** — the highs are dev-only toolchain
  (esbuild via vitest, etc.) and are already documented as accepted risk in `SECURITY.md`.
- One install caveat: `npm ci` aborts in restricted/proxied environments because
  `@capacitor/assets` → `sharp` tries to download a native binary. Use
  `npm ci --legacy-peer-deps --ignore-scripts` for CI/tooling that doesn't need image
  processing. Worth pinning `sharp`'s install or making it optional.

### CQ-09 — Low — Assorted lint warnings worth clearing

From the 1,770 warnings, beyond `any`: **96** `react-hooks/exhaustive-deps` (stale-closure
risk), **41** `no-empty` (overlaps CQ-05), **2** `no-async-promise-executor`
(`src/lib/push-native.ts:59`, `src/utils/gearSetupPdfExport.ts:12` — async executor can
swallow rejections), **5** `react-hooks/rules-of-hooks` (all in CQ-01), and a handful of
`no-control-regex`/`no-useless-escape` in sanitizer utils (review those regexes for intent).

## Prioritized action list

1. **Fix CQ-01** (Disponibilidad hooks) — small, isolated, prevents a real runtime crash.
2. **Fix the 2 `no-async-promise-executor`** and review `exhaustive-deps` in the matrix/job-card
   hotspots — cheap correctness wins.
3. **Add a god-file size warning** to governance and start splitting the top 5 on-touch.
4. **Burn down `any`** file-by-file in the top-20 offenders using existing generated DB types.
5. **Resolve the duplications** (TimesheetView, PDF exporter boilerplate).
6. **Make coverage visible** in CI and grow it alongside the refactors.

## Metrics appendix

| Metric | Value |
| --- | --- |
| Source files (TS/TSX) | 1,279 |
| Source LOC | ~287,430 |
| Edge functions | 67 |
| SQL migrations | 154 |
| `tsc --noEmit` errors | 0 |
| ESLint errors / warnings | 0 / 1,770 |
| — `no-explicit-any` | 1,543 |
| — `react-hooks/exhaustive-deps` | 96 |
| — `react-hooks/rules-of-hooks` | 5 (all `Disponibilidad.tsx`) |
| Files >800 lines (excl. generated) | 49 |
| Empty catch blocks | 38 |
| `console.*` calls | 2,787 |
| `eslint-disable` / `ts-ignore` escapes | 21 |
| Hardcoded secrets in source | 0 |
| `dangerouslySetInnerHTML` | 2 |
| Test files / cases | 163 / 954 |
| npm audit (prod) | 4 moderate, 0 high/critical |
| npm audit (incl. dev) | 6 high, 5 moderate (dev toolchain, accepted) |
