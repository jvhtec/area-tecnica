# 2026-09 Festival Module Audit and Roadmap

**Audit date:** 2026-09-28
**Baseline reviewed:** `main` at `9d2907d`
**Scope:** everything behind `/festival-management/:jobId` and `/festivals` — the management shell, artists, gear/stages, scheduling (shifts), public artist form, rider library, print/PDF, offline mode, push feed, Flex pullsheet — plus the DB tables and RLS they use. The same screens serve `festival`, `ciclo`, `single`, `evento` (and, by accident, `tourdate`) jobs, so all of those uses are in scope.
**Method:** a static pass over the 127 non-test source files (30.6k LOC), a review of the governance baselines (lint-warning, source-boundary, mobile-type-floor, file-size), a read of the migrations and pgTAP suites, and **read-only** queries against production (`pg_policies`, row counts, and usage aggregates by job type; no row contents were read). This is a backlog. The findings describe the audit-time baseline (`9d2907d`); progress since then is recorded in the **Status** notes of §4b and §5 (Phase 0 and SCH-A are done).

## Executive summary

The module is in better shape than its size suggests. The May VM split (P3-05), the unified festival PDF design system, the offline snapshot/queue with its own tests, the hardened public-form RPCs and the SEC-12 fix for `festival_artists` all hold up. The remaining debt falls into four themes:

1. **The authorization boundary for festival data covers only one table (P0).** SEC-12 correlated `festival_artists` and `festival_artist_files` with job assignment. The eight sibling tables still grant `SELECT` to every `technician` and `house_tech` with no job scoping. That includes **`festival_artist_forms.token`**, the bearer credential for the public artist form. Verified on production.
2. **"Festival module" is really the job production workspace, but the code does not know that.** Which mode the page is in comes from a `?singleJob=true` query parameter, not from `job.job_type`. Five of the six entry points drop that parameter. Production usage shows **`single` jobs use the artist roster more than festivals do** (42 vs 37 jobs). `evento` has never used it (0 of 31), and `tourdate` can reach it too. **Decision (§7):** every job type keeps the same full workspace for now; only the labels follow `job_type`.
3. **The data layer lives in the components.** 56 files query `festival_*` tables directly, and 19 components do `useEffect` + `useState` fetching. The artist editor's form model is copy-pasted three times with different defaults. Multi-row writes such as copying shifts run as client-side loops with no transaction.
4. **Quality ratchets are close to their limits.** Nine files sit between 740 and 798 lines, just under the 800-line gate. The module has 58 baselined lint warnings, 22 `as unknown as` casts, 420 `console.*` calls (all stripped in production, so they hide failures) and three different realtime mechanisms.

The enhancement opportunities are large. Public artist forms are generated but almost never used (355 forms, 3 submissions), and named stages are practically unused (2 `festival_stages` rows against 35 gear setups). Festival shifts are not connected to timesheets or conflict detection.

## 1. Module map

| Layer | Location | Notes |
| --- | --- | --- |
| Routes | `src/routes/app-route-pages.tsx` → `FestivalManagement`, `FestivalArtistManagement`, `FestivalGearManagement`, `Festivals`, public `ArtistRequirementsForm`/`FormSubmitted` | Scheduling renders inside the management shell (`/scheduling` path check). |
| Shell / VM | `src/features/festival-management/` (`useFestivalManagementVm`, `queries`, `commands`, `selectors`, 8 hooks), `src/pages/festival-management/` | The only area with a real query/command/selector split. |
| UI | `src/components/festival/` (artists, `form/sections`, `gear-setup`, `mobile`, `pdf`, `push-to-flex-pullsheet`, `scheduling`) | Most direct DB access lives here. |
| Hooks | `src/hooks/festival/*`, `src/hooks/useArtistsQuery.ts`, `useArtistMutations.ts`, `useCombinedGearSetup.ts` | Artist hooks live outside the festival folder. |
| PDF | `src/utils/pdf/festival-report/*`, `festivalPdfGenerator.ts`, ~10 `*PdfExport.ts` utils, `usePrintOptionDownloads.ts` | Already on the shared design system (#930). |
| Offline | `src/lib/offline/festival-*.ts` | Tested (snapshot, queue, sync, files). |
| Edge | `submit-public-artist-form`, `upload-/delete-public-artist-rider`, `enrich-artist-metadata`, `push/festivalFeed.ts` | |
| DB | `festival_artists`, `_artist_files`, `_artist_forms`, `_artist_form_submissions`, `_gear_setups`, `_stage_gear_setups`, `_stages`, `_settings`, `_logos`, `_shifts`, `_shift_assignments`, `_push_subscriptions`, `_push_delivery_log` | 4 pgTAP suites cover artists, stages, push feed and soundcheck date. |

### How each job type reaches the module (production, 2026-09-28)

| `job_type` | Entry point | Mode the page thinks it is in | Jobs | With artists | With shifts | With gear setup |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| `festival` | "Gestionar Festival" (`isFestivalLikeJobType`) | Festival | 62 | 37 | 22 | 28 |
| `ciclo` | same | Festival | 3 | 1 | 1 | 1 |
| `single` | "Gestionar Trabajo" → `?singleJob=true` | "Single Job", only when that button was used | 369 | **42** | 3 | 17 |
| `evento` | same as `single` | same | 31 | 0 | 0 | 0 |
| `tourdate` | same (the condition is `!isFestivalLike && !dryhire`) | same | 440 | 1 | 0 | 1 |

Other entry points (`JobCard`, `JobCardNew`, `dashboard/MobileJobCard`, `usePendingTasks`, `RiderLibraryDialog`) navigate without the parameter. The same single job therefore shows up as "Festival" or "Single Job" depending on where the user clicked.

## 2. Metrics snapshot (ratchet baseline for this roadmap)

| Metric | Value | Source |
| --- | --- | --- |
| Source files / LOC (excluding tests) | 127 / 30,646 | `find src -ipath '*festival*'` |
| Files ≥ 600 LOC / ≥ 740 LOC | 13 / 9 (largest: `ArtistTable.tsx` 798) | file-size gate is 800 |
| Baselined lint warnings | 58 (52 `no-explicit-any` of which 3 in tests, 6 `exhaustive-deps`) | `lint-warning-baseline.json` |
| Source-boundary baseline entries | 22 `dataLayerClient` imports in components/pages, plus 4 date-format entries | `source-boundary-baseline.json` |
| Mobile type-floor entries | 31 across 9 files (`ArtistTable` 14, `MobileArtistCard` 10) | `mobile-type-floor-baseline.json` |
| Files querying `festival_*` tables directly | 56 (`festival_artists` 44 call sites, `festival_artist_files` 30) | grep |
| Components fetching in `useEffect` | 19 | grep |
| `as any` / `as unknown as` | 22 / 22 | grep |
| `console.*` / `console.log` | 420 / 194 | grep (all dropped in prod by esbuild `drop`) |
| Realtime mechanisms | 3 (raw `supabase.channel` in VM, `useRealtimeSubscription`, `useTableSubscription`) | grep |
| Unit/component test files | 18, plus 1 Edge test | |
| pgTAP suites | 4 festival-specific | `supabase/tests/database/festival_*` |
| E2E | 2 smoke tests (scheduling + WhatsApp dialog, blank public form) | `tests/e2e/festival-management.spec.ts` |

## 3. Findings register

Severity: **P0** means containment is needed now. **P1** is a correctness or user-visible bug. **P2** is structural debt. **P3** is polish.

### Security and data integrity

| ID | Sev | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| FEST-SEC-01 | **P0** | `festival_artist_forms` `SELECT` is open to any `technician`/`house_tech`, and the table holds the public form bearer `token` (plus `shortened_url`). A freelancer with no assignment can read live tokens for any festival and submit the rider once. `get_public_artist_form_context` enforces **one submission per artist**, so a hostile or accidental submission also locks out the real artist. 8 tokens are live today. | Production `pg_policies`: the `p_festival_artist_forms_public_select_aaaff3` predicate is role-only. | Limit `SELECT` to admin/management/logistics (form links are generated only by managers). If technicians need form status, expose it through a column-limited view or RPC that never returns `token`. Add pgTAP coverage: an unassigned technician sees 0 rows and an assigned one never sees `token`. |
| FEST-SEC-02 | **P0** | `festival_shifts`, `festival_shift_assignments` (645 rows: who works where, including external names), `festival_gear_setups`, `festival_stage_gear_setups`, `festival_settings`, `festival_logos`, `festival_stages` and `festival_artist_form_submissions` (form payloads) are readable by every technician with no job correlation. This is the same class as SEC-12, which fixed only the artists and files tables. | Production `pg_policies`. The baseline policies are OR chains of overlapping role arrays and `TO public`. | One migration per table family: `TO authenticated`, and an operational-roles OR `EXISTS (job_assignments …)` predicate that mirrors `p_festival_artists_public_select_598f77`. **Shifts and shift assignments are department-scoped as well** (decision §7.3): a technician sees a shift only if it is theirs, or if it has no department, or if they hold that department's role on the job (`sound_role` / `lights_role` / `video_role` / `production_role` on their non-declined `job_assignments` row). Extend the pgTAP pattern from `festival_artist_permissions.sql`. Check the offline snapshot and the technician super app still load for assigned techs. **Diff against production first**, because DB-06 drift means the migration chain is not authoritative. |
| FEST-DATA-01 | P1 | Copying shifts is an N-step client loop (insert shift → read assignments → insert assignments, per shift). A mid-way failure leaves a partial copy and retrying duplicates it. | `scheduling/CopyShiftsDialog.tsx:66-121` | A `copy_festival_shifts(job, source_date, target_date)` RPC in one transaction, idempotent through a conflict check. |
| FEST-DATA-02 | P1 | `festival_shift_assignments` has no uniqueness on `(shift_id, technician_id)`, a nullable `shift_id`, an FK to `auth.users` rather than `profiles`, and nothing ties the technician to the job. Duplicate or orphan assignments are possible, and so is assigning someone who is not on the job. | `00000000000000_production_schema.sql:5578` | Add `NOT NULL`, a partial unique index and a trigger or check against `job_assignments` for internal techs, after a data-cleanup query. |
| FEST-DATA-03 | P2 | Artist copy, rider library import, gear setup save (global + per-stage) and form-link bulk generation all run as client-side multi-statement flows. | `CopyArtistsDialog`, `FestivalGearSetupForm`, `ArtistFormLinksDialog` | Move each to an RPC when its screen is refactored (Phase 2). |
| FEST-DATA-04 | P2 | Loading festival settings **inserts** a `festival_settings` row as a side effect of a read query. This happens in the query function of `FestivalArtistManagement`, and a read-only viewer gets an RLS error that is silently swallowed. | `FestivalArtistManagement.tsx:~105` | Create settings with the job (or lazily through an RPC with upsert), and treat a missing row as defaults on read. |

### Correctness and UX bugs

| ID | Sev | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| FEST-BUG-01 | P1 | The workspace mode comes from `?singleJob=true`, not from `job.job_type`. Five entry points drop the parameter, so a `single` or `evento` job shows the "Festival" badge and icon, and a `ciclo` can never be told apart. | `useFestivalManagementVm.ts:40`, `JobCardActions.tsx:173` vs `JobCard.tsx:41`, `JobCardNew.tsx:480`, `MobileJobCard.tsx:169`, `usePendingTasks.ts:107` | Derive a `JobWorkspaceProfile` from `job.job_type` (see ENH-01) and drop the query parameter. Keep reading it for one release so old links don't break. |
| FEST-BUG-02 | P3 | `tourdate` jobs get a "Gestionar Trabajo" button into the festival workspace (1 production tourdate already has artists and gear). Tour dates have their own workflow, and any data created here is invisible to it. | `JobCardActionButtons.tsx:306`, `MobileJobCardActions.tsx:189` | **Decided (§7.1): keep access.** Tour dates stay in the workspace. Scope is limited to labelling (ENH-01) plus making sure tour-date views that should show this data (for example the technician app) read it. |
| FEST-BUG-03 | P1 | The configurable festival day start (`festival_settings.day_start_time`) is ignored in several places. The PDF timeline hardcodes `07:00` (`festival-report/timeline.ts:18`), `DAY_START_HOUR = 7` is dead code, and about ten call sites (components, hooks, the offline snapshot) default to `"07:00"` on their own. Changing the setting splits UI and PDFs across different day boundaries. | grep `"07:00"` | Add a single `useFestivalDayStart(jobId)` and pass it into the PDF context. Remove the local defaults. |
| FEST-BUG-04 | P2 | Dates in the header use `new Date(...).toLocaleDateString()` (browser locale and timezone, not Madrid), and `ShiftsTable`/`CopyShiftsDialog` format dates with the browser default locale (`'MMM d, yyyy'`), which gives English month names. | `FestivalManagementView.tsx:~150`, source-boundary baseline entries | Use the Madrid date utilities and the `es` locale everywhere. Delete the baseline entries. |
| FEST-BUG-05 | P2 | Errors that are only logged to the console disappear in production. `festival_settings`/`job_date_types` query failures return `null`/`{}`, and the UI silently falls back to defaults. | `FestivalScheduling.tsx:59-90`, 420 `console.*` calls | Throw from query functions and let React Query surface the error. Report the unexpected ones through `errorTracking`. |
| FEST-BUG-06 | P3 | Hardcoded English strings: the "Single Job" badge and `alt="Venue location"`. The native `confirm()` in `ShiftsTable.tsx:137` is unstyled and unlocalised on iOS. | | Fix together with ENH-01, use `useConfirm`, and run `/i18n-check`. |
| FEST-BUG-07 | P3 | A stale compatibility cast in `CopyArtistsDialog.tsx:327` says `soundcheck_date` is missing from the generated types, but it is now present (`types.ts:2016`). | | Remove the cast. |

### Architecture and debt

| ID | Sev | Finding | Fix direction |
| --- | --- | --- | --- |
| FEST-ARCH-01 | P2 | **The artist technical spec has three form models.** `ArtistManagementForm` (desktop), `MobileArtistFormSheet` and `MobileArtistConfigEditor` each hand-roll a `createFormData` with about 60 fields and **divergent defaults** (`show_start` is `"20:00"` in two of them and `""` in the third; `rider_missing` is `?? isNewArtist` in two and `?? false` in the third). The public form has a fourth model in `artistRequirementsFormModel.ts`. There is no zod schema, and 32 of the 49 non-test `any` warnings sit in these files. The UI sections are already shared, but the model is not. | Add one `features/festival-artists/model.ts` with a zod schema, `toFormValues(row)` / `toDbPatch(values)` and one defaults table, used by all four editors. Tests pin the defaults and the round-trip. |
| FEST-ARCH-02 | P2 | **The data access is spread across 56 files.** Only the shell has a `queries.ts`/`commands.ts`. Artists, gear, scheduling, logos and form links query tables inside components (22 source-boundary exemptions, 19 `useEffect` fetchers, query results copied into `useState` in `FestivalScheduling`). | Add a `features/festival-*/api.ts` per sub-domain (artists, gear, scheduling, forms, assets) with React Query hooks and a `festivalKeys` factory. Delete the source-boundary exemptions as each file moves. |
| FEST-ARCH-03 | P2 | **Three realtime paths.** The shell opens a raw `supabase.channel('job-…-updates')`, which bypasses the unified subscription manager and multi-tab leader election (a CLAUDE.md invariant). The artist and gear pages use `useRealtimeSubscription`, and scheduling uses `useTableSubscription`. | Put everything on `useTableSubscription` with route-aware registration, so there is one subscription per table per leader tab. |
| FEST-ARCH-04 | P2 | **Stage identity is duplicated.** `max_stages` (integer, 37 usages) and `festival_stages` (named rows, 2 in production) coexist, and artists, shifts and stage gear reference a stage **number**. Renaming or removing a stage cannot be done safely. | Short term: always resolve names through `buildFestivalStageOptions`. Long term: see ENH-05. |
| FEST-ARCH-05 | P2 | **Files at the size ceiling.** `ArtistTable` (798), `PushToFlexPullsheetDialog` (795), `festivalPdfGenerator` (786), `FestivalManagementView` (783), `FestivalArtistManagement` (777), `FestivalGearSetupForm` (766), `ArtistRequirementsForm` (758), `usePrintOptionDownloads` (740) and `ArtistFormLinkDialog` (728) will block the next feature that touches them. | Split each one alongside the Phase 2 data-layer PR for its screen, not as a separate refactor. The target is under 500. |
| FEST-ARCH-06 | P2 | **Artist hooks live outside the module** (`src/hooks/useArtistsQuery.ts`, `useArtistMutations.ts`, `useCombinedGearSetup.ts`), and the festival-list page loads *all* jobs through `useJobsRealtime` before filtering on the client, then fetches logos one per festival (N+1, repeated on every jobs refetch). | Move the hooks into the feature folder. Add a `festival_jobs` query that filters server-side and a batched logo query. |
| FEST-ARCH-07 | P3 | Terminology is hardwired to festivals ("Programación del Festival", "Gestionar Festival", provided-by value `'festival'`) even for single and evento jobs. | This is covered by the ENH-01 profile labels. The stored value `'festival'` can stay and only its label needs to change ("Producción"/"Nosotros"). |

### Test gaps

| ID | Gap | Target |
| --- | --- | --- |
| FEST-TEST-01 | There are no pgTAP tests for shifts, shift assignments, gear setups, settings, logos, forms or submissions. That is why FEST-SEC-01/02 went unnoticed. | One suite per table family, landing with each policy migration. |
| FEST-TEST-02 | The artist form model, gear-setup save and copy-shifts/copy-artists flows have no tests. | Unit tests for the new model, and RPC tests for the copy flows. |
| FEST-TEST-03 | E2E covers only the scheduling load and the blank public form. | Add artist create/edit on desktop and mobile, single-job mode rendering (badge and labels driven by `job_type`), and a technician view-only check. |

## 4. Enhancement suggestions

These go beyond cleanup. Each one names the problem it solves.

| ID | Enhancement | Why | Rough size |
| --- | --- | --- | --- |
| **ENH-01** | **A job workspace profile.** Rename the concept from "festival management" to "Producción del trabajo" and add `getJobWorkspaceProfile(job_type)`, which returns labels (festival / ciclo / bolo / evento / fecha de gira) and defaults (for example one stage for `single`). **Per §7.1–7.2, every type keeps all modules for now.** The profile still has a `modules` field, but it is all-on, so hiding a module later is a one-line change. The route stays the same. | It fixes FEST-BUG-01 and FEST-ARCH-07 in one place. `single` jobs already use the artist roster more than festivals do, so they deserve their own copy rather than a "Single Job" badge. | M |
| ENH-02 | **Public artist forms, sent by production and aimed at `ciclo`** (decision §7.4). **Stop minting tokens automatically:** the `trg_ensure_artist_form_for_missing_rider` trigger (`20260218195000`) creates a live bearer token whenever `rider_missing` is true, and two of the three editors default new artists to `rider_missing = true`. That is where the 355 forms and 3 submissions come from. Mint a token only when production presses **Enviar formulario**. Send it from the app (email/WhatsApp through the existing edge functions), and record the sender (a production-department user, a natural fit with `job_producer_claims`). Track sent / opened / submitted, and send a reminder N days before the date. For a ciclo, add a "send to every artist of the next date" bulk action, and pre-fill from the artist's previous ciclo submission. Managers review a "diff vs current config" with accept-per-field. The UI stays visible on all job types. | It removes 350+ unused live-able credentials and puts the effort where the feature is expected to be used. | M |
| ENH-03 | **Tie shifts to timesheets** (delivered as part of SCH-E, §4b). Link `festival_shift_assignments` to `job_assignments`. Detect overlapping shifts for the same tech on the same day and across jobs, reusing matrix conflict detection. Optionally pre-fill timesheet hours from shifts (the server-side `compute_timesheet_hours` stays authoritative). Only 26 jobs use shifts today, possibly because they duplicate work. | Removes double entry and catches double-booking that the matrix currently can't see. | L |
| ENH-04 | **An artist change log and rider versions.** Record who changed which technical field and when (the activity catalog already exists). Keep previous rider files as versions instead of replacing them, and show "changed since last print" in the PDFs. | Riders change the week of the show, and crews ask what changed. The `rider_outdated` flags only cover copies. | M |
| ENH-05 | **First-class stages.** Make `festival_stages` authoritative: create N rows when `max_stages` is set, reference stages by id (keeping the number for display), and allow renaming or reordering. Put per-stage gear, crew and schedule on one stage page. | It fixes FEST-ARCH-04 and enables per-stage WhatsApp groups and PDFs without mapping numbers to names. | L (migration + backfill) |
| ENH-06 | **Automatic gear-mismatch → extras quote.** The mismatch detection and `useCreateExtrasPresupuesto` already exist. Add a festival-wide "requirements vs inventory" summary per day and stage, with one-click grouped extras into Flex. | It turns an existing indicator into a planning tool. | M |
| ENH-07 | **Mobile field mode for stage managers.** A read-first day view per stage (running order with live "now/next", changeover countdown, contact for the artist's production), which works offline on the existing snapshot. | The offline infrastructure already exists and is used today mainly for documents. | M |
| ENH-08 | **Templates for recurring events.** Save a festival's stages, gear setup, shift pattern and form settings as a template, and apply it to the next edition or to a `ciclo` date. `CopyArtistsDialog` and `CopyShiftsDialog` already do half of this, per day. | Ciclos and annual festivals reuse the same structure every time. | M |
| ENH-09 | **Show-day status on the wallboard and push feed.** Publish the running order (on stage / changeover / delayed) from the stage manager view to the wallboard preset and the festival push feed. | It reuses two existing channels. | S–M |

## 4b. Shift scheduling UX (SCH workstream)

The "Planificación" tab (`src/components/festival/scheduling/`, about 2,100 LOC) works, but every task takes too many steps. This section is a UX audit plus a delivery plan. It extends Phase 2.4 and absorbs ENH-03.

### How it is used (production, 2026-09-28, aggregates only)

| Signal | Value | What it tells us |
| --- | --- | --- |
| Shifts / festival days / jobs | 159 / 67 / 26 | The feature is used on real festivals and single jobs. |
| Shifts per day, people per shift | 2.4, 4.4 | A typical day is Mañana / Tarde / Noche with 4–5 people each. It is a small grid, not a big roster. |
| Shifts that end after midnight | **61 (38%)** | Overnight is the normal case, not an edge case. |
| External crew in assignments | **133 of 677 (21%)** | Externals are first-class, but they are typed as free text every time. |
| Shifts edited after creation | **102 of 159** | People create a shift and then fix it. The create flow doesn't capture what they need first time. |
| Most common names | Mañana, Noche, Turno de Mañana, Montaje, Turno de Tarde, "Turno de Mañana - Stage 1" … | The same few patterns are retyped every day, and the stage is written into the name because the stage picker ignores stage names. |

### Friction and bugs found

| ID | Finding | Evidence |
| --- | --- | --- |
| SCH-01 | **Adding people is one at a time and fights you.** Pick a technician, pick a role, press *Asignar*, read the toast, repeat. After each add the role resets to empty, and the default role only applies when the dialog opens, so the second add fails with "completa todos los campos" until the role is picked again. The technician `Select` is uncontrolled, so it keeps showing the previous name while its state is empty. | `ManageAssignmentsDialog.tsx` (`setRole("")` after add; `useEffect([open, department])`; `Select` without `value`) |
| SCH-02 | **The crew list in the dialog doesn't update.** The dialog receives a snapshot of the shift taken when it opened (`managingShift` / `currentShift` state), so a person just added doesn't appear under "Personal asignado" until the dialog is reopened. It also invalidates a query key (`festivalShifts`) that no query uses. | `ShiftsTable.tsx:48,149,317`, `ShiftsList.tsx`, `ManageAssignmentsDialog.tsx:153,183` |
| SCH-03 | **One shift is split across two dialogs:** "Editar" for times and details, the people icon for crew. Creating a staffed shift takes two dialogs and at least six clicks per person. | `EditShiftDialog`, `ManageAssignmentsDialog` |
| SCH-04 | **Stage and department pickers are hardcoded.** "Stage 1–4" regardless of `festival_stages` names or `max_stages`. The department list has no production, and the table shows the raw value (`sound`). | `CreateShiftDialog.tsx`, `EditShiftDialog.tsx:172-195`, `ShiftsTable` |
| SCH-05 | **The candidate list is wrong for mixed crews.** It lists job crew whose *profile* department equals the shift's department, and defaults to sound when the shift has none. Someone on this job as lights crew with a sound profile shows up in sound shifts and not in lights shifts. People who are only on a shift, and production crew, never appear. | `ManageAssignmentsDialog.tsx` technicians query |
| SCH-06 | **Crew names can come out blank.** The shifts hook reads `profiles` directly (including `email`, which it doesn't need). Since SEC-13, a house tech or shift-only technician can't read the profiles of people they don't share an assignment with, so the view shows "undefined undefined". | `useFestivalShifts.ts`; `20260904162000_narrow_profile_and_rate_visibility.sql` (use `get_profile_directory`) |
| SCH-07 | **Overnight shifts are misplaced.** Shifts are sorted by the `start_time` string, so anything starting between 00:00 and the festival day start (07:00) lists first. There is no duration, no "ends next day" marker, and no validation, so `end == start` is accepted. With 38% overnight shifts this is the common case. | `ShiftsTable.tsx` sort; create/edit zod schemas |
| SCH-08 | **Destructive actions are inconsistent.** Delete in the table uses the native `confirm()`; delete in the list view has **no confirmation at all**. Deletion is two client-side deletes, even though the FK already cascades. | `ShiftsTable.tsx:137`, `ShiftsList.tsx`, `FestivalScheduling.tsx` `handleDeleteShift` |
| SCH-09 | **The time calculator is a detour.** It computes N optimal shifts from the artist schedule, but it lives inside *Crear turno* and applies one start/end pair to the single shift being created. You have to reopen the dialog N times. | `ShiftTimeCalculator.tsx:182`, `CreateShiftDialog` |
| SCH-10 | **Copying is all-or-nothing, to one date, and not atomic.** You can't pick which shifts to copy, choose several target dates, or copy without crew. A 500 ms `setTimeout` papers over the refetch. | `CopyShiftsDialog.tsx`, `FestivalScheduling.tsx:handleShiftsCopied` (FEST-DATA-01) |
| SCH-11 | **Two views, both partial.** The table is six columns wide on a phone. The list view hides stage and crew names. The toggle isn't remembered. There is a manual "Actualizar" button next to a live-subscription indicator. | `FestivalScheduling.tsx`, `ShiftsList.tsx` |
| SCH-12 | **No person-centred view.** There is no way to see a technician's shifts across the day or festival, how many hours they do, who on the job has no shift, or whether someone is double-booked or lacks rest. Shifts don't feed timesheets (ENH-03). | — |
| SCH-13 | **Smaller issues.** English "(House Tech)" label; dates in browser locale/timezone; `ShiftsTable` fetches job title and logo on every mount just for the PDF; externals retyped each time with no suggestions. | `ManageAssignmentsDialog.tsx`, `ShiftsTable.tsx` |

### Target experience

1. **One day board instead of a table plus dialogs.**
   - Pick a day and see it as a timeline from the festival day start to the day start of the next day (for example 07:00→07:00), so overnight shifts read naturally. There is one lane per stage (using stage names) or per department, with a switch.
   - Each shift is a block showing its name, time range, duration and crew chips. An "ends next day" marker appears when it crosses midnight.
   - On phones the same data is a vertical agenda per stage, and you swipe to change day. No wide tables.
2. **A shift sheet instead of two dialogs.** Tapping a shift, or dragging on an empty lane, opens a side sheet (bottom sheet on mobile) with details and crew together:
   - Times, stage (named) and department.
   - A **multi-select crew picker** with search. It lists the job's crew grouped by *the role they hold on this job*, then everyone else on the job, then "externos recientes" (names reused on this festival). Each person comes in with a default role, and the role can be changed on the chip.
   - Changes save as you go, with undo on remove. The crew list is live (no snapshot).
3. **Patterns instead of retyping.**
   - **Day templates**: save "Mañana / Tarde / Noche" with times, stage and optional crew per festival, and apply them to one or many dates.
   - **Copy day**: choose the source shifts, several target dates, and with or without crew, done in one transaction (FEST-DATA-01).
   - The calculator becomes **"Generar turnos desde el horario de artistas"**. It proposes the N shifts on the board as drafts; you adjust them and create all at once.
4. **Crew view ("Por persona").**
   - Rows are the job's crew and columns the festival days, showing each person's shifts and hours.
   - It highlights people with no shift, overlapping shifts (including other jobs, through the matrix conflict logic), and less than 12 h rest between shifts. The rest threshold is configurable and is a warning only.
5. **Coverage at a glance (optional).**
   - A shift can declare how many people it needs per role, and the board shows filled versus needed.
   - "Shifts without crew" (4 today) become visible instead of silent.
6. **Out of the planner.**
   - The existing PDF gets per-day, per-stage and per-person variants.
   - Crew see their own shifts in the technician app, which already reads `festival_shifts`.
   - Changes go out through the festival push feed. The "send to the department WhatsApp" action is kept.

### Delivery plan

**Status (2026-09-28): SCH-A done** on the Phase 0 branch (PR #963).

**Status (2026-09-29): SCH-B done.** The copy RPC and the assignment constraints (FEST-DATA-01/02: `NOT NULL`, the partial unique index, the `profiles` FK and the job-membership triggers) landed with Phase 1.2. The rest:

- **Data layer:** `features/festival-scheduling/` now holds every read and write of the schedule (`fetchShiftsForDate`, create/update/delete shift, add/remove assignment, `fetchJobCrew`, the PDF branding) and `festivalShiftKeys`; `useFestivalShifts` moved there. The five `scheduling/*` source-boundary exemptions are gone, and the shift and assignment types now say `| null` where the columns do.
- **No manual refresh:** the "Actualizar" buttons are removed. They existed because nothing refreshed the list when someone else changed the crew: the route subscription for `festival_shift_assignments` invalidated `['festival_shift_assignments']`, which the shifts query (`['festival_shifts', …]`) never matched, and `useTableSubscription` only reports status. The hook now registers `festival_shifts` (filtered by job) and `festival_shift_assignments` through `useRealtimeSubscription`, both invalidating the festival's shift queries.
- **Failures are visible:** a failed load used to toast and then render as "No hay turnos". It is now an error state with a retry, tracked through `trackError`. The 500 ms refetch timeout was already gone; the broad "invalidate everything, then refetch" wrapper is replaced by one targeted invalidation after each write.
- Still open: SCH-C–E (day board, shift sheet, timesheets), and the shifts table's PDF branding still resolves the logo on its own (it could share `fetchFestivalLogoUrl`).


- **Shared model:** `scheduling/shiftModel.ts` holds departments, overnight-aware sorting and duration, the next-day marker, the form schema and the crew-candidate rules, all unit-tested. `ShiftFormFields.tsx` is shared by the create and edit dialogs.
- **Fixes:** SCH-01, 02, 04, 05, 06, 07, 08, and the SCH-13 labels and locale.
- **Two bugs found while fixing:**
  - The realtime subscription for crew changes invalidated a cache key no query used, so crew changes made elsewhere never showed up live. It now targets the shifts query.
  - Logistics shifts couldn't get anyone assigned, because that department has no role catalogue and the role was mandatory. They now take a free-text role.
- **Also:** phones open the list view by default; external names are suggested from earlier shifts of the job; the PDF branding loads only on export.
- **Still open for SCH-C:** the rest of SCH-11 (the date-navigation empty state overflows on phones) and SCH-12.

**Status (2026-09-30): SCH-C1 done** (the shift sheet, stacked on SCH-B). `ShiftSheet` replaces `CreateShiftDialog`, `EditShiftDialog` and `ManageAssignmentsDialog` (SCH-03): details and crew live in one right-hand sheet (bottom sheet on phones) that stays open after *Crear turno*, so a shift is created and staffed without leaving it. Crew changes save immediately and follow the live shift (the sheet reads it by id from the day's query); the shift's own fields save with *Guardar cambios*, enabled only once something changed, and a refetch never overwrites what is being typed. The crew picker is multi-select with accent-insensitive search, groups by the role held on this job, suggests earlier external names, inserts everyone in one statement, and keeps each person's own job role (a shift without a department now accepts whatever role the person holds, instead of leaving *Añadir* disabled with no explanation). Roles change in place; removing someone offers *Deshacer*. New: `e2e` create → staff → edit → delete on desktop and iPhone viewports. Still open: the day board and mobile agenda (SCH-C2), then SCH-D and SCH-E.


| Step | Scope | Size | Depends on | Done when |
| --- | --- | --- | --- | --- |
| ~~**SCH-A. Quick fixes**~~ **Done** (PR #963) | SCH-01 (keep the role, control the Select, bulk add stays for step B); SCH-02 (dialog reads the live shift from the query by id); SCH-04 (stage names from `buildFestivalStageOptions`, production department, Spanish labels); SCH-05 (candidates by job role, plus shift crew, plus production); SCH-06 (`get_profile_directory`); SCH-07 (sort from festival day start, duration and "+1 día" marker, reject `end == start`); SCH-08 (`useConfirm` everywhere, single delete); SCH-13 labels and locale | S–M | Phase 0 merged | Component tests for each fix; overnight sorting has a unit test; e2e adds "create shift, add two people without re-picking the role" |
| ~~**SCH-B. Data layer**~~ **Done** (see the status note) | `features/festival-scheduling/api.ts` (queries and mutations, `festivalKeys`); `copy_festival_shifts` RPC (FEST-DATA-01); assignment constraints (FEST-DATA-02); remove the refetch timeouts and the manual refresh button | M | = Phase 1.2 + 2.4 | Source-boundary exemptions for `scheduling/*` removed; RPC pgTAP |
| **SCH-C. Day board + shift sheet** (sheet done as C1, board and agenda are C2) | Timeline board (stage or department lanes, overnight aware), unified shift sheet with the multi-select picker and external suggestions, mobile agenda; retire `ShiftsList`/`ShiftsTable` as primary views (the table stays for print) | L | SCH-B; ENH-05 is *nice to have* (works with the current stage numbers + names) | Usability check with 2–3 real planners; `/ui-check` desktop + mobile; e2e for create, edit, assign and delete on both viewports |
| **SCH-D. Patterns** | Day templates (small table `festival_shift_templates`), copy day with options, "generate from artist schedule" drafts | M | SCH-C | Creating a typical three-shift day for a new date takes one action |
| **SCH-E. Crew view + conflicts** | "Por persona" view, hours per person, overlap and rest warnings (reusing the matrix conflict helpers), coverage counts; then ENH-03 (link to `job_assignments`, optional timesheet pre-fill; `compute_timesheet_hours` stays authoritative) | L | SCH-C, 1.2 | Conflicts pinned by tests; timesheet pre-fill behind a flag first |

**What to measure** (same queries as above, re-run after each step): the share of shifts edited after creation (64% today) should fall; average clicks and time to staff a day (measure in the usability check); the share of shift names that embed a stage should reach zero once stage names are shown; shifts without crew; external names reused versus retyped.

## 5. Roadmap

Each item is sized to be one PR. Phases can overlap. Phase 0 blocks nothing else and should ship first.

### Phase 0: containment (this week)

**Status (2026-09-28): 0.1–0.4 done.**

- `20260928120000_scope_festival_workspace_reads.sql` scopes the nine workspace tables (0.1, 0.2). Form-link actions are hidden in the UI for roles that can no longer read tokens (`canManageArtistFormLinks`). Production matched the migration chain for these tables (one SELECT policy each).
- `20260928130000_align_festival_artist_and_storage_reads.sql` (0.4):
  - `festival_artists` and `festival_artist_files` now use the same `can_read_festival_job` rule, so declined technicians lose access and shift-only crew gain it.
  - It closes **FEST-SEC-03**, found while doing this. Production had seven storage policies that no migration defines (DB-06 drift). Among them, `riders_bucket_read_all` let **anyone with the anon key read all 586 rider files**, and five others let any signed-in user upload, overwrite or delete any rider file or logo. Those six are dropped; the seventh, a public logo read, is kept on purpose (see below).
  - The public form now opens and downloads its riders through the token-validated `sign` action of `upload-public-artist-rider`.
  - Logos stay publicly readable on purpose (the anonymous form and PDFs render them), and the policy is now defined in a migration.
  - Logo uploads accept every job type. Before, single jobs only worked through the dropped drift policies.
- `supabase/tests/database/festival_workspace_read_scope.sql` pins the behaviour per role, including the storage objects and the anon key.

| # | Item | Findings | Exit criteria |
| --- | --- | --- | --- |
| 0.1 | Close form-token exposure: role-limit `festival_artist_forms` and `festival_artist_form_submissions` `SELECT`, and give technicians a token-free status view if needed. | FEST-SEC-01 | pgTAP: an unassigned technician gets 0 rows, and no non-manager path returns `token`. Production policy diff recorded in the PR. |
| 0.2 | Job-correlate `SELECT` on shifts, shift assignments, gear setups, stage gear setups, settings, logos and stages. Shifts and shift assignments are also scoped to the technician's department on that job. | FEST-SEC-02 | pgTAP per table, including a sound tech on the job who sees sound and department-less shifts but not lights shifts, and still sees any shift they are personally assigned to. The technician super app, the offline snapshot and `push/festivalFeed` still work for an assigned tech (manual smoke plus existing tests). |
| 0.3 | Tracking entry in `docs/CODEBASE_AUDIT_2026-09-04.md`'s register (as a SEC-12 follow-up). | — | Register updated. |
| 0.4 | Align `festival_artists` / `festival_artist_files` and the rider/logo storage buckets with the same read rule, and remove the drifted storage policies. | FEST-SEC-03 | pgTAP covers artists, rider metadata, rider objects, stage plots and anon storage reads. The public form reads riders through signed URLs. |

### Phase 1: correctness (1–2 weeks)

| # | Item | Findings |
| --- | --- | --- |
| 1.1 | `JobWorkspaceProfile` derived from `job_type` (labels only, every module on). Drop `?singleJob`, fix the entry points, move labels to Spanish and set them per type. `tourdate` keeps its button. | FEST-BUG-01, -06, ARCH-07 (ENH-01 foundation) |
| 1.6 | Remove the automatic public-form trigger (`trg_ensure_artist_form_for_missing_rider`) and expire the unused pending tokens that were never sent. Forms are created only from production's send action. | FEST-SEC-01 hardening, ENH-02 prerequisite |
| 1.2 | **Implemented:** `copy_festival_shifts` copies a day atomically; internal shift crew are unique, require a shift, and must hold an assignment to the same job regardless of status/source. The audited 16 missing production memberships are backfilled without deleting shift data, and membership cleanup removes shift crew when their job assignment is deleted or moved. | FEST-DATA-01, -02 |
| 1.3 | A single festival day-start source, threaded into the PDF context. | FEST-BUG-03 |
| 1.4 | Madrid timezone and `es` locale for every date in the module. Remove the 4 source-boundary date entries. | FEST-BUG-04 |
| 1.5 | Settings read with no insert side effect. Query functions throw, with no silent defaults. | FEST-DATA-04, FEST-BUG-05 |

### Phase 2: structure (3–6 weeks, one sub-domain per PR)

Each PR has the same shape: move reads and writes into `features/festival-<domain>/api.ts` with React Query and `festivalKeys`, move multi-row writes to RPCs, split the screen under 500 LOC, remove its source-boundary and lint-warning baseline entries, and add tests.

| # | Sub-domain | Files | Also closes |
| --- | --- | --- | --- |
| 2.1 | **Artist model**: shared zod schema and mapping for all four editors | `ArtistManagementForm`, `MobileArtistFormSheet`, `MobileArtistConfigEditor`, `artistRequirementsFormModel` | FEST-ARCH-01, about 32 `any` warnings |
| 2.2 | Artists list/table. **Done** (see the Phase 2 status note below the table) | `FestivalArtistManagement`, `ArtistTable`, `useArtistsQuery`, `useArtistMutations`, `CopyArtistsDialog` | ARCH-05, ARCH-06 (artist hooks), BUG-07 |
| 2.3 | Gear and stages. **Done** (see the Phase 2 status note) | `FestivalGearManagement`, `FestivalGearSetupForm`, `gear-setup/*`, `useCombinedGearSetup` | DATA-03 (gear save RPC), DATA-04 (stage rows) |
| 2.4 | Scheduling | `FestivalScheduling`, `ShiftsTable`, `Create/Edit/ManageAssignments/CopyShifts` dialogs, `useFestivalShifts` | Delivered as **SCH-A → SCH-B** (see §4b); the UX redesign continues as SCH-C–E |
| 2.5 | Forms and assets. **Done** (see the Phase 2 status note) | `ArtistFormLinkDialog`, `ArtistFormLinksDialog`, `FestivalLogoManager`, `ArtistFileDialog` | DATA-03 (bulk links: not an RPC, see note) |
| 2.6 | Shell and realtime. **Done** (see the Phase 2 status note) | `useFestivalManagementVm` channel → `useRealtimeSubscription`, `FestivalManagementView` split, `Festivals` page server-side filter and batched logos | ARCH-03, ARCH-06 |
| 2.7 | Print | `usePrintOptionDownloads`, `PrintOptionsDialog`, `festivalPdfGenerator` split by section | ARCH-05 |
| 2.8 | Flex pullsheet | `PushToFlexPullsheetDialog` → model already extracted (`push-to-flex-pullsheet/model.ts`); split view | ARCH-05 |

**Phase 2 status.**

- **2.1 done** (PR: shared artist form model). `features/festival-artists/model.ts` is the single defaults/mapping table for the desktop form, the mobile sheet and the mobile category editor; the form sections take typed slices of form data instead of `any`.
- **2.2 done.**
  - Data access lives in `features/festival-artists/` (`api.ts`, `keys.ts`, `hooks/`). The artist hooks moved there, and `ArtistTable`, `FestivalArtistManagement` and `CopyArtistsDialog` no longer query Supabase directly (five source-boundary exemptions removed). The three editors read and save through `api.ts` too.
  - `FestivalArtistManagement` 750 → 383 lines, `ArtistTable` 793 → 347, `CopyArtistsDialog` 623 → 178 (split into `artist-table/` and `copy-artists/`).
  - Dead code removed from the page: `handlePrintTable` (the print dialog has always generated its own PDF) and its `console.log` tracing.
  - Gear comparisons are derived with `useMemo` instead of effect + state, and gear setups refetch on mount so the table never compares against a stale setup.
  - **Deviation from the plan:** copying artists is *not* an RPC. It is already a single `INSERT` (atomic), and an RPC would duplicate `rebaseSoundcheckDate` in SQL. The row-building rules moved to the pure, tested `copyArtists.ts`. Revisit if copies ever need server-side authorisation beyond RLS.
  - BUG-07's stale `soundcheck_date` cast is gone.
  - Still open for this domain: `ArtistTablePrintDialog` and `ArtistFileDialog` (Phase 2.7 / 2.5) and the offline snapshot readers.

- **2.3 done.**
  - `features/festival-gear/` (`model.ts`, `api.ts`, `keys.ts`, `hooks/`) owns the gear setup and stages. `useCombinedGearSetup` moved there and now uses React Query.
  - Two `SECURITY INVOKER` RPCs (`20260929170000_festival_gear_stage_rpcs.sql`, pgTAP in `festival_gear_stage_rpcs.sql`): `save_festival_stage_gear_setup` replaces the three-statement client save of a non-primary stage (create/widen the global setup + upsert the stage row) with one transaction, and `set_festival_max_stages` sets the stage count and creates the missing named stage rows atomically. Row-level policies still decide who may write.
  - Stage rows are no longer inserted as a side effect of *reading* the gear page (FEST-DATA-04's sibling): unnamed stages read as "Stage n" through `buildFestivalStageOptions`, and renaming upserts.
  - The form only takes server data on stage change or while pristine, so a realtime refetch cannot wipe unsaved edits (tested).
  - `FestivalGearManagement` 637 → 174 lines and `FestivalGearSetupForm` 767 → 114; desktop and mobile layouts render from one section list (`GearSetupSections`), and the stage tabs are `StageSelector`.
  - Dead code removed from the page: the print-options dialog and `handlePrintAllDocumentation` (nothing ever opened the dialog).
  - Still open: `PushToFlexPullsheetDialog` (2.8), the shell's gear reads (2.6), and per-stage rows for `max_stages` beyond what is created on demand (ENH-05).
- **2.5 done.**
  - `features/festival-forms/` gains `api.ts`, `links.ts`, `emailTemplate.ts`, `blankTemplate.ts`, `blankTemplatePdf.ts`, `keys.ts` and hooks (`useArtistFormSend`, `useArtistFormLinks`); the new `features/festival-assets/` owns logos and rider files (`api.ts`, `keys.ts`, hooks).
  - The four components drop from 614/439/354/385 to 142/231/73/156 lines and no longer touch Supabase (four source-boundary exemptions removed; lint baseline 991 → 985).
  - The send flow keeps the send-owned token lifecycle of #969 (a token is minted only by the send action); the existing dialog test still pins it. The two copies of the blank-template skeleton became one `buildBlankArtistPdfData`, and the email body is a pure, tested `buildArtistFormEmail` (the link is now HTML-escaped inside the `href`).
  - Artist-file batch uploads keep their all-or-nothing rollback, now covered by tests (`uploadArtistFiles`).
  - **Deviation from the plan:** the bulk "copy all links" action is client-side text over already-fetched rows (no writes), so there is no bulk-link RPC to build; the plan's DATA-03 note for this screen no longer applies.
  - Small behaviour changes: "copy all links" orders stages ascending with "Sin escenario" last (before, first appearance in the list); a file row with no `file_type` no longer crashes the artist file dialog; the logo view refetches on open because its URL is signed for an hour.
  - Still open in Phase 2: 2.6 (shell and realtime), 2.7 (print) and 2.8 (Flex pullsheet).
- **2.6 done.**
  - **Realtime (ARCH-03):** the shell's raw `supabase.channel('job-…-updates')` is gone. `useFestivalManagementVm` now registers its `jobs` subscription through `useRealtimeSubscription`, so it goes through the unified manager (multi-tab leader election, route-aware cleanup) and invalidates the two shell queries via the new `festivalManagementKeys`. The artists and gear pages already used this path; scheduling's `useTableSubscription` use is unchanged.
  - **Silent background refreshes:** the old channel refetched with `silent: true`. Invalidation cannot pass that flag, so `useFestivalJobData` now stays quiet when a refetch nobody asked for fails while data is already on screen, and still reports a failed first load and a failed refresh the user requested (tested). Failures go to error tracking instead of `console.error`.
  - **Festival list (ARCH-06):** the server-side filter and pagination had already landed (#970). Logos are now one batched lookup per visible page (`festivalLogos.ts`: three `in` queries instead of up to two per festival, then the shared cached URL resolvers, extracted from `logoUtils` as `resolveFestivalLogoUrl` / `resolveTourLogoUrl`). Tours without a `tour_logos` row still fall back to a storage search, once per distinct tour. The resolvers no longer log signed URLs.
  - **Size (ARCH-05):** `FestivalManagementView` 789 → 55 lines, split into `management/FestivalManagementHeader`, `FestivalQuickActions` and `FestivalDocumentsCard`. Markup is unchanged.
  - Still open: `FestivalManagementDialogs` (530 lines), the remaining `console.*` in the shell, and 2.7/2.8.

### Phase 3: enhancements (after Phase 2 lands for the relevant sub-domain)

Suggested order, by value and dependency: **ENH-01** (labels and defaults; module hiding deferred by decision) → **ENH-02** (production send flow, ciclo-first) → **ENH-04** (change log / rider versions) → **ENH-06** (mismatch → quote) → **ENH-05** (first-class stages, needs 2.3) → **ENH-03** (shifts ↔ timesheets, now delivered inside SCH-E) → ENH-08 / ENH-07 / ENH-09. The scheduling redesign (§4b SCH-A…E) runs in parallel: SCH-A can start right after Phase 0 because it needs no schema change.

## 6. Ratchets and exit targets

When each phase lands, lower the baselines with `--write-baseline` so the gains are locked in.

**Measured 2026-09-30**, on `main` plus the open Phase 2.8 and SCH-B PRs (the last two Phase 2 increments). "Baseline" is the 2026-09-28 audit snapshot.

| Metric | Baseline | Measured 2026-09-30 | After Phase 2 target |
| --- | --- | --- | --- |
| Festival-scope lint warnings | 58 | **6** (3 `exhaustive-deps`, 3 `no-explicit-any` in one test file) | ≤ 5 |
| Source-boundary exemptions in festival files | 26 | **1** (`ArtistRequirementsForm.tsx` imports `dataLayerClient`) | 0 |
| Files querying `festival_*` outside `features/festival-*` | 56 | **29** (of 39 in all of `src`, excluding tests) | ≤ 10 (PDF context, offline snapshot, technician app) |
| Files ≥ 740 LOC | 9 | **1** (`ArtistRequirementsForm.tsx` 759; the next is 530) | 0 |
| Files ≥ 600 LOC | 13 | **1** | – |
| Source files / LOC (festival paths, excluding tests) | 127 / 30,646 | 203 / 31,152 (more, smaller files: LOC +1.7%) | – |
| `as any` + `as unknown as` | 44 | **13** (0 + 13) | ≤ 10 |
| `console.log` | 194 | **32** (`console.*` 420 → 126) | 0 (keep `console.error` only where `errorTracking` also reports) |
| Mobile type-floor entries in festival files | 31 in 9 files | **30 in 8 files** (`ArtistTableRow` 14, `MobileArtistCard` 10) | – |
| Components fetching in `useEffect` (rough grep) | 19 | **~1** | 0 |
| Festival unit/component test files | 18 | **59** | – |
| Festival tables with pgTAP policy tests | ~4 of 13 | 8 suites (artists, soundcheck date, form tokens, gear/stage RPCs, push feed, shift integrity, stages, workspace read scope) | 13 of 13 |
| Realtime mechanisms in festival code | 3 | **1** (`useRealtimeSubscription`; no raw `supabase.channel`, no `useTableSubscription`) | 1 |

Not yet at target: the last `dataLayerClient` import and the last file over 740 lines are the same file (`ArtistRequirementsForm.tsx`, the public artist form), the 3 test-file `any`s, 13 `as unknown as`, and the 29 files that still read `festival_*` tables directly (mostly the technician app, offline snapshot and PDF context, which the target allows up to 10 of; the rest need a look).

Consider a module-scoped gate, `governance:festival`, that fails when a new file under `src/components/festival/` imports `dataLayerClient`. The global source-boundary check already does this, so the gate would only mean zeroing the festival entries and not granting new exemptions.

## 7. Decisions (2026-09-28)

1. **`tourdate` → workspace: keep.** Tour dates keep the "Gestionar Trabajo" entry. FEST-BUG-02 drops to P3 (labelling only).
2. **Every job type gets the same workspace for now.** `festival`, `ciclo`, `single`, `evento` and `tourdate` all see every module. ENH-01 changes only the labels and defaults, and it keeps a `modules` switch so hiding a module later is trivial.
3. **Technicians see only their own department's shifts.** This applies to `festival_shifts` and `festival_shift_assignments` in Phase 0.2. "Own department" means the departments where the technician holds a role on that job (`sound_role`/`lights_role`/`video_role`/`production_role`). Shifts with no department and shifts the technician is personally on stay visible. `house_tech` keeps its current operational read, like `festival_artists`. Revisit if house techs should be department-scoped too.
4. **Production sends the public artist form, and it is expected mainly for `ciclo`.** Tokens are minted only on send (Phase 1.6), the send action belongs to production, and the ENH-02 bulk and pre-fill features target ciclos. The feature stays available on every job type.

## Appendix: production queries used (read-only)

- `pg_policies` for `public.festival%` (SELECT/ALL predicates and roles).
- `pg_class.reltuples` for `festival%` tables (approximate row counts).
- `festival_artist_forms` status/expiry counts. `festival_artist_form_submissions` row count.
- Per-`job_type` counts of jobs with artists, shifts and gear setups.
- Scheduling usage (§4b): shift, day and job counts; overnight shifts; external versus internal assignments; duplicate and overlapping assignments; shifts edited after creation; the most common shift names.

No row contents were read. Before writing each migration, re-run the policy query, because production has drifted from the migration chain (DB-06).
