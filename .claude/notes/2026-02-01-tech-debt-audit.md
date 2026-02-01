# Tech Debt Audit — 2026-02-01

Comprehensive technical debt scan of `src/` using parallel Explore agents across 7 categories.

---

## Executive Summary

| Category | Severity | Items Found |
|----------|----------|-------------|
| Missing error handling | Critical/High | 31 issues (4 critical) |
| Pattern inconsistencies | High | 60 files w/ direct Supabase, 68 unsafe dates |
| Code duplication | High | ~1,100+ redundant lines across 10 patterns |
| Type safety gaps | Medium | 463 `as any` casts, 120+ missing return types |
| Large files (>300 lines) | Medium | 208 files, top 30 exceed 836 lines |
| Dead code | Medium | 8 unused exports, 4 duplicate `hexToRgb` implementations |
| TODO/FIXME comments | Low-Critical | 6 items (1 critical: security audit logging) |

---

## CRITICAL — Bugs Waiting to Happen

### C1. Fire-and-Forget Supabase Delete Operations (Silent Data Loss)

- `src/components/disponibilidad/StockCreationManager.tsx:363-364` — Two deletes (`global_stock_entries`, `stock_movements`) awaited but never error-checked. If either fails, subsequent equipment delete still executes → data inconsistency.
- `src/components/logistics/TransportRequestDialog.tsx:88` — Delete on `transport_request_items` with no error check → orphaned items.
- `src/components/tours/tour-date-management/createFoldersForDate.ts:104,147,213,243,272` — Multiple `flex_folders` inserts in loop without error checks → corrupted Flex folder hierarchy.
- `src/components/jobs/cards/JobCardNew.tsx:564` — Empty catch block `catch { }` silently swallows transport_requests update failure.

### C2. Security Audit Logging Not Persisted

- `src/lib/security-audit.ts:30` — TODO: "Implement secure audit log storage." Events only go to console.log with no persistent storage for compliance.

### C3. Truss Model Placeholder Values (Safety-Critical)

- `src/data/trussModels.ts:4` — TODO: "Fill real values from manufacturer datasheets." Placeholder values used in rigging calculations for load capacity and deflection analysis.

---

## HIGH — Significant Quality Issues

### H1. Direct Supabase Calls in 60 Components

Convention: Supabase queries should be wrapped in custom hooks under `src/hooks/`. **60 component files** bypass this pattern with direct `supabase.from()` calls.

Key offenders:
- `src/components/messages/DirectMessageDialog.tsx:51-87`
- `src/components/festival/ArtistForm.tsx:106-209`
- `src/components/dashboard/CalendarSection.tsx:97-100`
- `src/components/disponibilidad/DisponibilidadCalendar.tsx:44-72`
- All messaging, logistics, festival, and equipment components

### H2. Unsafe Date Handling — 68 Files

Direct `new Date()` usage without Europe/Madrid timezone awareness.

Examples:
- `src/components/video/VideoTaskDialog.tsx:243`
- `src/components/lights/LightsTaskDialog.tsx:243`
- `src/components/milestones/MilestoneGanttChart.tsx:151,174`
- `src/components/personal/PersonalCalendar.tsx:38`
- `src/components/sound/ReportGenerator.tsx:262`

Should use: `utcToZonedTime(new Date(), 'Europe/Madrid')` from `date-fns-tz`.

### H3. Three Duplicate Jobs Query Hooks

- `src/hooks/useJobs.ts:20-120`
- `src/hooks/useOptimizedJobs.ts:30-179`
- `src/hooks/useJobsRealtime.ts:19-143`

Nearly identical Supabase query structure. Consolidate into `createJobsQueryBuilder()`.

### H4. Duplicate Rate Approval Hooks

- `src/hooks/useJobRatesApproval.ts` (entire file)
- `src/hooks/useTourRatesApproval.ts` (entire file)

~100% identical structure. Create generic `createApprovalStatusHook<T>(tableName, queryKey)`.

### H5. Mutation + Toast + Invalidation Boilerplate

623 toast occurrences across 171 files. 76 dialog components repeat the same `useMutation({ onSuccess: toast.success, onError: toast.error })` pattern.

Create `createMutationWithToast<T>()` wrapper.

### H6. Permission Checks Duplicated Inline

114 inline `['admin', 'management'].includes(userRole)` checks across components. `src/utils/permissions.ts` has 8 permission functions, but many components reinvent them.

Create `usePermissions()` hook.

### H7. 9 Unhandled Operation Failures

- `src/hooks/hoja-de-ruta/useHojaDeRutaData.ts:158-287` — 7 sequential DB operations without error handling
- `src/components/jobs/EditJobDialog.tsx:218-230` — Delete + insert on `job_departments` without error checks
- `src/components/festival/ArtistFormLinksDialog.tsx:93-109` — Silent failure on artist form links
- `src/components/profile/ProfilePictureUpload.tsx:92` — Storage removal without error check
- `src/components/profile/ProfileSkillsEditor.tsx:29-37` — `Promise.all` with weak recovery

---

## MEDIUM — Code Quality & Maintainability

### M1. `as any` Casts — 463 Instances

Top offenders:
- `src/components/jobs/job-details-dialog/tabs/JobDetailsInfoTab.tsx` — 15+ casts
- `src/hooks/useOptimizedMatrixData.ts` — 12 casts
- `src/components/matrix/OptimizedAssignmentMatrix.tsx` — 10+ casts
- `src/pages/wallboard/WallboardDisplay.tsx` — 9 casts
- `src/services/tourRatesExport.ts` — 7 casts
- `src/utils/tour-scheduling-pdf-enhanced.ts` — 8 casts

Primary causes: jsPDF `autoTable` access, DB query results, API responses, UI library props.

### M2. `@ts-nocheck` on 2 Files

- `src/utils/tour-scheduling-pdf.ts:1`
- `src/utils/tour-scheduling-pdf-enhanced.ts:1`

### M3. Missing Return Types — ~120+ Exported Functions

Affects most hooks in `src/hooks/` and utility functions in `src/utils/`. Makes API surfaces implicit.

### M4. Inconsistent Toast Pattern

Two competing patterns:
- `useToast` from `@/hooks/use-toast` — 73 files (object pattern)
- `toast` from `sonner` — 37 files (function pattern)

Standardize on one.

### M5. Inconsistent Query Key Patterns

- `createQueryKey` factory — 94+ files (correct pattern)
- Inline string arrays — 20+ files (causes cache invalidation issues)

Examples: `src/components/dashboard/DepartmentSchedule.tsx:40`, `src/components/disponibilidad/DisponibilidadCalendar.tsx:42`.

### M6. 208 Files Over 300 Lines

Top 10 by size:
1. `src/utils/flex-folders/folders.ts` — 1,401 lines
2. `src/pages/festival-management/useFestivalManagementVm.ts` — 1,280 lines (god hook, 40+ state variables)
3. `src/utils/rates-pdf-export.ts` — 1,238 lines
4. `src/components/matrix/OptimizedAssignmentMatrix.tsx` — 1,217 lines
5. `src/components/jobs/JobPayoutTotalsPanel.tsx` — 1,146 lines
6. `src/components/jobs/cards/JobCardNew.tsx` — 1,123 lines
7. `src/components/matrix/AssignJobDialog.tsx` — 1,111 lines
8. `src/pages/TourManagement.tsx` — 1,107 lines
9. `src/components/tours/TourDateManagementDialog.tsx` — 1,038 lines
10. `src/components/jobs/cards/JobCardActions.tsx` — 1,034 lines

### M7. Duplicate PDF Generation Setup

16 PDF exporters repeat the same pattern: load libs → create doc → set header (125,1,1) → load logo → generate → return blob. ~200+ duplicated lines.

Create `PdfBuilder` class/factory.

### M8. 4x `hexToRgb()` Implementations

- `src/utils/color.ts:4` (primary)
- `src/components/dashboard/CalendarSection.tsx:238` (local copy)
- `src/utils/personalCalendarPdfExport.ts:59` (local copy)
- `src/utils/stage-plot/pdf-generator.ts:73` (local copy)

### M9. `useEffect` + `useState` Instead of `useQuery` (3 Files)

- `src/components/jobs/CrewCallLinker.tsx`
- `src/components/profile/ProfileSkillsEditor.tsx`
- `src/components/schedule/ScheduleBuilder.tsx`

### M10. 36 Files with Commented-Out Code Blocks

Including:
- `src/components/jobs/JobAssignmentDialog.tsx`
- `src/components/matrix/DateHeader.tsx`
- `src/pages/TechnicianSuperApp.tsx`
- `src/lib/optimized-react-query.ts`
- `src/lib/api-config.ts`

---

## LOW — Minor Cleanup

### L1. Dead Code / Unused Exports

- `src/utils/roleCategory.ts:6` — `getCategoryFromRole()` never imported
- `src/lib/enhanced-security-config.ts:111,160,248` — `validatePasswordStrength()`, `validateFileUpload()`, `validateEnvironmentSecurity()` never used
- `src/lib/enhanced-security-config.ts:74,90` — `enhancedSanitizeInput()`, `validateSecureEmail()` defined but never called
- `src/utils/color.ts:28,35` — `relativeLuminance()`, `contrastRatio()` exported but only used internally

### L2. `Function` Type in Google Maps Stubs

- `src/types/google-maps.d.ts:13,110,129` — Uses `Function` instead of `(...args: any[]) => void`

### L3. `@ts-ignore` / `@ts-expect-error` Directives — 6 Instances

All justified with comments:
- `src/test/setup.ts:5`
- `src/lib/tourPdfExport.ts:272`
- `src/hooks/useLgScreensaverBlock.ts:7`
- `src/components/auth/SignUpForm.tsx:78`
- `src/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView.tsx:305`
- `src/pages/Auth.tsx:247`

### L4. Unimplemented Features

- `src/lib/shortcuts/global-shortcuts.ts:85` — Ctrl+K global search registered but logs "not yet implemented"
- `src/components/tours/scheduling/TourTravelPlanner.tsx:115` — Save travel segments TODO (not persisted to DB)
- `src/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView.tsx:91` — Reserved Stream Deck integration

### L5. `tourLogoUtils.ts` is a Pointless Re-export

- `src/utils/pdf/tourLogoUtils.ts` — Single-line re-export of `logoUtils.ts`. Delete and import directly.

### L6. Unused Imports

- `src/lib/enhanced-security-config.ts:7` — Imports `validateFolderName` and `sanitizeInput` but only uses `VALIDATION_PATTERNS`

---

## Recommended Remediation Priority

### Immediate (Safety/Data Integrity)
1. Add error handling to all fire-and-forget Supabase operations (C1, H7)
2. Replace truss model placeholder values with real manufacturer data (C3)
3. Implement persistent security audit logging (C2)

### Sprint 1 (High-Impact Patterns)
4. Create `usePermissions()` hook and replace 114 inline checks (H6)
5. Create `createMutationWithToast<T>()` to reduce 76 dialog boilerplate (H5)
6. Consolidate 3 job query hooks into shared builder (H3)
7. Standardize toast pattern to one library (M4)

### Sprint 2 (Code Quality)
8. Migrate 60 components from direct Supabase to custom hooks (H1)
9. Fix 68 files with unsafe `new Date()` to use timezone-aware dates (H2)
10. Migrate 20+ inline query keys to `createQueryKey` factory (M5)
11. Create `PdfBuilder` utility to deduplicate 16 exporters (M7)

### Sprint 3 (Cleanup)
12. Split top 10 god files (>1000 lines) into focused modules (M6)
13. Reduce `as any` usage in top offender files (M1)
14. Remove dead code and consolidate duplicate `hexToRgb` (L1, M8)
15. Clean up 36 files with commented-out code blocks (M10)

### Backlog
16. Add return types to 120+ exported functions (M3)
17. Create base tool page to deduplicate ConsumosTool variants
18. Convert 3 remaining useEffect data fetchers to useQuery (M9)
19. Consolidate realtime subscription hooks
