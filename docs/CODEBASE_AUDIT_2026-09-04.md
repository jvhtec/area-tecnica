# Codebase Re-Audit — 2026-09-04

**Audit date:** 2026-09-04
**Baseline reviewed:** `main` at `3ff4d13` (after the strict-mode / `no-explicit-any` / edge-type-gate PR series, #886–#891)
**Previous audit:** [`docs/plans/2026-07-codebase-audit-roadmap.md`](plans/2026-07-codebase-audit-roadmap.md) (2026-07-09)
**Scope:** React/Vite app, Supabase migrations/RLS/RPC/grants, all 74 Edge Functions, governance gates, tests/CI, PWA delivery, dependencies, bundle output.
**Method:** every gate re-run locally on this commit; RLS reconstructed to final state by replaying the full migration chain; static data-flow tracing. Numbers below are measured, not carried forward.

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

**The single most important finding is new and unrelated to the recent work:** eight tables are
readable by anyone holding the public anon key, because machine-generated RLS policies carry a
`true OR …` prefix that short-circuits the role check. This was predicted as a *class* by SEC-05
in July ("historical generated policy fragments"); the instances were never enumerated.

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

### SEC-12 — Eight tables are readable with the public anon key (unauthenticated)

**Severity: critical.** Ten SELECT policies in the schema baseline are written as
`USING ((true OR <role check>))` or `USING ((<role check> OR true))`. The `true` short-circuits the
disjunction, so the policy is unconditionally true. None of them carries a `TO` clause, so they
apply to `PUBLIC` — which includes `anon`. Eight of the ten tables additionally hold a table-wide
`GRANT SELECT … TO "anon"`, so nothing else stops the read.

The `anon` key is embedded in the shipped client bundle by design. Any person on the internet can
therefore read these tables in full, with no account.

| Table | Policy (`00000000000000_production_schema.sql`) | anon reach |
| --- | --- | --- |
| `tours` | `p_tours_public_select_5a6a0b` (L9482) | **full table** (L10439) |
| `tour_dates` | `p_tour_dates_public_select_8f4344` (L9440) | **full table** |
| `tour_default_sets` | `p_tour_default_sets_public_select_8341a3` (L9444) | **full table** |
| `tour_default_tables` | `p_tour_default_tables_public_select_fead6e` (L9448) | **full table** |
| `tour_power_defaults` | `p_tour_power_defaults_public_select_5dba2b` (L9456) | **full table** |
| `tour_weight_defaults` | `p_tour_weight_defaults_public_select_b2dacf` (L9478) | **full table** |
| `rate_extras_2025` | `p_rate_extras_2025_public_select_0e3de6` (L9358) | **full table** |
| `job_date_types` | `p_job_date_types_public_select_e0ccdb` (L9231) | **full table** |
| `job_departments` | `p_job_departments_public_select_ce698d` (L9235) | column-only (`job_id`) |
| `locations` | `p_locations_public_select_6df21f` (L9275) | column-only (`id`, `name`) |

Exposed content includes the full tour roster and tour date schedule (client and venue
information), and 2025 rate-extra pricing. The matching UPDATE/DELETE policies on these tables
*are* correctly role-restricted, which is why this never surfaced as broken behaviour.

**Remediation.** Replace the ten SELECT policies with the role predicate the `true OR` was
masking, scope each to `TO authenticated` unless a public audience is deliberate, and revoke the
table-wide `anon` grants that are not required by the tokenized wallboard path. Add a governance
rule that fails any policy body matching `true OR`, `OR true`, or `USING (true)` without an
explicit reviewed allowlist entry — the same shape as the existing SQL-grant gate. Cover each
table with a pgTAP deny test asserting an `anon` role reads zero rows.

**Verify first** (the schema baseline may not match the live database):

```sql
select tablename, policyname, roles, qual
  from pg_policies
 where schemaname = 'public'
   and (qual ilike '%true or%' or qual ilike '%or true%' or qual = 'true')
 order by tablename;
```

### SEC-13 — `profiles` is fully readable by every authenticated user, exposing ICS bearer tokens

**Severity: high.** `profiles_select` is `USING (true)` for `authenticated` (L9521) and was never
narrowed — the 2026-02 phase-2 hardening migration altered only `profiles_insert`, `profiles_update`
and `profiles_delete`. `authenticated` holds a table-wide SELECT grant (L10273). No masking view
sits in front of the client path.

Every logged-in user — including a freelance `technician` and the `wallboard` display role — can
therefore read every row of `profiles`, which stores `dni` (Spanish national ID), `residencia`
(home address), `phone`, `email` … and `calendar_ics_token`.

That last column is not merely PII, it is a **bearer credential**. `tech-calendar-ics`
(`index.ts:153-157`) authenticates a request purely by matching `?tid=<uuid>&token=<value>`
against `profiles.calendar_ics_token`. Any authenticated user can read every other user's token
and then fetch their personal calendar feed from an unauthenticated endpoint — a privilege
escalation, not just an over-broad read.

**Remediation.** Narrow `profiles_select` to self + colleagues the caller legitimately needs
(assignment/department correlated), with admin/management retaining full read. Independently, move
`calendar_ics_token` out of the row the client can read — a side table readable only by
`service_role`, or a column-level `REVOKE` on the `authenticated` grant — so that fixing the
policy is not the only thing standing between a technician and everyone's calendar. `dni` and
`residencia` deserve the same treatment. Add pgTAP coverage: today no pgTAP file asserts anything
about `profiles` row visibility.

---

## P1 — open, and older than they look

### SEC-14 — `SECURITY DEFINER` authorization primitives have a mutable `search_path`

136 `SECURITY DEFINER` functions are live; **55 have no `SET search_path`**. Four of them are the
authorization primitives every RLS policy in the schema calls: `get_current_user_role`, `is_admin`,
`is_admin_or_management`, `can_manage_users`.

An unpinned `search_path` on a definer function is the standard Postgres escalation vector: an
attacker who can create an object in an earlier schema on the path shadows what the function
resolves. Exploitability depends on whether a non-superuser role holds `CREATE` on a schema in the
path — no migration in this repo grants or revokes `CREATE ON SCHEMA`, so the live grant is
inherited from project defaults and must be checked directly:

```sql
select has_schema_privilege('authenticated','public','CREATE'),
       has_schema_privilege('anon','public','CREATE');
```

If either returns true, treat this as P0 alongside SEC-12.

This survived because the `db_lint` CI job runs `--fail-on error`, and Supabase's
`function_search_path_mutable` advisory (0011) is a **warning**. The gate is real but tuned past
the finding. DB-03 in the July roadmap called for exactly this and has not been actioned.

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

## Recommended sequence

1. **Now.** SEC-12 — run the `pg_policies` verification query, fix the ten policies, revoke the
   anon grants, add the policy-shape governance rule and pgTAP deny tests.
2. **Now.** SEC-13 — get `calendar_ics_token` out of client reach first (fastest risk reduction),
   then narrow `profiles_select`.
3. **Within 7 days.** SEC-14 — check `has_schema_privilege` for `CREATE`; pin `search_path` on the
   four authorization primitives regardless of the answer, then the remaining 51; change `db_lint`
   to fail on the `0011` advisory so it cannot recur.
4. **Within 30 days.** SEC-09 and SEC-15 — adopt `structuredLogger` and `escapeHtml` at the mail
   and auth functions, and add the lint rules that make adoption enforceable rather than optional.
5. **Within 30 days.** QLT-07 — delete the 88 unreferenced modules in one reviewable PR; it
   improves QLT-01, QLT-05 and review surface at once.
6. **Ongoing.** Extend the file-size gate to `supabase/functions/`, split the lint baseline into
   app/functions halves with a decrement target, and wire `test:coverage` into CI so REL-02's
   thresholds are real.

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
- **RLS state was reconstructed, not observed.** The replay tracks `CREATE`/`DROP`/`ALTER POLICY`
  and `DROP TABLE` in document order across all 200 migrations, resolving quoted and
  schema-qualified identifiers. It cannot see drift applied directly to the production database.
  Confirm SEC-12, SEC-13 and SEC-14 against `pg_policies` / `pg_proc` before and after remediation.
- The dead-code sweep resolves `@/`-aliased and relative module specifiers and was spot-checked
  against dynamic `import()` calls. Modules reachable only through a string built at runtime would
  not be detected.
