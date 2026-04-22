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
- **Job Assignment Matrix audit**
  - `AUDIT_REPORT_JOB_ASSIGNMENT_MATRIX.md`
  - `JOB_ASSIGNMENTS_SYSTEM_AUDIT.md`
  - `FINAL_DEEP_AUDIT_REPORT.md`
  - `ULTRA_DEEP_AUDIT_AND_WORKFLOWS.md`
- **Performance**
  - `PERFORMANCE_AUDIT.md`
  - `PERFORMANCE_AUDIT_REPORT.md`
- **Security / observability**
  - `SECURITY_AUDIT_LOGGING.md`

## Plans / Roadmaps
- `plans/` (grouped plans)
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
