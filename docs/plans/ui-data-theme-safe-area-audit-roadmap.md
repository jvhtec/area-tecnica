# UI Data, Theme, And Safe-Area Audit Roadmap

Date: 2026-05-21  
Branch synced for audit: `main` at `origin/main` commit `f246c830`  
Production note: no `origin/prod` or `origin/production` branch exists in this checkout. The closest canonical branch found was `origin/main`; prod-like feature/hotfix branches exist but are not a deploy branch.

## Scope

This audit covers desktop and mobile UI across routed pages, job cards, dialogs, forms, sheets, drawers, layout chrome, and the data hooks that feed job surfaces. It focuses on:

- Data inconsistencies and missing data caused by divergent Supabase query shapes.
- Job card and dialog mismatches for assignments, location, documents, folders, tour metadata, and staff roles.
- Theme, color, typography, and hard-coded palette drift.
- Mobile and desktop responsive behavior, especially safe-area clipping in forms, modals, sheets, floating actions, and bottom navigation.

Inventory from the current codebase:

- 61 routed page-like files.
- 109 dialog/form-like component files.
- 170 job/task/assignment-related surfaces.
- 1,742 Supabase `.from(...)` calls and 888 `.select(...)` calls.
- 469 `DialogContent` usages, 44 `SheetContent` usages, and 4 `DrawerContent` usages.
- 3,659 hard-coded color utility/hex references.
- 84 safe-area references, mostly in layout/global utilities rather than modal primitives.

## Surface Map

Primary route groups audited:

- App shell and route guards: `src/App.tsx`, `src/routes/AuthenticatedShell.tsx`, `src/components/layout/Layout.tsx`, `src/components/layout/MobileNavBar.tsx`.
- Department pages: `src/pages/Sound.tsx`, `src/pages/Lights.tsx`, `src/pages/Video.tsx`, `src/pages/Operaciones.tsx`, legacy department pages.
- Job dashboards: `src/pages/Dashboard.tsx`, `src/pages/ProjectManagement.tsx`, `src/pages/JobAssignmentMatrix.tsx`, `src/pages/TechnicianDashboard.tsx`, `src/pages/TechnicianSuperApp.tsx`.
- Tour/festival pages: `src/pages/Tours.tsx`, `src/pages/TourManagement.tsx`, `src/features/tour-ops/TourOpsManagementHub.tsx`, festival management and artist forms.
- Operations/admin pages: expenses, personal/vacation, equipment, logistics, settings, rates, feedback, announcements, incident reports, stage plot, payouts, timesheets, wallboards.

Core job data sources currently diverge:

- General dashboard list: `src/hooks/useJobs.ts`.
- Optimized department/project lists: `src/hooks/useOptimizedJobs.ts`.
- Card-level enrichment: `src/hooks/useOptimizedJobCard.ts`.
- Assignment dialog data: `src/hooks/useJobAssignmentsRealtime.ts`.
- Job details dialog data: `src/components/jobs/JobDetailsDialog.tsx`.
- Matrix data: `src/pages/job-assignment-matrix/utils.ts` and `src/hooks/useOptimizedMatrixData.ts`.
- Technician views: `src/pages/TechnicianDashboard.tsx`, `src/pages/TechnicianSuperApp.tsx`, technician detail modal hooks.

## Critical Findings

### P0: Assignment role mutations are incomplete

`src/components/jobs/JobAssignmentDialog.tsx` can display and update existing `video_role` rows, but its add path only builds sound/lights insert payloads. `src/hooks/useJobAssignmentsRealtime.ts` `buildAssignmentInsertPayload` accepts `soundRole` and `lightsRole` only, and Flex sync only checks sound/lights.

Impact:

- Video assignments added through the dialog can be inserted with no role.
- Production roles are supported by matrix utilities but absent from job card/dialog hooks.
- Counts and role badges can disagree between `JobAssignmentMatrix`, job cards, job details, and technician views.

Roadmap action:

- Introduce a single assignment role model that includes `sound_role`, `lights_role`, `video_role`, and `production_role`.
- Update dialog add/edit/remove flows, Flex sync integration, notifications, card summaries, detail tabs, matrix, and technician views to consume the same role map.

### P0: Job cards omit fields that downstream UI already expects

`src/components/jobs/cards/JobCardAssignments.tsx` and `src/components/jobs/job-details-dialog/tabs/JobDetailsPersonnelTab.tsx` handle `external_technician_name`, but `src/hooks/useJobs.ts`, `src/hooks/useOptimizedJobs.ts`, and `src/components/jobs/JobDetailsDialog.tsx` do not consistently select it. `production_role` is also missing from card/detail query shapes while matrix and notification utilities already understand it.

Impact:

- External technicians can render as `Unknown` / `Desconocido`.
- Production staffing is invisible in job cards and details while present in matrix data.
- Role totals undercount staffed people for production and can undercount external staff.

Roadmap action:

- Define a shared `JobCardQueryShape` and `JobAssignmentRow` contract.
- Select `id`, `technician_id`, all role columns, `status`, source/date fields, `external_technician_name`, and profile display fields everywhere a job card or dialog consumes assignments.
- Add regression tests for internal staff, external staff, video roles, production roles, single-day assignments, and tour-sourced assignments.

### P0: Different job list hooks return different location and tour data

`src/hooks/useJobs.ts` selects `location:locations(name)` while `src/hooks/useOptimizedJobs.ts` selects id, formatted address, latitude, and longitude. Job detail and department modals expect formatted address and coordinates for weather/maps. Tour metadata is also shaped differently between list hooks.

Impact:

- The same job can show only a venue name in one card and full address/map/weather data in another.
- Mobile department modals can fall back to incomplete location data if opened from a surface using the leaner query.
- Tour cancellation/deletion filtering is implemented differently across list hooks.

Roadmap action:

- Promote location and tour metadata to a shared job summary select.
- Keep lightweight and heavyweight views separate only after a typed transform normalizes the public shape.

### P1: Job selectors can miss active jobs and misread tour-date shape

`src/hooks/useJobSelection.ts` filters with `.gte('start_time', today)`, which excludes ongoing multi-day jobs that started before today. It also excludes `Completado` but not `Cancelado`, and treats `tour_date` / `tour` as arrays (`job.tour_date[0]`) even though the named one-to-one relation can arrive as an object.

Impact:

- Linkers/selectors can hide jobs that are active today.
- Canceled jobs can still appear in selectors.
- Tour labels can become undefined depending on PostgREST relationship shape.

Roadmap action:

- Filter selectors with `end_time >= startOfToday` and exclude canceled/deleted jobs/tours.
- Normalize relation payloads with a `oneOrFirst` helper or explicit generated type.

### P1: Assignment dialog display is timesheet-first, not assignment-first

`src/hooks/useJobAssignmentsRealtime.ts` uses timesheets as the display source of truth, then fetches `job_assignments` only for technician IDs found in timesheets. Invited or scheduled assignment rows without timesheets can be invisible in the dialog.

Impact:

- A freshly invited assignment may not show until schedule/timesheet rows exist.
- The card and matrix can show a different assignment state from the assignment dialog.
- Remove operations can delete timesheets and assignments while the UI still relies on stale caches.

Roadmap action:

- Build assignment display from `job_assignments` first, then decorate with timesheet date metadata.
- Add a visible state for invited, confirmed, schedule-only, and timesheet-backed assignments.

### P1: Realtime and optimistic cache keys are inconsistent

`src/hooks/useJobAssignmentsRealtime.ts` uses `queryClient.setQueryData(['jobs'], ...)`, while the actual jobs hook uses `queryKeys.scope('jobs')`. `src/hooks/useAvailableTechnicians.ts` subscribes to availability changes but invalidates a key that omits `assignmentDate`.

Impact:

- Optimistic assignment updates do not reliably update job cards.
- Single-day availability dialogs can stay stale after assignments change.
- Users may see a technician as available after a relevant assignment mutation.

Roadmap action:

- Replace raw query keys with `queryKeys.scope(...)` everywhere.
- Add cache-key guard tests for assignment, availability, optimized jobs, and job details.

### P1: Availability date logic has timezone and empty-filter risks

`src/utils/technicianAvailability.ts` derives date keys with `new Date(...).toISOString().split('T')[0]`, which can shift local date boundaries. It also calls `.in('id', conflictingJobIds)` without guarding empty arrays.

Impact:

- Madrid-local single-day assignments can drift by a day in edge timezones.
- Empty conflict sets can produce fragile Supabase behavior.
- Availability in dialogs can disagree with the matrix for overnight or multi-day jobs.

Roadmap action:

- Use date-only helpers that preserve event timezone/local calendar date.
- Short-circuit empty conflict arrays before Supabase `.in(...)`.
- Test overnight jobs, rehearsal/prep/off/travel days, and single-day assignments.

## Theme And Color Findings

### P1: Hard-coded colors are widespread

The scan found 3,659 hard-coded color utility/hex references. High-density files include:

- `src/components/technician/TechnicianRfTableModal.tsx`
- `src/components/personal/VacationRequestsTabs.tsx`
- `src/components/technician/details-modal/DetailsModalTabs.tsx`
- `src/components/personal/MobilePersonalCalendar.tsx`
- `src/components/department/EnhancedJobDetailsModal.tsx`
- `src/components/dashboard/TechnicianTourRates.tsx`
- `src/components/jobs/JobPayoutOverrideSection.tsx`
- `src/components/incident-reports/TechnicianIncidentReportDialog.tsx`
- `src/pages/TechnicianSuperApp.tsx`

Impact:

- Department, technician, admin, and dashboard surfaces do not share a consistent semantic palette.
- Dark-mode and light-mode behavior depends on individual component choices.
- Mobile technician surfaces feel like a separate app from desktop operations pages.

Roadmap action:

- Introduce semantic role tokens for status, discipline, warning, success, destructive, transport, finance, and staffing.
- Build a department color adapter that maps sound/lights/video/production to tokens instead of inline blue/amber/purple classes.
- Add lint guidance or a small color-token audit script to keep new hard-coded colors out of shared UI.

### P2: Global typography scales with viewport width

`src/index.css` uses viewport-based `clamp(...)` for base typography. That makes text sizing vary by viewport instead of component context.

Impact:

- Compact cards, dialogs, sheets, and dense operational tables can inflate unexpectedly on wide or narrow viewports.
- Button text and card labels are harder to guarantee against overflow.

Roadmap action:

- Replace viewport-scaled base text with fixed semantic text sizes.
- Keep responsive typography only for true page heroes or explicitly designed large display surfaces.

### P2: Wallboard/alien tokens are globally declared

`src/index.css` defines wallboard-specific ALIEN palette variables globally. This is not immediately breaking, but it increases theme vocabulary outside the wallboard domain.

Roadmap action:

- Scope wallboard-specific variables under a wallboard class or route root.

## Safe-Area And Responsive Findings

### P0: Modal and sheet primitives do not include safe-area defaults

`src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx`, and `src/components/ui/drawer.tsx` place content centered or fixed to viewport edges, but do not provide mobile safe-area padding by default. Many callers use `max-h-[90vh]`, `h-[96vh]`, or bottom sheets with scroll content and footers.

High-risk examples:

- `src/components/jobs/JobAssignmentDialog.tsx`
- `src/components/jobs/CreateJobDialog.tsx`
- `src/components/jobs/EditJobDialog.tsx`
- `src/components/jobs/JobDetailsDialog.tsx`
- `src/components/jobs/cards/job-card-new/JobCardNewView.tsx`
- `src/components/tours/TourDateManagementDialog.tsx`
- `src/components/tours/TourRatesManagerDialog.tsx`
- `src/features/tour-ops/TourOpsManagementHub.tsx`
- `src/pages/festival-management/FestivalManagementDialogs.tsx`
- `src/components/feedback/AdminPanel.tsx`
- `src/pages/Expenses.tsx`
- `src/pages/TourManagement.tsx`

Impact:

- Mobile submit/cancel footers can sit behind the home indicator.
- Close buttons can sit too close to notches or browser UI.
- Long forms can trap users between inner scroll containers and page scroll.

Roadmap action:

- Add `MobileDialogContent`, `MobileSheetContent`, or variant props to primitives.
- Standardize modal shells with safe top/bottom padding, footer safe padding, fixed header/footer, and one scroll owner.
- Audit every form modal after the primitive migration.

### P1: Mobile full-screen department behavior is inconsistent

`src/components/layout/Layout.tsx` only treats `/sound` as a mobile full-screen route. `/lights` and `/video` still render inside normal mobile layout while also using fixed bottom create buttons.

Impact:

- Sound mobile hub suppresses chrome; lights/video can overlap mobile nav and fixed actions.
- Department UIs behave differently on mobile despite sharing the same hub pattern.

Roadmap action:

- Decide whether all department hubs are full-screen on mobile.
- If not full-screen, move FABs above `MobileNavBar` with `bottom-[calc(...env(safe-area-inset-bottom))]`.

### P1: Fixed bottom actions and sheets need safe-area review

Risk files include:

- `src/pages/ProjectManagement.tsx` fixed create button at `bottom-20`.
- `src/pages/Lights.tsx` and `src/pages/Video.tsx` mobile fixed create buttons at `bottom-6`.
- `src/pages/TechnicianUnavailability.tsx` fixed bottom action and bottom sheet.
- `src/components/ui/drawer.tsx` fixed bottom drawer.
- `src/components/ui/sheet.tsx` bottom sheet variant.
- `src/components/ui/toast.tsx` and connection/status overlays.

Roadmap action:

- Add a shared `safe-bottom-action` utility and use it for all mobile fixed actions.
- Add bottom padding to bottom sheets/drawers with `max(env(safe-area-inset-bottom), spacing)`.

### P2: Desktop modal heights are inconsistent

Desktop uses a mix of `max-h-[80vh]`, `85vh`, `90vh`, `92vh`, `95vh`, `96vh`, and `md:max-h-none`. Some forms scroll the whole dialog; others scroll an inner area.

Impact:

- Repeated workflows feel different depending on which module owns the dialog.
- Keyboard focus and sticky action behavior varies.

Roadmap action:

- Define modal sizes: compact, form, wide, full-workflow.
- Use one scroll strategy per size.

## Forms And Modals Checklist

Every item below needs desktop and mobile verification after the primitive/data fixes:

- Global create/edit job forms: `GlobalCreateJobDialog`, `CreateJobDialog`, `EditJobDialog`, `JobRequirementsEditor`.
- Job card modals: details, assignments, route sheet, transport requests, logistics, expenses, payout overrides, Flex sync log, document actions.
- Department tools: sound report generator, amplifier, memoria técnica, incident report, sound task dialog, video task dialog, lights task dialogs.
- Project management filters, mobile sheets, and create FAB.
- Matrix dialogs: optimized cell dialogs, assign job, staffing campaigns, reminders, job selectors.
- Tour dialogs: create/edit tour, tour date management, tour assignments, tour defaults, tour rates, documents, logistics, availability requests.
- Festival dialogs: artist management, shift create/edit/copy, gear setup, print options, push to Flex.
- Technician app dialogs/sheets: assignment cards, RF table modal, availability sheet, messages, details modal, unavailability form.
- Admin/operations dialogs: user create/edit/import, feedback admin, expenses, personal/vacation, equipment/subrental/stock movement, milestones, rates approvals.
- Public routes: auth, privacy, artist forms, tour share, wallboards.

## Phased Roadmap

### Phase 0: Verification Harness

Goal: make the audit repeatable.

- Add environment-backed local run instructions for authenticated UI QA.
- Add a small route/modal inventory script that reports routed pages, `DialogContent`, `SheetContent`, hard-coded colors, fixed-bottom elements, and safe-area usage.
- Create desktop and mobile viewport smoke flows for auth, dashboard, department hub, project management, job details, assignment dialog, technician app, tour management, and festival management.
- Acceptance: anyone can run the audit and get a stable report without manually searching the whole codebase.

### Phase 1: Critical Data Contract Fixes

Goal: stop job cards/dialogs from disagreeing.

- Create shared assignment/job summary types and query fragments.
- Include `external_technician_name`, `production_role`, all role columns, status/source/date fields, profile display fields, complete location metadata, and tour status/deleted metadata where relevant.
- Fix `JobAssignmentDialog` and `useJobAssignmentsRealtime` for video and production roles.
- Fix `useJobSelection` active/canceled/tour relation shape.
- Fix availability invalidation keys and timezone-safe date logic.
- Acceptance: job card, job details, assignment dialog, matrix, and technician view show the same staff/location/tour status for a seeded set of jobs.

### Phase 2: Job Card And Dialog Source Unification

Goal: one enriched job state per job, not per surface.

- Move assignment/date/timesheet enrichment to a shared service/hook.
- Standardize folder state, logistics events, transport requests, documents, tasks, and tour date chips.
- Remove per-card query duplication where list-level batching is possible.
- Acceptance: expanding a card, opening details, and opening assignment dialogs does not cause visible data shape changes or stale badges.

### Phase 3: Safe-Area Primitive Migration

Goal: fix mobile clipping at the component-system layer.

- Add safe-area-aware dialog, sheet, drawer, and alert-dialog variants.
- Define modal size variants and a single scroll-owner convention.
- Migrate high-risk forms first: job assignment, create/edit job, job details, tour dates, tour rates, festival management, technician RF modal, feedback admin.
- Acceptance: iPhone-style portrait and landscape viewports can submit/cancel/close every critical form without controls behind notches, browser chrome, or home indicators.

### Phase 4: Department Mobile Shell Consistency

Goal: make sound/lights/video/production behave consistently on mobile.

- Decide full-screen route policy for `/sound`, `/lights`, `/video`, and production/ops equivalents.
- Fix department FAB offsets and bottom-nav interaction.
- Validate `DepartmentMobileHub`, `MobileJobCard`, `EnhancedJobDetailsModal`, technician app, and project management mobile filters.
- Acceptance: no department mobile page has overlapping FAB/nav/content, and shared interactions appear in the same location.

### Phase 5: Theme Token Migration

Goal: reduce palette drift without redesigning the product.

- Build a semantic token map for departments, statuses, finance, transport, warnings, and assignments.
- Replace hard-coded blue/amber/purple/slate clusters in shared surfaces first.
- Scope wallboard-specific tokens.
- Replace viewport-scaled base typography with fixed semantic sizes.
- Acceptance: shared job surfaces look coherent in light/dark mode and new color usage goes through tokens.

### Phase 6: Page-By-Page QA Pass

Goal: finish the in-depth manual audit after data/primitives are stable.

- Desktop viewports: 1440x900 and 1920x1080.
- Mobile viewports: 390x844, 430x932, and landscape 844x390.
- Walk all forms/modals listed in the checklist.
- Record screenshots only for regressions or before/after fixes.
- Acceptance: every routed page and modal has a checked status for data completeness, safe-area behavior, theme consistency, keyboard/focus behavior, empty/loading/error states, and submit/cancel ergonomics.

### Phase 7: Rollout And Monitoring

Goal: ship without breaking live operations.

- Release data-contract fixes first behind focused regression tests.
- Release safe-area primitive changes in batches by workflow.
- Add production monitoring notes for assignment mutations, job card query errors, and Supabase relationship errors.
- Acceptance: no new assignment/job-card data drift reports for one release cycle, and mobile critical workflows remain passable.

## Verification Results

Completed:

- Synced local `main` to `origin/main` at `f246c830`.
- Preserved pre-sync local work in stashes:
  - `pre-sync-main-audit-preserve-tracked-work`
  - `pre-sync-main-audit-preserve-local-work`
- Ran static inventory over routes, dialogs/forms, job surfaces, query usage, color usage, and safe-area usage.
- Installed missing local dependencies with `npm install --package-lock=false` so the current workspace can run Vite without import-resolution failures.
- Implemented the Phase 1 data-contract fixes across job cards, job details, assignment dialogs, matrix, technician views, and selection/availability hooks.
- Implemented the Phase 3/4 safe-area fixes for shared dialog/sheet/drawer primitives plus high-risk job, tour, festival, technician, and department mobile surfaces.
- Reduced hard-coded CTA/FAB palette drift in shared create/edit/availability flows by moving them back to app semantic tokens.
- Fixed dynamic Supabase payload typing issues that blocked strict typecheck.
- Fixed a real task-document data bug where the video task upload path inserted `task_id` instead of `video_task_id`.
- Ran `npm run typecheck`: passed.
- Ran focused regression tests:
  - `src/hooks/__tests__/useJobAssignmentsRealtime.test.ts`
  - `src/utils/__tests__/assignmentNotificationDepartments.test.ts`
  - `src/hooks/__tests__/useOptimizedMatrixData.test.ts`
  - `src/pages/__tests__/jobAssignmentMatrixUtils.test.ts`
  - `src/pages/__tests__/TechnicianSuperApp.test.tsx`
  - `src/pages/__tests__/ProjectManagement.test.tsx`
  - `src/pages/__tests__/TechnicianUnavailability.test.tsx`
- Ran `npm run build`: passed, with existing chunk-size warnings.
- Started built preview on `http://127.0.0.1:4175/` and attempted browser smoke.
- Confirmed browser runtime still blocks before UI render on missing `VITE_SUPABASE_URL`, so authenticated desktop/mobile visual walkthrough still needs an environment-backed run.

Current verification blockers:

- No `.env` exists in the workspace; only `.env.example` and `.env.staging.example` are present.
- Browser boot error: missing `VITE_SUPABASE_URL`.
- `npm install` reported 19 dependency audit findings and a Node engine warning for `eslint-visitor-keys`.

## Acceptance Checklist For Completion

- [x] All job-card and job-dialog queries use the same assignment/location/tour contract.
- [x] External technicians and production roles render correctly in the audited job-card/detail/personnel paths.
- [x] Video and production assignment role mutations are represented in dialog payloads and role helpers.
- [x] Ongoing multi-day jobs appear in selectors; canceled jobs/tours are excluded.
- [x] Availability dialogs refresh correctly for single-day and multi-day assignment changes.
- [x] Dialog/sheet/drawer primitives support mobile safe areas by default.
- [x] High-risk custom p-0/full-height modals use `dvh` and safe-area padding.
- [x] Sound/lights/video mobile route chrome and fixed-action behavior are aligned.
- [x] Hard-coded color usage in shared create/edit/FAB flows is reduced to app semantic tokens.
- [ ] Desktop and mobile visual QA is completed against an environment with Supabase variables.
