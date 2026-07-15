# Current actionable codebase findings — 2026-07-15

## Purpose

This document supersedes `CODEBASE_AUDIT_CURRENT_FINDINGS_2026-07-10.md` as the
single current action register. It is the result of a full re-audit of
`origin/main` at `e4d10cb` (17 commits after the previous register's snapshot
`0e153a74`, spanning PRs #834–#856). Every prior finding (CUR-01…CUR-22) was
re-verified against current code, every CI-equivalent gate was rerun locally,
and fresh security/correctness/quality passes were run over the code merged
since the previous snapshot.

Findings keep their original CUR numbers so issue/PR history stays traceable.
Closed findings are listed once under "Closed since 2026-07-10" and are not
action items; do not reopen them from older prose.

A second, deeper line-level pass on 2026-07-15 added the RLS/`SECURITY DEFINER`
policy inventory, a review of all 14 public-token edge functions, the staffing
state machine and assignment/timesheet cascade, and full reads of the largest
new modules. It produced two new defects with file:line evidence — **CUR-04a**
(High, payroll integrity) and **CUR-25** (Low) — plus a "Fresh-pass results with
no finding" section recording what was cleared.

## Validation snapshot (2026-07-15, main @ e4d10cb)

| Check | Result | Interpretation |
| --- | --- | --- |
| `npm run typecheck` | Pass | App still compiles with `strict: false`. |
| `npm run lint` | Pass with 1,878 warnings (1,517 app + 361 functions) | Effectively flat vs 1,879 on 2026-07-10. App: 1,343 `no-explicit-any`, 87 `react-hooks/exhaustive-deps`, 61 `react-refresh/only-export-components`. |
| `npm run governance` | Pass | All sub-gates green; baselines ratchet downward (see below). |
| Source-boundary gate | `ui-data-layer-client-import` 197 (baseline 213); `scheduling-new-date` 88 (baseline 107); `direct-protected-route-allowed-roles` 0 (baseline 64) | Real progress; the direct-role-guard debt is fully eliminated. |
| File-size gate | 43 files over 800 lines (baseline 45) | Unchanged since 2026-07-10; largest handwritten modules unchanged (`TourOpsManagementHub.tsx` 2,116; `tourSchedulingService.ts` 1,885; `useConsumosTool.ts` 1,806; `TourDefaultsManager.tsx` 1,706). |
| Edge Function gate | 69 entrypoints: 36 `createHttpHandler`, 33 legacy manual | +1 wrapper migration since 2026-07-10; queue persists. |
| Exposure inventory | 14 public-token, 14 authenticated-user, 34 privileged-role, 7 service-only | Unchanged classification; semantic negative testing still incomplete (CUR-04). |
| SQL grant gate | 82 anon/PUBLIC-executable `SECURITY DEFINER` functions, all allowlisted, 0 new | The two new migrations since 2026-07-10 grant only to `service_role`. |
| CSP governance gate | Pass — enforced policy, 7 hashed inline scripts, no unsafe script execution | New gate since the last register; see CUR-14 closure. |
| Dependency audit | 10 vulnerabilities: 6 high, 3 moderate, 1 low (12 allowlisted advisory IDs) | `npm audit --omit=dev` shows only 3 (1 low, 2 moderate: `quill@2.0.3`, `minimatch` chain). All 6 highs are dev-only chains (`replace`→`minimatch`, `tar`). See CUR-22. |
| Migration ordering | Pass — 191 migrations, unique ordered timestamps | Was 189 at the previous audit. |
| `npm run test:run` | Pass — 254 files, 1,392 tests | |
| `npm run test:critical` | Pass with enforced coverage thresholds | CUR-12's gate is active and green. |
| `npm run build` | Pass | Vite still warns about >500 kB raw chunks (maps-lib 1.75 MB raw / 497 kB gzip). |
| `npm run budget:bundle` | Pass at exactly the cap: **JS gzip total 3.01 MB vs 3.01 MB max** | Zero headroom. See CUR-18 (escalated). |
| `npm run test:e2e` (Linux, Chromium) | Pass — 20 specs including axe accessibility and mobile-navbar checks | CUR-10 closure confirmed on Linux. |

Database behavior tests (pgTAP) were not rerun locally (they require the local
Supabase/Docker stack); CI runs them on every PR. Governance verifies migration
ordering, not production state, backups, provider configuration, or
hosted-dashboard cron jobs.

## Closed since 2026-07-10

Verified on current `main`; keep the regression tests, do not reopen:

- **CUR-01 / CUR-02 (timezone-correct availability + timesheet dates):**
  released in #834. `technicianAvailability.ts` uses job-timezone helpers; the
  remaining `toISOString()` calls in `useTimesheets.ts` are timestamp fields
  (`approved_at`, `rejected_at`, `signed_at`), which are correct as UTC.
- **CUR-05 (hardened `security-audit` ingestion):** function plus
  `20260710231000_harden_anonymous_security_audit.sql` are on main; the cleanup
  function is `SECURITY DEFINER` granted to `service_role` only.
- **CUR-06 (`image-proxy` retirement):** fails closed with HTTP 410, no
  outbound fetch.
- **CUR-07 (server-side corporate-email sanitization):** sanitizer plus
  `20260710232500_hash_corporate_email_log_bodies.sql` are on main.
- **CUR-10 (cross-platform E2E):** `npm run test:e2e` passes on Linux in this
  audit and on Windows per the prior register; CI runs it as a required job.
- **CUR-12 (risk-based coverage gate):** `test:critical` enforces coverage
  thresholds and passes.
- **CUR-14 (enforced CSP):** `public/_headers` now sends an enforced
  `Content-Security-Policy` with per-script SHA-256 hashes, no `unsafe-eval`
  and no script `unsafe-inline`; a path-specific policy relaxes only
  `frame-ancestors` for `/wallboard/public/*`. A `governance:csp` gate guards
  regressions. Residual (operational, tracked under CUR-13): re-verify the
  production response header after each CSP change. Note #854 added
  `https://<project>.storage.supabase.co` to `connect-src` for large uploads —
  reviewed, appropriately scoped.
- **CUR-15 core cases (Flex work orders, matrix metrics, morning summary):**
  `flexWorkOrders.ts` formats via `formatFlexWorkOrderDate(…, timezone)`; the
  dead `assignmentWorkDates.ts` branch is gone. The *semantic triage* residue
  moves to CUR-23 below.
- **CUR-21 (documentation drift):** this register pattern is in place,
  `docs/README.md` links the current register, and architecture docs point at
  verification commands. Residual nit folded into CUR-16 housekeeping:
  `ARCHITECTURE.md` line 304 still says "61 functions" (actual: 69) and the
  migration count is now 191.

## Register changes in this audit

- **CUR-17 is materially stale and was re-scoped.** The "unused tour scheduling
  suite" is now live code: `tourSchedulingService.ts` → `useTourOps.ts` →
  `TourDetailView.tsx`, `TourShare.tsx`, and `TourOpsManagementHub.tsx` →
  `TourSchedulingDialog.tsx`. `src/legacy/` no longer exists, and the duplicate
  `useRecalcTimesheet` hooks are gone. The dead-code inventory must be
  regenerated before any further removal work.
- **CUR-18 escalated to P1.** The JS gzip total now sits exactly at the CI cap.
- **CUR-23 (new)** captures the remaining business-date triage split out of
  CUR-15.

## Action register

### P0 — correctness and security containment

#### CUR-03 — Exposed Google Maps key rotation is not evidenced

- **Severity:** Critical until verified
- **Status:** Unchanged — external verification required
- **Evidence:** `docs/plans/2026-07-codebase-audit-roadmap.md` (SEC-04) still
  records the rotation as "user-owned action in progress." Source and docs are
  clean of key material (fresh secret-pattern scan on 2026-07-15 found no
  hits), but source review cannot prove revocation in Google Cloud.
- **Action:** Revoke the old credential; restrict the replacement by approved
  origins/app identities and API list; add quotas and billing alerts.
- **Closure:** Record a non-secret rotation date and evidence that the old key
  is denied and the new key works only for approved callers/APIs.

#### CUR-04 — RLS and privileged RPC review is still baseline-driven

- **Severity:** High
- **Status:** Unchanged as a control gap; the 2026-07-15 deep pass found one
  concrete instance (CUR-04a below)
- **Evidence:** Governance still accepts 82 anon/PUBLIC-executable
  `SECURITY DEFINER` functions ("no new exposure" ≠ "least privilege"). pgTAP
  coverage exists (`supabase/tests/database/`, 13 SQL test files) but there is
  no role × action × tenant access matrix or systematic deny-path inventory.
  The RLS *mutation* posture is otherwise strong: the permissive base-schema
  `USING (true)` policies on `profiles`/`jobs`/`job_assignments` were tightened
  to role/owner predicates in
  `20260217233500_advisor_security_hardening_phase2_rls.sql`; the `anon`
  realtime-read policies were dropped in
  `20260609120000_security_hardening_anon_access.sql`; and
  `20260623160000_phase0_authorization_hardening.sql` adds a thorough
  `enforce_profile_privilege_changes` BEFORE-UPDATE trigger that blocks
  self-role-escalation and cross-department management edits. Every
  `SECURITY DEFINER` function reviewed pins `search_path` and re-checks the
  caller role/`service_role`.
- **Action:** Generate the access matrix, inventory `USING (true)`,
  self-equalities, unpinned definers, and broad grants; add negative pgTAP
  cases by table family, one family per PR.
- **Closure:** Every privileged table/bucket/RPC has an owner, intended
  audience, and at least one deny-path behavior test.

#### CUR-04a — Technician self-update of `job_assignments` is not column-scoped

- **Severity:** High (payroll integrity)
- **Status:** New — found in the 2026-07-15 deep pass
- **Evidence:** The `job_assignments_update` policy
  (`20260217233500_advisor_security_hardening_phase2_rls.sql:77-86`) permits an
  update when `technician_id = auth.uid()`, with an identical `WITH CHECK`, and
  there is **no BEFORE-UPDATE trigger on `job_assignments`** restricting which
  columns the owner may change (unlike `profiles`, which has
  `enforce_profile_privilege_changes`). The row therefore lets a technician
  rewrite pay-relevant columns on their own assignment:
  `sound_role`/`lights_role`/`video_role`/`production_role` (feed the timesheet
  rate category) and `use_tour_multipliers` — whose own schema comment
  (`00000000000000_production_schema.sql:5951`) states it "forces tour
  multiplier calculation." A technician using the authenticated anon key can
  `update job_assignments set production_role='PROD-RESP-R', use_tour_multipliers=true
  where technician_id = <self>` and inflate their own payout. The policy
  correctly prevents reassigning the row to another technician (the
  `WITH CHECK` pins `technician_id = auth.uid()`), so the gap is column scope,
  not row ownership.
- **Action:** Add a BEFORE-UPDATE trigger on `job_assignments` mirroring the
  profiles pattern: when the actor is the row's technician (not
  admin/management/logistics and not `service_role`), allow only
  response/status columns (`status`, `response_time`) to change and reject
  edits to role and multiplier columns; log privileged changes. Add negative
  pgTAP coverage.
- **Closure:** A technician cannot change any rate/role/multiplier column on
  their own assignment; a deny-path pgTAP test proves it.

#### CUR-08 — Runtime logs still expose personal data

- **Severity:** High
- **Status:** In progress — shared redactors shipped in #834, but legacy call
  sites remain; fresh evidence found on 2026-07-15
- **Evidence:** `supabase/functions/send-password-reset/index.ts:37,98,208`
  logs the raw normalized user email three times;
  `send-timesheet-reminder/index.ts:406` logs provider message IDs;
  `staffing-click/index.ts` retains ~47 verbose step-by-step `console.log`
  calls (token material itself is truncated/absent — expiry substring only).
  Edge functions contain ~700 raw `console.*` calls overall, concentrated in
  `push` (83), `send-staffing-email` (78), `staffing-click` (47),
  `background-job-deletion` (36), `send-corporate-email` (34).
- **Action:** Migrate the highest-PII functions first (`send-password-reset`,
  `send-timesheet-reminder`, `send-staffing-email`, `push`) to the shared
  redacting logger; ban raw emails/endpoints/URLs by lint rule for
  `supabase/functions/`.
- **Closure:** Fixture tests assert redaction; no raw email/token/endpoint in
  any function's logs.

#### CUR-09 — Privacy promises and operational controls diverge

- **Severity:** High → Medium (scope reduced)
- **Status:** Partially closed — the public notice is now realistic
- **Evidence:** `Privacy.tsx` now describes verified deletion requests, legal
  retention periods (~7 years for fiscal/labor records), 30-day anonymous
  audit retention, and hash-only email logs, which matches shipped behavior.
  Remaining: final controller identity and the operational deletion workflow
  still require data-owner/legal approval, and the storage policy needs a real
  security contact/owner.
- **Action:** Obtain data-owner/legal sign-off on controller identity and the
  deletion workflow; name real owners in the storage policy.
- **Closure:** A tested request/deletion workflow and approved retention matrix
  match the public notice.

### P1 — reliability and release confidence

#### CUR-18 — Bundle budget has zero headroom (escalated from P2)

- **Severity:** High (was Medium)
- **Status:** Worse than the previous audit
- **Evidence:** `npm run budget:bundle` on 2026-07-15: JS gzip total
  **3.01 MB against a 3.01 MB absolute cap** (was 2.99 MB on 2026-07-10;
  +279 kB vs the checked-in 2.74 MB baseline). Font total also rose +77.6 kB
  (the new `NotoSansPdf-Regular.ttf` from #856) to 2.65 MB vs a 2.70 MB cap.
  maps-lib is 497 kB gzip (cap 543 kB), pdf-libs 341 kB, spreadsheet-libs
  265 kB. The next JS growth fails CI for unrelated PRs.
- **Action:** Immediately recover headroom: re-measure route waterfalls, keep
  the new PDF font and heavy engines behind interaction boundaries, remove
  dead dependencies (see CUR-22's `replace` package), and only then consider a
  deliberate, reviewed cap adjustment. Target ≥15% headroom.
- **Closure:** JS gzip total at least 15% below the cap; per-route budgets for
  the authenticated shell.

#### CUR-11 — Quality gates permit behavior-affecting warning debt

- **Severity:** High
- **Status:** Open — no measurable progress since 2026-07-10
- **Evidence:** Total warnings 1,878 vs 1,879 a week ago. App-side
  `react-hooks/exhaustive-deps` is still **87** despite #837/#839 ("reduce
  hook dependency warnings") — fixes were offset by new warnings elsewhere.
  `no-explicit-any` remains 1,343 (app) + functions debt. `strict` and
  `strictNullChecks` remain off.
- **Action:** As before: fail new warnings by rule/file, eliminate hook
  warnings first, then ratchet `any` debt and introduce strict subprojects.
  Add a per-rule count check so "reduce warnings" PRs cannot regress silently.
- **Closure:** Zero hook warnings; no new warnings; new/changed domains compile
  strict.

#### CUR-13 — Production recovery and observability are not operationalized

- **Severity:** High
- **Status:** Unchanged — repository evidence still absent
- **Evidence:** No RPO/RTO, backup inventory, restore runbook/drill, SLO,
  alert routing, or on-call ownership documents exist under `docs/` (fresh
  search on 2026-07-15). Health endpoints and `system_errors` remain
  primitives without an operating model. Production CSP header re-verification
  (residual of CUR-14) belongs to this operating model.
- **Action:** Confirm Supabase backup/PITR configuration, define RPO/RTO, run a
  recorded restore drill, define critical-journey SLOs, connect alerting.
- **Closure:** A restore drill meets approved targets; alerts reach an owner.

### P2 — maintainability, performance, and UX debt

#### CUR-16 — Architectural migrations are progressing but incomplete

- **Severity:** Medium
- **Status:** Open, measurably improving
- **Evidence:** UI data-layer imports 197 (213 baseline); `new Date()` in
  scheduling paths 88 (107); direct role-guard usage eliminated (64 → 0);
  Edge wrapper migration 36/69; 43 files >800 lines (45). Largest handwritten
  modules unchanged. Housekeeping: `ARCHITECTURE.md` still shows "61
  functions" (actual 69) and pre-#834 migration counts (actual 191).
- **Action:** Continue by feature domain; update the two stale ARCHITECTURE.md
  facts in the next docs pass.
- **Closure:** Baselines decrease every release; no new exemptions.

#### CUR-17 — Dead-code inventory must be regenerated (re-scoped)

- **Severity:** Medium
- **Status:** Re-scoped on 2026-07-15 — prior inventory is stale
- **Evidence:** The tour scheduling suite (2026-07-10's headline dead
  subsystem) is now referenced by live routes (`TourDetailView`, `TourShare`,
  `TourSchedulingDialog`). `src/legacy/` is deleted; duplicate
  `useRecalcTimesheet` hooks are gone. `generate-sv-report` and
  `SoundVisionMap` still have no in-repo references and remain removal/owner
  candidates.
- **Action:** Regenerate the import graph on current main before any removal;
  verify hosted cron/external consumers for uncalled Edge functions; remove one
  verified subsystem per PR.
- **Closure:** Every deployed function has an in-repo or documented external
  caller/owner.

#### CUR-19 — Deferred database/query correctness work remains

- **Severity:** Medium
- **Status:** Unchanged
- **Evidence:** `technician_availability.technician_id` is still legacy
  `varchar` — `20260224095500_fix_check_technician_conflicts_uuid_text_compare.sql`
  works around it with text comparison, and `20260701140000` indexed it without
  converting. Client-side aggregation, generic query keys, and stored signed
  URLs persist as described in the previous register.
- **Action:** Compatibility migrations with behavior tests, one item per PR
  (UUID/FK conversion first).
- **Closure:** Referential integrity enforced; large aggregations in SQL.

#### CUR-20 — Accessibility and mobile consistency lack a full release gate

- **Severity:** Medium
- **Status:** Open, partially improved
- **Evidence:** `tests/e2e/accessibility.spec.ts` (axe + keyboard) runs in the
  required E2E job and passes. The July mobile refurb (#847) landed 85 files of
  mobile UI, but only one spec asserts mobile-viewport behavior; remaining
  fixed-width/touch-target/tiny-text debt from the UI audit is still open.
- **Action:** Extend the `mobile-chromium` project over the refurbished
  operations flows; burn down the UI audit by high-traffic route at 360 px.
- **Closure:** Critical flows pass keyboard/automated scans at mobile
  breakpoint.

#### CUR-22 — Accepted dependency advisories need owned expiry decisions

- **Severity:** Medium
- **Status:** Open, with sharper scope
- **Evidence:** 10 total advisories (6 high, 3 moderate, 1 low; 12 allowlisted
  IDs), but `npm audit --omit=dev` shows the production graph carries only
  1 low + 2 moderate (`quill@2.0.3` via the editor stack; `minimatch`). All 6
  highs come from dev-only chains: the unmaintained `replace` package
  (ReDoS-vulnerable `minimatch`) and `tar` (path traversal advisories).
- **Action:** Remove or replace the `replace` dev dependency (also recovers
  install weight), upgrade `tar` consumers, and review the `quill` advisory
  reachability. Keep owner + expiry on every allowlist entry.
- **Closure:** No high advisory even in the dev graph without a dated,
  owner-signed exception.

#### CUR-23 — Remaining business-date conversions need semantic triage (new)

- **Severity:** Medium
- **Status:** New — split from CUR-15's residue
- **Evidence:** 17 date-only `toISOString().split('T')[0]` sites remain in
  non-test source. At least five sit in business-calendar paths where a UTC
  day key can differ from the Madrid day around midnight/DST:
  `src/components/personal/hooks/usePersonalCalendarData.ts:41` (calendar day
  keys), `src/services/jobRehearsalDates.ts:22` (rehearsal date keys),
  `src/hooks/useJobCard.ts:66` (job/day grouping key),
  `src/hooks/useExpensePermissions.ts:103` (permission date compare),
  `src/lib/vacation-requests.ts:161` ("today" for vacation cutoffs);
  `FestivalWeatherSection.tsx:31-32` renders job dates via UTC. Others (file
  download names, `AmplifierTool` PDF filenames) are benign.
- **Action:** Classify each site as UTC-intentional or business-calendar; fix
  business-calendar sites with the shared timezone helpers; then add the
  planned lint/governance rule banning new date-only UTC conversions in
  business paths (the existing `scheduling-new-date` rule does not cover
  `toISOString` keys).
- **Closure:** Zero unclassified sites; boundary tests around Madrid midnight
  and DST for the five listed paths.

#### CUR-24 — Print/PDF views hardcode English strings (new, minor)

- **Severity:** Low
- **Status:** New
- **Evidence:** `src/features/rack-builder/lib/panelThumbnail.ts:109` renders
  `'Front'/'Rear'` into the printed SVG; 21 components still contain hardcoded
  English UI strings (`Save`/`Cancel`/`Delete`/`Loading...`), including four
  touched since the last audit (`UserManual.tsx`, `EditJobDialog.tsx`,
  `RequestTourAvailabilityDialog.tsx`, `TourRequirementsDialog.tsx`).
- **Action:** Run `/i18n-check` over the mobile-refurb and power-tools surfaces
  and fix by route; Spanish is the only supported UI language.
- **Closure:** No hardcoded English strings in user-facing or printed output.

#### CUR-25 — Duplicate cascade triggers on `job_assignments` delete (new, minor)

- **Severity:** Low
- **Status:** New — found in the 2026-07-15 deep pass
- **Evidence:** `00000000000000_production_schema.sql:8285` and `:8287` both
  attach the same `delete_timesheets_on_assignment_removal()` function to
  `job_assignments` DELETE — one `AFTER DELETE` (`trigger_delete_timesheets`)
  and one `BEFORE DELETE` (`trigger_delete_timesheets_on_assignment_removal`).
  Every assignment deletion runs the timesheet `DELETE` twice (the second is a
  no-op because the rows are already gone) and emits the `RAISE INFO` cleanup
  log twice. `20260609204500_harden_user_delete_cascade_triggers.sql` only
  re-pinned the function's `search_path`; it did not de-duplicate the triggers.
  Harmless today because the delete is idempotent, but it doubles work per
  removal and becomes a real bug the moment the function is made
  non-idempotent (e.g. counters, audit rows, or external calls).
- **Action:** Drop `trigger_delete_timesheets` (keep the BEFORE-DELETE variant
  so a failed cascade aborts the assignment delete), in a small migration.
- **Closure:** Exactly one cascade trigger fires per `job_assignments` delete;
  regression test asserts a single timesheet cleanup.

## Fresh-pass results with no finding

Deep line-level review on 2026-07-15 (RLS/definers, all 14 public-token edge
functions, the staffing state machine, and the largest new code) cleared the
following:

- **Staffing state machine (`staffing-click`):** the accept/decline transition
  is a compare-and-swap — the `UPDATE … .eq('status','pending')` in the WHERE
  clause makes concurrent double-clicks safe (only one update matches; the
  loser reports "already responded"). No race.
- **Public-token edge functions:** token checks are sound — `tech-calendar-ics`
  uses a constant-time hashed compare (`tokensMatch`), and the public-token
  functions apply dual durable rate limits (ingress + per-token) and validate
  the token against the resource via the service role before acting. No IDOR
  or timing leak found.
- **Cascade/RLS mutation posture:** permissive base-schema policies were
  superseded and the profile privilege-escalation trigger is comprehensive
  (see CUR-04). The one gap is the column scope of technician self-update
  (CUR-04a).
- **PDF Unicode font (#856):** `registerPdfUnicodeFont` fetches
  `/fonts/NotoSansPdf-Regular.ttf` (85 KB) lazily and only for `power`-type
  PDFs (`pdfExport.ts:97`); it is not statically imported, so it does not enter
  the JS bundle. It counts only against the separate font asset budget.
- **Technical-document sync (#853):** the department-aware `cleanupFilter`
  rewrite matches the described fix and is covered by
  `tourDefaultDocumentSync.test.ts`; no regression found.

- **Secrets:** pattern scan (Google/OpenAI/JWT-shaped) over `src`, `scripts`,
  `docs`, `supabase` — no hits; no `.env*` files committed.
- **XSS sinks:** all four `dangerouslySetInnerHTML` sites are safe —
  `PayoutEmailPreview` goes through DOMPurify, `chart.tsx` renders internally
  generated CSS, and the rack-builder print SVG escapes all interpolated text
  via `escapeXml` (verified in `panelThumbnail.ts`).
- **New migrations (2):** both scoped correctly; the only new grant is
  `TO service_role`.
- **New power-calculation engine (#856/#852):** reviewed
  `powerAggregation.ts`, `powerSnapshots.ts`, `powerTableHydration.ts`,
  `powerRequirementSelection.ts` — correct vector (ΣP, ΣQ) aggregation, safe
  refusal of mixed phase modes/voltages and unallocated single-phase loads,
  Spanish user-facing reasons, and dedicated test files for each module.
- **WhatsApp send policy (#851):** `whatsappSendPolicy.ts` correctly clamps
  concurrency to 1–4 with a safe default of 1.
- **GitHub Actions:** all external actions pinned to full commit SHAs.

- **Secrets:** pattern scan (Google/OpenAI/JWT-shaped) over `src`, `scripts`,
  `docs`, `supabase` — no hits; no `.env*` files committed.
- **XSS sinks:** all four `dangerouslySetInnerHTML` sites are safe —
  `PayoutEmailPreview` goes through DOMPurify, `chart.tsx` renders internally
  generated CSS, and the rack-builder print SVG escapes all interpolated text
  via `escapeXml` (verified in `panelThumbnail.ts`).
- **New migrations (2):** both scoped correctly; the only new grant is
  `TO service_role`.
- **New power-calculation engine (#856/#852):** reviewed
  `powerAggregation.ts`, `powerSnapshots.ts`, `powerTableHydration.ts`,
  `powerRequirementSelection.ts` — correct vector (ΣP, ΣQ) aggregation, safe
  refusal of mixed phase modes/voltages and unallocated single-phase loads,
  Spanish user-facing reasons, and dedicated test files for each module.
- **WhatsApp send policy (#851):** `whatsappSendPolicy.ts` correctly clamps
  concurrency to 1–4 with a safe default of 1.
- **GitHub Actions:** all external actions pinned to full commit SHAs.

## Recommended issue/PR sequence

1. Recover bundle headroom (CUR-18) — this now blocks unrelated work; pair
   with removing the `replace` dev dependency (CUR-22) and a dead-code
   re-inventory (CUR-17).
2. Verify/close the Maps key rotation (CUR-03) — decision + evidence only.
3. Redact the highest-PII Edge logs (CUR-08): `send-password-reset` first.
4. Ship the CUR-04a column-guard trigger on `job_assignments` (payroll
   integrity) as a standalone security migration with a deny-path pgTAP test,
   then run the broader CUR-04 access-matrix inventory one table family per PR.
   Fold the CUR-25 duplicate-trigger cleanup into the same migration batch.
5. Triage and fix the five business-date sites (CUR-23) with boundary tests.
6. Restart the CUR-11 warning ratchet with per-rule counts so progress is
   measurable.
7. Operational track (CUR-09 controller sign-off, CUR-13 backup/restore/SLO)
   — needs business/provider decisions, not just code.
8. Continue CUR-16/CUR-19/CUR-20 by domain; fold CUR-24 into route-level UI
   work.
