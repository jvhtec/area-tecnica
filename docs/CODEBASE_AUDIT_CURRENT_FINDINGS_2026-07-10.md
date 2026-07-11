# Current actionable codebase findings — 2026-07-10

## Purpose

This document is the current action register distilled from the repository's
older audit reports. It keeps only findings that are still reproducible on
`origin/main` at `0e153a74d375fe9cd852c2013bc433b21b5b3059`, or that still require an
explicit production/owner verification. It does not repeat findings already
fixed by later migrations or code changes.

Use this register to create issues and remediation PRs. The historical audit
files remain useful evidence, but their counts and completion claims should not
be treated as current state.

## What was reviewed

The review covered every audit-named file under `docs/`, the Phase 0 data-audit
artifacts, and the closely related pre-deployment/re-audit/coverage reports:

- the 2026-06 and 2026-07 codebase, enterprise, code-quality, performance,
  dead-code, UI/UX, and mobile safe-area audits;
- `AUDIT_REPORT_JOB_ASSIGNMENT_MATRIX.md`, `AUDIT_SUMMARY.md`,
  `JOB_ASSIGNMENTS_SYSTEM_AUDIT.md`, `FINAL_DEEP_AUDIT_REPORT.md`,
  `RE_AUDIT_FINDINGS.md`, `PRE_DEPLOYMENT_CONCERNS.md`, and
  `ULTRA_DEEP_AUDIT_AND_WORKFLOWS.md`;
- `MATRIX_TOOLTIP_AUDIT_FIELDS.md`, `SECURITY_AUDIT_LOGGING.md`, and
  `workflows/activity-audit-logging.md` as implementation/reference documents;
- `data_audit_phase0/` and `SYSTEM_COVERAGE_BREAKDOWN.md`;
- the current source-of-truth roadmap,
  `plans/2026-07-codebase-audit-roadmap.md`.

The January performance reports are superseded by
`PERFORMANCE_AUDIT_2026-07-01.md`. The 2025 assignment/data reports describe
historical schema states and must not be used as current schema inventories.

## Validation snapshot

| Check | Result on 2026-07-10 | Interpretation |
| --- | --- | --- |
| `npm run typecheck` | Pass | Useful, but the app compiles with `strict: false`. |
| `npm run lint` | Pass with 1,879 warnings | 1,628 `no-explicit-any`, 87 hook dependency, 65 useless escape, 61 React-refresh, and 38 other warnings. |
| `npm run governance` | Pass | It prevents new debt but intentionally allowlists substantial existing debt. |
| Source-boundary gate | 200 UI `dataLayerClient` matches | Down from baseline 213; still a large migration queue. |
| File-size gate | 43 source files over 800 lines | Down from baseline 45. Generated Supabase types are excluded from remediation priority. |
| Edge Function gate | 69 entrypoints: 35 shared-wrapper, 34 legacy manual | The wrapper migration remains incomplete. |
| Exposure inventory | 14 public-token, 14 authenticated-user, 34 privileged-role, 7 service-only | Classification exists; semantic negative testing is incomplete. |
| SQL grant gate | 82 anon/PUBLIC-executable `SECURITY DEFINER` functions, all allowlisted | A green gate means “no new exposure,” not “least privilege achieved.” |
| Dependency audit | 10 vulnerabilities: 6 high, 3 moderate, 1 low | Baseline accepted; no critical advisory. |
| `npm run build` | Pass | Vite still warns about chunks over 500 kB and ineffective dynamic splitting of the Supabase client. |
| `npm run budget:bundle` | Pass at 2.99 MB JS gzip | Only about 10–20 kB remains below the 3.00/3.01 MB ceilings. |
| `npm run test:e2e` on PowerShell | Pass, 20/20 Chromium tests | The server launcher is now cross-platform and the suite is serialized for deterministic local runs. |

Database behavior tests were not rerun locally because they require the local
Supabase/Docker stack. Governance verified migration ordering, not migration
application, RLS behavior, production state, backups, provider configuration,
or hosted-dashboard cron jobs.

## Remediation progress

| Finding | Branch status | Validation |
| --- | --- | --- |
| CUR-01 | Released in #834 | Availability and conflict date keys now use the job timezone; covered by Madrid/DST/non-Madrid range tests and assignment critical-path tests. |
| CUR-02 | Released in #834 | Timesheet auto-creation now uses the shared timezone-aware inclusive date range; timesheet critical-path tests pass. |
| CUR-05 | Released and deployed in #834 | Bounded ingestion, verified identity, durable rate limits, a separate 30-day anonymous auth-event table, and spoofing/rate/size tests; the migration and `security-audit` function are active in production. |
| CUR-06 | Released and deployed in #834 | The unreferenced arbitrary-URL proxy fails closed with HTTP 410 and performs no outbound fetch. |
| CUR-07 | Released and deployed in #834 | Server allowlist sanitization, approved inline-image origins, a 500KB HTML cap, malicious fixtures, and content-hash-only new audit rows; the migration and email functions are active in production. |
| CUR-08 | Partially released in #834 | Removed direct email, uploaded URL, WAHA URL, web-push endpoint, and APNs token logging; push results use opaque fingerprints; shared client and Edge redactors have fixtures. Migrating every legacy console call remains a separately reviewable follow-up. |
| CUR-09 | Partially released in #834 | The privacy notice and storage policy cover providers, purposes, legal bases, transfers, deletion/retention, safeguards, and escalation. Final controller identity and operational deletion workflow still require data-owner/legal approval. |
| CUR-10 | Released in #834 | Cross-platform Node/Vite launcher, serialized workers, and one local retry; Chromium E2E passes on PowerShell and Linux CI. |
| CUR-11 | In progress | `rules-of-hooks` is an error and the warning baseline blocks regressions; existing hook/type warning debt and strict-mode rollout remain. |
| CUR-12 | Released in #835 | Critical-module coverage thresholds are part of `test:critical`; focused security/assignment coverage now blocks regressions. |
| CUR-14 | Released and production-verified in #834 | Cloudflare enforces CSP without `unsafe-eval` or script `unsafe-inline`; all configured path-specific policies are governed and the production header was verified. |
| CUR-15 | Released in #834 | Flex work-order dates, matrix period boundaries, morning summary, festival proximity, and the unreachable assignment-date branch are fixed; boundary utility tests pass. |
| CUR-17 | Partially released in #835 | Seven verified-unreferenced legacy modules were removed; externally configured schedules/functions still require owner inventory. |
| CUR-20 | Partially released in #835 | Axe and keyboard smoke checks now cover public sign-in and technician mobile flows; high-traffic responsive and manual UX debt remains. |
| CUR-21 | Released in #835 | Architecture documentation now avoids volatile static inventories and points to verification commands. |
| CUR-22 | Released in #835 | Dependency exceptions now require an owner and non-expired review date; production high/critical advisories fail the gate. |

## Action register

### P0 — correctness and security containment

#### CUR-01 — Madrid/UTC mismatch can miss assignment conflicts

- **Severity:** High
- **Status:** Implemented on this branch; production deployment pending
- **Historical evidence (pre-fix):** `src/utils/technicianAvailability.ts:99-103,180,229-230,289-290`
  derived SQL date keys with `toISOString()`. Timesheet dates are derived in
  the job timezone in the database.
- **Impact:** Jobs around Madrid midnight can query the preceding UTC day,
  allowing a booked technician to appear available or a free technician to
  appear unavailable.
- **Action:** Deploy the implemented availability date-key change and verify the
  regression suite against the production release candidate.
- **Closure:** Unit/integration tests cover 00:30 CEST and 00:30 CET jobs,
  multi-day jobs, and single-day assignments; client results match database
  timesheet dates.

#### CUR-02 — Timesheet auto-creation can write the wrong work date

- **Severity:** High
- **Status:** Implemented on this branch; production deployment pending
- **Evidence:** `src/hooks/useTimesheets.ts:201-207` iterates local `Date` objects
  and writes `d.toISOString().split('T')[0]`.
- **Impact:** An after-midnight Madrid job can create a timesheet for the prior
  day and mismatch `job_date_types`, affecting payroll and off/travel filtering.
- **Action:** Reuse the shared assignment/timesheet date resolver rather than
  maintaining another loop in this hook. Include the job timezone in the query.
- **Closure:** Tests prove the generated dates and excluded date types across
  DST boundaries; no duplicate client/database date-generation rules remain.

#### CUR-03 — Exposed Google Maps key rotation is not evidenced

- **Severity:** Critical until verified
- **Status:** External verification required
- **Evidence:** The 2026-07 roadmap records a real Maps key in Git history and
  labels rotation/restriction as user-owned work in progress. Source review
  cannot prove revocation in Google Cloud.
- **Action:** Revoke the old credential; restrict the replacement by approved
  web origins/app identities and API list; add quotas and billing alerts; scan
  reachable refs and deployment variables.
- **Closure:** Record a non-secret rotation date and evidence that the old key is
  denied and the new key works only for approved callers/APIs.

#### CUR-04 — RLS and privileged RPC review is still baseline-driven

- **Severity:** High
- **Status:** Confirmed process/control gap
- **Evidence:** Governance accepts 82 existing anon/PUBLIC-executable
  `SECURITY DEFINER` functions. The July sub-rental self-comparison defect
  demonstrated that static policy presence is not proof of correct scope.
- **Action:** Generate a table/storage/RPC access matrix (role × action ×
  tenant/job/department), inventory `USING (true)`, self-equalities,
  unconditional branches, unpinned definers, and broad grants, then add negative
  pgtap cases by table family.
- **Closure:** Every privileged table/bucket/RPC has an owner, intended audience,
  and at least one deny-path behavior test; exceptions have explicit rationale.

#### CUR-05 — Public audit ingestion can be polluted and is not rate-limited

- **Severity:** High
- **Status:** Implemented on this branch; migration/deployment pending
- **Historical evidence (pre-fix):** `supabase/functions/security-audit/handler.ts`
  parsed the body without the shared bounded-body/rate-limit primitives and
  fell back to `event.user_id` when no authenticated user resolved. Gateway JWT
  validation can still admit an anonymous project token.
- **Action:** Deploy the function and migration, configure the dedicated
  rate-limit hash secret, and verify rate limiting and retention in production.
- **Closure:** Forged IDs are ignored, oversized/high-rate submissions are
  rejected, retention is defined, and tests cover authenticated and anonymous
  paths.

#### CUR-06 — `image-proxy` host checks do not stop DNS rebinding

- **Severity:** High
- **Status:** Implemented on this branch; deployment pending
- **Historical evidence (pre-fix):** `supabase/functions/image-proxy/index.ts`
  blocked textual private IPs/host suffixes but performed no DNS resolution or
  resolved-address class check before `fetch`.
- **Action:** Verify that the deployed retirement response remains HTTP 410 and
  that no supported caller depends on the retired proxy.
- **Closure:** Automated tests cover private IPv4/IPv6, redirect chains, DNS
  rebinding simulation, content type, byte limit, and timeout.

#### CUR-07 — Corporate email trusts raw HTML at the server boundary

- **Severity:** High
- **Status:** Implemented on this branch; migration/deployment pending
- **Evidence:** `supabase/functions/send-corporate-email/index.ts` accepts
  `bodyHtml`, performs CID replacement, and inserts it into the template without
  server-side HTML sanitization. Browser DOMPurify use is bypassable by another
  caller.
- **Action:** Apply a server-compatible allowlist in the Edge Function and reject
  dangerous schemes, event handlers, forms, style injection, and unapproved
  remote trackers.
- **Closure:** Malicious HTML fixtures are harmless and every email entrypoint
  passes through the same sanitizer.

#### CUR-08 — Runtime logs still expose personal or secret-bearing values

- **Severity:** High
- **Status:** In progress on this branch
- **Evidence:** Examples include sender email and uploaded public URL in
  `send-corporate-email`, technician email in `send-timesheet-reminder`, web-push
  endpoints and APNs device tokens in `push/broadcast/delivery.ts`, plus verbose
  provider/payload logging elsewhere.
- **Action:** Adopt one structured logger/redactor with correlation ID, event
  type, safe counts, and hashed identifiers; ban raw emails, tokens, endpoints,
  signed/public object URLs, bodies, and provider payloads. Define log retention
  and access ownership.
- **Closure:** Fixture tests assert redaction and sampled runtime logs remain
  diagnostically useful without PII/secrets.

#### CUR-09 — Privacy promises and operational controls diverge

- **Severity:** High
- **Status:** Confirmed in current source/docs
- **Evidence:** `Privacy.tsx` directs users to Profile and says personal data is
  deleted immediately; Profile opens an email request; `delete-user` forbids
  self-deletion. `secure_storage_and_data_handling_policy.md` still contains
  placeholder S3/GCS locations and `security@company.example`.
- **Action:** Align product behavior, the privacy notice, retention/legal bases,
  subprocessors/transfers, and verified deletion/anonymization across database,
  Storage, audit/payroll records, backups, and external processors. Replace or
  remove non-operational policy claims.
- **Closure:** A tested request/deletion workflow and approved retention matrix
  match the public notice; policies name real owners and systems without secrets.

### P1 — reliability and release confidence

#### CUR-10 — Required E2E workflow is not cross-platform

- **Severity:** High
- **Status:** Implemented and verified on Windows; CI verification pending
- **Evidence:** `npm run test:e2e` exits before Playwright starts because
  `playwright.config.ts` uses `VITE_SUPABASE_URL=... command` syntax.
- **Action:** Use a small Node launcher or approved cross-platform environment
  setter for the web server command.
- **Closure:** The same command starts and passes on PowerShell and Linux CI
  without a manually started server.

#### CUR-11 — Quality gates permit behavior-affecting warning debt

- **Severity:** High
- **Status:** In progress on this branch
- **Evidence:** 1,879 lint warnings are non-blocking; 87 are
  `react-hooks/exhaustive-deps`; `react-hooks/rules-of-hooks` is configured as
  an error. The app uses `strict: false` and `strictNullChecks: false`.
- **Action:** Check in warning counts by rule/file, fail new warnings, eliminate
  hook warnings first, then ratchet `any` debt. Introduce strict subprojects in
  this order: unknown catches, null checks, indexed access, full strict.
- **Closure:** No new warnings, zero hook warnings, and new/changed domains
  compile under strict settings without blanket casts/suppressions.

#### CUR-12 — Test breadth has no risk-based coverage enforcement

- **Severity:** High
- **Status:** Confirmed
- **Evidence:** Coverage can be run, but no thresholds or CI coverage gate exist.
  Passing suites do not prove auth, input, payroll, assignment, Storage, and RLS
  branch coverage.
- **Action:** Add strict branch thresholds for shared auth/input/security helpers,
  focused integration coverage for payroll/assignment/storage, and preview smoke
  tests for public and authenticated journeys.
- **Closure:** Critical-module thresholds block regressions; every P0 fix has a
  negative-path test; preview smoke results are visible in PR CI.

#### CUR-13 — Production recovery and observability are not operationalized

- **Severity:** High
- **Status:** Repository evidence still absent
- **Evidence:** No approved RPO/RTO, backup inventory, restore runbook/drill, SLO,
  error budget, alert routing, on-call owner, distributed correlation, or
  synthetic critical-journey monitoring is documented. The hardened health
  endpoints and `system_errors` table are useful primitives, not a complete
  operating model.
- **Action:** Confirm Supabase backup/PITR configuration, define RPO/RTO, run a
  recorded restore drill, define critical-journey SLOs, and connect alerting with
  clear ownership. Add sensitive-context redaction before expanding
  `src/lib/errorTracking.ts`.
- **Closure:** A restore drill meets approved targets; alerts reach an owner;
  browser/Edge/provider failures share correlation IDs; SLOs are reviewed.

#### CUR-14 — CSP is monitoring-only and still permits unsafe execution

- **Severity:** Medium/High
- **Status:** Implemented on this branch; production header verification pending
- **Historical evidence (pre-fix):** `public/_headers` set only
  `Content-Security-Policy-Report-Only` and allowed `unsafe-inline` and
  `unsafe-eval` for scripts.
- **Action:** Verify the deployed Cloudflare response header, including the
  path-specific wallboard embedding exception, after every CSP change.
- **Closure:** Enforced CSP runs for seven days without critical flow regressions
  and report volume has an owner.

#### CUR-15 — Secondary calendar-date defects remain in user-visible paths

- **Severity:** Medium
- **Status:** Implemented on this branch; production deployment pending
- **Evidence:** UTC date keys remain in `flexWorkOrders.ts`, matrix monthly/yearly
  metrics, and `MorningSummary.tsx`; `assignmentWorkDates.ts` retains an
  unreachable duplicate branch. Additional `toISOString` date-only sites need
  semantic triage rather than blind replacement.
- **Action:** Fix the confirmed Flex/metrics/summary cases with the shared
  calendar helpers, remove the dead branch, then classify every remaining
  date-only conversion as UTC-intentional or business-calendar data.
- **Closure:** Boundary tests cover Madrid midnight, month/year transitions, DST,
  and a non-Madrid viewer; an ESLint/governance rule prevents new unsafe
  business-date conversions.

### P2 — maintainability, performance, and UX debt

#### CUR-16 — Architectural migrations are stalled behind green baselines

- **Severity:** Medium
- **Status:** Confirmed
- **Evidence:** 200 UI data-layer imports, 34 manual Edge entrypoints, 43 files
  over 800 lines, and broad free-form query-key usage remain. The largest live
  handwritten modules include `TourOpsManagementHub.tsx` (2,116 lines),
  `tourSchedulingService.ts` (1,885), `useConsumosTool.ts` (1,819), and
  `TourDefaultsManager.tsx` (1,722).
- **Action:** Assign each baseline item to a domain owner. Migrate query/data
  access and Edge trust boundaries by feature; split modules at state/query/
  side-effect/view boundaries, not mechanically.
- **Closure:** Baselines decrease every release; no new exemptions; top-risk
  modules have focused regression tests and are below agreed thresholds.

#### CUR-17 — Large dead and duplicate subsystems remain in production source

- **Severity:** Medium
- **Status:** Representative findings reconfirmed; exact July 2 count is stale
- **Evidence:** The unused tour scheduling suite, legacy `useAuth`, legacy
  `AssignmentMatrix`, `PerformanceMonitor` stack, `ArtistForm`, `SoundVisionMap`,
  duplicate `useRecalcTimesheet` hooks, and uncalled Edge candidates such as
  `generate-sv-report` remain. Several names survive only in governance baselines
  or docs.
- **Action:** Regenerate the import graph on current main, verify external/hosted
  cron consumers, then remove one subsystem per PR. Move externally configured
  schedules into migrations/manifests.
- **Closure:** No production file is kept alive only by its own test; every
  deployed function has an in-repo or documented external caller/owner; docs and
  baselines shrink with removals.

#### CUR-18 — Bundle budget has effectively no growth headroom

- **Severity:** Medium
- **Status:** Confirmed by current build
- **Evidence:** JS gzip is 2.99 MB against 3.00/3.01 MB caps. The maps, PDF, and
  spreadsheet chunks are approximately 497, 341, and 265 kB gzip, and Vite
  reports chunks over 500 kB raw.
- **Action:** Measure route waterfalls, keep heavy engines behind route/user
  interaction boundaries, remove dead code/dependencies, and introduce
  per-route budgets with at least 15% practical headroom.
- **Closure:** Heavy engines are absent until used; initial authenticated shell
  meets an agreed route budget; global JS headroom is at least 15%.

#### CUR-19 — Deferred database/query correctness work remains

- **Severity:** Medium
- **Status:** Confirmed/deferred by the current performance audit
- **Evidence:** `technician_availability.technician_id` remains `varchar` without
  the intended profile FK; job timesheet aggregation remains client-side;
  generic query keys still dominate; signed URLs are stored in application
  tables; realtime publication/subscription scope lacks a complete inventory.
- **Action:** Handle each as a compatibility migration with behavior tests:
  technician UUID/FK conversion, server aggregation RPC, domain query-key
  factories, additive bucket/path references, and realtime table/consumer map.
- **Closure:** Referential integrity is enforced, large aggregations happen in
  SQL, signed URL expiry does not break viewers, and unauthorized users receive
  no realtime events.

#### CUR-20 — Accessibility and mobile consistency lack a release gate

- **Severity:** Medium
- **Status:** Confirmed
- **Evidence:** No axe/pa11y equivalent is installed or run in CI. The UI audit's
  first phases fixed language, reduced motion, skip link, toasts, native confirms,
  and many loading states, but fixed-width/mobile-table, touch-target, tiny-text,
  semantic color, empty/error state, and remaining async feedback work is still
  explicitly partial.
- **Action:** Add axe-based component/page smoke tests and keyboard checks for
  critical mobile flows; then burn down the existing UI audit by high-traffic
  route with 360 px visual verification.
- **Closure:** Accessibility checks block regressions; critical flows pass
  keyboard/automated scans; touch targets and overflow are verified at the
  mobile breakpoint.

#### CUR-21 — Documentation and audit evidence drift materially

- **Severity:** Medium
- **Status:** Confirmed
- **Evidence:** `ARCHITECTURE.md` still states 98 migrations and 61 Edge
  Functions while current counts are 189 migrations and 69 deployable
  entrypoints; it also references Vitest 2.1. Historical audits contain
  contradictory “complete,” “production-ready,” and open-item claims.
- **Action:** Make this register the actionable index, mark old audits historical
  or superseded, update architecture facts that affect decisions, and publish a
  small release scorecard (P0/P1, lint, RLS tests, bundle, E2E, migrations,
  secret rotation).
- **Closure:** `docs/README.md` links one current register/scorecard; old reports
  carry an unambiguous status; volatile counts are generated or date-stamped.

#### CUR-22 — Accepted dependency advisories need owned expiry decisions

- **Severity:** Medium
- **Status:** Confirmed
- **Evidence:** Governance accepts 6 high, 3 moderate, and 1 low vulnerability,
  and GitHub dependency review allowlists known advisories.
- **Action:** Review reachability/fix availability per advisory, assign owner and
  expiry, and upgrade in small tested batches while preserving the documented
  `date-fns` and Vite constraints.
- **Closure:** No critical/reachable high advisory; every exception has rationale,
  owner, and review date; release SBOM remains generated.

## Findings intentionally not carried forward

- The 2025 assignment-matrix uniqueness, assignment-date naming, and original
  conflict-RPC migration tasks are historical and were followed by later
  migrations/tests. Their old schema counts and deployment checklists are not
  current findings. The current conflict risk is CUR-01's timezone mismatch.
- June criticals covering self-role promotion, browser delivery of backend
  secrets, unsafe job-total role trust, availability/vacation RLS, broad initial
  definer grants, and unsafe `system-health` output were remediated by later
  code/migrations. Keep regression tests; do not reopen from the old prose alone.
- The mobile safe-area audit records implemented fixes. Remaining mobile work is
  represented by CUR-20, not by reopening every fixed safe-area item.
- The July performance audit marks most realtime, index, chunking, cache, image,
  PDF-concurrency, and service-worker issues resolved. Only its explicitly
  deferred items and the newly measured bundle headroom are carried forward.
- Wildcard CORS without credentials is not treated here as an independent
  vulnerability. Continue centralizing handlers and reviewing endpoint audience
  under CUR-04/CUR-16.
- The Phase 0 CSV snapshots contain headers only and are from 2025. They prove the
  historical snapshot was empty, not that production data is clean today. Rerun
  the audit SQL against an approved environment before making a current data
  quality claim.

## Recommended issue/PR sequence

1. Fix CUR-01 and CUR-02 together with shared date helpers and boundary tests.
2. Complete/verify CUR-03, then deliver CUR-05 through CUR-08 as small security
   PRs with negative tests.
3. Run the CUR-04 RLS/RPC inventory and fix one table family per PR.
4. Repair CUR-10 so the E2E gate is locally reproducible, then add CUR-12's
   highest-risk coverage.
5. Align privacy/recovery/observability ownership (CUR-09 and CUR-13); these need
   business/provider decisions as well as code.
6. Fix CUR-15 and start the CUR-11 lint/strict ratchet.
7. Recover bundle headroom by combining CUR-17 dead-code removal with CUR-18
   route-level measurements.
8. Burn down CUR-16/CUR-19/CUR-20 by domain, updating CUR-21's scorecard on each
   release.
