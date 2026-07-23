# God-file refactor checklist

Updated: 2026-07-22

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
| Current combined branch | 12 |
| Target | 0 |

PR #877 and PR #878 touch different source modules. After rebasing #878 onto
the merged #877, `npm run governance:filesize` reports 12 files over the
threshold. The governance baseline should match that live count after each
completed batch; it is a ratchet ceiling, not a separate debt inventory.

## Definition of done for one item

- The original authored module is at or below 800 lines.
- The split follows a real responsibility boundary; line shuffling does not count.
- Every new authored module is also below 800 lines.
- Extracted pure logic receives focused tests, and moved UI keeps a
  characterization test when callback or interaction wiring could drift.
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

## Remaining queue

Line counts are from the rebased PR #878 branch on 2026-07-22. Re-measure before
choosing a batch because parallel PRs can change the ordering.

- [ ] `src/features/tour-ops/TourOpsManagementHub.tsx` — 2,116 LOC
- [ ] `src/features/tour-ops/tourSchedulingService.ts` — 1,885 LOC
- [ ] `src/features/technical-tools/power/consumos/useConsumosTool.ts` — 1,820 LOC
- [ ] `src/components/tours/TourDefaultsManager.tsx` — 1,706 LOC
- [ ] `src/components/jobs/cards/JobCardNew.tsx` — 1,438 LOC
- [ ] `src/components/matrix/StaffingCampaignPanel.tsx` — 1,299 LOC
- [ ] `src/utils/rates-pdf-export.ts` — 1,244 LOC
- [ ] `src/components/matrix/AssignJobDialog.tsx` — 1,238 LOC
- [ ] `src/components/timesheet/TimesheetView.tsx` — 1,122 LOC
- [ ] `src/pages/PayoutsDueFortnights.tsx` — 1,112 LOC
- [ ] `src/components/technician/TimesheetView.tsx` — 980 LOC
- [ ] `src/components/matrix/TechnicianRow.tsx` — 925 LOC

## Batching guidance

Continue in coherent tranches: group near-threshold files when each has an
obvious extraction seam, but give modules above roughly 1,200 lines their own
domain plan and characterization coverage before separating state, query,
command, and view responsibilities. Assignment, staffing, timesheet, and Flex
work must also pass the repository's critical-invariant review.
