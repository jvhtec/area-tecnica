# Enterprise-Grade Roadmap (2026-03-10)

## Purpose
Define a decision-ready roadmap to move Area Tecnica from a fast-moving product baseline to enterprise-grade operational reliability, security, and delivery standards without breaking current workflows.

## Current Baseline
- `dev` and `main` are synchronized with the latest hygiene and lint-baseline work.
- ESLint is now actionable in CI with `0` errors and visible warning debt.
- Test suites and build are green.
- Repository hygiene issues caused by tracked generated artifacts were removed.

## Target Operating Model
- Every production release is reproducible, observable, and rollback-safe.
- Mainline quality gates are enforced by policy, not team memory.
- Data integrity is guaranteed by schema constraints and migration discipline.
- Incident response, ownership, and recovery expectations are explicit.

## Non-Goals
- Large feature rewrites in this roadmap window.
- Replatforming away from current stack.
- Blocking release cadence until all warning-level lint debt is eliminated.

## Workstreams
1. Delivery governance and branch protections.
2. CI/CD hardening and release controls.
3. Test strategy maturity and coverage enforcement.
4. Database reliability and migration safety.
5. Security controls and secret handling.
6. Observability, SLOs, and incident operations.
7. Performance and front-end operational budgets.
8. Documentation and ownership model.

## Phased Plan

### Phase 1 (Week 1): Governance Baseline
Deliverables:
- Enforce branch protection for `main` and `dev`:
  - no direct pushes
  - required PR review
  - required status checks
  - required up-to-date branch before merge
- CODEOWNERS file for critical areas:
  - `supabase/**`
  - `.github/workflows/**`
  - `src/integrations/**`
  - `src/hooks/**`
- PR template with mandatory:
  - risk assessment
  - test evidence
  - rollback plan
  - migration impact section

Acceptance criteria:
- No merge to `main` is possible without required checks and review.
- Every PR includes explicit risk and rollback sections.

### Phase 2 (Weeks 2-3): CI/CD Hardening
Deliverables:
- Required pipeline checks:
  - `npm run lint`
  - `npm run test:critical`
  - `npm run test:run`
  - `npm run build`
- Add changed-file based test matrix for faster feedback and full nightly run.
- Add migration validation job:
  - SQL lint/static checks
  - migration ordering validation
  - dry-run migration in isolated environment
- Add deployment promotion policy:
  - `dev` deploys to preview/staging
  - only approved release PR promotes to `main`

Acceptance criteria:
- 100 percent of merges to `dev` and `main` pass the required checks.
- Median CI duration for PR checks stays below 15 minutes.

### Phase 3 (Weeks 4-5): Test Maturity and Quality Gates
Deliverables:
- Define minimum test gate by area:
  - critical flows must keep integration coverage
  - regressions require reproducer tests
- Add flake tracking and quarantine process:
  - flake label and owner
  - SLA to resolve or remove flaky tests
- Introduce warning burn-down policy:
  - promote selected lint rules from warning to error per sprint
  - track remaining warning count as KPI

Acceptance criteria:
- No flaky test remains unowned for more than 7 days.
- Lint warning count trends down each sprint.

### Phase 4 (Weeks 6-7): Data and Migration Reliability
Deliverables:
- Schema safety standards for new tables and changes:
  - FK constraints
  - not-null/default strategy
  - index review
  - RLS and policy review
- Migration template requiring:
  - up/down compatibility strategy
  - backfill strategy
  - lock/latency impact note
- Backup and restore runbook validated in staging.

Acceptance criteria:
- Every migration PR includes compatibility and rollback notes.
- Restore drill succeeds within target RTO.

### Phase 5 (Weeks 8-9): Security and Access Controls
Deliverables:
- Secret management policy:
  - no secrets in repo
  - rotated keys and ownership registry
  - environment separation (`dev`, `staging`, `prod`)
- Dependency and code scanning in CI:
  - npm audit baseline
  - CodeQL or equivalent
- Service-role usage audit for Supabase functions:
  - least-privilege review
  - explicit allowlist for sensitive operations

Acceptance criteria:
- High-severity vulnerabilities have owner and remediation plan inside 48 hours.
- Secret rotation process is documented and testable end-to-end.

### Phase 6 (Weeks 10-11): Observability and Incident Readiness
Deliverables:
- Standardized structured logging for app and edge functions.
- Error monitoring with alert routing and ownership.
- Core service dashboards:
  - auth/sign-in health
  - assignment operations
  - messaging/email/push function success rates
  - DB error and latency trends
- On-call and incident playbook:
  - severity levels
  - communication templates
  - postmortem checklist

Acceptance criteria:
- Time-to-detect critical failures under 5 minutes.
- Postmortem generated for every sev1/sev2 incident within 72 hours.

### Phase 7 (Week 12): Performance and Release Readiness Review
Deliverables:
- Performance budgets for web bundles and key route load times.
- Core journey budgets for:
  - dashboard load
  - assignment matrix interaction
  - tour management dialog flows
- Final compliance checklist against this roadmap.

Acceptance criteria:
- Route-level SLOs and performance budgets are green for release candidate.
- All workstreams have named owners and next-quarter backlog items.

## KPIs to Track Weekly
- PR lead time (open to merge).
- Change failure rate (hotfixes or rollbacks required).
- Mean time to recovery (MTTR).
- CI success rate and median pipeline duration.
- Test flake rate.
- ESLint warning count.
- High-severity vulnerability open age.

## Ownership Model
- Engineering lead: roadmap governance and release gate authority.
- Frontend owner: UI quality, performance budgets, route SLOs.
- Data owner: schema policy, migrations, restore drills.
- Platform owner: CI/CD, observability stack, incident operations.
- Security owner: secret lifecycle and vulnerability response.

## Immediate Next Actions (This Week)
- Create an epic and child issues per phase.
- Set branch protections and required status checks.
- Introduce PR template and CODEOWNERS.
- Start warning burn-down with top three warning-producing areas.

## Tracking
- Master issue: create from this document and keep progress updated there.
- Source of truth: `docs/plans/2026-03-10-enterprise-grade-roadmap.md`.
