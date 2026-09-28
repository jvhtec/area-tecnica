# 2026-09 Festival Module Audit and Roadmap

**Audit date:** 2026-09-28
**Baseline reviewed:** `main` at `9d2907d`
**Scope:** everything behind `/festival-management/:jobId` and `/festivals` — the management shell, artists, gear/stages, scheduling (shifts), public artist form, rider library, print/PDF, offline mode, push feed, Flex pullsheet — plus the DB tables and RLS they use. The same screens serve `festival`, `ciclo`, `single`, `evento` (and, by accident, `tourdate`) jobs, so all of those uses are in scope.
**Method:** a static pass over the 127 non-test source files (30.6k LOC), a review of the governance baselines (lint-warning, source-boundary, mobile-type-floor, file-size), a read of the migrations and pgTAP suites, and **read-only** queries against production (`pg_policies`, row counts, and usage aggregates by job type; no row contents were read). This is a backlog. Nothing in this document has been fixed yet.

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
| ENH-03 | **Tie shifts to timesheets.** Link `festival_shift_assignments` to `job_assignments`. Detect overlapping shifts for the same tech on the same day and across jobs, reusing matrix conflict detection. Optionally pre-fill timesheet hours from shifts (the server-side `compute_timesheet_hours` stays authoritative). Only 26 jobs use shifts today, possibly because they duplicate work. | Removes double entry and catches double-booking that the matrix currently can't see. | L |
| ENH-04 | **An artist change log and rider versions.** Record who changed which technical field and when (the activity catalog already exists). Keep previous rider files as versions instead of replacing them, and show "changed since last print" in the PDFs. | Riders change the week of the show, and crews ask what changed. The `rider_outdated` flags only cover copies. | M |
| ENH-05 | **First-class stages.** Make `festival_stages` authoritative: create N rows when `max_stages` is set, reference stages by id (keeping the number for display), and allow renaming or reordering. Put per-stage gear, crew and schedule on one stage page. | It fixes FEST-ARCH-04 and enables per-stage WhatsApp groups and PDFs without mapping numbers to names. | L (migration + backfill) |
| ENH-06 | **Automatic gear-mismatch → extras quote.** The mismatch detection and `useCreateExtrasPresupuesto` already exist. Add a festival-wide "requirements vs inventory" summary per day and stage, with one-click grouped extras into Flex. | It turns an existing indicator into a planning tool. | M |
| ENH-07 | **Mobile field mode for stage managers.** A read-first day view per stage (running order with live "now/next", changeover countdown, contact for the artist's production), which works offline on the existing snapshot. | The offline infrastructure already exists and is used today mainly for documents. | M |
| ENH-08 | **Templates for recurring events.** Save a festival's stages, gear setup, shift pattern and form settings as a template, and apply it to the next edition or to a `ciclo` date. `CopyArtistsDialog` and `CopyShiftsDialog` already do half of this, per day. | Ciclos and annual festivals reuse the same structure every time. | M |
| ENH-09 | **Show-day status on the wallboard and push feed.** Publish the running order (on stage / changeover / delayed) from the stage manager view to the wallboard preset and the festival push feed. | It reuses two existing channels. | S–M |

## 5. Roadmap

Each item is sized to be one PR. Phases can overlap. Phase 0 blocks nothing else and should ship first.

### Phase 0: containment (this week)

| # | Item | Findings | Exit criteria |
| --- | --- | --- | --- |
| 0.1 | Close form-token exposure: role-limit `festival_artist_forms` and `festival_artist_form_submissions` `SELECT`, and give technicians a token-free status view if needed. | FEST-SEC-01 | pgTAP: an unassigned technician gets 0 rows, and no non-manager path returns `token`. Production policy diff recorded in the PR. |
| 0.2 | Job-correlate `SELECT` on shifts, shift assignments, gear setups, stage gear setups, settings, logos and stages. Shifts and shift assignments are also scoped to the technician's department on that job. | FEST-SEC-02 | pgTAP per table, including a sound tech on the job who sees sound and department-less shifts but not lights shifts, and still sees any shift they are personally assigned to. The technician super app, the offline snapshot and `push/festivalFeed` still work for an assigned tech (manual smoke plus existing tests). |
| 0.3 | Tracking entry in `docs/CODEBASE_AUDIT_2026-09-04.md`'s register (as a SEC-12 follow-up). | — | Register updated. |

### Phase 1: correctness (1–2 weeks)

| # | Item | Findings |
| --- | --- | --- |
| 1.1 | `JobWorkspaceProfile` derived from `job_type` (labels only, every module on). Drop `?singleJob`, fix the entry points, move labels to Spanish and set them per type. `tourdate` keeps its button. | FEST-BUG-01, -06, ARCH-07 (ENH-01 foundation) |
| 1.6 | Remove the automatic public-form trigger (`trg_ensure_artist_form_for_missing_rider`) and expire the unused pending tokens that were never sent. Forms are created only from production's send action. | FEST-SEC-01 hardening, ENH-02 prerequisite |
| 1.2 | `copy_festival_shifts` RPC plus assignment constraints (cleanup query first). | FEST-DATA-01, -02 |
| 1.3 | A single festival day-start source, threaded into the PDF context. | FEST-BUG-03 |
| 1.4 | Madrid timezone and `es` locale for every date in the module. Remove the 4 source-boundary date entries. | FEST-BUG-04 |
| 1.5 | Settings read with no insert side effect. Query functions throw, with no silent defaults. | FEST-DATA-04, FEST-BUG-05 |

### Phase 2: structure (3–6 weeks, one sub-domain per PR)

Each PR has the same shape: move reads and writes into `features/festival-<domain>/api.ts` with React Query and `festivalKeys`, move multi-row writes to RPCs, split the screen under 500 LOC, remove its source-boundary and lint-warning baseline entries, and add tests.

| # | Sub-domain | Files | Also closes |
| --- | --- | --- | --- |
| 2.1 | **Artist model**: shared zod schema and mapping for all four editors | `ArtistManagementForm`, `MobileArtistFormSheet`, `MobileArtistConfigEditor`, `artistRequirementsFormModel` | FEST-ARCH-01, about 32 `any` warnings |
| 2.2 | Artists list/table | `FestivalArtistManagement`, `ArtistTable`, `useArtistsQuery`, `useArtistMutations`, `CopyArtistsDialog` (RPC) | ARCH-05, ARCH-06, BUG-07 |
| 2.3 | Gear and stages | `FestivalGearManagement`, `FestivalGearSetupForm`, `gear-setup/*`, `useCombinedGearSetup` | DATA-03 (gear save RPC) |
| 2.4 | Scheduling | `FestivalScheduling`, `ShiftsTable`, `Create/Edit/ManageAssignments/CopyShifts` dialogs, `useFestivalShifts` | `confirm()` → `useConfirm` |
| 2.5 | Forms and assets | `ArtistFormLinkDialog`, `ArtistFormLinksDialog`, `FestivalLogoManager`, `ArtistFileDialog` | DATA-03 (bulk links) |
| 2.6 | Shell and realtime | `useFestivalManagementVm` channel → `useTableSubscription`, `FestivalManagementView` split, `Festivals` page server-side filter and batched logos | ARCH-03, ARCH-06 |
| 2.7 | Print | `usePrintOptionDownloads`, `PrintOptionsDialog`, `festivalPdfGenerator` split by section | ARCH-05 |
| 2.8 | Flex pullsheet | `PushToFlexPullsheetDialog` → model already extracted (`push-to-flex-pullsheet/model.ts`); split view | ARCH-05 |

### Phase 3: enhancements (after Phase 2 lands for the relevant sub-domain)

Suggested order, by value and dependency: **ENH-01** (labels and defaults; module hiding deferred by decision) → **ENH-02** (production send flow, ciclo-first) → **ENH-04** (change log / rider versions) → **ENH-06** (mismatch → quote) → **ENH-05** (first-class stages, needs 2.3) → **ENH-03** (shifts ↔ timesheets, needs 2.4 and 1.2) → ENH-08 / ENH-07 / ENH-09.

## 6. Ratchets and exit targets

When each phase lands, lower the baselines with `--write-baseline` so the gains are locked in.

| Metric | Now | After Phase 2 |
| --- | --- | --- |
| Festival-scope lint warnings | 58 | ≤ 5 |
| Source-boundary exemptions in festival files | 26 | 0 |
| Files querying `festival_*` outside `features/festival-*` | 56 | ≤ 10 (PDF context, offline snapshot, technician app) |
| Files ≥ 740 LOC | 9 | 0 |
| `as any` + `as unknown as` | 44 | ≤ 10 |
| `console.log` | 194 | 0 (keep `console.error` only where `errorTracking` also reports) |
| Festival tables with pgTAP policy tests | ~4 of 13 (artists, files, stages, push) | 13 of 13 |
| Realtime mechanisms | 3 | 1 |

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

No row contents were read. Before writing each migration, re-run the policy query, because production has drifted from the migration chain (DB-06).
