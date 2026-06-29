# Codebase Tech Debt & Dead Code Audit — 2026-06-29

**Scope**: Full `src/` tree (1,300 TS/TSX files, ~290k LOC including generated types).
**Method**: Static scans for unreferenced modules, `any` usage, console statements, duplicate
implementations, dependency vulnerabilities, and existing governance baselines. Dead-file
detection is path-based (a file is flagged when no other module imports it by path); a sample
of ~15 hits was hand-verified with zero false positives.

> This is a **report only** — no code was changed. Removals should be done in small,
> reviewable batches with a typecheck + build between each.

---

## Executive Summary

| Area | Finding | Severity |
| --- | --- | --- |
| Dead code | **102 removable files = ~16,200 LOC** (90 app files + 12 unused shadcn/ui kit) | **High** |
| Future use | `src/components/landing/` (6 files, ~1,246 LOC) is unwired but **intentionally kept** | — |
| Dead subsystem | Entire **tour-scheduling** module (~4,400 LOC) superseded by `features/tour-ops/` | **High** |
| Doc drift | CLAUDE.md lists 4 dead hooks as "active patterns" | **High** |
| Dependencies | **11 npm advisories** (6 high, 5 moderate) | **High** |
| Duplication | `useRecalcTimesheet` exists twice — **both dead** | Medium |
| Type safety | **1,225 `any`** occurrences (286 `as any` + 939 `: any`) | Medium |
| Noise | **2,777 `console.*`** calls in app code (dropped in prod, but dev noise) | Low |
| File size | 45 files > 800 lines — fully baselined, no new regressions | Low |
| Markers | 0 TODO/FIXME/HACK — clean discipline | ✅ |

---

## CRITICAL

_None._ No security-definer leaks, exposed secrets, or build-breaking issues surfaced in this
pass (the governance gates — source boundaries, edge-function exposure, SQL grants — are all at
baseline).

---

## HIGH

### H1. ~17,400 LOC of dead (unreferenced) code

108 files are imported by no other module. Verified samples (`LoginForm`, `useAuth`,
`useJobManagement`, `ArtistForm`, `useTimezone`, `useLocations`,
`useVirtualizedMatrix`, …) have **zero** references anywhere in `src/`. Lazy-loaded pages are
correctly excluded (the route manifest uses literal `import()` paths the scan resolves).

Of these, **6 are the `src/components/landing/` files — intentionally retained** for a future
landing page (see H1b) and **excluded** from removal. That leaves **102 removable files**:
**90 app files** + **12 unused shadcn/ui primitives**. Full list in
[Appendix A](#appendix-a--dead-file-inventory).

Highest-impact clusters:

#### H1a. Abandoned tour-scheduling subsystem (~4,400 LOC)
Superseded by the active `src/features/tour-ops/` module, but the old implementation was never
deleted:

| File | LOC |
| --- | ---: |
| `src/utils/tour-scheduling-pdf-enhanced.ts` | 753 |
| `src/components/tours/scheduling/TourAccommodationsManager.tsx` | 725 |
| `src/utils/tour-scheduling-pdf.ts` | 642 |
| `src/components/tours/scheduling/EnhancedTourTravelPlanner.tsx` | 582 |
| `src/components/tours/scheduling/TourItineraryBuilder.tsx` | 405 |
| `src/components/tours/scheduling/TourTimelineView.tsx` | 352 |
| `src/types/tourScheduling.ts` | 350 |
| `src/services/tours/createFoldersForDate.ts` | 326 |

#### H1b. Landing/marketing page — NOT dead, intentionally retained (~1,246 LOC)
The `src/components/landing/` directory (`HeroSection`, `ModuleShowcase`, `FeatureHighlights`,
`CallToAction`, `StatsSection`, `TechnicalSpecs`) is currently unwired — no page assembles it —
but it is **kept on purpose for a future landing page**, not abandoned. **Do not delete.** Note
that it will need updating before reuse, since many newer features aren't represented in it.
Excluded from the deletion totals below.

#### H1c. Superseded matrix + equipment components
- `src/components/matrix/AssignmentMatrix.tsx` (490) + `MatrixPerformanceWrapper`,
  `PerformanceIndicator` — replaced by `matrix/optimized-assignment-matrix/`.
- `src/components/equipment/EquipmentCreationManager.tsx` (606),
  `JobPresetManager.tsx` (539), `StockManagement.tsx`, `StockMovementHistory.tsx`.

#### H1d. Stray / example files in `src/`
- `src/testPdfExport.ts` — a scratch/test file in the source root.
- `src/components/flex/FlexElementSelectorDialog.example.tsx` — an `.example` file shipped in `src/`.

**Recommendation**: Delete in themed batches (tour-scheduling, landing, matrix, equipment,
dead hooks, dead UI kit), running `npm run typecheck` + `npm run build` after each batch.
Per the Archive policy in CLAUDE.md, anything worth keeping for reference belongs in
`src/legacy/`, not in the active tree.

### H2. CLAUDE.md documents dead hooks as active patterns

Four hooks cited in CLAUDE.md / architecture docs are unreferenced:

| Hook | Doc claim |
| --- | --- |
| `useOptimisticJobManagement` (209 LOC) | "Optimistic Updates … immediate UI feedback with rollback" |
| `useVirtualizedMatrix` (78 LOC) | "Virtual Scrolling for large datasets" |
| `useJobCard` (387 LOC) | — |
| `useJobManagement` (170 LOC) | — |

This is actively misleading — new contributors will reach for hooks that no longer wire into
anything. Either rewire them or delete them **and** update CLAUDE.md's "Performance
Optimizations" section.

### H3. 11 dependency advisories (6 high, 5 moderate)

From `npm audit` (also tracked by `npm run audit:deps`, currently at baseline):

| Severity | Package | Issue |
| --- | --- | --- |
| HIGH | `tar` (via `@capacitor/cli`, `@capacitor/assets`) | Arbitrary file write via hardlink path traversal |
| HIGH | `minimatch` (via `replace` ← `@trapezedev/project`) | ReDoS |
| HIGH | `xcode`/`replace` (via `@trapezedev/project`) | transitive |
| MODERATE | `quill` ← `react-quill` | Stored XSS via HTML export |
| MODERATE | `uuid` (via `exceljs`, `xcode`) | Missing buffer bounds check (v3/v5/v6) |

Most high-severity items are in **build/native tooling** (`@capacitor/*`, `@trapezedev`) — not
shipped to the browser bundle — so runtime exposure is limited. The **`quill`/`react-quill` XSS
is the one that touches user-facing runtime** and deserves a closer look (confirm where rich-text
HTML is rendered and whether output is sanitized). Re-baseline `audit:deps` only after triage.

---

## MEDIUM

### M1. Duplicated dead hook: `useRecalcTimesheet`
Two implementations exist and **neither is referenced**:
- `src/hooks/useRecalcTimesheet.ts` (31 LOC)
- `src/features/timesheets/hooks/useRecalcTimesheet.ts` (26 LOC)

Delete both, or consolidate to one and rewire if recalc-on-demand is still wanted.

### M2. Parallel `TimesheetView` implementations
`src/components/timesheet/TimesheetView.tsx` (1,122 LOC) and
`src/components/technician/TimesheetView.tsx` (980 LOC) are **both live** (used by the
Timesheets page and the technician dashboard respectively) but are separate ~1k-line
implementations of overlapping concepts. Not dead, but a consolidation candidate — divergence
here means timesheet display bugs must be fixed twice.

### M3. `any` proliferation (1,225 occurrences)
286 `as any` + 939 `: any`. There is an active burndown effort (recent commits:
`refactor(types): reduce … any debt`), so this is trending down. Hotspots to target next:

| Count | File |
| ---: | --- |
| 24 | `src/components/jobs/job-details-dialog/tabs/JobDetailsInfoTab.tsx` |
| 23 | `src/components/jobs/cards/job-card-new/JobCardNewView.tsx` |
| 21 | `src/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView.tsx` |
| 16 | `src/components/tasks/TaskList.tsx` |
| 16 | `src/components/festival/mobile/MobileArtistFormSheet.tsx` |
| 15 | `src/pages/JobAssignmentMatrix.tsx` |

---

## LOW

### L1. 2,777 `console.*` calls in app code
1,159 `console.log`, 1,305 `console.error`, 300 `console.warn`, plus debug/info. These are
**stripped in production** (`vite.config.ts` → `esbuild.drop: ['console','debugger']`), so this
is dev-time noise rather than a leak. Consider a thin logger wrapper + a lint `no-console`
(allow `warn`/`error`) to keep new noise out, especially the 1,159 raw `console.log`s.

### L2. File-size budget at baseline (no regression)
45 files exceed the 800-line governance threshold, matching the baseline exactly. Largest
genuine offenders worth splitting opportunistically: `TourOpsManagementHub.tsx` (2,116),
`tourSchedulingService.ts` (1,885), `useConsumosTool.ts` (1,820), `TourDefaultsManager.tsx`
(1,722), `JobCardNew.tsx` (1,438). (`integrations/supabase/types.ts` at 11.5k is generated —
ignore.)

### L3. Type-only dead files
`src/types/flex.ts` (2 LOC) and `src/types/tourScheduling.ts` (350 LOC, part of H1a) are
unreferenced. `src/types/google-maps.d.ts` and `src/types/badging.d.ts` are ambient `.d.ts`
declarations — flagged by the path scan but **likely intentional**; verify they're picked up by
`tsconfig` `include` before touching.

---

## Suggested Order of Operations

1. **Delete dead code in batches** (H1) — biggest LOC win, lowest risk. Start with the
   tour-scheduling cluster and landing dir; typecheck + build between batches.
2. **Reconcile CLAUDE.md** (H2) — remove/rewire the dead hooks and fix the docs in the same PR
   as their deletion.
3. **Triage `react-quill`/`quill` XSS** (H3) — verify sanitization of rendered rich text.
4. **Collapse `useRecalcTimesheet` duplication** (M1).
5. Continue the `any` burndown on the M3 hotspots; add `no-console` lint (L1) to stop new noise.

---

## Appendix A — Dead File Inventory

### A1. App code (90 files, ~14.9k LOC) — safe-to-remove candidates

> `src/components/landing/*` is **excluded** here — unwired but intentionally kept (see A4).

```
src/components/PerformanceMonitor.tsx
src/components/auth/LoginForm.tsx
src/components/auth/signup/SignUpFormActions.tsx
src/components/auth/signup/SignUpFormFields.tsx
src/components/dashboard/DashboardContent.tsx
src/components/dashboard/DepartmentSchedule.tsx
src/components/dashboard/DepartmentTabContent.tsx
src/components/dashboard/JobDocuments.tsx
src/components/dashboard/LightsSchedule.tsx
src/components/dashboard/MyJobTotalsSection.tsx
src/components/dashboard/RealTimeJobsList.tsx
src/components/disponibilidad/AvailabilityActions.tsx
src/components/disponibilidad/PresetManagement.tsx
src/components/equipment/EquipmentCreationManager.tsx
src/components/equipment/JobPresetManager.tsx
src/components/equipment/StockManagement.tsx
src/components/equipment/StockMovementHistory.tsx
src/components/festival/ArtistForm.tsx
src/components/festival/ArtistFormSubmissionDialog.tsx
src/components/festival/FormStatusBadge.tsx
src/components/festival/gear-setup/InfrastructureConfig.tsx
src/components/festival/gear-setup/StageEquipmentConfig.tsx
src/components/flex/FlexElementSelectorDialog.example.tsx
src/components/hoja-de-ruta/components/ModernTemplateManager.tsx
src/components/hoja-de-ruta/dialogs/RoomAssignmentsDialog.tsx
src/components/hoja-de-ruta/sections/VenueLocationSection.tsx
src/components/jobs/JobAssignments.tsx
src/components/layout/LazyNotificationBadge.tsx
src/components/lights/LightsCalendar.tsx
src/components/lights/LightsSchedule.tsx
src/components/matrix/AssignmentMatrix.tsx
src/components/matrix/MatrixPerformanceWrapper.tsx
src/components/matrix/PerformanceIndicator.tsx
src/components/messages/MessageReplyDialog.tsx
src/components/messages/SendDirectMessageButton.tsx
src/components/milestones/JobMilestonesDialog.tsx
src/components/personal/TechnicianTooltip.tsx
src/components/shortcuts/ShortcutableButton.tsx
src/components/soundvision/SoundVisionDatabaseDialog.tsx
src/components/soundvision/SoundVisionMap.tsx
src/components/technician/AssignmentsGrid.tsx
src/components/technician/AssignmentsList.tsx
src/components/technician/MessageManagementDialog.tsx
src/components/technician/MyToursSection.tsx
src/components/technician/TimeSpanSelector.tsx
src/components/timesheet/JobTotalAmounts.tsx
src/components/timesheet/TimesheetSidebarTrigger.tsx
src/components/tours/TourDateForm.tsx
src/components/tours/TourDateInputList.tsx
src/components/tours/TourDateListItem.tsx
src/components/tours/TourDefaultsSimpleForm.tsx
src/components/tours/TourPowerWeightDefaultsDialog.tsx
src/components/tours/scheduling/EnhancedTourTravelPlanner.tsx
src/components/tours/scheduling/TourAccommodationsManager.tsx
src/components/tours/scheduling/TourItineraryBuilder.tsx
src/components/tours/scheduling/TourTimelineView.tsx
src/components/video/VideoCalendar.tsx
src/features/staffing/hooks/useStaffingStatusByDate.ts
src/features/timesheets/hooks/useRecalcTimesheet.ts
src/features/wallboard/components/panels/DocProgressPanel.tsx
src/hooks/useAuth.tsx
src/hooks/useConnectionPool.ts
src/hooks/useEnhancedPerformanceMonitor.ts
src/hooks/useHojaDeRutaTemplates.ts
src/hooks/useJobCard.ts
src/hooks/useJobIntegration.ts
src/hooks/useJobManagement.ts
src/hooks/useLocations.ts
src/hooks/useOptimisticJobManagement.ts
src/hooks/useOptimisticMutation.ts
src/hooks/usePermissions.ts
src/hooks/useRecalcTimesheet.ts
src/hooks/useRefreshOnTabVisibility.ts
src/hooks/useTimesheetApproval.ts
src/hooks/useTimezone.ts
src/hooks/useVirtualizedMatrix.ts
src/lib/performance-optimizer.ts
src/pages/pesos-tool/TableCard.tsx
src/services/tours/createFoldersForDate.ts
src/testPdfExport.ts
src/types/flex.ts
src/types/tourScheduling.ts
src/utils/maps.ts
src/utils/pdf/pdfLibImageUtils.ts
src/utils/pdfMerger.ts
src/utils/taskDocuments.ts
src/utils/tour-scheduling-pdf-enhanced.ts
src/utils/tour-scheduling-pdf.ts
```

### A2. Unused shadcn/ui primitives (12 files) — vendored kit, low priority

```
src/components/ui/aspect-ratio.tsx
src/components/ui/carousel.tsx
src/components/ui/chart.tsx
src/components/ui/date-time-picker.tsx
src/components/ui/drawer.tsx
src/components/ui/input-otp.tsx
src/components/ui/menubar.tsx
src/components/ui/navigation-menu.tsx
src/components/ui/resizable.tsx
src/components/ui/subscription-status.tsx
src/components/ui/timeout-loader.tsx
src/components/ui/toggle-group.tsx
```

### A3. Ambient declarations — verify before removing

```
src/types/google-maps.d.ts   # likely referenced via global/ambient types
src/types/badging.d.ts        # likely referenced via global/ambient types
```

### A4. Unwired but intentionally retained — DO NOT delete

`src/components/landing/` — kept for a future landing page; not currently mounted by any route.
Will need updating before reuse (many newer features aren't represented). Excluded from all
removal totals above.

```
src/components/landing/CallToAction.tsx
src/components/landing/FeatureHighlights.tsx
src/components/landing/HeroSection.tsx
src/components/landing/ModuleShowcase.tsx
src/components/landing/StatsSection.tsx
src/components/landing/TechnicalSpecs.tsx
```

---

## Caveats / Method Notes

- Dead-file detection is **path-based**. It correctly resolves `React.lazy(() => import('@/...'))`
  and static imports, but cannot see a file referenced **only** by a non-TS asset (e.g. a string
  in a config, a JSON manifest, or a runtime `import(variable)`). Before deleting, a quick
  `grep -rn "<basename>"` across the repo (not just `src/`) is recommended for each batch.
- `.d.ts` ambient declarations (A3) are flagged because nothing `import`s them, which is normal
  for global type augmentation — confirm against `tsconfig` `include` rather than deleting blindly.
- All counts taken on branch `claude/codebase-techdebt-audit-5ok4bf` at audit time.
