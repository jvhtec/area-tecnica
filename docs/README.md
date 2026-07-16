# Área Técnica — Documentation Index

This folder currently contains a mix of:
- product notes,
- engineering audits,
- ops runbooks,
- and long-form plans.

This index helps you find what you need without having to remember filenames.

## Workflows (per-subsystem reference docs)

Detailed documentation for each major subsystem — key files, database tables, data flows, and step-by-step workflows.

- **[Hoja de Ruta](workflows/hoja-de-ruta.md)** — Route sheet builder (10-tab form, 13 DB tables, PDF/Excel export)
- **[Festival Management](workflows/festival-management.md)** — Artists, riders, gear setup, shift scheduling
- **[Tour Management](workflows/tour-management.md)** — Tour dates, crew sync, rates, Flex folders
- **[Job Assignment Matrix](workflows/job-assignment-matrix.md)** — Virtualized crew matrix, conflict detection, staffing campaigns
- **[Timesheet System](workflows/timesheet-system.md)** — Draft → submitted → approved workflow, server-side rate calculation
- **[Equipment Management](workflows/equipment-management.md)** — Stock tracking, sub-rentals, presets
- **[Rates & Payouts](workflows/rates-and-payouts.md)** — Rate catalog, approval workflow, payout overrides
- **[Activity / Audit Logging](workflows/activity-audit-logging.md)** — 30+ event types, realtime toasts, visibility controls
- **[Public Artist Form](workflows/public-artist-form.md)** — Tokenized public routes for artist rider submission
- **[SoundVision Files](workflows/soundvision-files.md)** — File library with access request and review workflow
- **[Technical PDF Sync](technical-pdf-sync.md)** — How generated technical PDFs (consumos, pesos, memorias, SV reports) stay in sync for jobs and tour dates; required triggers when adding generators/mutations
- **[Consumos power calculations](technical-tools/power-calculations.md)** — canonical equations, assumptions, validation, PDU planning policy, persisted snapshots, report aggregation, and engineering limitations


## Festival architecture (section-specific)

Detailed deep-dive docs for the full festival subsystem:

- **[Festival System Architecture Index](architecture/festival-system/README.md)**
- **[Artist Tables & Workflow](architecture/festival-system/artist-tables.md)**
- **[Gear Setup & Comparison](architecture/festival-system/gear-setup-and-comparison.md)**
- **[Scheduling Architecture](architecture/festival-system/scheduling.md)**
- **[Flex Integration Architecture](architecture/festival-system/flex-integration.md)**

## Product / workflows
- **SoundVision access workflow**
  - `SOUNDVISION_ACCESS_CHANGES.md`
  - `soundvision-access-workflow.md`
  - `soundvision-access-test-cases.md`
- **Wallboard (tokenized/public access)**
  - `WALLBOARD_TOKENIZED_ACCESS.md`
  - `WALLBOARD_STATUS.md`
  - `WALLBOARD_PRESET_DEBUG.md`

## Agent guidance (Claude, Codex, and other coding agents)
- **[Operating manual](agents/operating-manual.md)** — the working method expected of any AI agent in this repo: request reading, verification-first decomposition, provenance labeling, self-attack, answer-first communication, plus a five-question pre-send self-test
- **[PR workflow](agents/pr-workflow.md)** — agent authority boundary (prepare + shepherd; humans merge), high-risk classification, CodeRabbit protocol, quality bar, mistakes to avoid

## Operations
- **Staging setup (Cloudflare + Supabase)**
  - `STAGING_SETUP.md`
- **Security audit logging**
  - `SECURITY_AUDIT_LOGGING.md`
- **Push notifications**
  - `PUSH_NOTIFICATIONS_SUMMARY.md`
  - `PUSH_NOTIFICATIONS_IMPLEMENTATION_SUMMARY.md`
  - `push-subscription-recovery.md`
  - `pwa-push-credentials.md`
  - `pwa-service-worker-cache-control.md`
- **Timesheets reminders / deployment notes**
  - `DEPLOY_TIMESHEET_REMINDER.md`

## Engineering / audits / deep dives
- **[Current actionable findings (2026-07-15)](CODEBASE_AUDIT_CURRENT_FINDINGS_2026-07-15.md)** — consolidated register of findings still reproducible on current `main`, externally unverified operational actions, closure criteria, and historical findings intentionally retired. Supersedes the [2026-07-10 register](CODEBASE_AUDIT_CURRENT_FINDINGS_2026-07-10.md).
- **Job Assignment Matrix audit**
  - `AUDIT_REPORT_JOB_ASSIGNMENT_MATRIX.md`
  - `JOB_ASSIGNMENTS_SYSTEM_AUDIT.md`
  - `FINAL_DEEP_AUDIT_REPORT.md`
  - `ULTRA_DEEP_AUDIT_AND_WORKFLOWS.md`
- **Performance**
  - `PERFORMANCE_AUDIT.md`
  - `PERFORMANCE_AUDIT_REPORT.md`
- **Generated Supabase types**
  - Source: `src/integrations/supabase/types.ts`
  - Regenerate from the linked project with `npx supabase gen types typescript --linked --schema public > src/integrations/supabase/types.ts`
  - Last roadmap regeneration: P0-01 on 2026-05-15
- **Security / observability**
  - `SECURITY_AUDIT_LOGGING.md`

## Plans / Roadmaps
- **[2026-07 Deep Codebase Audit and Remediation Roadmap](plans/2026-07-codebase-audit-roadmap.md)** — supporting security, database, quality, reliability, performance, operations, and technical-debt plan; reconcile work against the current actionable findings register above.
- **[Codebase Maintenance Roadmap](plans/codebase-maintenance-roadmap.md)** - phased technical-debt, refactor, type-safety, performance, and ops cleanup backlog
  - Phase 0 is complete as of 2026-05-16: `npm run typecheck` is available, rigging pass/fail is disabled for unverified truss constants, and Flex lights/video business-role gaps return diagnostics.
  - Phase 1 is complete as of 2026-05-16: PDF `@ts-nocheck` suppressions are removed, `noImplicitAny` is enabled, dynamic Supabase wrappers are typed, festival gear JSON mapping is centralized, additive transactional RPCs cover tour requirement/logistics replacement writes, and the `src` `as any` count is down to `325`.
  - Phase 2 is complete as of 2026-05-16: component/page Supabase ownership is behind the shared data-layer boundary, generic query keys use `queryKeys`, the highest-use tour-management mutations share feedback/invalidation handling, and wallboard-sensitive calendar dates use Madrid timezone utilities with DST tests.
  - P3-01 technician details refactor is complete as of 2026-05-16: the modal shell is under 500 LOC with data loading, document actions, formatters, and tab sections split into `src/components/technician/details-modal/`.
  - P3-02 job card actions refactor is complete as of 2026-05-16: the `JobCardActions` shell is under 500 LOC with WhatsApp, Flex opening, technical power, dialogs, and button groups split into `src/components/jobs/cards/job-card-actions/`.
  - P3-03 Flex folder creation refactor is complete as of 2026-05-16: `src/utils/flex-folders/folders.ts` is a compatibility entrypoint, while creation orchestration, dryhire handling, tourdate handling, standard job handling, commercial extras, helpers, and shared creation types live under `src/utils/flex-folders/folder-creation/`.
  - P3-04 Consumos/Pesos refactor is complete as of 2026-05-16: shared power and weight calculations, persistence payload builders, PDF upload/task-completion wrappers, and reusable power table controls live under `src/features/technical-tools/`, while department pages keep their department-specific labels, catalogs, and export categories.
  - P3-05 festival management VM refactor is complete as of 2026-05-17: the VM composition hook is under 500 LOC, with query hooks, command wrappers, and derived selectors split under `src/features/festival-management/`.
  - P3-06 assignment matrix refactor is complete as of 2026-05-17: page controls, virtualization state, technician ordering, dialogs, and cell rendering are split across focused matrix modules.
  - P3-07 push broadcast refactor is complete as of 2026-05-17: the Edge Function entrypoint delegates to event-family handlers, shared delivery/recipient helpers, and pure message builders under `supabase/functions/push/broadcast/`.
  - P3-08 PDF exporter refactor is complete as of 2026-05-18: shared jsPDF setup, logo data URL loading, corporate header/footer drawing, AutoTable final-Y access, safe image insertion, and blob output live in `src/utils/pdf/exportHelpers.ts`.
  - Phase 4 is complete as of 2026-05-18: `npm run perf:baseline` writes bundle, route timing, React Profiler, Lighthouse, and mobile screenshot artifacts to `docs/performance/phase-4-baseline/`, and those baseline artifacts are committed; the global create-job dialog is interaction-lazy; About/changelog artwork now uses WebP payloads; route-owned subscriptions clean up on authenticated shell unmount; and mobile workflow screenshots cover dashboard, matrix, technician app, public artist form, and wallboard.
  - P6-03 source placeholder cleanup is complete as of 2026-05-15; deferred source work should reference a durable roadmap or issue ID rather than bare TODO/FIXME/HACK comments.
- `migrations/` (migration notes)

## Screenshots
- `screenshots/` (README gallery images)

---

## Next documentation upgrades (planned)
- Rewrite root README to reflect the full product surface.
- Add a bilingual **in-app user manual** (ES/EN) with updated screenshots.
- Create structured folders:
  - `docs/product/`, `docs/operations/`, `docs/engineering/`, `docs/user-manual/`
  while keeping the existing documents (we can migrate incrementally).
