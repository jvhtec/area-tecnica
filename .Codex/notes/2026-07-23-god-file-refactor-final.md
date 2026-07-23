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
  - `src/features/staffing/storedCampaignPolicy.ts` owns typed normalization
    of persisted campaign JSON, including legacy camelCase recovery
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
- Preserve the staffing scorer's persisted snake_case contract in both
  directions. The loader accepts canonical `penalty_strength` /
  `max_rate_penalty` values and normalizes camelCase values written by older
  clients; `buildCampaignPolicy` always writes the canonical keys consumed by
  the Edge Function and SQL scorer.

## Focused coverage

- `consumosStoredPower.test.ts` covers stored snapshot normalization.
- `useJobCardFolderActions.test.ts` covers local-folder structure parsing.
- `tourDefaultsManagerSupport.test.ts` covers default-table normalization.
- Existing focused suites cover tour scheduling, assignment dialog/conflicts,
  technician timesheet behavior, and rates PDF exports.
- `storedCampaignPolicy.test.ts` protects canonical rate-penalty loading and
  camelCase compatibility; `crewingProfiles.test.ts` asserts canonical
  snake_case policy serialization.
- `assignJobConflicts.test.ts` protects Europe/Madrid date keys for multi-day
  conflict checks.
- `tourOpsManagementUtils.test.ts` and the staffing lifecycle suite protect
  Spanish labels for extracted status/source/state mappings.

## Review hardening

The final review pass addressed all eight actionable CodeRabbit threads and
all three summary nitpicks:

- Multi-day assignment conflict checks now use `formatMadridDateKey`.
- The extracted timesheet view-model no longer emits render/bulk debug logs or
  user email/ID values to the browser console.
- The job-card Flex push uses promise rejection handling instead of a
  synchronous `try/catch` around a discarded promise.
- Tour Ops guest-link expiry uses Europe/Madrid formatting.
- Extracted staffing, Tour Ops, package-default, technician-edit, and Consumos
  user-facing copy is Spanish, including persisted campaign/role status labels.
- `AssignJobDialogView` imports its contracts directly from the typed source
  modules, avoiding a type-only cycle and a duplicate conflict shape.
- The tour-rates summary PDF reuses the shared multiplier-display helper.
- Staffing policy load/save preserves the server's canonical snake_case
  rate-penalty contract and remains compatible with older camelCase writes.

## Deliberate high-risk second read

The repository-mandated second read was performed independently after the
review-fix batch, with money paths and critical invariants reviewed before the
remaining extraction wiring.

- Runtime-equivalence checks against `origin/main` found the payout query
  pipeline, rate-quote PDF, and job-payout PDF logic unchanged. The tour-rate
  summary differs only by the reviewed shared multiplier-display helper.
- The read found one semantic regression in
  `tourSchedulingNormalizers.ts`: the extracted comparison normalizer no
  longer trimmed surrounding whitespace. That could make otherwise equivalent
  travel or accommodation rows look unsynchronized and permit duplicate sync
  writes.
- A negative-control test first demonstrated the defect by receiving
  `"  bcn airport  "` instead of `"bcn airport"`. Restoring `trim()` made the
  test pass, and the assertion remains in
  `tourSchedulingService.test.ts`.
- Staffing lifecycle transitions still go through `staffing-orchestrator`;
  assignment removal still prefers the established cascade service; Flex
  folder creation still delegates to `createAllFoldersForJob` and preserves
  parent-before-child ordering; and timesheet payout calculation remains
  server-owned. No Edge Function exposure surface changed.
- A TypeScript no-unused audit found 404 copied declarations/imports in the
  changed files. Organizing the extracted modules removed the dead imports;
  the same audit now reports zero findings in changed files.
- The refactored production modules and new typed seams still contain zero
  explicit `any` matches and no TODO/FIXME/HACK markers. Two pre-existing
  `any[]` mock annotations remain in `tests/assignments/critical-paths.test.ts`
  and are tracked as low-priority test debt rather than production debt.

## Validation

- `npm run lint`: pass with 0 errors and 361 grandfathered warnings.
- `npm run typecheck`: pass.
- Changed-file TypeScript no-unused audit: 0 findings after cleanup
  (404 before cleanup).
- `npm run governance`: pass. File size is 0/0, mobile type floor is 248/248,
  source boundaries add no new violations, and governed lint warnings improve
  from 1,901 to 1,737.
- Deliberate second-read selection: 12 files and 46 tests pass, covering the
  Tour Ops whitespace regression, money PDFs, assignment flows, staffing
  policy, Flex folder parsing, Consumos, Tour defaults, and technician
  timesheets.
- Focused Vitest selection: 7 files and 22 tests pass.
- Review hardening selection: 2 staffing policy files and 8 tests pass,
  including snake_case load/write compatibility.
- Complete review selection: 8 files and 23 tests pass, including Madrid
  conflict dates, Spanish status labels, assignment flow, policy
  normalization, Flex folder parsing, and rates PDFs.
- `npm run test:critical`: pass, including the assignment, staffing, Flex, and
  timesheet invariant suites plus the coverage gate.
- `npm run test:run`: pass.
- Staffing recommendations Playwright smoke: 1 Chromium test passes.
- `npm run test:e2e`: pass with 22 Chromium tests and 3 guarded mobile
  screenshot cases skipped.
- `npm run build`: pass (5,930 modules transformed).
- `npm run budget:bundle`: pass. JS gzip total is 3.06 MB (+49.4 kB versus the
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
- Replace the two `any[]` query-key annotations in
  `tests/assignments/critical-paths.test.ts` during the test-debt portion of
  that campaign.
- Several successfully split modules remain close to the 800-line ceiling
  (`TimesheetView.tsx` at 798 lines, `useConsumosBuilder.ts` at 785, and the
  technician `TimesheetView.tsx` at 783). Governance prevents regression;
  future feature work should extend their existing responsibility boundaries
  instead of growing those files.
- No new repository-wide operating rule was discovered, so `AGENTS.md` does
  not need an update for this batch.
