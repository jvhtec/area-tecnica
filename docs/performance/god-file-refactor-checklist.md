# God-file refactor checklist

Updated: 2026-07-23

This is the live paydown list for authored application modules above the
`800`-line governance threshold. The executable source of truth is
`npm run governance:filesize`; tests and generated Supabase types follow the
exclusions in `scripts/governance/check-file-size-budget.mjs`.

## Progress

| Measurement | Count |
| --- | ---: |
| Starting count on `origin/main` (`d57be9df`) | 43 |
| Retired by PR #877 | 15 |
| Retired by PR #878 | 16 |
| Retired by the final batch | 12 |
| Current branch | 0 |
| Target | 0 |

The three batches retire all 43 modules that were above the authored-source
threshold when the campaign started. `npm run governance:filesize` now reports
zero files over 800 lines, and the regenerated file-size baseline has an empty
`files` object. The baseline is a ratchet ceiling, not a separate debt
inventory.

## Definition of done for one item

- The original authored module is at or below 800 lines.
- The split follows a real responsibility boundary; line shuffling does not count.
- Every new authored module is also below 800 lines.
- Extracted pure logic receives focused tests, and moved UI keeps a
  characterization test when callback or interaction wiring could drift.
- Refactored and directly adjacent seams contain no explicit `any`; external
  JSON and library boundaries are normalized or narrowed into domain types.
- `npm run governance:filesize`, targeted tests, typecheck, lint, and build pass.
- The file-size baseline is regenerated so a completed file cannot grow back to
  its former ceiling.

## Completed in PR #877

- [x] `src/components/jobs/JobAssignmentDialog.tsx` — 810 → 497 LOC
- [x] `src/components/technician/TechnicianRfTableModal.tsx` — 819 → 419 LOC
- [x] `src/components/jobs/cards/job-card-new/JobCardNewView.tsx` — 822 → 722 LOC
- [x] `src/components/sound/AmplifierTool.tsx` — 832 → 729 LOC
- [x] `src/pages/GlobalTasks.tsx` — 898 → 795 LOC
- [x] `src/components/festival/PushToFlexPullsheetDialog.tsx` — 835 → 794 LOC
- [x] `src/components/feedback/AdminPanel.tsx` — 844 → 798 LOC
- [x] `src/components/disponibilidad/StockCreationManager.tsx` — 875 → 782 LOC
- [x] `src/components/dashboard/CalendarSection.tsx` — 864 → 782 LOC
- [x] `src/hooks/useGlobalTaskMutations.ts` — 841 → 713 LOC
- [x] `src/components/jobs/JobExpensesPanel.tsx` — 882 → 780 LOC
- [x] `src/services/flexWorkOrders.ts` — 803 → 796 LOC
- [x] `src/utils/artistTablePdfExport.ts` — 889 → 773 LOC
- [x] `src/utils/artistPdfExport.ts` — 913 → 788 LOC
- [x] `src/utils/rfIemTablePdfExport.ts` — 893 → 768 LOC

## Completed in PR #878

- [x] `src/routes/app-route-manifest.tsx` — 1,410 → 468 LOC
- [x] `src/components/tours/TourDateManagementDialog.tsx` — 1,342 → 660 LOC
- [x] `src/components/soundvision/SoundVisionInteractiveMap.tsx` — 1,293 → 696 LOC
- [x] `src/components/festival/pdf/PrintOptionsDialog.tsx` — 1,224 → 622 LOC
- [x] `src/components/festival/ArtistTable.tsx` — 1,221 → 792 LOC
- [x] `src/pages/PesosTool.tsx` — 1,130 → 774 LOC
- [x] `src/components/festival/ArtistRequirementsForm.tsx` — 1,119 → 757 LOC
- [x] `src/pages/TourManagement.tsx` — 1,086 → 788 LOC
- [x] `src/utils/pdf/festivalPdfGenerator.ts` — 1,076 → 796 LOC
- [x] `src/features/technical-tools/power/consumos/ConsumosToolPage.tsx` — 1,054 → 660 LOC
- [x] `src/components/hoja-de-ruta/ModernHojaDeRuta.tsx` — 992 → 656 LOC
- [x] `src/components/technician/details-modal/DetailsModalTabs.tsx` — 991 → 771 LOC
- [x] `src/features/wallboard/WallboardDisplay.tsx` — 930 → 787 LOC
- [x] `src/lib/unified-subscription-manager.ts` — 930 → 796 LOC
- [x] `src/components/department/EnhancedJobDetailsModal.tsx` — 911 → 799 LOC
- [x] `src/hooks/useOptimizedAuth.tsx` — 842 → 758 LOC

Review hardening for this batch also bounds festival stage-plot URL signing to
the PDF worker limit and keeps job-document actions inside full-width,
touch-sized mobile rows in both Job Details and Project Management (including
job, tour, and rider documents). These paths have focused regression coverage.

## Completed in the final batch

- [x] `src/features/tour-ops/TourOpsManagementHub.tsx` — 2,116 → 695 LOC.
  Date overview, management panels, editor dialogs, and view helpers now have
  focused modules under `src/features/tour-ops/`.
- [x] `src/features/tour-ops/tourSchedulingService.ts` — 1,885 → 25 LOC.
  The compatibility entrypoint delegates to typed scheduling models,
  normalizers, queries, mutations, and guest-link operations.
- [x] `src/features/technical-tools/power/consumos/useConsumosTool.ts` — 1,820
  → 758 LOC. Builder state, tour/default loading, and stored-power
  normalization are separate, typed hooks/helpers.
- [x] `src/components/tours/TourDefaultsManager.tsx` — 1,706 → 598 LOC.
  Department tables, PDF export orchestration, and normalization helpers are
  split from manager state; the data-owning PDF hook lives in
  `src/features/tour-ops/`.
- [x] `src/components/jobs/cards/JobCardNew.tsx` — 1,438 → 686 LOC. The view,
  transport behavior, folder actions, and shared job-card contract are
  separated; data-owning hooks/contracts live under
  `src/features/jobs/job-card-new/`, and the details-only path uses the same
  typed contract.
- [x] `src/components/matrix/StaffingCampaignPanel.tsx` — 1,299 → 655 LOC.
  Campaign rendering and its view contract are separated from campaign
  orchestration. Persisted policy normalization now lives in a fully typed
  feature helper that preserves the snake_case rate-penalty contract consumed
  by the staffing Edge Function and SQL scorer while accepting camelCase
  values written by older clients.
- [x] `src/utils/rates-pdf-export.ts` — 1,244 → 4 LOC. The stable entrypoint
  re-exports dedicated quote, tour-summary, and job-payout generators plus
  shared typed PDF support.
- [x] `src/components/matrix/AssignJobDialog.tsx` — 1,238 → 776 LOC. The dialog
  view, domain contract, and conflict adapter are explicit modules. The typed
  existing-assignment query now fetches the `response_time` value that its
  confirmed-status preservation path already consumes.
- [x] `src/components/timesheet/TimesheetView.tsx` — 1,122 → 800 LOC.
  Query/mutation/form orchestration is owned by a typed view-model hook.
- [x] `src/pages/PayoutsDueFortnights.tsx` — 1,112 → 597 LOC. Payout query
  normalization and grouping live in `src/features/rates/payoutsDueData.ts`.
- [x] `src/components/technician/TimesheetView.tsx` — 980 → 791 LOC. Prompt
  dialogs and their timesheet contract are extracted from the main view.
- [x] `src/components/matrix/TechnicianRow.tsx` — 925 → 775 LOC. Inline editing
  now lives in a dedicated, typed edit form.

Focused coverage protects stored Consumos snapshots, job-card folder
normalization, tour-default table conversion, tour scheduling, assignment
conflicts, technician timesheet behavior, and rates PDF exports. The final
typing sweep also removes the directly adjacent `any` boundaries in the Tour
Ops PDF adapter and details-only job card. Review hardening adds policy
normalization and serialization coverage so reopening and saving a staffing
campaign cannot reset its configured rate penalty. It also protects Madrid
multi-day conflict keys and Spanish staffing/Tour Ops state labels.

The final review pass resolved all eight actionable threads and all three
nitpicks: async Flex push failures are handled, timesheet PII/debug logs are
removed, guest-link expiry and assignment keys use Madrid semantics, extracted
UI copy is Spanish, assignment view types come from their source modules, and
the rates summary PDF uses the shared multiplier-display helper.

## Ratchets after completion

- File size: `43 → 0` authored modules above 800 lines; the baseline is empty.
- Mobile type floor: `266 → 248` sub-12px utility occurrences. Four existing
  occurrences moved with Tour Ops/defaults view extraction, while the batch
  removed 18 occurrences overall; the per-file baseline was regenerated to
  preserve the lower total.
- Explicit `any`: zero in the refactored modules and their new typed seams.
  Supabase JSON, policy metadata, and jsPDF AutoTable inputs are narrowed at
  their boundaries instead of leaking untyped values through UI code.
- Source boundaries: extracted UI views do not introduce direct
  `dataLayerClient` ownership, and scheduling displays use the existing
  Madrid-aware formatting helper instead of constructing dates inline. The
  legacy counts improve from `213 → 196` UI data-layer imports and `107 → 83`
  scheduling-domain date constructions.
- Lint-warning ratchet: `1,901 → 1,737`. Extracted effects and callbacks list
  their complete dependencies rather than transferring old
  `react-hooks/exhaustive-deps` exceptions into new files.

## Remaining queue

None. Re-run `npm run governance:filesize` when adding or materially expanding
authored modules; CI will reject a new file over 800 lines or any non-empty
regression to the baseline.

## Final verification

The final batch passed:

- `npm run lint` — 0 errors; 361 grandfathered warnings.
- `npm run typecheck`.
- `npm run governance` — including empty file-size baseline, mobile type floor,
  source boundaries, lint-warning ratchet, Edge exposure, SQL grants, CSP,
  action pins, migration ordering, and dependency audit.
- Seven focused suites — 22 tests covering the extracted logic and the highest
  risk moved UI paths.
- Two staffing policy suites — 8 tests, including canonical snake_case
  serialization and persisted-policy compatibility.
- Complete review selection — 8 files / 23 tests, including Madrid conflict
  dates, translated status labels, assignment flow, Flex folder parsing, and
  rates PDFs.
- `npm run test:critical`, including assignment cascade, staffing
  orchestration, Flex deletion/creation, and timesheet critical paths.
- `npm run test:run`.
- Staffing recommendations Playwright smoke — 1 Chromium test passed.
- `npm run test:e2e` — 22 Chromium smoke tests passed and 3 optional
  mobile-screenshot cases were skipped by their configured guard.
- `npm run build`.
- `npm run budget:bundle` — all budgets pass; total JS gzip is 3.06 MB
  (`+48.8 kB`, below the 3.32 MB relative ceiling), and the largest entry
  script is 107.7 kB gzip.
- `git diff --check`.

The critical-invariant audit found no bypass: assignment removal still prefers
the existing cascade service, campaign lifecycle transitions still use the
staffing orchestrator, Flex creation still delegates to
`createAllFoldersForJob`, and the two timesheet views still delegate writes and
server-owned payout calculation to the existing hooks/services. No Edge
Function, migration, RLS, or database authorization surface changed.
