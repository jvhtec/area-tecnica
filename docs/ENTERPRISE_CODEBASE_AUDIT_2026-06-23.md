# Enterprise Codebase Audit and Roadmap — 2026-06-23

## Audit scope

- Product: Area Tecnica / Sector Pro
- Audited source: `origin/main`
- Commit: `e00aa3d77ea8d0a7bceaf565a8f9541c42242239`
- Production runtime checked: `https://sector-pro.work/` on 2026-06-23
- Database checked: linked production Supabase project
- Repository controls checked: `jvhtec/area-tecnica` GitHub rules, Actions, and security settings
- Previous work reviewed:
  - `docs/CODEBASE_AUDIT_2026-06-09.md`
  - `docs/CODEBASE_AUDIT_2026-06-12.md`
  - `docs/plans/codebase-maintenance-roadmap.md`
  - `archive/2026-03-repo-cleanup/docs/plans/2026-03-10-enterprise-grade-roadmap.md`
  - `SECURITY.md`
  - `ARCHITECTURE.md`
  - staging, privacy, retention, and monitoring documentation

This was a source, production-control, database, CI/CD, security, testing, architecture, PWA, privacy, and operational-readiness audit. It did not perform destructive exploitation, production data extraction, or external penetration testing.

## Executive verdict

Area Tecnica is a capable production product with a stronger engineering baseline than the earlier audits suggest. Type checking, unit tests, build validation, lazy loading, bundle budgets, migration discipline, and several previously critical security paths have improved materially.

It is **not enterprise grade yet**.

The immediate blockers are not component size or stylistic debt. They are:

1. A confirmed self-service privilege-escalation path through `profiles`.
2. Backend integration secrets returned to browser code.
3. Privileged `SECURITY DEFINER` functions executable by inappropriate roles.
4. Over-permissive availability and vacation RLS.
5. Production SQL functions that fail live database linting.
6. Merge, supply-chain, secret-scanning, deployment, observability, recovery, and privacy controls that are documented more strongly than they are enforced.

Recommended classification:

| Domain | Current grade | Enterprise blocker |
| --- | --- | --- |
| Authentication and authorization | D | Confirmed role escalation |
| Secret management | D | Backend credentials delivered to browsers |
| Database security and integrity | D+ | Unsafe function grants, permissive RLS, live SQL errors |
| Delivery governance | C- | Zero required approvals; incomplete required checks |
| Supply-chain security | D+ | No tracked lockfile, no secret scanning, no code scanning |
| Testing and quality gates | C | Good test count, very low effective coverage |
| Architecture and maintainability | C+ | Useful foundations, large grandfathered debt |
| Observability and incident readiness | D | No external error telemetry, alert routing, or SLOs |
| Backup and disaster recovery | D | No current RPO/RTO or verified restore drill |
| Privacy and data lifecycle | D+ | Policy/runtime mismatch and no enforced lifecycle |
| PWA and performance | B- | Good build controls; limited production measurement |

## What is working well

- `npm run typecheck` passes.
- At the audit baseline `e00aa3d7`, `npm run test:run` passed: 169 files and 1,034 tests.
- At the Phase 0 implementation commit `5ab97b6`, `npm run test:run` passed: 169 files and 997 tests. The lower test count is from consolidating Flex-secret delivery tests around the new proxy contract.
- `npm run build` and the bundle-budget check pass.
- Production source maps are disabled.
- Routes are lazy-loaded and heavy map/PDF/spreadsheet dependencies are split.
- The current build remains inside the committed bundle budget:
  - total JavaScript gzip: approximately 2.76 MB of a 3.01 MB ceiling
  - largest entry chunk: approximately 164.6 KB gzip
- `npm run governance` prevents new violations in selected source boundaries.
- The latest `origin/main` migration set matches the production migration history; `supabase db push --dry-run` reports the remote database is up to date.
- Earlier critical findings were genuinely fixed, including broad anonymous sensitive-table reads, image-proxy SSRF, default passwords, wallboard fallback credentials, staffing token logging, Flex retry/idempotency gaps, WhatsApp quotas, and unsanitized payout preview HTML.
- The repository has a route policy manifest, a unified subscription manager, shared Flex retry logic, shared Brevo mechanics, and an Edge Function HTTP wrapper. These are useful foundations.

## Confirmed findings

### ENT-SEC-01 — Critical — Users can promote their own profile role

**Evidence**

- `supabase/migrations/20260217233500_advisor_security_hardening_phase2_rls.sql:117-132`
- `supabase/migrations/00000000000000_production_schema.sql:6297-6330`
- `supabase/migrations/00000000000000_production_schema.sql:10272-10274`

The active `profiles_update` policy permits a user to update their own row. Authenticated users have table-level `UPDATE`, and no later trigger or column-level privilege restriction prevents modification of privileged columns such as:

- `role`
- `department`
- `assignable_as_tech`
- `soundvision_access_enabled`
- other authorization-relevant flags

An authenticated technician can therefore set their own role to `admin` or `management`. Most RLS policies and Edge Functions trust `profiles.role`, so this is a platform-wide authorization bypass.

**Impact**

- Administrative data access.
- User, staffing, finance, expense, and payout operations.
- Access to management-only Edge Functions.
- Access to the secret-returning function described in ENT-SEC-02.
- Ability to modify role-gated tables and invoke role-gated RPCs.

**Required remediation**

1. Revoke general user control of authorization columns.
2. Allow self-service updates only for an explicit safe column set.
3. Move role/department/privileged-flag changes behind an admin-only RPC or Edge Function.
4. Add an immutable security audit row for every privilege change.
5. Add RLS tests proving technicians cannot change any authorization attribute.

**Immediate mitigation**

- Deploy a `BEFORE UPDATE` trigger that restores protected columns unless the actor is service role or an authorized administrator.
- Review `profiles` audit/history for unexpected role changes.

### ENT-SEC-02 — Critical — Backend integration secrets are returned to browser code

**Evidence**

- `supabase/functions/get-secret/handler.ts:7-8`
- `supabase/functions/get-secret/handler.ts:128-171`
- `src/lib/api-service.ts:18-45`
- `src/components/project-management/apiService.ts:101-128`
- `src/services/flexPullsheets.ts:33-50`
- `src/services/flexWorkOrders.ts:15-32`
- `src/utils/flexUrlResolver.ts:165-225`
- `src/utils/flex-folders/api.ts:14-54`

`get-secret` returns raw values for:

- `X_AUTH_TOKEN`
- `OPENAI_API_KEY`
- `GOOGLE_MAPS_API_KEY`

The Flex token is then cached in browser memory and sent directly from the browser to Flex. Any authorized browser user can retrieve it through DevTools, runtime instrumentation, an XSS payload, or a compromised extension. ENT-SEC-01 makes the management check bypassable by any authenticated user.

`src/lib/api-service.ts` also attaches the retrieved token to a caller-provided URL, increasing accidental or malicious exfiltration risk.

**Impact**

- Direct credential theft and reuse outside Sector Pro.
- Unauthorized Flex reads and state changes.
- Potential external API cost or data exposure.
- Larger impact from any future XSS because Supabase sessions and integration secrets are browser-accessible.

**Required remediation**

1. Stop returning backend secrets to clients.
2. Route every privileged integration through narrow server-side proxy operations.
3. Allowlist operation type, upstream host, method, fields, and resource scope.
4. Rotate exposed integration credentials after migration.
5. Remove `OPENAI_API_KEY` and server Google credentials from the client-retrievable allowlist immediately.

### ENT-DB-01 — Critical — Privileged SQL functions have unsafe execution grants

**Evidence**

Examples in `supabase/migrations/00000000000000_production_schema.sql`:

- `clear_tour_preset_assignments`: `995-1006`, granted to `anon` at `9679-9681`
- `get_tour_complete_timeline`: `2349-2392`, granted to `anon` at `9762-9764`
- `get_tour_date_complete_info`: `2393-2419`, granted to `anon` at `9765-9767`
- `get_user_job_ids`: `2420-2428`, granted to `anon` at `9768-9770`
- `invoke_scheduled_push_notification`: `2477-2532`, granted to `anon` at `9782-9784`
- `log_activity`: `2629-2670`, granted to `anon` at `9804-9806`
- `log_activity_as`: `2671-2708`, granted to `anon` at `9807-9809`
- `sync_preset_assignments_for_tour`: `4118-4156`, granted to `anon` at `9882-9884`
- `upsert_venue`: `4923-4977`, granted to `anon` at `9987-9989`

These functions are `SECURITY DEFINER` and do not consistently enforce caller identity or authorization. Confirmed capabilities include:

- deleting or creating preset assignments
- spoofing activity actors and audit events
- invoking scheduled push behavior with a stored service-role credential
- bypassing table RLS to read tour, travel, accommodation, and assignment-derived data
- inserting/updating venue data

The schema contains many trigger functions that are harmless when called only by triggers, but broad generated grants make the function surface difficult to reason about. A scan found 41 `SECURITY DEFINER` functions granted to `anon` that either write data or lack an obvious caller-authorization check. Each must be classified rather than assumed safe.

**Required remediation**

1. Default-revoke `EXECUTE` from `PUBLIC` and `anon` for all non-public RPCs.
2. Maintain an explicit RPC privilege manifest.
3. Separate trigger-only functions from callable APIs.
4. Require identity and capability checks inside every privileged callable function.
5. Add automated schema tests that fail on new unsafe `SECURITY DEFINER` grants.

### ENT-DB-02 — High — Availability and vacation RLS allows cross-user modification

**Evidence**

- `supabase/migrations/00000000000000_production_schema.sql:9416-9419`
- `supabase/migrations/00000000000000_production_schema.sql:9493-9499`

Every authenticated user can select, insert, update, and delete any row in `technician_availability`. The policies test only that `auth.uid()` is non-null.

The `vacation_requests` insert policy allows broad technician/house-tech/admin/management roles without requiring `technician_id = auth.uid()`. The update policy allows a technician to update their own pending row but does not safely freeze ownership fields.

**Impact**

- One technician can change another technician's availability.
- Staffing recommendations and scheduling conflicts can be corrupted.
- Pending vacation ownership can be reassigned.

**Required remediation**

- Self-only insert/update/delete for technicians.
- Department-scoped management access where required.
- Protected ownership fields during update.
- RLS integration tests for every role and operation.

### ENT-DB-03 — High — Job totals RPC trusts a caller-supplied role

**Evidence**

- `supabase/migrations/20260612150000_exclude_voided_timesheets_from_payout_math.sql:126-174`

`get_job_total_amounts(_job_id, _user_role)` uses `_user_role` when supplied. A caller can pass `admin`, `management`, or `logistics`, causing the function to expose all individual payout details for a job.

**Required remediation**

- Remove `_user_role` from the public signature.
- Derive role exclusively from the authenticated actor.
- Revoke the old overload explicitly after migrating callers.

### ENT-DB-04 — High — Production database lint reports broken functions

The linked production database reported application-level errors in:

1. `public.auto_complete_past_jobs` — references missing `jobs.updated_at`.
2. `public.get_timesheet_effective_rate` — references missing `house_tech_rates`.
3. `public.find_declined_with_active_timesheets` — result type mismatch between assignment status enum/text.
4. `public.get_job_total_amounts` — ambiguous `job_id`.

These are live schema defects, not only local static warnings. `system-health` calls one of the broken functions, so the health endpoint cannot be trusted as an operational signal.

**Required remediation**

- Correct each function in additive migrations.
- Add database lint to required CI checks.
- Execute database function smoke tests against an ephemeral Supabase/Postgres instance.

### ENT-EDGE-01 — High — Public service-role and paid-API endpoints lack consistent protection

**Evidence**

- `supabase/config.toml:19-23`
- `supabase/config.toml:46-47`
- `supabase/functions/place-restaurants/index.ts:1-175`
- `supabase/functions/place-photos/index.ts:10-142`
- `supabase/functions/cleanup-corporate-email-images/index.ts:32-87`

`place-restaurants`, `place-photos`, and `cleanup-corporate-email-images` have JWT verification disabled. They do not perform equivalent robust authorization internally.

Confirmed risks:

- third parties can consume paid Google APIs through the project
- request bodies and location data are logged
- cleanup can be triggered externally using a service-role client

Some other `verify_jwt = false` functions are intentionally public and tokenized. The issue is the absence of one enforced endpoint classification model.

**Required remediation**

- Classify every function as public-token, authenticated-user, privileged-role, or service-only.
- Enforce that classification in code and `config.toml`.
- Maintain durable rate limits for high-risk public-token endpoints and finish
  polling-safe wallboard abuse controls.
- Make cleanup functions service-only.
- Remove unused Google proxy functions if the Mapbox/Wikimedia migration superseded them.

### ENT-EDGE-02 — Medium — Edge Function standardization is mostly a baseline exception

The repository contains 64 Edge Function directories, but only four current entrypoints use the shared `createHttpHandler` pattern. The governance gate permits the other 60 as grandfathered legacy functions.

At least 52 function files define wildcard CORS directly, and the shared CORS helper itself defaults to `Access-Control-Allow-Origin: *`.

Wildcard CORS is not an authorization bypass by itself, but it increases abuse surface and makes endpoint intent unclear. Authentication, authorization, method validation, request-size limits, rate limits, redaction, error shape, and correlation IDs remain inconsistent.

### ENT-WEB-01 — High — Production lacks a CSP and key browser security headers

Production response observed on 2026-06-23:

- present: `X-Content-Type-Options: nosniff`
- present: `Referrer-Policy: strict-origin-when-cross-origin`
- absent: Content Security Policy
- absent: frame protection through CSP `frame-ancestors` or `X-Frame-Options`
- absent: `Permissions-Policy`
- absent: cross-origin isolation policies where appropriate

`public/_headers` contains service-worker caching rules but no security-header policy.

Supabase sessions persist in `localStorage` (`src/lib/supabase-client.ts:32-40`). This is common for SPAs, but without a strong CSP any XSS has direct access to the session and to integration secrets exposed by ENT-SEC-02.

**Required remediation**

- Deploy CSP in report-only mode, measure violations, then enforce it.
- Add `frame-ancestors`, `Permissions-Policy`, and explicit resource origin policies.
- Define and test a third-party script policy for Cloudflare Analytics.
- Do not add HSTS without confirming the complete domain/subdomain rollout plan.

### ENT-PWA-01 — Medium — Production service worker logs full push payloads

**Evidence**

- `public/sw.js:226-234`

The service worker is copied as a static asset, so Vite's production console stripping does not remove its logging. Full push payloads and metadata are written to the browser console.

Push payloads should be treated as potentially sensitive operational data. Production logging should include event IDs and delivery outcomes, not content.

### ENT-CI-01 — High — Mainline protection does not require review or all available checks

GitHub ruleset `Protect main and dev` is active, but:

- required approving reviews: `0`
- code-owner review: disabled
- last-push approval: disabled
- required checks:
  - `npm run lint`
  - `npm run test:critical`
  - `npm run test:run`
  - `npm run build`

The workflow also runs typecheck, governance, and E2E, but those are not required by branch policy. A PR can therefore merge while those checks fail.

**Required remediation**

- Require at least one independent approval; use two for database/security/high-risk changes.
- Require CODEOWNER review for `supabase/**`, CI, auth, integrations, and security policy.
- Require typecheck, governance, E2E smoke, database lint, and migration validation.
- Require approval after the final push for high-risk changes.

### ENT-SUPPLY-01 — High — Builds are not reproducible

Before Phase 1, the repository intentionally ignored `package-lock.json` and CI ran:

```bash
npm install --legacy-peer-deps
```

Most dependencies use caret ranges. Without a committed lockfile, the same commit can resolve a different dependency graph on a later day. This weakens:

- reproducibility
- rollback confidence
- dependency review
- software bill of materials generation
- forensic comparison
- vulnerability triage

Phase 1 remediation commits and enforces `package-lock.json` as the deterministic package-management mechanism.

### ENT-SUPPLY-02 — High — Repository security automation is disabled

The GitHub repository is public. Current settings show:

- Dependabot security updates: disabled
- secret scanning: disabled
- secret scanning push protection: disabled
- code scanning: no analysis configured
- GitHub Actions SHA pinning: not required
- actions are referenced by moving tags such as `actions/checkout@v4`

A history scan of 33,995 text-like blobs found JWT-like material in historical `.env` and compiled artifacts, but no high-confidence private key or service-role credential was confirmed by the pattern set. The scan is not a substitute for GitHub secret scanning or a dedicated historical scanner.

**Required remediation**

- Decide explicitly whether a proprietary operations platform should remain public.
- Enable secret scanning and push protection.
- Enable CodeQL or equivalent.
- Enable Dependabot/Renovate with an ownership and rollout policy.
- Pin third-party Actions by full commit SHA.
- Generate an SBOM and retain it with releases.

### ENT-TEST-01 — High — Test count is healthy, but effective coverage is low

`npm run test:coverage` fails.

Observed aggregate coverage:

- lines: 15.64%
- functions: 51.82%
- branches: 65.29%

Existing focused thresholds also fail for:

- `supabase/functions/_shared/flexFetch.ts`
- `supabase/functions/_shared/whatsappQuota.ts`

Many business-critical files report 0% coverage, including:

- `supabase/functions/staffing-orchestrator/index.ts`
- `supabase/functions/send-staffing-email/index.ts`
- `src/components/jobs/cards/JobCardNew.tsx`
- `src/features/tour-ops/TourOpsManagementHub.tsx`
- `supabase/functions/create-whatsapp-group/index.ts`

The Playwright suite uses a mocked Supabase server. It is useful for UI routing and state, but it does not validate production RLS, RPCs, migrations, Realtime, storage policies, or Edge Function authorization.

### ENT-TEST-02 — Medium — E2E has a concurrency flake

The full local E2E run produced two blank-app failures in festival and project management. The same tests passed when rerun with one worker. CI forces one worker, masking the shared-state/concurrency issue.

The suite should either be isolation-safe or declare and document its serialized dependency.

### ENT-CODE-01 — High — Lint is green only because severe rules are warnings

Direct ESLint JSON output reported:

- 2,178 warnings
- 1,873 `no-explicit-any`
- 96 `react-hooks/exhaustive-deps`
- 58 `no-empty`
- 56 React refresh warnings
- 5 `react-hooks/rules-of-hooks`

`src/pages/Disponibilidad.tsx:60-81` returns before later hooks execute. This can change the hook order across renders and is a correctness bug, not style debt.

`eslint.config.js:105` explicitly downgrades `react-hooks/rules-of-hooks` to warning, allowing this defect to pass CI.

### ENT-CODE-02 — Medium — Type safety is not at the enterprise target

- `strict: false`
- `strictNullChecks` is not enabled
- 329 `as any` occurrences
- approximately 1,083 explicit `: any` occurrences

`noImplicitAny` is enabled and typecheck passes, which is a meaningful improvement. The next useful ratchet is `strictNullChecks`, domain by domain.

### ENT-ARCH-01 — Medium — The “data layer complete” status is overstated

`src/services/dataLayerClient.ts:4-8` explicitly describes itself as a legacy boundary where UI code still owns query details.

Current baseline:

- 203 UI imports of `dataLayerClient`
- governance accepts that debt against a fingerprint baseline
- source-boundary checks stop new violations but do not complete the migration

The result is naming consistency, not a true domain data layer. Query construction, authorization assumptions, error mapping, and cache behavior remain distributed through UI files.

### ENT-ARCH-02 — Medium — Realtime consolidation remains incomplete

Current baseline:

- 36 `.channel(` calls in 20 source files
- 2 calls belong to the unified manager
- approximately 34 channels remain outside the manager

The Phase 4 roadmap marked realtime subscription work complete, but the current code still has duplicate lifecycle, invalidation, reconnect, and route-cleanup risks.

### ENT-ARCH-03 — Medium — Large modules remain a change-risk multiplier

Production files above 1,000 lines: 23.

Largest examples:

- `TourOpsManagementHub.tsx`: 2,116
- `tourSchedulingService.ts`: 1,885
- `useConsumosTool.ts`: 1,690
- `send-staffing-email/index.ts`: 1,627
- `TourDefaultsManager.tsx`: 1,507
- `JobCardNew.tsx`: 1,422
- `StaffingCampaignPanel.tsx`: 1,297
- `SoundVisionInteractiveMap.tsx`: 1,293
- `TourDateManagementDialog.tsx`: 1,254
- `rates-pdf-export.ts`: 1,244

File length alone is not a defect. These modules are roadmap targets because they combine data access, policy, state machines, side effects, formatting, and UI, making security review and test isolation harder.

### ENT-OBS-01 — High — There is no enterprise production observability

The repository has:

- browser console logging
- a narrow `system_errors` table for timesheets and assignments
- local sessionStorage ErrorBoundary records
- database health views
- an in-app subscription diagnostics panel

It does not have evidence of:

- external error aggregation
- distributed traces
- correlation IDs across browser, Edge Function, database, and external APIs
- alert routing
- on-call ownership
- SLOs or error budgets
- release-health comparison
- synthetic monitoring of critical journeys

`src/lib/errorTracking.ts:22-44` serializes arbitrary context without a sensitive-field denylist. Before expanding this path, add structured redaction.

### ENT-OBS-02 — High — `system-health` is not a safe or reliable health contract

**Evidence**

- `supabase/functions/system-health/index.ts:14-67`

The function:

- uses service role
- does not perform a role check in its handler
- returns sample rows from integrity queries
- exposes internal database error messages
- depends on a function currently failing database lint

Even if gateway JWT verification is active, every authenticated caller can receive internal health samples unless an upstream policy not represented in code prevents it.

Create two endpoints:

1. A minimal liveness/readiness response with no business data.
2. A privileged diagnostic endpoint with explicit role checks and audit logging.

### ENT-DR-01 — High — Backup and recovery objectives are not operationalized

The repository has historical backup notes but no current:

- business-approved RPO
- business-approved RTO
- production backup inventory
- point-in-time recovery verification
- restore runbook
- recurring restore drill evidence
- dependency recovery plan for Cloudflare, Supabase, Flex, email, WAHA, or push

Supabase-managed backups may exist, but their configuration and tested recoverability are not evidenced in the repository. Enterprise readiness requires proof, not an assumption based on provider defaults.

### ENT-PRIV-01 — High — Privacy policy and runtime behavior diverge

**Evidence**

- `src/pages/Privacy.tsx:71-90`
- `src/pages/Profile.tsx:741-780`
- `supabase/functions/delete-user/index.ts:57`

The privacy page says users can delete their account through Profile and that personal data is deleted immediately. The profile UI instead opens an email request, and the administrative delete function explicitly prevents self-deletion.

The policy does not fully identify:

- legal entity/data controller
- legal bases by processing purpose
- processors/subprocessors
- international transfers
- complaint authority
- detailed retention schedule
- automated decision/profiling status
- verified deletion/anonymization behavior across audit, payroll, documents, backups, and external integrations

### ENT-PRIV-02 — High — Data-handling policy is not operational

`docs/secure_storage_and_data_handling_policy.md` references:

- `s3://ops-audits-prod`
- `gs://ops-shared/audit-log.xlsx`
- `security@company.example`

These appear to be placeholders, and no matching CI or operational integration exists in the repository. The document should not be treated as an implemented control.

### ENT-A11Y-01 — Medium — Accessibility has no automated release gate

No axe, pa11y, or equivalent accessibility test dependency or CI gate is present. The application uses shadcn/Radix primitives in many areas, which helps, but custom mobile workflows, dialogs, maps, tables, and large interactive cards require automated checks plus keyboard/screen-reader testing.

### ENT-DOC-01 — Medium — Security and architecture documentation has material drift

Examples:

- `SECURITY.md` still describes Vitest 2 even though the repository uses Vitest 3.
- It lists unresolved key-rotation work from February without evidence of closure.
- It says service-role keys must never be exposed to clients while `get-secret` returns backend credentials to browser code.
- `ARCHITECTURE.md` has stale migration/function counts and still references removed legacy structure.
- The maintenance roadmap marks the data-layer and realtime phases complete despite the current baselines above.
- Previous audits reported lint warning counts that covered only part of the configured lint surface.

Roadmap status must be based on measurable acceptance criteria, not the existence of helper infrastructure.

## Active feature-branch findings

The user's current worktree is on `codex/remove-matrix-unavailable-flag`, behind `origin/main`, with uncommitted matrix changes. Those changes were preserved and not modified.

The new `src/utils/matrixAvailability.ts` currently deletes all legacy `technician_availability` rows for a technician/date when clearing manual unavailability. It should delete only the intended manual `day_off` status. Legacy vacation/travel/sick records are also mapped as clearable.

Before that branch is committed:

- constrain deletion to the manual status/source
- make only manual entries clearable
- add regression tests for vacation/travel/sick preservation
- exclude the modified `supabase/.temp/cli-latest` file

## Reconciliation with previous audits and roadmaps

### March 2026 enterprise roadmap

| Claimed target | Current reality |
| --- | --- |
| Required PR review | Ruleset exists, but required approvals are `0` |
| Required quality checks | Four checks required; typecheck, governance, E2E, DB lint, and migration checks are not |
| Restore drill and RTO | No current runbook or drill evidence |
| Secret and code scanning | Disabled |
| Observability and on-call | Not implemented |
| SLOs | Not defined |

### May 2026 maintenance roadmap

| Claimed completion | Current reality |
| --- | --- |
| Data-layer phase complete | 203 UI `dataLayerClient` imports; UI still owns queries |
| Realtime phase complete | Approximately 34 unmanaged channels remain |
| Edge HTTP helper complete | Helper exists, but only 4/64 entrypoints use it |
| Performance phase complete | Build budgets exist; production RUM and route SLOs do not |
| Type phase complete | `noImplicitAny` is enabled; `strictNullChecks` and strict mode remain off |

### June 2026 audits

The June audits correctly identified and drove substantial remediation. Their primary weakness was rechecking the prior finding list more deeply than the complete authorization surface. The current privilege escalation, browser secret distribution, broad function grants, and permissive availability RLS were not surfaced.

The June 12 addendum is accurate for the fixes it lists. Those fixes should be retained.

## Enterprise roadmap

The roadmap is ordered by risk reduction and operational dependency. Large refactors should not start before the containment and control-plane work.

### Phase 0 — Containment and incident review

**Target:** 0-72 hours  
**Estimated effort:** 5-8 engineer-days plus credential coordination

1. Block self-modification of profile authorization fields.
2. Review profile and security-audit history for unexpected role changes.
3. Disable browser retrieval of `OPENAI_API_KEY` and server Google credentials.
4. Begin migration of Flex calls to server-side operation-specific proxies.
5. Rotate Flex and any other credential that has been returned to browsers.
6. Revoke `anon`/`PUBLIC` execution from unsafe privileged RPCs.
7. Fix `technician_availability` and `vacation_requests` RLS.
8. Remove caller-supplied role trust from `get_job_total_amounts`.
9. Fix the four live database-lint errors.
10. Make paid-API proxies authenticated/rate-limited and cleanup functions service-only.

**Exit gates**

- A technician cannot modify role, department, or privileged flags.
- No backend secret is returned to browser code.
- No unauthenticated actor can execute a data-changing privileged RPC.
- Cross-user availability/vacation modification tests fail closed.
- Production database lint has zero application errors.
- Credential rotations are recorded with owner and date.

### Phase 1 — Secure delivery control plane

**Target:** Weeks 1-2  
**Estimated effort:** 5-8 engineer-days

1. Require one independent PR approval; require two for high-risk paths.
2. Require CODEOWNER review for database, auth, CI, integration, and security changes.
3. Make all existing CI jobs required:
   - lint
   - typecheck
   - governance
   - critical tests
   - full unit tests
   - build/budget
   - E2E smoke
4. Add required database jobs:
   - migration ordering
   - `db lint`
   - ephemeral migration apply
   - RLS/RPC security tests
5. Approve and implement deterministic dependency locking; update `AGENTS.md` when the policy changes.
6. Enable secret scanning, push protection, dependency updates, and CodeQL.
7. Pin GitHub Actions by full SHA.
8. Add SBOM generation and retain release artifacts.
9. Add production security headers, starting with CSP report-only.
10. Create a release checklist with rollback and post-deploy verification.

**Exit gates**

- No merge to `main` can occur with any quality/security check failing.
- Every production change has independent review.
- A commit resolves the same dependency graph locally and in CI.
- Secret and code scanning run continuously.
- CSP is enforced without breaking critical routes.

### Phase 2 — Backend trust-boundary hardening

**Target:** Weeks 2-4  
**Estimated effort:** 10-15 engineer-days

1. Inventory every Edge Function and RPC by exposure class.
2. Default-revoke SQL function execution and grant explicitly.
3. Add an automated `SECURITY DEFINER` privilege gate.
4. Migrate priority Edge Functions to the shared HTTP/auth framework:
   - user administration
   - staffing
   - payouts/expenses
   - Flex mutations
   - WhatsApp/email
   - document access
5. Add shared:
   - actor/role authorization
   - origin policy
   - request-size limits
   - structured errors
   - correlation IDs
   - sensitive-field redaction
   - rate limiting
   - idempotency keys
6. Separate liveness from privileged diagnostics.
7. Add abuse tests for public tokenized links and paid API proxies.
8. Add database policy tests for every role and sensitive table.

**Exit gates**

- 100% of callable privileged RPCs have explicit grants and authorization tests.
- 100% of service-role Edge Functions have an enforced exposure classification.
- No health endpoint returns business samples or internal errors to normal users.
- Public endpoints have durable abuse controls.

**Implementation status (updated 2026-06-24):** The first wave is implemented
and enforced in CI — Edge Function exposure classification gate,
SECURITY DEFINER anonymous-grant gate, liveness/diagnostic health split,
anonymous-reach revoke migration, shared correlation/size-limit/redaction
primitives, durable service-role public Edge rate limiting for high-risk
public/token endpoints, and pgTAP authorization regressions. Follow-up handler
migration has started: user-admin, payout/expense notification, and
staffing/message delivery slices are now on the shared HTTP/auth/body parsing
path, and the legacy Edge Function baseline has been ratcheted down. See
`docs/operations/phase-2-trust-boundary-hardening.md` for the exit-gate mapping
and remaining follow-up (Flex/document handler migration and polling-safe
wallboard abuse controls).

### Phase 3 — Test and correctness maturity

**Target:** Weeks 3-6  
**Estimated effort:** 12-20 engineer-days

1. Fix the Rules-of-Hooks defect and promote `rules-of-hooks` to error.
2. Add tests for:
   - staffing orchestrator HTTP/state-machine paths
   - staffing email orchestration
   - Flex operation proxies
   - payout/expense authorization
   - role change and profile policies
   - availability/vacation policies
   - user deletion and privacy workflows
3. Introduce risk-based coverage gates:
   - security/finance/staffing/data-integrity modules: at least 90% lines, 80% branches
   - changed-file coverage gate for all PRs
   - overall line coverage milestones: 30%, 45%, then 60%
4. Add integration tests against ephemeral Supabase/Postgres.
5. Add a small production-like staging E2E suite with isolated test tenants.
6. Fix or formally serialize the E2E concurrency dependency.
7. Add accessibility smoke tests for critical routes.
8. Begin `strictNullChecks` by domain.
9. Ratchet lint warnings so no PR increases the count.

**Exit gates**

- Coverage command passes.
- All authorization regressions have negative tests.
- Critical browser journeys pass against real database policies.
- Hooks violations and new explicit `any` usage fail CI.

### Phase 4 — Observability, SLOs, and incident operations

**Target:** Weeks 4-8  
**Estimated effort:** 10-15 engineer-days plus platform configuration

1. Implement external browser and Edge Function error telemetry.
2. Add trace/correlation IDs through:
   - browser action
   - Edge Function
   - database operation
   - Flex/email/WhatsApp/push provider
3. Define redaction rules before sending telemetry.
4. Establish initial SLOs for:
   - sign-in/session refresh
   - dashboard load
   - assignment mutation
   - staffing campaign execution
   - timesheet submission/approval
   - document access
   - external notification delivery
5. Add alerts for error rate, latency, database failures, queue/backlog, quota, and provider failures.
6. Create on-call ownership, severity definitions, communication templates, and postmortem policy.
7. Add synthetic checks for the public app, auth, and selected safe APIs.
8. Add deployment markers and release-health comparison.

**Recommended initial targets**

- critical failure detection: under 5 minutes
- Sev-1 acknowledgement: under 15 minutes
- Sev-1 restore/mitigation: under 4 hours
- critical user-journey availability: 99.9%, then refine with business input

### Phase 5 — Backup, recovery, staging, and release safety

**Target:** Weeks 5-8  
**Estimated effort:** 6-10 engineer-days plus provider configuration

1. Confirm production backup/PITR capabilities and ownership.
2. Define business-approved RPO/RTO; recommended starting point:
   - RPO: no more than 1 hour for core operational data
   - RTO: no more than 4 hours
3. Build and test a staging restore runbook.
4. Run a recorded restore drill.
5. Verify staging and preview deployments cannot address production Supabase.
6. Use separate credentials and integration sandboxes where providers support them.
7. Add post-deploy smoke tests and automated rollback criteria.
8. Document recovery for Cloudflare, Supabase, Flex, Brevo, WAHA, push, and mobile releases.

**Exit gates**

- Restore drill meets RPO/RTO.
- Preview builds are technically prevented from writing production.
- Every release has a tested rollback path and post-deploy verification.

### Phase 6 — Privacy and data governance

**Target:** Weeks 6-10  
**Estimated effort:** 8-12 engineer-days plus legal/privacy review

1. Build a data inventory and processing map.
2. Classify data by sensitivity and owner.
3. Replace placeholder secure-storage policy details with real approved systems and contacts.
4. Align the privacy notice with actual behavior and legal review.
5. Implement a verified account/data-subject request workflow.
6. Define retention by table, storage bucket, audit log, backup, and external processor.
7. Automate deletion/anonymization where legally permitted.
8. Record subprocessors, transfer mechanisms, and breach-notification responsibilities.
9. Run recurring access reviews for production, Supabase, Cloudflare, GitHub, and external providers.

**Exit gates**

- User-facing privacy statements match implemented behavior.
- Every sensitive dataset has owner, purpose, retention, and deletion rule.
- Data-subject requests are traceable and testable.

### Phase 7 — Architecture and maintainability convergence

**Target:** Weeks 8-16  
**Estimated effort:** continuous, 20-35 engineer-days for the first wave

1. Replace the thin `dataLayerClient` alias with domain query/mutation modules.
2. Reduce UI-owned data queries by at least 25% per sprint until the baseline is zero.
3. Move all direct Realtime channels behind the manager.
4. Standardize React Query cache policies by domain.
5. Split the highest-risk monoliths by state machine, data access, and side effects.
6. Finish Edge Function handler adoption, prioritized by privilege and external side effects.
7. Migrate repeated email HTML to tested, render-verified templates.
8. Reduce lint warnings:
   - immediate: zero Hooks rule warnings
   - 30 days: below 1,000
   - 60 days: below 400
   - 90 days: below 100
9. Enable `strictNullChecks`, then broader strict mode.
10. Keep architecture and roadmap metrics generated from code rather than manually stated.

## Ownership model

| Workstream | Accountable owner |
| --- | --- |
| Authorization, RLS, RPC grants | Security/Data owner |
| Secret migration and integration proxies | Platform/Integration owner |
| CI, dependency locking, GitHub controls | Platform owner |
| Test strategy and quality gates | QA/Engineering lead |
| Browser security and frontend architecture | Frontend owner |
| Observability and incident response | Platform owner |
| Recovery and staging isolation | Platform/Data owner |
| Privacy and retention | Business/privacy owner with engineering |

No critical control should have only one person capable of approving, deploying, or recovering it.

## Weekly enterprise scorecard

Track these metrics from automated sources:

- open critical/high security findings and age
- percentage of protected branches requiring independent approval
- percentage of required CI checks enforced by branch rules
- database lint and migration-test status
- changed-file and critical-module coverage
- test flake rate
- lint warning count by rule/domain
- unmanaged Realtime channel count
- browser-owned query count
- Edge Function standard-handler adoption
- deployment frequency, change failure rate, rollback rate, MTTR
- SLO compliance and error-budget consumption
- dependency and secret-scanning findings
- restore-drill result and achieved RPO/RTO
- data-retention/deletion job success

## Enterprise exit criteria

Do not label the platform enterprise grade until all of the following are true:

1. No known critical or unaccepted high-severity security finding remains.
2. Authorization and RLS have automated negative tests.
3. No backend credential is delivered to a browser.
4. Privileged RPC and Edge Function exposure is explicit and least-privilege.
5. Production database lint and migration validation are clean.
6. All quality/security checks and independent review are enforced before merge.
7. Builds are dependency-reproducible and generate an SBOM.
8. Production errors, latency, and critical workflows are externally monitored with alerts and owners.
9. RPO/RTO are approved and demonstrated through a restore drill.
10. Privacy, retention, deletion, and incident-response behavior matches documented policy.
11. Critical paths meet risk-based coverage targets.
12. An external penetration test verifies the remediated trust boundaries.

## Validation performed

| Check | Result |
| --- | --- |
| Latest `origin/main` isolated audit tree | `e00aa3d7` |
| `npm run typecheck` | Pass |
| `npm run lint` at audit baseline `e00aa3d7` | Pass with 2,178 warnings |
| `npm run lint` at Phase 0 implementation `5ab97b6` | Pass with 405 warnings |
| `npm run governance` | Pass against grandfathered baselines |
| `npm run test:run` at audit baseline `e00aa3d7` | 169 files / 1,034 tests pass |
| `npm run test:run` at Phase 0 implementation `5ab97b6` | 169 files / 997 tests pass |
| `npm run test:coverage` | Fail; 15.64% line coverage |
| `npm run build` | Pass |
| bundle budget | Pass |
| Playwright full local run | 18/20 pass; failed tests pass serialized |
| production migration dry run from latest `origin/main` | Remote database up to date |
| linked production database lint | Four application function errors |
| production HTTP header inspection | Missing CSP/frame/permissions policies |
| GitHub branch/rules/security inspection | Review count 0; scanning controls disabled |
| Git history pattern scan | 33,995 text-like blobs; no high-confidence private credential confirmed |

## Audit limitations

- No destructive production exploit was executed.
- No production user records or sensitive function responses were retrieved.
- Provider dashboards for Supabase backups, Cloudflare build variables, Flex, Brevo, WAHA, Apple, and Google were not available.
- Historical secret scanning used a local pattern set and should be followed by a dedicated scanner.
- Legal conclusions require qualified privacy/legal review.
- External penetration testing remains necessary after Phase 0-2 remediation.
