# Codebase Re-Audit — 2026-09-04

**Audit date:** 2026-09-04
**Baseline reviewed:** `main` at `3ff4d13` (after the strict-mode / `no-explicit-any` / edge-type-gate PR series, #886–#891)
**Previous audit:** [`docs/plans/2026-07-codebase-audit-roadmap.md`](plans/2026-07-codebase-audit-roadmap.md) (2026-07-09)
**Scope:** React/Vite app, Supabase migrations/RLS/RPC/grants, all 74 Edge Functions, governance gates, tests/CI, PWA delivery, dependencies, bundle output.
**Method:** every gate re-run locally on this commit; static data-flow tracing; **all SQL findings verified against the live production database** (`syldobdcdsgfgjtbuwxm`) via read-only catalog queries and role-impersonated (`SET LOCAL ROLE anon` / `authenticated`) row counts. Numbers below are measured, not carried forward.

---

## Executive assessment

The remediation programme worked where it was measured. Every governance gate passes, the full
Vitest suite is green, `strict: true` type-checks clean, and several P0/P1 security items are
genuinely closed rather than papered over — `image-proxy` was retired instead of patched, CSP is
enforced with hashes and no `unsafe-eval`, the `anon`-realtime read policies are gone, and
transport-request duplication is now prevented by a database constraint instead of a read-then-write
check.

The dominant remaining pattern is different from July's. It is no longer "no safety primitives";
it is **good primitives with partial adoption**, plus **a schema baseline that the gates never
look at**. Three examples carry most of the risk:

1. `structuredLogger.ts` was written, tested, and never imported by a single Edge Function; 665
   raw `console.*` calls remain, some logging email addresses.
2. `escapeHtml` exists in `_shared/corporateEmailTemplate.ts`; seven email functions interpolate
   database-sourced values into HTML without it.
3. Every governance gate that reads source stops at `src/`. The 10,500-line schema baseline and
   the 74 Edge Functions are largely outside the ratchets, and that is where this audit's
   highest-severity findings are.

**The single most important finding is new and unrelated to the recent work:** `profiles` is
readable in full by every authenticated user — 313 rows, including 313 `calendar_ics_token`
bearer credentials and 286 national-ID numbers. The February hardening migration narrowed insert,
update and delete on that table and left select at `USING (true)`.

A second, smaller instance of the same class: three tables are readable with the public anon key,
`festival_artists` (598 rows) materially. Both were predicted as a *class* by SEC-05 in July
("historical generated policy fragments"); the instances were never enumerated. The policy that
exposes `festival_artists` also still carries the `ja.job_id = ja.job_id` self-comparison that
SEC-03 fixed for `sub_rentals` — the fix was applied to one table rather than swept for.

---

## Scorecard — measured on this commit

| Signal | 2026-07-09 | 2026-09-04 | Verdict |
| --- | --- | --- | --- |
| `npm run lint` warnings | 1,904 | **1,259** (898 app/test + 361 functions) | −34%; unchanged since the roadmap's own milestone |
| — of which `no-explicit-any` | ~1,343 | **1,038** (754 app + 284 functions) | app half ratcheted; functions half never was |
| `npm run typecheck` | passes, `strict: false` | **passes, `strict: true`** | resolved |
| `npm run typecheck:functions` | did not exist | gate exists; **not runnable here** (no Deno) | resolved in CI |
| Vitest full suite | "passed" (selective) | **357 files / 1,983 tests, all pass** | healthy |
| Coverage thresholds | none | **5 files**, and **CI never runs coverage** | inert |
| Production build | passes | **passes** | ok |
| Bundle (js gzip) | 3.01 MB / 3.34 MB ceiling | **3.10 MB / 3.34 MB** | **7.2% headroom** vs PERF-01's 15% target |
| Governance | passes (grandfathered) | **passes**, all 11 sub-gates | see below |
| Dependency audit | baseline-aware | **0 advisories, baseline is zero** | resolved |
| Migrations | 180+ | **200**, timestamps unique/ordered | ok |
| Live DB vs migration chain | not checked | **drifted** — 552 live policies vs 590 replayed; bodies rewritten in place | DB-06 |
| Playwright | failed on Windows | **POSIX env syntax removed** (Node launcher) | config resolved; suite not runnable here |

### Governance gate detail

| Gate | Current | Baseline | Note |
| --- | ---: | ---: | --- |
| `ui-data-layer-client-import` | 195 | 213 | slow drain; QLT-03 still open |
| `scheduling-new-date` | 67 | 107 | good progress |
| `direct-protected-route-allowed-roles` | 0 | 64 | **cleared** |
| `pages-supabase-client-import` | 0 | 0 | held |
| File size >800 lines | 0 | 0 | **`src/` only — see QLT-05 below** |
| Lint warnings | 1,259 | 1,259 | **zero headroom; ratchet is frozen at par** |
| Mobile type floor | 244 | 248 | draining |
| Manual Edge entrypoints | 33 | 37 | 38 functions now use `createHttpHandler` |
| Edge exposure classes | 14 public-token / 14 authenticated / 36 privileged / 7 service-only | — | all 71 classified |
| SECURITY DEFINER anon grants | 82 | 82 reviewed | no new exposures |
| GitHub Actions pinning | all pinned | — | held |

---

## P0 — new findings, ship immediately

### SEC-13 — `profiles` is fully readable by every authenticated user, exposing ICS bearer tokens

**Severity: high. Confirmed on production.** `profiles_select` is `USING (true)` for
`authenticated` and was never narrowed — the 2026-02 phase-2 hardening migration altered only
`profiles_insert`, `profiles_update` and `profiles_delete`. Measured directly as the
`authenticated` role:

| Visible rows | `calendar_ics_token` readable | `dni` readable |
| ---: | ---: | ---: |
| 313 | 313 | 286 |

Every logged-in user — including a freelance `technician` and the `wallboard` display role — can
read every row of `profiles`: `dni` (Spanish national ID), `residencia` (home address), `phone`,
`email`.

`calendar_ics_token` is not merely PII, it is a **bearer credential**. `tech-calendar-ics`
(`index.ts:153-157`) authenticates a request purely by matching `?tid=<uuid>&token=<value>`
against `profiles.calendar_ics_token`. Any authenticated user can read all 313 tokens and fetch
any colleague's personal calendar from an unauthenticated endpoint — privilege escalation, not
just an over-broad read.

**Remediation.** Narrow `profiles_select` to self + colleagues the caller legitimately needs
(assignment/department correlated), with admin/management retaining full read. Independently move
`calendar_ics_token` out of the client-readable row — a side table readable only by `service_role`,
or a column-level `REVOKE` on the `authenticated` grant — so the policy is not the only thing
between a technician and everyone's calendar. `dni` and `residencia` deserve the same treatment.
No pgTAP file currently asserts anything about `profiles` row visibility.

### SEC-12 — Three tables are readable with the public anon key

**Severity: medium. Confirmed and bounded on production.** A sweep of every table on which `anon`
holds `SELECT`, executed as the `anon` role, returns rows from exactly three:

| Table | Rows readable by anon | Assessment |
| --- | ---: | --- |
| `festival_artists` | **598** | Unannounced festival line-ups, stage assignments, free-text `notes`, rider status flags. Commercially confidential; no contact or fee columns. |
| `activity_catalog` | 54 | Static event-type reference data. Benign, likely intentional. |
| `rate_extras_2025` | 4 | Rate-extra pricing rows. |

The cause in each case is a SELECT policy whose predicate short-circuits to true and which carries
no `TO` clause, so it applies to `PUBLIC` including `anon`:

- `festival_artists` → `p_festival_artists_public_select_598f77`, which ORs a `true` term into the
  middle of an otherwise correct role check. **The same policy also still contains the
  `ja.job_id = ja.job_id` self-comparison** that SEC-03 fixed for `sub_rentals` in July — the
  anti-pattern was fixed on one table, not swept for across the schema, exactly as SEC-05 warned.
- `rate_extras_2025` → `p_rate_extras_2025_public_select_0e3de6` = `(is_admin_or_management() OR true)`.
- `activity_catalog` → `activity_catalog_read` = `true`.

The `anon` key ships in the client bundle by design, so these need no account to read.

**Remediation.** Drop the `true` term from all three predicates and restore the role check the
`OR true` was masking; scope each `TO authenticated` unless a public audience is deliberate
(`activity_catalog` plausibly is — decide explicitly rather than by accident). Fix the
`ja.job_id = ja.job_id` self-correlation in the same policy. Then add a governance rule that fails
any policy body matching `true OR`, `OR true`, `USING (true)`, or a self-comparison, unless
allowlisted with a rationale — the same shape as the existing SQL-grant gate — and a pgTAP deny
test per table.

Twelve further tables carry a `USING (true)` SELECT policy scoped to `authenticated`
(`achievements`, `app_changelog`, `jobs`, `job_assignments`, `job_rehearsal_dates`,
`rate_cards_2025`, `rate_cards_tour_2025`, `venues`, `madrid_holidays`, `role_skill_mapping`,
`soundvision_file_reviews`, `technical_tool_quick_presets`, plus `tours` via
"Allow wallboard to read tour status"). These are not anon-reachable and several are plausibly
intended to be org-wide, but `jobs`, `job_assignments` and the two `rate_cards_*` tables mean any
technician can read the entire job book and the full rate card. That is a business decision to
confirm, not a defect to assume — but it should be confirmed rather than inherited.

## P1 — open, and older than they look

### DB-06 — Production RLS has been hand-edited away from the migration chain

**Severity: high (latent). Measured on production.** The schema the migrations build is not the
schema that is running:

| | Migration replay | Production |
| --- | ---: | ---: |
| Policies in `public` | 590 | **552** |
| Tables carrying policies | 184 | 183 |

The difference is not only missing policies — **policy bodies have been rewritten in place under
the same name**. The four tables the first pass of this audit wrongly flagged are the proof:

| Policy | Migration chain says | Production actually has |
| --- | --- | --- |
| `p_tours_public_select_5a6a0b` | `USING (true OR <role check>)` | `USING (auth.uid() IS NOT NULL)` |
| `p_tour_dates_public_select_8f4344` | `USING (true OR <role check>)` | `USING (auth.uid() IS NOT NULL)` |
| `p_tour_power_defaults_public_select_5dba2b` | `USING (true OR <role check>)` | `USING (auth.uid() IS NOT NULL)` |
| `p_job_date_types_public_select_e0ccdb` | `USING (true OR <role check>)` | `USING (auth.uid() IS NOT NULL)` |

Someone hardened these directly against the database — plausibly through the Supabase advisor UI —
without writing a migration. Two consequences, and the second is the serious one:

1. **CI validates a schema that is not production.** `migration_apply`, `db_lint` and
   `rls_rpc_security_tests` all run `supabase db reset` and then test the result. For every drifted
   policy, those three jobs — the expensive ones, the ones that exist precisely to catch
   authorization defects — are asserting against a fiction.
2. **A rebuild from migrations silently reintroduces the vulnerability.** Any disaster-recovery
   restore, any new staging project, any `supabase db reset` against a real environment replays
   `USING (true OR …)` and re-opens the SEC-12-class exposure on tables that are currently safe.
   The hardening exists only in one mutable place, and nothing in CI would notice it being lost.

**Remediation.** Dump the production schema (`supabase db dump --linked -f`), diff it against a
migration replay, and write one reconciliation migration so the chain reproduces production
exactly. Then add a CI drift check — replay into an ephemeral database, dump both, and fail on a
`pg_policies` / `pg_proc` diff — so the two can never separate again silently. Until that check
exists, no RLS conclusion drawn from reading migrations can be trusted, including the ones in this
document.

### SEC-09 (carried) — structured logging shipped as dead code

`supabase/functions/_shared/structuredLogger.ts` exports `redactLogFields` and `logEvent`, has a
test file, and **has zero importers outside its own test**. Meanwhile 81 function files make 665
raw `console.*` calls. Confirmed PII at the boundary:

- `send-password-reset/index.ts:37, 98, 208` — logs the normalized email address three times per
  request, including on the success path.
- `send-password-reset/index.ts:76` — logs resolved `baseUrl` and raw env value.
- `staffing-click/index.ts:338-351` — logs token-validation internals and a token-expiry prefix.

**Remediation.** Adopt `logEvent` at the mail/auth/token functions first (the ones handling
identifiers), then make adoption enforceable: an ESLint rule for `supabase/functions/**` banning
bare `console.*` outside an allowlist would convert this from a convention into a gate.

### SEC-15 — Seven email functions interpolate user data into HTML with no escaping

`send-corporate-email` is correctly hardened (SEC-08 is closed — it runs `sanitizeCorporateEmailHtml`
server-side at `index.ts:669`). But the shared `escapeHtml` from `_shared/corporateEmailTemplate.ts`
is not used at all by:

`send-onboarding-email`, `send-password-reset`, `send-staffing-email`, `send-tour-availability`,
`send-vacation-decision`, `notify-staffing-cancellation`, `auto-send-timesheet-reminders`.

Concrete instance — `send-vacation-decision/index.ts:309-318` interpolates `techName`, `dept` and
period text straight into markup. `techName` is built from `profiles.first_name`/`last_name`
(L259), which the user controls. `reqRow.reason` and `rejection_reason` are free-text fields on
the same path. The result is HTML injection into outbound mail read by managers — a credible
internal phishing vector, not a self-XSS.

**Remediation.** Route every template through `escapeHtml`; the two functions that already do
(`send-bug-resolution-email`, `send-expense-notification`) are the pattern to copy.

---

## P2 — quality signals that are true but narrow

### QLT-05 — the file-size gate does not look at Edge Functions

`scripts/governance/check-file-size-budget.mjs:29` sets `sourceRoot = join(repoRoot, "src")`. The
gate reports "0 files over threshold" — accurate for `src/`, and silent about the privileged server
code, where six functions exceed the 800-line threshold:

| Lines | File |
| ---: | --- |
| 1,868 | `supabase/functions/send-staffing-email/index.ts` |
| 1,288 | `supabase/functions/staffing-orchestrator/index.ts` |
| 1,002 | `supabase/functions/create-whatsapp-group/index.ts` |
| 969 | `supabase/functions/staffing-click/index.ts` |
| 905 | `supabase/functions/upload-public-artist-rider/index.ts` |
| 878 | `supabase/functions/send-corporate-email/index.ts` |

Separately, **20 `src/` files now sit between 780 and 800 lines**, ten of them at 792–799
(`AmpRackDesigner.tsx` 799; `flexWorkOrders.ts`, `Expenses.tsx`, `TimesheetView.tsx`,
`AdminPanel.tsx` all at 798). A cluster that tight against the ceiling is a threshold being
managed, not complexity being reduced.

**Remediation.** Extend `sourceRoot` to cover `supabase/functions/` with its own baseline, and
report a "files within 5% of threshold" warning line so the cluster is visible before it becomes
a wall of exemptions.

### QLT-01 — the lint ratchet is frozen at par

Current warnings equal the baseline exactly (1,259 = 1,259). The gate blocks regressions and exerts
no downward pressure. The 284 `no-explicit-any` warnings in `supabase/functions/` have never been
through a reduction pass, and the 78 `react-hooks/exhaustive-deps` warnings remain the highest-risk
category in the file — each is a potential stale-closure bug, not a style nit.

Suggest splitting the baseline into `app` and `functions` halves so progress on one is not masked
by the other, and setting a per-PR decrement target rather than a freeze.

### QLT-07 — ~14,000 lines of unreferenced application code

A module-graph sweep (99 unreferenced modules of 1,465 scanned; 11 are vendored shadcn/ui
primitives worth keeping) leaves **88 app-owned modules, ~13,955 LOC**, with no import anywhere in
`src/` or `tests/`, static or dynamic. The largest cluster is an abandoned tour-scheduling feature:

| Lines | Module |
| ---: | --- |
| 757 | `src/utils/tour-scheduling-pdf-enhanced.ts` |
| 725 | `src/components/tours/scheduling/TourAccommodationsManager.tsx` |
| 646 | `src/utils/tour-scheduling-pdf.ts` |
| 610 | `src/components/equipment/EquipmentCreationManager.tsx` |
| 594 | `src/components/tours/scheduling/EnhancedTourTravelPlanner.tsx` |
| 539 | `src/components/equipment/JobPresetManager.tsx` |
| 405 | `src/components/tours/scheduling/TourItineraryBuilder.tsx` |
| 391 | `src/hooks/useJobCard.ts` |
| 352 | `src/components/tours/scheduling/TourTimelineView.tsx` |
| 350 | `src/types/tourScheduling.ts` |

Two notes on this list. First, the five dashboard components the July roadmap explicitly said to
"delete rather than type" — `DashboardContent`, `DepartmentSchedule`, `DepartmentTabContent`,
`MyJobTotalsSection`, `RealTimeJobsList` — are **all still present and still unreferenced**.
Second, `useOptimisticJobManagement` is documented in `CLAUDE.md` as an active performance pattern
("Optimistic Updates") and has no callers; the documentation describes code that is not running.

This is dead weight in review surface and in every `any`/lint/type count above, not in the bundle
(tree-shaking excludes it). Deleting it is the cheapest available reduction in all three.

### REL-02 — coverage thresholds exist but CI never runs coverage

`vitest.config.ts:41-70` defines thresholds for exactly five files. No workflow in
`.github/workflows/` invokes `test:coverage`, so none of them is enforced anywhere. The
trust-boundary modules that most need a floor — `_shared/auth.ts`, `memoriaSecurity.ts`,
`rateLimit.ts`, `hojaLinkToken.ts`, `emailHtmlPolicy.ts` — have tests but no threshold.

### DB-02 — pgTAP covers roughly 40% of the policied schema

19 pgTAP files reference ~76 tables; the replayed migration chain yields **590 live policies across
184 tables**. Recent table families are well covered. The gap is precisely the old baseline
tables — including every table named in SEC-12 and SEC-13.

---

## Closed since 2026-07-09 — verified, not assumed

| ID | Evidence on this commit |
| --- | --- |
| QLT-02 | `tsconfig.app.json:21` `"strict": true`; `npm run typecheck` exits 0 |
| DATA-02 | `functions_typecheck` job present; `deno.lock` committed; gate fails closed without Deno |
| DATA-01 | `20260709210000_enforce_subrental_transport_request_uniqueness.sql` adds `uq_transport_requests_active_subrental` |
| SEC-03 | No self-comparison (`x.a = x.a`) survives in any migration — only the explanatory comment in `20260709123000_harden_sub_rentals_rls.sql:2` |
| SEC-07 | `image-proxy` retired to a fail-closed stub with the rationale in-file |
| SEC-08 | `send-corporate-email/index.ts:669` sanitizes server-side via `_shared/emailHtmlPolicy.ts` |
| SEC-10 | `public/_headers` ships an **enforced** CSP — no `unsafe-eval`, no `unsafe-inline` in `script-src` (7 hashes), `object-src 'none'`, `frame-ancestors 'none'`; `governance:csp` gates it |
| REL-01 | `playwright.config.ts:21` uses `node scripts/e2e/start-test-server.mjs`; no POSIX inline env |
| OPS-01 | `audit:deps` reports 0 advisories against a zero baseline |
| — | `anon_*_select_for_realtime` policies on `jobs`, `profiles`, `job_assignments`, `locations`, `logistics_*` dropped by `20260609120000_security_hardening_anon_access.sql` |
| — | `direct-protected-route-allowed-roles` fully drained, 64 → 0 |

`style-src 'unsafe-inline'` and `img-src https:` remain in the CSP. Both are common residuals;
the `img-src` wildcard is worth revisiting since it permits pixel-based exfiltration of anything
reachable from a URL.

---

## Next moves — prioritized register

Ranked by risk removed (or future defects prevented) per unit of effort, not by severity alone.
Each row is meant to become one issue with an owner and a target release, per the review rules
inherited from the July roadmap.

| # | ID | Move | Why it ranks here | Effort | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| 1 | SEC-13 | Get `calendar_ics_token` out of the client-readable row, then narrow `profiles_select`; rotate all 313 tokens afterwards | Only finding that is both confirmed-exploitable and live: 313 bearer credentials and 286 national IDs readable by any account | S (column `REVOKE` is one line; policy is one migration) | As `authenticated`, a non-management user reads only permitted rows; pgTAP deny test for `profiles`; tokens rotated |
| 2 | SEC-12 | Drop the `true` term from the three anon-reachable SELECT policies; fix the `ja.job_id = ja.job_id` self-correlation in the same `festival_artists` policy; decide `activity_catalog`'s audience explicitly | 598 rows of unannounced line-ups readable with a key that ships in the bundle | S | Anon sweep returns zero rows from `festival_artists` and `rate_extras_2025`; pgTAP deny test per table |
| 3 | **DB-06** | Reconcile production RLS with the migration chain, then add a CI drift check | **Highest structural leverage.** Until this closes, three CI jobs test a fiction, a restore-from-migrations silently re-opens SEC-12, and no migration-based RLS reasoning is sound — including this document's | M | One reconciliation migration lands; CI fails on any `pg_policies`/`pg_proc` diff between replay and production dump |
| 4 | QLT-07 | Delete the 88 unreferenced modules (~13,955 LOC) in one reviewable PR | Cheapest large win: improves QLT-01, QLT-05 and review surface simultaneously; nothing depends on it | S–M (mechanical, but needs one careful review pass) | Modules deleted; `npm run lint`/`typecheck`/tests green; lint baseline regenerated downward |
| 5 | QLT-08 | Close the gate blind spots: extend the file-size budget to `supabase/functions/`, wire `test:coverage` into CI, split the lint baseline into app/functions halves with a decrement target | Small config changes that make three existing gates tell the truth; prevents recurrence rather than fixing instances | S | File-size gate reports the six oversized functions; coverage thresholds actually fail a PR; lint baseline drops below par |
| 6 | SEC-09 / SEC-15 | Adopt `structuredLogger` and `escapeHtml` at the mail and auth functions, and add the lint rules that make adoption enforceable | The primitives already exist and are tested; only adoption is missing. The lint rule is what stops it regressing again | M | No bare `console.*` in `supabase/functions/**` outside an allowlist; every email template escapes interpolated values |
| 7 | QLT-03 | Continue draining the 195 legacy data-layer imports | Steady structural work with no acute risk; ranks below everything above | L | Baseline continues to fall each release |

Items 1–3 are the ones worth doing before anything else. Item 3 is the one most likely to be
skipped because it produces no visible feature change, and the one whose absence most reliably
turns a fixed vulnerability back into an open one.

## Method and limits

- Every number above was produced by running the command on this commit. Commands run: `npm ci`,
  `lint`, `typecheck`, `test:run`, `build`, `budget:bundle`, all 11 `governance:*` sub-gates,
  `audit:deps`, `ci:db:migrations`.
- **Not run:** `typecheck:functions` (no Deno on this machine — CI covers it), the Playwright
  suite (this sandbox ships Chromium r1194; the pinned Playwright wants r1234, so all 29 specs
  fail at `browserType.launch` before any assertion — an environment mismatch, not a code signal;
  the `e2e_smoke` and mobile jobs cover it in CI), and every
  container-backed database job (`migration_apply`, `db_lint`, `rls_rpc_security_tests`), so all
  SQL findings are derived from replaying the migration chain statically.
- **SQL findings were verified against production, and that verification overturned two of them.**
  An initial pass reconstructed RLS by replaying the migration chain. Checking it against the live
  database showed the replay is not a reliable model of production:
  - It reported eight tour/job tables as anon-readable. Measured as `anon`, all eight return
    **zero** rows — those policies have been replaced in production outside the migration chain.
    The real anon exposure is three tables, and only `festival_artists` materially.
  - It reported 55 `SECURITY DEFINER` functions with a mutable `search_path`, including the
    authorization primitives. **This was a false positive in the audit tooling**: the schema dump
    writes `SET "search_path"` (quoted) and the scan matched only the unquoted form. Production has
    **140 of 140 definer functions pinned**, and neither `anon` nor `authenticated` holds `CREATE`
    on schema `public`. There is no finding here; the earlier SEC-14 entry has been withdrawn.
  Treat the migration chain as the intent and `pg_policies` / `pg_proc` as the truth. That gap is
  itself the highest-leverage structural finding in this report — see **DB-06**.
- The dead-code sweep resolves `@/`-aliased and relative module specifiers and was spot-checked
  against dynamic `import()` calls. Modules reachable only through a string built at runtime would
  not be detected.
