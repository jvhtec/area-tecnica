# Codebase Audit — Dead Code & Bug Hunt — 2026-07-02

## Scope and method

- **Branch audited:** `claude/codebase-audit-bugs-4eu29h` (off `main` @ `5624e72`)
- **Focus:** This audit deliberately complements `docs/CODEBASE_AUDIT_2026-07-01.md`
  (security / CI / dependencies). It covers three things that audit did not:
  1. **Dead code inventory** — files, exports, and edge functions nothing references
  2. **Bug hunt** — concrete logic defects with file/line and failure scenarios
  3. **Per-feature improvements** — at least one actionable improvement per feature
- **Method:**
  - Custom import-graph analysis over all 1,328 TS/TSX files under `src/`
    (resolves `@/` aliases, relative imports, dynamic `import()`, `export … from`;
    verified no `import.meta.glob` exists so the graph is complete)
  - `ts-prune -p tsconfig.app.json` for unused exports within live files
  - Edge-function reference sweep across `src/`, other functions, and all SQL
    migrations (including `cron.schedule` / `functions/v1/` invocations)
  - Manual review of core date/timezone, availability, permission, and money paths
  - `npm run typecheck` re-verified green on this branch

---

## Executive summary

- **~18,100 lines across 114 source files are never imported by anything** —
  including whole superseded subsystems (tour scheduling suite, legacy auth
  provider, legacy assignment matrix, the entire `landing/` folder) and 7 more
  files kept alive only by their own tests.
- **One high-severity bug class confirmed:** UTC-vs-Madrid calendar-date
  derivation. The repo *has* correct helpers (`formatMadridDateKey`,
  `normalizeDateKey`) and even a comment in `AssignJobDialog.tsx:184` warning
  about exactly this — but the **availability/conflict engine, timesheet
  auto-creation, Flex work-order dates, and matrix metrics** still derive dates
  via `toISOString()`, which is wrong for any timestamp in the 00:00–01:59
  Madrid window (00:00–00:59 in winter). Live-event jobs routinely start or end
  after midnight, so this is not a theoretical edge.
- **12 deployed edge functions have no caller** in app code, other functions, or
  DB migrations; at least 2 (`recalc-timesheet-amount`, `generate-sv-report`)
  appear fully dead end-to-end.
- Several duplicated module pairs exist where one twin is dead
  (`useRecalcTimesheet` ×2, `useTourCreation` ×2, `LightsSchedule` ×2,
  `testPdfExport.js`/`.ts`).

None of the bugs below block the build (typecheck/lint/tests are green); they are
runtime-correctness issues.

---

## Part 1 — Bug findings

### BUG-1 (High): Conflict detection & availability use UTC dates, DB uses Madrid dates

**Files:** `src/utils/technicianAvailability.ts:99–103, 180, 229–230, 289–290`

The database derives timesheet dates in **local job time**:

```sql
-- supabase/migrations/20260329120100_add_prep_day_timesheet_support.sql:241
(j.start_time AT TIME ZONE COALESCE(NULLIF(j.timezone, ''), 'Europe/Madrid'))::date
```

But the client-side availability engine derives the comparison window in **UTC**:

```ts
const jobStartDate = new Date(jobStartTime).toISOString().split('T')[0];
```

**Failure scenario:** A job starts 2026-07-11 at 00:30 Madrid (CEST = UTC+2), i.e.
`2026-07-10T22:30:00Z`. The DB timesheet row has `date = '2026-07-11'`; the client
computes `'2026-07-10'` and queries the wrong day. Consequences:

- `getAvailableTechniciansForJob()` misses real double-bookings → the matrix
  offers technicians who are already booked (and can flag free ones as busy).
- `checkTechnicianAvailability()` / `getTechnicianAvailabilityDetails()`
  (used by `AssignJobDialog` and `OptimizedAssignmentMatrix`) same off-by-one.

**Fix:** replace every `toISOString().split('T')[0]` in this file with
`formatMadridDateKey()` from `src/utils/timezoneUtils.ts` (or
`normalizeDateKey()` from `src/utils/assignmentWorkDates.ts`, which already
handles per-job timezones correctly). Note `AssignJobDialog.tsx:184` already
carries the comment *"IMPORTANT: use local yyyy-MM-dd, not toISOString (which is
UTC)"* — the fix pattern is accepted in the codebase; it just never reached this
module.

### BUG-2 (High): Timesheet auto-creation generates UTC date keys

**File:** `src/hooks/useTimesheets.ts:195–203`

```ts
const startDate = new Date(job.start_time);
const endDate = new Date(job.end_time);
for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
  allDates.push(d.toISOString().split('T')[0]);
}
```

Same class as BUG-1, but this one **writes data**: for a job starting after
midnight Madrid time, timesheets are created for the *previous* calendar day.
Downstream effects: `job_date_types` filtering on line 206–211 compares these UTC
keys against Madrid-local `date` values (so an "off"/"travel" day can fail to be
excluded), and `compute_timesheet_hours()` then computes hours for the wrong day.
Fix identically with `formatMadridDateKey()` iterating via
`addMadridCalendarDays()`.

### BUG-3 (Medium): Flex work orders get a UTC planned start date

**File:** `src/services/flexWorkOrders.ts:17, 38, 567`

```ts
return date.toISOString().slice(0, 10);   // formatDate()
```

`plannedStartDate` sent to Flex is the UTC date of `job.start_time` — one day
early for after-midnight Madrid starts. Work orders in Flex then live under the
wrong date. Same one-line fix.

### BUG-4 (Medium): Matrix technician metrics use UTC month/year boundaries

**File:** `src/components/matrix/TechnicianRow.tsx:97–102`

```ts
const mStart = startOfMonth(now).toISOString().split('T')[0];
```

`startOfMonth(now)` is local midnight (e.g. June 1 00:00 CEST) which serializes to
`2026-05-31` in UTC — every month/year window in the technician tooltip metrics
(jobs this month / this year / last year) silently includes the last day of the
previous period and can double-count boundary timesheets. Use
`formatMadridDateKey(startOfMonth(now))`.

### BUG-5 (Low): Morning summary "today" flips to yesterday between 00:00–01:59

**File:** `src/pages/MorningSummary.tsx:71`

```ts
const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
```

Anyone opening the morning summary shortly after midnight Madrid time gets
*yesterday's* summary. Low impact (it's a morning page), same one-line fix.

### BUG-6 (Low): Unreachable duplicate branch in work-date resolution

**File:** `src/utils/assignmentWorkDates.ts:190–192`

The second `if (timesheetDates.length > 0)` can never execute — the identical
check already returned at line 178. Harmless today, but it masks intent and will
confuse the next edit to the fallback ordering. Delete the dead branch.

### BUG-7 (Low): `findClosestFestival` compares dates in the viewer's local zone

**File:** `src/utils/dateUtils.ts:19–30`

`new Date(festival.start_time); festivalDate.setHours(0,0,0,0)` normalizes in the
*browser's* timezone, not the festival's. For users outside CET (tour crew abroad)
the "closest festival" pagination can pick the wrong festival by one day. Minor,
but trivially fixed with `formatMadridDateKey` comparison.

### BUG-8 (Risk enabler): React hooks lint rules effectively off

**File:** `eslint.config.js:105`

`react-hooks/rules-of-hooks` is set to `"warn"` (warnings don't fail CI's lint
gate) and `react-hooks/exhaustive-deps` is **not enabled at all**. In a codebase
with 141 hooks, stale-closure/dependency bugs are currently invisible. Recommend:
`rules-of-hooks: "error"` immediately; enable `exhaustive-deps: "warn"` and burn
down the warnings folder-by-folder.

### Observations (not defects, worth knowing)

- `src/utils/permissions.ts:9` hardcodes a user-specific magic role `'oscar'`
  into `DASHBOARD_ALLOWED_ROLES` (and `canViewProfilePushControls`). Works, but
  it's an account name acting as an authorization class — replace with a real
  role or profile flag.
- `canSubmitTechnicianIncidentReports` (`permissions.ts:121–122`) allows only
  `technician`, excluding `house_tech` — every sibling helper treats the two as
  interchangeable (`isTechnicianRole`). Verify this asymmetry is intentional.
- `src/hooks/useTimesheets.ts` logs whole job/assignment objects on ~15
  `console.log` lines. Stripped in prod builds, but it makes dev consoles and
  test output noisy; `src/` has 2,763 console statements total.

---

## Part 2 — Dead code inventory

### 2.1 Files never imported by anything (114 files, ~18,100 lines)

Method: full import-graph resolution from all entry points; `src/main.tsx`,
`src/App.tsx`, config files, and `tests/` included as roots. No
`import.meta.glob` exists, and route pages are reached through
`app-route-manifest.tsx` lazy imports, which the graph resolves — so these files
are genuinely unreachable.

**Whole dead subsystems (highest-value deletions):**

| Subsystem | Files | Lines | Notes |
| --- | --- | --- | --- |
| Tour scheduling suite | `components/tours/scheduling/{EnhancedTourTravelPlanner,TourAccommodationsManager,TourItineraryBuilder,TourTimelineView}.tsx`, `utils/tour-scheduling-pdf.ts`, `utils/tour-scheduling-pdf-enhanced.ts`, `types/tourScheduling.ts` | ~3,820 | Superseded by `features/tour-ops`. The four components import only each other. |
| Landing page | `components/landing/*` (6 files) | ~1,250 | No route references any of them. |
| Legacy auth | `hooks/useAuth.tsx`, `components/auth/LoginForm.tsx`, `components/auth/signup/{SignUpFormFields,SignUpFormActions}.tsx` | ~670 | Superseded by `useOptimizedAuth` / current Auth page. |
| Legacy matrix | `components/matrix/{AssignmentMatrix,MatrixPerformanceWrapper,PerformanceIndicator}.tsx` | ~600 | Superseded by `OptimizedAssignmentMatrix`. |
| Legacy job hooks | `hooks/{useJobCard,useJobManagement,useOptimisticJobManagement,useOptimisticMutation,useJobIntegration,useEntityQueries}.ts` | ~1,070 | The "optimistic job management" pattern documented in CLAUDE.md is not actually wired anywhere. |
| Perf-monitoring stack | `components/PerformanceMonitor.tsx`, `hooks/useEnhancedPerformanceMonitor.ts`, `hooks/useConnectionPool.ts`, `lib/performance-optimizer.ts` | ~500 | |
| Equipment legacy managers | `components/equipment/{EquipmentCreationManager,JobPresetManager,StockManagement,StockMovementHistory}.tsx` | ~1,390 | |
| Dashboard leftovers | `components/dashboard/{DashboardContent,DepartmentSchedule,DepartmentTabContent,JobDocuments,LightsSchedule,MyJobTotalsSection,RealTimeJobsList}.tsx` | ~900 | |

**Full list (remaining single files):**

```
src/components/auth/… src/components/dashboard/… (listed above)
src/components/disponibilidad/AvailabilityActions.tsx        (106)
src/components/disponibilidad/PresetManagement.tsx           (186)
src/components/festival/ArtistForm.tsx                       (513)  superseded by ArtistManagementForm
src/components/festival/ArtistFormSubmissionDialog.tsx       (184)
src/components/festival/FestivalManagement.tsx               (63)   name-collides with pages/FestivalManagement
src/components/festival/FormStatusBadge.tsx                  (32)
src/components/festival/gear-setup/InfrastructureConfig.tsx  (70)
src/components/festival/gear-setup/StageEquipmentConfig.tsx  (56)
src/components/flex/FlexElementSelectorDialog.example.tsx    (154)  example code shipped in src/
src/components/hoja-de-ruta/components/ModernTemplateManager.tsx (198)
src/components/hoja-de-ruta/dialogs/RoomAssignmentsDialog.tsx (152)
src/components/hoja-de-ruta/sections/VenueLocationSection.tsx (80)
src/components/jobs/JobAssignments.tsx                       (236)
src/components/jobs/cards/index.ts                           (8)
src/components/layout/LazyNotificationBadge.tsx              (29)
src/components/lights/LightsCalendar.tsx                     (26)
src/components/lights/LightsSchedule.tsx                     (57)
src/components/messages/MessageReplyDialog.tsx               (124)
src/components/messages/SendDirectMessageButton.tsx          (37)
src/components/milestones/JobMilestonesDialog.tsx            (224)
src/components/personal/TechnicianTooltip.tsx                (204)
src/components/shortcuts/ShortcutableButton.tsx              (126)
src/components/soundvision/SoundVisionDatabaseDialog.tsx     (94)
src/components/soundvision/SoundVisionMap.tsx                (268)  superseded by SoundVisionInteractiveMap
src/components/technician/AssignmentsGrid.tsx                (43)
src/components/technician/AssignmentsList.tsx                (46)
src/components/technician/MessageManagementDialog.tsx        (51)
src/components/technician/MyToursSection.tsx                 (162)
src/components/technician/TimeSpanSelector.tsx               (45)
src/components/timesheet/JobTotalAmounts.tsx                 (146)
src/components/timesheet/TimesheetSidebarTrigger.tsx         (33)
src/components/tours/TourDateForm.tsx                        (139)
src/components/tours/TourDateInputList.tsx                   (47)
src/components/tours/TourDateListItem.tsx                    (196)
src/components/tours/TourDefaultsSimpleForm.tsx              (276)
src/components/tours/TourPowerWeightDefaultsDialog.tsx       (46)
src/components/tours/useTourCreation.ts                      (122)  duplicate #1
src/components/video/VideoCalendar.tsx                       (26)
src/features/staffing/hooks/useStaffingStatusByDate.ts       (164)
src/features/timesheets/hooks/useRecalcTimesheet.ts          (23)   duplicate #1
src/features/wallboard/components/panels/DocProgressPanel.tsx (90)
src/hooks/hoja-de-ruta/index.ts                              (5)
src/hooks/tours/useTourCreation.ts                           (108)  duplicate #2
src/hooks/useHojaDeRutaTemplates.ts                          (86)
src/hooks/useLocations.ts                                    (19)
src/hooks/usePermissions.ts                                  (56)
src/hooks/useRecalcTimesheet.ts                              (32)   duplicate #2
src/hooks/useRefreshOnTabVisibility.ts                       (61)
src/hooks/useTimesheetApproval.ts                            (64)
src/hooks/useTimezone.ts                                     (22)
src/pages/pesos-tool/TableCard.tsx                           (126)
src/services/tours/createFoldersForDate.ts                   (327)
src/testPdfExport.js + src/testPdfExport.ts                  (64)   same file twice, at src root
src/types/flex.ts                                            (3)
src/utils/hoja-de-ruta/pdf/helpers.ts                        (7)
src/utils/maps.ts                                            (9)
src/utils/pdf-generator.ts                                   (407)
src/utils/pdf/pdfLibImageUtils.ts                            (70)
src/utils/pdfMerger.ts                                       (12)
src/utils/taskDocuments.ts                                   (41)
```

**shadcn/ui primitives never used** (keep-or-delete is a policy call; they are
template boilerplate, not app code): `aspect-ratio`, `carousel` (261), `chart`
(366), `date-time-picker`, `drawer`, `input-otp`, `menubar` (235),
`navigation-menu`, `resizable`, `sidebar/index`, `subscription-status`,
`timeout-loader`, `toggle-group` — ~1,640 lines.

### 2.2 Files kept alive only by their own tests (7)

The production code is dead but its tests still run in CI — CI time spent
verifying code no user can reach:

```
src/components/personal/VacationManagement.tsx   (153)
src/components/project-management/apiService.ts  (265)
src/hooks/useEntityQueries.ts                    (121)
src/hooks/useTourDateFlexFolders.ts              (197)
src/lib/flex/urlBuilder.ts                       (87)
src/utils/micListTransform.ts                    (196)  ← its test is in test:critical!
src/utils/powerReportReadiness.ts                (80)
```

`micListTransform` deserves a decision: either the transform should be used by
the artist/gear pipeline again, or it and its *critical-path* test should go.

### 2.3 Unused exports in live files

`ts-prune` reports **359 exported symbols with no importer** (after excluding
"used in module"). Notable clusters, hand-verified:

- `src/lib/react-query.ts`: `setupReactQuery`, `createQueryClient`,
  `createEntityQueryOptions`, `applyOptimisticUpdate`, `invalidateRelatedQueries`
  — the "standardized invalidation" API documented in CLAUDE.md is largely
  unconsumed.
- `src/lib/security-config.ts` vs `src/lib/enhanced-security-config.ts`: the
  non-"enhanced" module's `RATE_LIMITS`, `SECURITY_HEADERS`,
  `REQUIRED_ENV_VARS`, `isAllowedEndpoint` are all unused — the older module can
  likely be folded into the enhanced one.
- `src/hooks/useOptimizedSubscriptions.ts`: 3 of its hooks unused;
  `useTableSubscription.ts` and `useSubscription.ts` each export unused variants.
- `src/lib/tour-payout-email.ts:54` `adjustRehearsalQuotesForMultiDay` — exported
  money-math with no caller and no test.

Full list capturable via `npx ts-prune -p tsconfig.app.json`. (Caveat: ts-prune
has known false positives for types referenced only in declaration positions —
treat the list as a review queue, not a delete list.)

### 2.4 Edge functions with no in-repo caller (12 of 67)

Referenced in neither `src/`, any other edge function, nor any migration
(`cron.schedule` bodies checked — the DB only invokes
`auto-send-timesheet-reminders`, `push`, `send-expense-notification`,
`staffing-sweeper`):

| Function | Assessment |
| --- | --- |
| `recalc-timesheet-amount` | **Dead end-to-end** — its only two client wrappers (`useRecalcTimesheet` ×2) are themselves dead files. |
| `generate-sv-report` | **Dead end-to-end** — zero references anywhere, including docs. |
| `get-secret` | Intentionally neutered (always 410, per 2026-07-01 audit) — candidate for actual removal now. |
| `image-proxy`, `static-map`, `get-google-maps-key` | Unreferenced since the Google-Places cost-reduction work; verify no external consumer (wallboard TVs), then remove. |
| `wallboard-debug` | Debug endpoint, unreferenced. |
| `persist-flex-elements` | Unreferenced from app code despite recent auth hardening. |
| `evaluate-achievements`, `background-job-deletion`, `cleanup-corporate-email-images` | Likely invoked by **hosted-dashboard cron** (not in repo). Verify in Supabase dashboard before touching; if real, add the schedule to a migration so the dependency is visible. |
| `csp-report` | **Not dead** — wired via `public/_headers` CSP `report-uri`. Excluded from removal. |

### 2.5 Duplicated modules (one twin dead)

- `useRecalcTimesheet`: `src/hooks/` **and** `src/features/timesheets/hooks/` — both dead.
- `useTourCreation`: `src/components/tours/` **and** `src/hooks/tours/` — both dead.
- `LightsSchedule.tsx`: `components/dashboard/` **and** `components/lights/` — both dead.
- `testPdfExport`: `.js` **and** `.ts` at `src/` root — both dead.
- `components/festival/FestivalManagement.tsx` (dead) shadows `pages/FestivalManagement.tsx` (live).
- `lib/subscription-manager.ts` exports `getSubscriptionManager` unused; superseded by `lib/unified-subscription-manager.ts`.

---

## Part 3 — At least one improvement per feature

Grounded in what this audit actually observed; ✂ = deletion opportunity from Part 2, 🐛 = bug from Part 1.

| Feature | Improvement |
| --- | --- |
| **Jobs** | Split `JobCardNew.tsx` (1,438 lines) — it contains its own status-mapping logic (`mapStatus`) duplicated with `JobStatusSelector.tsx:79`; extract one shared `flexStatus` mapper. ✂ Also delete the six dead legacy job hooks (~1,070 lines) or actually adopt `useOptimisticJobManagement` as CLAUDE.md advertises. |
| **Assignment matrix** | 🐛 Fix BUG-1/BUG-4 (UTC dates in availability + metrics). ✂ Delete legacy `AssignmentMatrix.tsx` + perf wrappers (600 lines) so the Optimized variant is the only implementation. |
| **Timesheets** | 🐛 Fix BUG-2 (auto-creation writes UTC date keys) and strip the ~15 object-dumping `console.log`s in `useTimesheets.ts`. Decide the fate of the `recalc-timesheet-amount` function + its two dead hooks: wire it up or delete all three. |
| **Tours** | ✂ Remove the dead scheduling suite (~3,820 lines incl. PDFs and types) now that `features/tour-ops` owns scheduling — it's the single largest dead mass in the repo. Then split `TourDefaultsManager.tsx` (1,722 lines). |
| **Tour ops** | `TourOpsManagementHub.tsx` (2,116 lines) and `tourSchedulingService.ts` (1,885) are the two biggest files in `src/`; carve the service into per-concern modules (itinerary / travel / accommodation) before the next feature lands there. |
| **Festivals (artists)** | ✂ Delete superseded `ArtistForm.tsx` (513 lines) + `ArtistFormSubmissionDialog` + `FormStatusBadge`; they're drift risk next to the live `ArtistManagementForm`/`ArtistRequirementsForm`. Resolve `micListTransform` (tested in `test:critical`, unused in prod). |
| **Festivals (gear)** | ✂ Remove dead `gear-setup/{InfrastructureConfig,StageEquipmentConfig}.tsx`; they present stale copies of options that now live in `festivalGearOptions.ts`. |
| **Equipment / inventory** | ✂ Delete `EquipmentCreationManager` + `JobPresetManager` + stock leftovers (~1,390 lines). `SubRentalManager` correctly uses local `format(new Date(),'yyyy-MM-dd')` — use it as the pattern reference when fixing Part 1 bugs. |
| **Logistics** | `constants/transportOptions.ts` exports `LOGISTICS_TRANSPORT_OPTIONS` that nothing imports — either logistics transport pickers should consume the shared constant (they currently don't), or drop it. |
| **Staffing** | ✂ `useStaffingStatusByDate.ts` (164 lines) is dead — the matrix reads staffing status through another path; delete to avoid two sources of truth. Split `StaffingCampaignPanel.tsx` (1,297 lines). |
| **Rates / payouts** | Add tests for or delete `adjustRehearsalQuotesForMultiDay` (`lib/tour-payout-email.ts:54`) — exported, untested, uncalled money math is the worst kind of dead code. `rates-pdf-export.ts` (1,244 lines) needs the same split treatment. |
| **Expenses** | `useJobExpenses.ts:293` exports unused `useJobApprovedExpenses`; remove or wire into the payout panels so approved-expense totals come from one hook instead of ad-hoc reduces (`MyJobTotalsSection` was doing this and is now dead). |
| **Messages / announcements** | ✂ Delete `MessageReplyDialog` + `SendDirectMessageButton` + technician `MessageManagementDialog` (dead); the live messaging path no longer uses them. |
| **Activity feed** | `useActivityPushFallback` is flag-gated by `VITE_ENABLE_ACTIVITY_PUSH_FALLBACK`; document the flag's production value, and remove the fallback if it has been on (or off) for a quarter. |
| **Hoja de Ruta** | The template feature is half-removed: `useHojaDeRutaTemplates` hook, `ModernTemplateManager`, `RoomAssignmentsDialog`, `VenueLocationSection`, and the `hooks/hoja-de-ruta/index.ts` barrel are all dead while `useHojaDeRutaPersistence` (28.9KB) remains. Finish the removal or restore the entry point. |
| **SoundVision** | ✂ Delete `SoundVisionMap.tsx` (268 lines) — superseded by `SoundVisionInteractiveMap.tsx` (1,293 lines, live); keeping both invites edits to the wrong map. |
| **Wallboard** | ✂ `DocProgressPanel` is dead and `wallboard-debug` edge function is uncalled; remove both. Rotation/interval handling in `WallboardDisplay` is correctly cleaned up — no action. |
| **Push / PWA** | ✂ `LazyNotificationBadge.tsx` is dead while the non-lazy `NotificationBadge` polls on `setInterval`; either finish the lazy migration or delete the wrapper. |
| **Auth & roles** | ✂ Delete legacy `useAuth.tsx` (389 lines) + `LoginForm` + signup fragments; two auth providers in-tree is a real footgun. Replace the `'oscar'` magic role with a profile flag (Part 1 observation). Escalate `react-hooks` lint rules (BUG-8). |
| **Flex integration** | 🐛 Fix BUG-3 (UTC `plannedStartDate`). ✂ Move `FlexElementSelectorDialog.example.tsx` out of `src/` (docs or storybook), and delete dead `services/tours/createFoldersForDate.ts` (327 lines) — folder creation now lives in `flex-folders/`. |
| **PDF generation** | ✂ Delete `pdf-generator.ts` (407 lines), `pdfMerger.ts`, `pdfLibImageUtils.ts`, and both `testPdfExport.*` root scripts; `utils/pdf/` is the live engine. |
| **Technical tools (consumos/pesos/SysCalc)** | Split `useConsumosTool.ts` (1,820 lines). ✂ Delete dead `pages/pesos-tool/TableCard.tsx`. |
| **Dashboard / technician app** | ✂ Remove the seven dead dashboard components (~900 lines, incl. `MyJobTotalsSection` money math that silently stopped being rendered — if those totals are still wanted, they need a new home, not resurrection by accident). |
| **Incident reports** | Confirm whether `house_tech` users should be able to submit incident reports; `canSubmitTechnicianIncidentReports` is the only permission helper that splits `technician` from `house_tech` (Part 1 observation). |
| **Disponibilidad / vacations** | ✂ `AvailabilityActions` + `PresetManagement` are dead; `VacationManagement.tsx` is test-only — delete or re-route. 🐛 The morning-summary date fix (BUG-5) also affects the availability "today" defaults. |
| **Settings / shortcuts** | ✂ `ShortcutableButton.tsx` (126 lines) is dead — the shortcut registry (`useShortcutStore`) is used directly; delete the wrapper to keep one registration pattern. |
| **Core libs** | Fold `lib/security-config.ts` into `enhanced-security-config.ts` and `lib/subscription-manager.ts` into the unified manager; remove the unused halves of `lib/react-query.ts`'s API or start consuming it as CLAUDE.md documents. |

---

## Recommended execution order

1. **Fix BUG-1 and BUG-2 together** (same pattern, shared helper, add a unit test
   with a 00:30 CEST job) — these affect double-booking detection and payroll data.
2. **BUG-3/BUG-4/BUG-5** — mechanical one-liners with the same helper.
3. **Delete the five whole dead subsystems** (tour scheduling suite, landing,
   legacy auth, legacy matrix, legacy job hooks): ~7,400 lines, zero behavior
   change, shrinks typecheck/lint surface. Do it in one PR per subsystem so
   `git log` stays legible.
4. **Edge functions:** delete `recalc-timesheet-amount` + `generate-sv-report`
   after a quick hosted-cron check; move any dashboard-configured cron schedules
   into migrations so future audits can see them.
5. **Escalate hooks lint rules** (BUG-8) once the dead files are gone (fewer
   files to fix warnings in).
6. Work through the per-feature table opportunistically; each row is
   independently shippable.

## Appendix — verification commands

```
node <import-graph script>            # 114 never-imported files, 7 test-only
npx ts-prune -p tsconfig.app.json     # 359 unused exports (review queue)
npm run typecheck                     # PASS on this branch
grep -rn "toISOString().split('T')[0]" src   # 38 sites; triaged above
# edge-function sweep: grep each function name across src/, functions/, migrations/
```
