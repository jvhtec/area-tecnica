# Codebase Refactoring Plan

**Date**: 2026-02-02
**Branch**: `claude/refactor-codebase-structure-OVVB7`
**Goal**: Improve codebase hygiene, reduce duplication, and make the project more navigable while maintaining full production functionality.

---

## Audit Summary

| Metric | Value |
|--------|-------|
| Total TypeScript files | 955 |
| Total lines of code | 213,652 |
| Component directories | 36 |
| Hook files | 124 (all in flat `src/hooks/`) |
| Page files | 77 |
| Utility files | 61 (root) + 73 (subdirs) |
| Lib files | 39 |
| Test files | 30 |
| PDF/Export files | 38 (12,955 lines) |
| Realtime/Subscription files | 30 |

---

## Critical Issues Identified

### 1. Three Supabase Client Import Paths (HIGH)

The codebase uses **three different import paths** for the Supabase client:

| Path | Usage |
|------|-------|
| `@/lib/supabase` | 251 files (re-exports from supabase-client.ts) |
| `@/integrations/supabase/client` | 104 files (typed wrapper) |
| `@/lib/supabase-client` | 9 files (actual client creation) |

All three ultimately resolve to the same client instance, but the inconsistency creates confusion.

**Fix**: Standardize on a single canonical import. Keep `@/lib/supabase` as the re-export facade (since 251 files already use it) and batch-migrate the other 113 files.

---

### 2. Realtime/Subscription Sprawl (HIGH)

**30 files** across the codebase deal with realtime subscriptions, with massive overlap:

**Subscription managers** (pick one):
- `src/lib/unified-subscription-manager.ts` (666 lines)
- `src/lib/subscription-manager.ts` (11 lines)
- `src/providers/SubscriptionProvider.tsx` (183 lines)

**Realtime hooks** (overlapping responsibilities):
- `useRealtimeSubscription.ts` (184 lines)
- `useRealtimeQuery.ts` (89 lines)
- `useOptimizedRealtime.ts` (125 lines)
- `useOptimizedSubscriptions.ts` (87 lines)
- `useEnhancedRouteSubscriptions.ts` (424 lines)
- `useRouteSubscriptions.ts` (6 lines)
- `useResetSubscriptions.ts` (33 lines)
- `useTableSubscription.ts` (158 lines)
- `useSubscription.ts` (112 lines)
- `useSubscriptionStatus.ts` (99 lines)
- `useMobileRealtimeSubscriptions.ts` (98 lines)

**Domain-specific realtime** (could use shared base):
- `useJobAssignmentsRealtime.ts` (447 lines)
- `useJobsRealtime.ts` (217 lines)
- `useTourDateRealtime.ts` (58 lines)
- `useTourSubscription.ts` (38 lines)
- `useTourRateSubscriptions.ts` (106 lines)
- `useStaffingCampaignRealtime.ts` (120 lines)
- `useMorningSummarySubscription.ts` (81 lines)

**Fix**: Consolidate into a layered architecture:
1. **Core**: One subscription manager + one base hook (`useRealtimeSubscription`)
2. **Domain**: Thin domain hooks that compose the base hook
3. **Remove**: Dead/superseded wrappers (`useRouteSubscriptions`, `subscription-manager.ts`, etc.)

---

### 3. Department-Duplicated Pages (HIGH)

Three near-identical "Consumos" tool pages (~2,907 lines combined):
- `ConsumosTool.tsx` (969 lines) - Sound
- `LightsConsumosTool.tsx` (1,032 lines) - Lights
- `VideoConsumosTool.tsx` (906 lines) - Video

Four near-identical "Pesos" tool pages (~2,096 lines combined):
- `PesosTool.tsx` (870 lines)
- `VideoPesosTool.tsx` (627 lines)
- `LightsPesosTool.tsx` (4 lines - just a redirect)
- `pesos-tool/PesosToolView.tsx` (595 lines)

These share 80%+ of their code with department-specific config differences.

**Fix**: Extract a parameterized `<ConsumosToolBase department={...} config={...} />` and `<PesosToolBase>` component. Each page becomes a thin wrapper (~20 lines) passing department-specific config.

---

### 4. Flat Hooks Directory (MEDIUM-HIGH)

124 hook files dumped into a single `src/hooks/` directory with no organization. Finding the right hook requires scanning 124 files.

**Proposed reorganization**:
```
src/hooks/
├── auth/                  # useAuth, useOptimizedAuth
├── realtime/              # useRealtimeSubscription, useTableSubscription, etc.
├── jobs/                  # useJobCard, useOptimizedJobCard, useJobActions, etc.
├── tours/                 # useTourDocuments, useTourDefaultSets, etc.
├── festivals/             # useFestival, useFestivalDates, etc.
├── timesheets/            # useTimesheets, useShiftTimeCalculator
├── matrix/                # useOptimizedMatrixData, useVirtualizedDateRange
├── push/                  # usePushNotifications, usePushSubscriptionRecovery
├── soundvision/           # useSoundVisionFiles, useSoundVisionFileReviews
├── ui/                    # use-mobile, use-toast, useConnectionStatus
└── index.ts               # Barrel re-exports for backward compatibility
```

**Approach**: Create subdirectories and move files, leaving barrel re-exports at old paths during transition. Remove barrel files once all imports are updated.

---

### 5. "Optimized" / "Enhanced" Naming Debt (MEDIUM-HIGH)

19 files carry `Optimized` or `Enhanced` prefixes, suggesting iterative rewrites where the old version was never removed:

**Optimized (12 files, 5,378 lines)**:
- `OptimizedAssignmentMatrix.tsx` + `optimized-assignment-matrix/OptimizedAssignmentMatrixView.tsx` (overlapping!)
- `useOptimizedAuth.tsx` alongside `useAuth.tsx`
- `useOptimizedJobCard.ts` alongside `useJobCard.ts`
- `useOptimizedJobs.ts`
- `useOptimizedRealtime.ts`
- `optimized-react-query.ts`

**Enhanced (7 files, 3,236 lines)**:
- `enhanced-supabase-client.ts` alongside `supabase-client.ts`
- `enhanced-security-config.ts` alongside `security-config.ts`
- `tour-scheduling-pdf-enhanced.ts` alongside `tour-scheduling-pdf.ts` (regular has 0 importers!)
- `EnhancedRouteSubscriptions` alongside `useRouteSubscriptions`

**Fix**: For each pair, determine which is the active version (check importers), delete the dead one, and rename the survivor to drop the prefix. Example: `tour-scheduling-pdf.ts` has zero importers -> delete it, rename `tour-scheduling-pdf-enhanced.ts` to `tour-scheduling-pdf.ts`.

---

### 6. PDF/Export File Sprawl (MEDIUM)

38 PDF/export files totaling 12,955 lines scattered across:
- `src/utils/` root (16 `*PdfExport.ts` / `*Export.ts` files)
- `src/utils/pdf/` (9 files)
- `src/utils/hoja-de-ruta/pdf/` (4 files)
- `src/utils/stage-plot/` (1 file)
- `src/utils/incident-report/` (1 file)
- `src/lib/tourPdfExport.ts` (why in lib?)
- `src/services/tourRatesExport.ts` (why in services?)

**Fix**: Consolidate all PDF generation into `src/utils/pdf/` with subdirectories by domain:
```
src/utils/pdf/
├── core/               # Shared PDF primitives (headers, footers, styles)
├── festival/           # artistPdf, gearSetupPdf, festivalSchedulePdf, etc.
├── tour/               # tourSchedulingPdf, tourPdf, hojaDeRuta
├── timesheet/          # timesheet-pdf
├── rates/              # rates-pdf-export
├── equipment/          # wiredMicrophoneNeeds, rfIem, amplifierCalc
├── logistics/          # logisticsCalendar
├── personal/           # personalCalendar, vacationRequest
└── reports/            # incidentReport, stagePlot, missingRider
```

---

### 7. `src/utils/` Root is a Dumping Ground (MEDIUM)

61 files in the root of `src/utils/` with no organization. Mix of:
- PDF exports (should be in `pdf/`)
- Flex integration (partially in `flex-folders/`, partially root)
- General utilities (dateUtils, color, throttle)
- Domain-specific logic (technicianAvailability, timesheetAssignments)

**Fix**: Move domain-specific utils into `src/utils/{domain}/` directories. Keep only truly generic utilities (dateUtils, color, throttle, errorUtils) in the root.

---

### 8. `src/lib/` vs `src/utils/` Unclear Boundary (MEDIUM)

39 files in `src/lib/` with no clear distinction from `src/utils/`. Contains:
- Supabase client configuration (belongs here)
- React Query config (belongs here)
- Email templates (`job-payout-email.ts`, `tour-payout-email.ts`)
- Security configs
- Push notification logic
- StreamDeck integration
- Keyboard shortcuts
- Wallboard API
- Connection recovery

**Fix**: Define clear ownership:
- `src/lib/` = Core infrastructure (Supabase client, React Query config, auth, security, network)
- `src/utils/` = Domain utilities (PDF, Flex, formatting, calculations)
- Move email templates, wallboard API, StreamDeck, shortcuts to `src/features/` or `src/services/`

---

### 9. Inconsistent Feature Module Usage (MEDIUM)

`src/features/` exists but is barely used (17 files, 2,351 lines) covering only:
- `activity/` - Activity feed
- `staffing/` - Staffing hooks
- `rates/` - Rates management
- `timesheets/` - Single recalc hook
- `lights/` - Single rigging planner

Meanwhile, the same domains have much larger presence in `src/components/`, `src/hooks/`, `src/utils/`, and `src/pages/`. The feature module pattern was started but never fully adopted.

**Fix**: Choose one pattern and commit. Two options:
- **Option A**: Fully adopt feature modules — move all festival, tour, job, equipment, matrix code into `src/features/{domain}/` with co-located components, hooks, utils, types.
- **Option B**: Abandon feature modules — move the 5 existing feature modules back into the standard directories.

**Recommendation**: Option A is the ideal long-term structure but requires moving ~400 files. Option B is pragmatic and low-risk. **Go with Option B for now** (delete `src/features/`, redistribute files) and gradually adopt feature modules in future iterations.

---

### 10. Orphaned / Dead Code (MEDIUM)

Specific instances found:

| File | Issue |
|------|-------|
| `src/utils/tour-scheduling-pdf.ts` (649 lines) | Zero importers — superseded by enhanced version |
| `src/hooks/useRouteSubscriptions.ts` (6 lines) | Likely superseded by `useEnhancedRouteSubscriptions` |
| `src/lib/subscription-manager.ts` (11 lines) | Superseded by `unified-subscription-manager.ts` |
| `src/hooks/useAuth.tsx` (388 lines) | Likely superseded by `useOptimizedAuth.tsx` |
| `src/lib/security-config.ts` (63 lines) | Likely superseded by `enhanced-security-config.ts` |
| `src/components/jobs/cards/JobCardNew.tsx` (1,125 lines) | "New" suffix suggests old/new transition |
| `src/utils/pdf-generator.ts` (391 lines) | Generic name, may overlap with domain-specific generators |

**Fix**: For each file, verify zero/low usage with grep, then delete.

---

### 11. Oversized Components / Pages (LOW-MEDIUM)

Files exceeding 800 lines that should be split:

| File | Lines | Suggested Split |
|------|-------|----------------|
| `useFestivalManagementVm.ts` | 1,280 | Split into sub-VMs per concern |
| `OptimizedAssignmentMatrix.tsx` | 1,217 | Extract cell rendering, toolbar, filters |
| `JobPayoutTotalsPanel.tsx` | 1,146 | Extract calculation logic into hook |
| `JobCardNew.tsx` | 1,125 | Extract sections into sub-components |
| `AssignJobDialog.tsx` | 1,111 | Extract form sections, validation |
| `TourManagement.tsx` | 1,107 | Extract tab panels into components |
| `TourDateManagementDialog.tsx` | 1,038 | Extract form sections |
| `JobCardActions.tsx` | 1,034 | Extract action groups |
| `TimesheetView.tsx` | 1,011 | Extract table, summary, filters |
| `gearComparisonService.ts` | 1,002 | Extract comparison algorithms |

---

### 12. Connection/Network Layer Duplication (LOW-MEDIUM)

6 files handling connection status:
- `src/lib/connection-recovery-service.ts` (158 lines)
- `src/lib/network-utils.ts` (134 lines)
- `src/hooks/useConnectionStatus.ts` (132 lines)
- `src/hooks/useConnectionPool.ts` (101 lines)
- `src/components/ui/connection-status.tsx` (176 lines)
- `src/components/ui/connection-indicator.tsx` (150 lines)

Two UI components for connection status is unnecessary.

**Fix**: Merge `connection-status.tsx` and `connection-indicator.tsx` into one component. Consolidate `network-utils` and `connection-recovery-service` into a single network module.

---

### 13. Root-Level Component Files (LOW)

12 files in `src/components/` root that should be in subdirectories:
- `AppInit.tsx`, `ErrorBoundary.tsx`, `PerformanceMonitor.tsx` → `src/components/app/`
- `Layout.tsx` → already exists in `src/components/layout/`
- `ProtectedRoute.tsx`, `RequireAuth.tsx` → `src/components/auth/`
- `SplashScreen.tsx`, `VersionDisplay.tsx` → `src/components/app/`
- `CompanyLogoUploader.tsx` → `src/components/settings/`
- `UserManual.tsx` → `src/components/ui/`
- `WakeLockVideo.tsx` → `src/components/ui/`
- `theme-provider.tsx` → `src/providers/`

---

### 14. Missing Barrel Exports / Index Files (LOW)

Only 8 index files in the entire `src/` tree. Most directories lack barrel exports, forcing consumers to know exact file paths.

**Fix**: Add index files to major directories (`hooks/`, `utils/`, `lib/`, `types/`) that re-export public API.

---

### 15. Test Coverage Gaps (LOW)

Only 30 test files for 955 source files (~3% coverage). Test distribution is skewed toward Flex integration (13 test files).

**Fix**: Not part of this refactor, but flag for future work. Priority test targets:
- Auth flows (`useOptimizedAuth`)
- Timesheet calculations
- Assignment cascade logic
- Realtime subscription management

---

## Execution Plan

### Phase 1: Dead Code & Deduplication (Low Risk)

**Estimated scope**: ~15 files deleted/consolidated

1. **Delete confirmed dead files**:
   - `src/utils/tour-scheduling-pdf.ts` (0 importers)
   - `src/lib/subscription-manager.ts` (superseded)
   - `src/hooks/useRouteSubscriptions.ts` (superseded)
   - Verify and delete other candidates from Issue #10

2. **Rename "Optimized"/"Enhanced" survivors**:
   - Remove `Optimized`/`Enhanced` prefix from files where the old version is dead
   - Update all import paths

3. **Unify Supabase import path**:
   - Standardize all 364 files to use `@/lib/supabase`
   - Keep `@/integrations/supabase/client` as the typed version for files needing `Database` types
   - Delete `@/lib/supabase-client` direct imports (route through `@/lib/supabase`)

4. **Merge connection UI components**:
   - Consolidate `connection-status.tsx` and `connection-indicator.tsx`

### Phase 2: Structural Reorganization (Medium Risk)

**Estimated scope**: ~200 file moves, all import paths updated

5. **Reorganize `src/hooks/`** into subdirectories with barrel re-exports
6. **Consolidate PDF exports** into `src/utils/pdf/{domain}/`
7. **Clean up `src/utils/` root** — move domain files into subdirectories
8. **Move root-level components** into appropriate subdirectories
9. **Clarify `src/lib/` boundary** — move non-infrastructure files out

### Phase 3: Deduplication & Consolidation (Medium-High Risk)

**Estimated scope**: ~5,000 lines reduced

10. **Extract parameterized ConsumosTool base** — collapse 3 pages into 1 + 3 thin wrappers
11. **Extract parameterized PesosTool base** — collapse pages into 1 + wrappers
12. **Consolidate realtime subscription layer** into core + domain hooks
13. **Resolve `src/features/` ambiguity** — redistribute 5 feature modules into standard directories

### Phase 4: Component Decomposition (Lower Priority)

14. **Split oversized components** (>800 lines) into sub-components
15. **Add barrel exports** to major directories
16. **Update CLAUDE.md** to reflect new structure

---

## Risk Mitigation

- **Every phase gets its own PR** — no mixing structural changes with behavior changes
- **Run `npm run build` after every batch of moves** — catch broken imports immediately
- **Run `npm test` after every phase** — ensure no test regressions
- **Phase 1 and 2 are pure renames/moves** — zero behavior change, lowest risk
- **Phase 3 requires careful extraction** — test manually in dev before merging
- **Phase 4 is optional** — only if bandwidth allows

---

## Files Affected Per Phase

### Phase 1 (~15 files)
- Delete: 3-5 dead files
- Rename: 5-7 files (drop Optimized/Enhanced prefix)
- Modify imports: ~113 files (Supabase path standardization)
- Merge: 2 connection components

### Phase 2 (~200 files)
- Move: 124 hook files into subdirectories
- Move: ~25 PDF/export files
- Move: ~20 utils files
- Move: 12 root component files
- Add: ~10 barrel index files
- Update imports across entire codebase

### Phase 3 (~30 files)
- Refactor: 3 ConsumosTool pages → 1 base + 3 wrappers
- Refactor: 3 PesosTool pages → 1 base + 3 wrappers
- Consolidate: ~15 realtime files → ~5 files
- Redistribute: 17 feature module files

### Phase 4 (~20 files)
- Split: 10 oversized components
- Add: 10 barrel export files

---

## Success Criteria

After all phases:
- No file in `src/hooks/` root (all in subdirectories)
- No file in `src/utils/` root except truly generic utilities (<10 files)
- Single Supabase import path used consistently
- No "Optimized"/"Enhanced" prefixed files (just the canonical version)
- No department-duplicated pages (parameterized base components instead)
- Realtime subscription layer: max 10 files (down from 30)
- PDF exports: all under `src/utils/pdf/`
- `npm run build` passes
- `npm test` passes
- All existing functionality works identically in production
