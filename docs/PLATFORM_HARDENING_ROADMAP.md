# Área Técnica: Platform Hardening & Architecture Roadmap

**Established:** 2026-10-08  
**Status:** Living plan; baseline measurements and phase gates require verification  
**Scope:** React/TypeScript, Supabase/Postgres, Edge Functions, integrations, CI, deployment, operations  
**Safety:** Documentation-only proposal. No production changes authorized by this roadmap.

## North star

Turn a heavily used, organically grown, rule-complete operational prototype into a predictable, maintainable platform. Preserve production behavior unless an explicitly documented bug or product decision changes it. Every business concept should have one authoritative owner, with database invariants enforced server-side and workflows covered end-to-end.

This is **not** a blanket rewrite, nor a mandate to reduce table/migration counts. Changes are justified by observed defects, inconsistency, coupling, risk, or maintenance cost.

## Non-negotiable gates

1. **Production parity:** capture golden workflows and representative real data before altering critical paths; enumerate intentional behavior changes.
2. **Safety:** production backup/PITR and restore rehearsal, dev/staging isolation, rollout and rollback procedures for data and code, owner approval for destructive operations.
3. **DB authority:** RLS, grants, RPC authorization, concurrency/atomicity, foreign keys, uniqueness, exclusion and temporal invariants reviewed together.
4. **Evidence:** automated unit/integration/contract tests, actual Postgres migration and PgTAP tests, UI E2E for critical journeys, failure-injection where useful. A typecheck alone does not prove correctness.
5. **Observability:** structured error reporting, durable operation IDs, audit events, and reconciliation signals before high-risk refactors.
6. **Release gate:** green required CI, zero unresolved blocking review threads, migration dry-run, deployment order documented, explicit human production smoke checks.
7. **Incremental delivery:** small domain-scoped PRs, no simultaneous dual writers without reconciliation, no irreversible destructive cutover without verified backfill and rollback plan.

## Baseline (Phase 0): measure before changing

- [ ] Inventory current production schema, tables, views, functions, triggers, RLS, grants, extensions, storage, jobs, Edge Functions, and migration history. Snapshot normalized definitions; do not expose secrets or personal data.
- [ ] Build a dependency graph: UI routes -> hooks/services -> RPC/Edge -> tables -> outbound integrations; identify each table's authoritative domain owner.
- [ ] Establish quantitative dashboard: TS strictness/any counts, lint/CodeQL findings, dependency vulnerabilities, test coverage by critical workflow, E2E pass rate, migration replay success, duplicated read/write surfaces, flaky tests, bundle sizes, operational incidents.
- [ ] Classify findings P0 (data loss/security), P1 (wrong results/races), P2 (maintainability), P3 (cosmetic); record reproduction, affected workflows, owner, proposed change, tests, rollback and status.
- [ ] Document production baseline workflows and contract tests, including permissions and rejected/failed paths.
- [ ] Identify deployed migrations versus Git files and confirm dev/staging databases are isolated. Never assume a new migration was not applied.
- [ ] Create a traceability matrix mapping every roadmap item to issue/PR, tests, deployment steps and evidence.

**Exit:** auditable baseline report, risk register, dependency map and prioritised backlog. This phase should be read-only.

## Phase 1: production safety net and release engineering

- [ ] Restore-test a scrubbed production backup in an isolated environment; verify counts, key relationships, RLS and representative workflows.
- [ ] Validate fresh database bootstrap and migration replay in CI; run real PostgreSQL/PgTAP tests rather than mocking DB semantics.
- [ ] Harden CI ratchets: typecheck, lint, unit/integration, build, security scanning, migration checks and targeted E2E; document unavoidable environmental limitations instead of silently skipping.
- [ ] Introduce deployment checklist and automated preflight: migration dependencies, compatibility window, Edge Function deployment order, rollback/forward-fix path, smoke checks.
- [ ] Establish minimal monitoring for failed RPCs, permission denials, async integration failures, stale data and inconsistent state.

**Exit:** repeatable staging deploy, tested restore, and enforced CI/release gates.

## Phase 2: canonical staffing and personnel lifecycle (highest operational risk)

**Existing work:** staffing matrix observability, direct assignment and manual assignment hardening (PRs #990/#992/#994 and successors). Reassess merged HEAD and production rather than treating past reviews as current.

- [ ] Specify the complete assignment state machine: available, offered, accepted, declined, direct-assigned, changed, cancelled; document authority, notification and compensation behavior.
- [ ] Prove manual and direct paths converge on the same canonical assignment invariants, permissions and rate rules. Production roles must not accidentally receive technician rates.
- [ ] Test overlapping assignments, retries, duplicate requests, stale responses, concurrent edits, time zones, multi-date tours, declined invitations, unavailable technicians, leave, partial failures and unauthorized actors.
- [ ] Reconcile emails/WhatsApp delivery with canonical state; ensure idempotent sends and recovery without phantom assignments.
- [ ] Preserve operational data and ensure read/write behavior remains identical except documented defects.

**Exit:** behavioral contract suite, live-like concurrency tests, no critical unresolved defects, documented human UAT.

## Phase 3: Hoja de Ruta, tours, festivals and job lifecycle

- [ ] Reverify the Hoja de Ruta remediation work following PR #961 and later changes: persisted accommodations/restaurants/media, section export isolation, atomic saves, concurrency, dirty tracking, crew eligibility, rooming identity, contacts, logistics and published snapshots.
- [ ] Define canonical boundaries among job, tour, tour date, festival, tour ops and published Hoja. Document which data is live and which is a snapshot.
- [ ] Cover creation/update/cancellation/export of each job type, backdated dates, bulk operations, permissions, and cross-module propagation.
- [ ] Add PDF/document contract tests for output sections, privacy, formatting and repeatable generation.

**Exit:** no contradictory ownership or silent data loss across planning and published documents.

## Phase 4: logistics and fleet consolidation

**Active dependency:** external contributor draft PR #997. Treat its useful UI as reusable, not its proposed parallel domain model.

- [ ] Map material requests -> logistics events -> driver/vehicle assignments; represent personnel transfers with canonical `logistics_events.event_type='crew_transfer'`.
- [ ] Reject duplicate canonical tables for personnel plans, operations, hotels, transport providers, and reports. Use Hoja/tour accommodations, canonical crew reporting, activity logging and existing provider field.
- [ ] Implement vehicle unavailability as general-purpose vehicle blocks (maintenance, repair, inspection, breakdown, cleaning, reservation); enforce conflicts in PostgreSQL, not only in UI.
- [ ] Preserve driver leave using existing availability/vacation data; confirm server-side checks and concurrency safety.
- [ ] Separate demand status, event execution status and assignment response status. Define ownership and transition rules.
- [ ] Fix event deletion with future assignments, cancellation behavior, driver declines, half-open time intervals, responsibility permissions and atomic location creation.
- [ ] Keep useful calendars, work queues, conflict displays and service history as projections over canonical data.
- [ ] Verify vehicle/driver concurrency, double-booking, cancellations, assignment declines, timezone and daylight-saving boundaries.

**Exit:** one source of truth per logistics concept; PR #997 is not merged until this is proven.

## Phase 5: money and commercial correctness

- [ ] Inventory every rate, fee, estimate, expense, allowance, invoice-adjacent field, report and export; identify who may read/edit/approve each.
- [ ] Define canonical ledger-like expense and rate ownership, currency/precision, tax treatment, auditability, effective dates, approvals and immutable historical snapshots where necessary.
- [ ] Separate operational estimates from approved/actual costs. Remove competing finance surfaces only after their unique behavior is catalogued.
- [ ] Test rate eligibility by role, historic rate changes, adjustments, cancellations, concurrency, totals, rounding, exports and access controls.
- [ ] Decide accounting-system integration boundaries explicitly; do not quietly turn Área Técnica into an accounting system.

**Exit:** reconcilable financial outputs, documented permissions and historical correctness.

## Phase 6: shared platform architecture and integration resilience

- [ ] Audit permissions consistently across frontend guards, Postgres RLS, RPCs, Edge Functions and storage.
- [ ] Consolidate duplicate services/hooks/models, oversized files and weakly typed boundaries by domain; retain public contracts during migration.
- [ ] Standardize domain errors, typed RPC interfaces, validation, transaction boundaries, activity/audit event taxonomy and observability.
- [ ] Harden Flex folder/pull-sheet automation, Outlook/WhatsApp, printer/signage and other external integrations: idempotency, retries, deduplication, queueing, observability and recovery.
- [ ] Validate file lifecycle, retention, signed access, large exports, storage and document references.
- [ ] Profile expensive queries and UI paths against representative data; tune indexes and queries based on measurements, not guesswork.
- [ ] Maintain architecture decision records (ADRs), domain ownership map and onboarding documentation for future contributors/agents.

**Exit:** reduced duplicated authority, controlled integration failures, bounded complexity, reproducible builds.

## Phase 7: schema rationalisation (only after domain contracts stabilize)

This phase deliberately distinguishes **schema redesign** from **migration history squashing**.

1. Compare production database, canonical domain model, historical migration chain and application usage; flag obsolete tables, conflicting fields, weak constraints and undocumented privileged functions.
2. For every justified redesign use **expand -> backfill -> reconcile -> switch readers/writers -> observe -> contract**, with tests and explicit rollback windows. No destructive big-bang rewrite.
3. Verify data counts, foreign keys, aggregates, temporal invariants, authorization and domain-specific checks against production-like anonymized data.
4. Generate a clean **versioned baseline** containing schema, types, functions, triggers, RLS, grants and other required database objects. Treat storage, extensions, seed/reference data and Edge configuration explicitly.
5. Bootstrap a blank database from the baseline and a separate blank database through the old migration chain. Compare normalized resulting schemas and representative behavioral tests.
6. Preserve Git history. Do **not** apply the new baseline SQL to existing production. Reconcile migration metadata for already-provisioned environments through a separately reviewed, tested procedure.
7. Define a documented baseline cutover policy for new installs and upgrades, with archival and reproducibility requirements.

**Exit:** equivalent clean bootstrap, documented ownership, successful upgraded-instance verification and no production data loss. A lower migration count is a byproduct, not the success metric.

## Sequencing, parallelism and dependencies

- **Critical path:** Phase 0 -> Phase 1 -> Phase 2 -> Phases 3/4/5 -> Phase 6 -> Phase 7.
- Phases 3, 4 and 5 may be developed in parallel only when their shared ownership contracts are fixed and cross-domain writes have a single accountable owner.
- Security, testing, documentation and observability are continuous workstreams, not deferred cleanup.
- Prefer one production-sensitive migration track at a time; independent frontend-only work can proceed separately.
- Each phase starts with a read-only audit and a narrow implementation plan, not a rewrite commitment.

## PR checklist and reporting format

Every hardening PR must state:
- **Problem and affected workflows**
- **Canonical owner and invariants**
- **Behavior preserved vs intentionally changed**
- **Database/migration impact**, including deployment order
- **Tests executed and evidence**, with environment and limitations
- **Security/permissions review**
- **Rollback or forward-fix strategy**
- **Production human verification** and named follow-up owner
- **Debt removed and debt introduced**
- **Updated phase metrics and roadmap links**

Weekly status: phase, scope completed, open P0/P1/P2, CI and E2E results, DB replay status, risk, blockers, next merge candidates. Avoid percent-complete guesses unless tied to counted acceptance criteria.

## First execution batch

1. Publish Phase 0 evidence: current schema inventory, dependency map, critical workflow inventory and quantitative ratchets.
2. Validate staging isolation, backup restore, migration replay and CI gates.
3. Complete staffing UAT and post-merge behavior audit.
4. Refactor PR #997 to canonical logistics rather than merging duplicate persisted models.
5. Audit finance surfaces and write a domain model before implementing new cost tables.
6. Only after the above, schedule schema redesign candidates and baseline generation.

## Change control

This roadmap is a hypothesis until each finding is verified against the current repository and live schema. Past PR numbers are context, not proof of current merge readiness. Keep phase statuses and evidence current; do not mark an item complete on the basis of a code review alone.
