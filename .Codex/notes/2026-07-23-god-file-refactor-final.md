# Final god-file refactor batch

## Summary

Completed the last 12 authored modules above the repository's 800-line
governance threshold. The campaign now stands at 43 retired files and zero
remaining file-size baseline entries. The work is structural: stable public
entrypoints remain available while query, mutation, state, rendering, PDF, and
normalization responsibilities move into focused modules.

The refactored modules and their directly adjacent seams contain no explicit
`any`. Supabase JSON/policy values, dynamic table results, job-card inputs, and
jsPDF AutoTable options are normalized into typed contracts at their
boundaries.

## Key files and responsibility boundaries

- Tour Ops:
  - `src/features/tour-ops/TourOpsManagementHub.tsx`
  - `TourOpsDateOverview.tsx`, `TourOpsManagementPanels.tsx`,
    `TourOpsEditorDialogs.tsx`, and `tourOpsManagementUtils.ts`
  - `tourSchedulingService.ts` remains a compatibility entrypoint over
    `tourSchedulingModel.ts`, `tourSchedulingNormalizers.ts`,
    `tourSchedulingQueries.ts`, `tourSchedulingMutations.ts`, and
    `tourGuestLinkService.ts`
- Consumos:
  - `useConsumosTool.ts` composes `useConsumosBuilder.ts`,
    `useConsumosTourData.ts`, and `consumosStoredPower.ts`
- Tour defaults:
  - `TourDefaultsManager.tsx` composes `TourDepartmentDefaults.tsx`,
    `src/features/tour-ops/useTourDefaultsPdfExports.ts`, and
    `tourDefaultsManagerSupport.ts`
- Job card:
  - `JobCardNew.tsx` composes `JobCardNewView.tsx`,
    `src/features/jobs/job-card-new/useJobCardTransport.tsx`,
    `useJobCardFolderActions.ts`, and the shared `jobCardNewTypes.ts` contract
- Staffing and matrix:
  - `StaffingCampaignPanel.tsx` delegates rendering to
    `StaffingCampaignView.tsx`
  - `AssignJobDialog.tsx` delegates presentation and conflict adaptation to
    `AssignJobDialogView.tsx` and `assignJobConflicts.ts`
  - `TechnicianRow.tsx` delegates editing to `TechnicianRowEditForm.tsx`
- Timesheets:
  - the management `TimesheetView.tsx` composes
    `useTimesheetViewModel.ts`
  - the technician `TimesheetView.tsx` composes
    `TechnicianTimesheetPrompts.tsx`
- Rates:
  - `rates-pdf-export.ts` is a stable barrel over three dedicated PDF
    generators and shared support
  - `PayoutsDueFortnights.tsx` uses `src/features/rates/payoutsDueData.ts`

## Decisions

- Preserve existing component/service entrypoints so route and caller churn
  stays minimal.
- Extract by responsibility rather than by arbitrary line ranges.
- Treat externally shaped JSON as `unknown` until a narrow normalizer proves
  the domain shape.
- Keep assignment conflict detection behind the existing
  `checkTimeConflictEnhanced` behavior.
- Select `response_time` with the existing assignment row before preserving a
  confirmed response. The old code read the field through an `any` cast
  without fetching it; the typed query and critical-path fixture now agree on
  the actual payload.
- Keep Flex folder creation behind `createAllFoldersForJob`; the job-card hook
  only coordinates UI state and messages.
- Keep timesheet views as consumers of existing server-owned calculation and
  mutation paths; the split does not add client-side payroll calculations.
- Keep direct data-layer ownership out of extracted component views. Job-card
  data hooks and the tour-default PDF data hook live under `src/features/`.
- Format assignment and staffing instants with `formatInJobTimezone` so the
  matrix split preserves Madrid semantics and does not add scheduling-domain
  `new Date(...)` debt.
- Keep extracted effect/callback dependencies explicit. The lint-warning
  ratchet recognizes warnings by file, so moving an old effect without
  correcting its dependency list would create new debt even when total
  warnings fall.
- Correct the local-folder success label so it distinguishes custom and
  default structures from the parsed structure rather than from an object's
  truthiness.
- Regenerate the mobile type-floor baseline because extraction relocates four
  existing occurrences while reducing the repository total from 266 to 248.

## Focused coverage

- `consumosStoredPower.test.ts` covers stored snapshot normalization.
- `useJobCardFolderActions.test.ts` covers local-folder structure parsing.
- `tourDefaultsManagerSupport.test.ts` covers default-table normalization.
- Existing focused suites cover tour scheduling, assignment dialog/conflicts,
  technician timesheet behavior, and rates PDF exports.

## Validation

- `npm run lint`: pass with 0 errors and 361 grandfathered warnings.
- `npm run typecheck`: pass.
- `npm run governance`: pass. File size is 0/0, mobile type floor is 248/248,
  source boundaries add no new violations, and governed lint warnings improve
  from 1,901 to 1,737.
- Focused Vitest selection: 7 files and 22 tests pass.
- `npm run test:critical`: pass, including the assignment, staffing, Flex, and
  timesheet invariant suites plus the coverage gate.
- `npm run test:run`: pass.
- `npm run test:e2e`: pass with 22 Chromium tests and 3 guarded mobile
  screenshot cases skipped.
- `npm run build`: pass (5,929 modules transformed).
- `npm run budget:bundle`: pass. JS gzip total is 3.06 MB (+48.8 kB versus the
  performance baseline), and every relative/absolute asset budget remains
  below its ceiling.
- `git diff --check`: pass.

The read-only critical-invariant review found no bypasses. The batch changes no
Edge Function, migration, RLS policy, database grant, or authorization test.

## Gotchas

- The file-size baseline is executable policy, not the inventory itself. With
  the campaign complete, `scripts/governance/file-size-baseline.json` must
  retain an empty `files` object.
- The mobile type-floor gate is per-file as well as total. Moving markup
  requires regenerating the per-file distribution only when the overall debt
  does not increase.
- The Tour Ops PDF adapter uses jsPDF's direct `getCurrentPageInfo()` method;
  its narrower `internal` declaration does not expose that API.
- Source-boundary governance is fingerprint-based. Moving a legacy import or
  date construction to a new filename is a new violation; ownership and date
  semantics must be corrected instead of regenerating that baseline.

## Follow-up

- The next planned campaign is repository-wide explicit-`any` debt. Existing
  untouched modules remain in scope, but new refactor modules should continue
  to enter that campaign at zero.
- No new repository-wide operating rule was discovered, so `AGENTS.md` does
  not need an update for this batch.
