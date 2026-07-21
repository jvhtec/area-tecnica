# God-file refactor checklist

Updated: 2026-07-22

This is the live paydown list for authored source modules above the governance
threshold of 800 lines. The executable source of truth is
`npm run governance:filesize`; tests and generated Supabase types are excluded by
that gate.

## Progress

| Metric | Count |
| --- | ---: |
| Starting count on `origin/main` (`d57be9df`) | 43 |
| Completed in the current batch | 15 |
| Remaining after this batch | 28 |
| Target | 0 |

## Definition of done for one item

- The original authored module is at or below 800 lines.
- The split follows a real responsibility boundary; line shuffling does not count.
- Every new authored module is also below 800 lines.
- Extracted pure logic receives focused tests, and moved UI keeps a characterization
  test when callback or interaction wiring could drift.
- `npm run governance:filesize`, targeted tests, typecheck, lint, and build pass.
- The file-size baseline is regenerated so a completed file cannot grow back to its
  former ceiling.

## Completed

- [x] `src/components/jobs/JobAssignmentDialog.tsx` — 810 → 497 LOC. Removed
  unreachable add/save state and the unused technician-availability query; moved
  typed display/date formatters into a tested module.
- [x] `src/components/technician/TechnicianRfTableModal.tsx` — 819 → 419 LOC.
  Moved the artist RF card and inventory summarization into focused, tested modules.
- [x] `src/components/jobs/cards/job-card-new/JobCardNewView.tsx` — 822 → 722
  LOC. Moved job, tour, and rider document rendering into a characterized component.
- [x] `src/components/sound/AmplifierTool.tsx` — 832 → 729 LOC. Moved
  amplifier sizing and rack aggregation into a pure, tested calculation module.
- [x] `src/pages/GlobalTasks.tsx` — 898 → 795 LOC. Moved user-query/date
  support and task filtering/statistics into focused, tested modules.
- [x] `src/components/festival/PushToFlexPullsheetDialog.tsx` — 835 → 794
  LOC. Moved pullsheet domain types and selection rules into a tested model.
- [x] `src/components/feedback/AdminPanel.tsx` — 844 → 798 LOC. Moved
  feedback domain types and persisted-state presentation mappings into a tested model.
- [x] `src/components/disponibilidad/StockCreationManager.tsx` — 875 → 782
  LOC. Moved the advanced Flex-backed equipment editor into a controlled component.
- [x] `src/components/dashboard/CalendarSection.tsx` — 864 → 782 LOC.
  Moved calendar-grid derivation, filtering, and export-range selection into tested helpers.
- [x] `src/hooks/useGlobalTaskMutations.ts` — 841 → 713 LOC. Moved dynamic
  table typing, document-path rules, and shared mutation support into a tested module.
- [x] `src/components/jobs/JobExpensesPanel.tsx` — 882 → 780 LOC. Moved
  expense domain types, workflow display metadata, and name formatting into a tested model.
- [x] `src/services/flexWorkOrders.ts` — 803 → 796 LOC. Moved immutable
  Flex work-order identifiers and technician labeling into a tested configuration module.
- [x] `src/utils/artistTablePdfExport.ts` — 889 → 773 LOC. Moved artist
  infrastructure, microphone, and mixed-provider formatting into a tested PDF helper.
- [x] `src/utils/artistPdfExport.ts` — 913 → 788 LOC. Moved the public PDF
  data contracts into a dedicated type module and removed unused summary helpers.
- [x] `src/utils/rfIemTablePdfExport.ts` — 893 → 768 LOC. Moved RF/IEM
  contracts and festival-day grouping into focused modules while preserving public exports.

## Remaining

- [ ] `src/features/tour-ops/TourOpsManagementHub.tsx` — 2,116 LOC
- [ ] `src/features/tour-ops/tourSchedulingService.ts` — 1,885 LOC
- [ ] `src/features/technical-tools/power/consumos/useConsumosTool.ts` — 1,820 LOC
- [ ] `src/components/tours/TourDefaultsManager.tsx` — 1,706 LOC
- [ ] `src/components/jobs/cards/JobCardNew.tsx` — 1,438 LOC
- [ ] `src/routes/app-route-manifest.tsx` — 1,410 LOC
- [ ] `src/components/tours/TourDateManagementDialog.tsx` — 1,342 LOC
- [ ] `src/components/matrix/StaffingCampaignPanel.tsx` — 1,299 LOC
- [ ] `src/components/soundvision/SoundVisionInteractiveMap.tsx` — 1,293 LOC
- [ ] `src/utils/rates-pdf-export.ts` — 1,244 LOC
- [ ] `src/components/matrix/AssignJobDialog.tsx` — 1,238 LOC
- [ ] `src/components/festival/pdf/PrintOptionsDialog.tsx` — 1,224 LOC
- [ ] `src/components/festival/ArtistTable.tsx` — 1,221 LOC
- [ ] `src/pages/PesosTool.tsx` — 1,130 LOC
- [ ] `src/components/timesheet/TimesheetView.tsx` — 1,122 LOC
- [ ] `src/components/festival/ArtistRequirementsForm.tsx` — 1,119 LOC
- [ ] `src/pages/PayoutsDueFortnights.tsx` — 1,112 LOC
- [ ] `src/pages/TourManagement.tsx` — 1,086 LOC
- [ ] `src/utils/pdf/festivalPdfGenerator.ts` — 1,076 LOC
- [ ] `src/features/technical-tools/power/consumos/ConsumosToolPage.tsx` — 1,058 LOC
- [ ] `src/components/hoja-de-ruta/ModernHojaDeRuta.tsx` — 992 LOC
- [ ] `src/components/technician/details-modal/DetailsModalTabs.tsx` — 991 LOC
- [ ] `src/components/technician/TimesheetView.tsx` — 980 LOC
- [ ] `src/features/wallboard/WallboardDisplay.tsx` — 930 LOC
- [ ] `src/lib/unified-subscription-manager.ts` — 930 LOC
- [ ] `src/components/matrix/TechnicianRow.tsx` — 925 LOC
- [ ] `src/components/department/EnhancedJobDetailsModal.tsx` — 911 LOC
- [ ] `src/hooks/useOptimizedAuth.tsx` — 842 LOC

## Batching guidance

Continue in coherent tranches: group several near-threshold files when each has an
obvious extraction seam, but give modules above roughly 1,200 lines their own domain
plan and characterization coverage before state, query, command, and view
responsibilities are separated. Assignment, staffing, timesheet, and Flex work must
also pass the repository's critical-invariant review.
