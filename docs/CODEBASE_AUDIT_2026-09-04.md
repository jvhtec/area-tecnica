# Codebase Re-Audit — opened 2026-09-04

**Opened:** 2026-09-04 on `main` at `3ff4d13`
**Last re-verified:** 2026-09-05 on `main` at `f87b836`, after PR #920 and the #921–#929 remediation series
**Previous audit:** [`docs/plans/2026-07-codebase-audit-roadmap.md`](plans/2026-07-codebase-audit-roadmap.md) (2026-07-09)
**Scope:** React/Vite app, Supabase migrations/RLS/RPC/grants, all Edge Functions, governance gates, tests/CI, PWA delivery, dependencies, bundle output.
**Method:** every gate re-run locally at each verification; static data-flow tracing; **all SQL findings verified against the live production database** (`syldobdcdsgfgjtbuwxm`) via read-only catalog queries and role-impersonated (`SET LOCAL ROLE anon` / `authenticated`) row counts. Numbers below are measured at the stated date, not carried forward.

This is a living register. Each finding carries its own status; the scorecard shows both
verification passes so the deltas are visible rather than overwritten.

---

## Executive assessment

**As of 2026-09-05 the register is substantially closed, and closed on production rather than only
in the repository.** Nine PRs (#920–#929) landed since this document opened. Every P0 is verified
shut against the live database, the two structural quality findings are enforced by new gates
rather than by intent, and the schema-drift finding has gone from "counts disagree" to a normalized
catalog exporter, a measured production comparison, and an applied reconciliation migration.

What the 2026-09-04 pass found, and where each landed:

- **`profiles` readable in full by every authenticated account** — 313 rows, 313 ICS bearer tokens,
  286 national IDs. Both halves are now fixed. Tokens live in an owner-scoped vault with client
  write privileges revoked; `profiles_select` is correlated to owner / operational admin /
  shared-job technician. Measured on production: a claimless authenticated session now reads **0**
  profile rows, and a real technician reads exactly their shared-job set.
- **Three tables readable with the public anon key** — an anon sweep of every table `anon` can
  `SELECT` now returns rows from **one**: `activity_catalog` (54 rows of static reference data,
  deliberately public). `festival_artists` (598) and `rate_extras_2025` are closed, along with the
  `ja.job_id = ja.job_id` self-comparison that SEC-03 had fixed on one table without sweeping.
- **Good primitives, partial adoption** — the pattern that dominated the September baseline is
  now enforced rather than encouraged. `escapeHtml` covers every email function; a new
  `check-edge-logging` gate freezes console sites so the `structuredLogger` migration can only move
  forward; the lint gate enforces its own global and per-domain budgets; the file-size budget
  covers `supabase/functions/` as a second domain.

**The single most useful thing this pass adds is a residual, not a new defect.** Narrowing
`profiles_select` reduced exposure sharply but did not eliminate it: a technician still reads the
**full** profile row — `dni`, `residencia`, `phone`, `email` — for every colleague they have ever
shared a job with. Measured on production: 175 accounts have such reach, averaging 55 colleagues
and peaking at **134 of 313 profiles (43%)**. `get_profile_directory()` exists and returns exactly
the safe projection, but it is an *alternative* the caller may choose, not a *constraint* the
policy imposes. Closing this means moving colleague-facing reads onto the directory and dropping
the shared-job branch from `profiles_select` — see SEC-16.

The second residual is that **schema-drift detection is instrumented but not gated**: CI exports a
catalog artifact and then compares it against itself, which proves the exporter and comparator run
but cannot detect drift. The production comparison is a documented manual release step.

---

## Scorecard

| Signal | 2026-07-09 | 2026-09-04 | 2026-09-05 | Verdict |
| --- | --- | --- | --- | --- |
| `npm run lint` warnings | 1,904 | 1,216 | **1,145** (826 app + 319 functions) | −40% from July; now budgeted per domain |
| — of which `no-explicit-any` | ~1,343 | 1,037 | **966** | ratcheted; functions remain the untreated half |
| `npm run typecheck` | passes, `strict: false` | passes, `strict: true` | **passes** | resolved |
| `npm run typecheck:functions` | did not exist | passes | **passes** | resolved |
| Vitest full suite | "passed" (selective) | 360 files / 1,995 tests | **373 files / 2,075 tests, all pass** | healthy |
| Coverage thresholds | none | 5 files, **never run in CI** | **10 files incl. every shared trust boundary, run in CI** via `test:critical` | resolved |
| Production build | passes | passes | **passes** | ok |
| Bundle (js gzip) | 3.01 MB | 3.10 MB | **3.10 MB / 3.32 MB** | **6.6% headroom** vs PERF-01's 15% target |
| Governance | passes (grandfathered) | passes, 11 sub-gates | **passes, 12 sub-gates** (adds `check-edge-logging`) | strengthened |
| Dependency audit | baseline-aware | 0 advisories | **0 advisories** | resolved |
| Migrations | 180+ | 203 | **206, and all 206 applied to production** | ok |
| Live DB vs migration chain | not checked | count mismatch, undiagnosed | **normalized catalog compared; 199 object differences found, zero policy differences; reconciliation applied** | DB-06 residual: not gated |
| Anon-readable tables (measured) | not checked | **3** (598 + 54 + 4 rows) | **1** (`activity_catalog`, 54, deliberate) | resolved |
| Profiles visible to a claimless authenticated session | not checked | **313** | **0** | resolved |
| Unreferenced app modules | not checked | **88 files / ~13,955 LOC** | **0** (1 intentional Rollup stub) | resolved |

### Governance gate detail — 2026-09-05

| Gate | Current | Baseline | Note |
| --- | ---: | ---: | --- |
| `ui-data-layer-client-import` | 176 | 176 | draining (213 → 195 → 176); QLT-03 still open |
| `scheduling-new-date` | 43 | 43 | draining (107 → 67 → 43) |
| `direct-protected-route-allowed-roles` | 0 | 0 | cleared |
| `pages-supabase-client-import` | 0 | 0 | held |
| File size >800 lines — `src/` | 0 | 0 | held |
| File size >800 lines — `supabase/functions/` | 6 | 6 | **new domain**; the six oversized functions are now budgeted rather than invisible |
| Lint warnings | 1,145 | 1,145 | now enforced at total, per-rule, per-domain and per-file |
| Legacy edge console sites | 560 in 80 files | frozen | **new gate**; new/unlisted sites fail |
| Mobile type floor | 241 | 241 | draining |
| Edge exposure classes | 14 public-token / 14 authenticated / 36 privileged / 7 service-only | — | all 71 classified |
| SECURITY DEFINER anon grants | 81 | 81 reviewed | one fewer than September |
| GitHub Actions pinning | all pinned | — | held |

---

## Open findings

### SEC-16 — a technician still reads full profile rows for every shared-job colleague

**Severity: medium. New on 2026-09-05, and it is the residual of SEC-13's fix rather than a
regression.** `profiles_select` is now correlated:

```
id = auth.uid()
OR current_user_role() = ANY (ARRAY['admin','management','logistics'])
OR EXISTS (caller and target share a job_assignment)
```

That third branch returns the **whole row**, so `dni`, `residencia`, `phone` and `email` remain
readable for every colleague the caller has ever shared a job with. Measured on production:

| Metric | Value |
| --- | ---: |
| Accounts with shared-job reach | 175 |
| Average colleagues visible | 55 |
| **Maximum colleagues visible to one technician** | **134 of 313 (43%)** |
| Non-null `dni` among one sampled technician's 103 visible rows | 102 |

This is a large improvement on 313-of-313 and the credential is entirely gone from the row, so it
is not a P0. But `get_profile_directory()` — which returns exactly the safe projection and
deliberately excludes email, phone, DNI and residence — is an *alternative* a caller may choose,
not a *constraint* the policy imposes. Any colleague-facing query that goes to `profiles` directly
still gets the sensitive columns.

**Remediation.** Inventory the colleague-facing reads (the assignment matrix, staffing, messaging,
wallboard) and move them onto `get_profile_directory()`; then drop the shared-job branch from
`profiles_select` so the sensitive columns are reachable only by the owner and by
admin/management/logistics. Add a pgTAP case asserting a technician reads zero rows for a
colleague they share a job with, once the directory is the only path. Doing it in that order keeps
the UI working at every step.

### DB-06 (residual) — drift detection is instrumented but not gated

The substance landed: `scripts/ci/schema-catalog.sql` exports policies, RLS flags, view and
function fingerprints, trigger definitions and table/function/column ACLs under stable object
identities; `compare-schema-catalog.mjs` diffs two catalogs and refuses empty, duplicate or
cross-major inputs; `docs/security/schema-drift-verification.md` records the procedure and the
first real production comparison — **199 object differences, zero policy differences** — and the
reconciliation migration has been applied (verified: `set_job_created_by` and the jobs attribution
trigger now exist on production, client `TRUNCATE`/`REFERENCES`/`TRIGGER` grants are gone, and all
206 repository migrations are applied).

What is not closed: the CI step runs

```
node scripts/ci/compare-schema-catalog.mjs schema-catalog.json schema-catalog.json
```

— the artifact against itself. That proves the exporter and comparator execute, and it publishes
the artifact for manual comparison, but it cannot detect drift, because PR CI deliberately never
contacts production. So drift is caught only when a human downloads the artifact and runs the
comparison as a release step.

**Remediation.** Either accept this explicitly (record the manual comparison as a required item on
the production release checklist, so it is a gate operated by a person rather than an intention),
or add a scheduled workflow that holds a read-only production connection and runs the real
comparison on a cadence, failing loudly on any policy or ACL difference. The first is cheap and
honest; the second is what actually prevents silent drift between releases.

### SEC-09 (partial) — structured logging is adopted at the boundaries, not throughout

The confirmed PII cases are fixed — `send-password-reset` no longer logs anything, and
`structuredLogger` now has 8 importers where it had none. A new `check-edge-logging` governance
gate lints `supabase/functions/**` for `no-console`, freezes the legacy sites in
`legacy-console-allowlist.json`, and fails on any new or unlisted site, so the remaining debt can
only shrink.

**560 console sites across 80 files remain.** That is now a ratcheted migration rather than an open
wound, and the gate's own rationale is explicit that freezing is "not approval to log PII". The
residual work is to keep draining it, prioritising functions that handle identifiers.

### QLT-03 — the legacy data-layer boundary is still draining

176 `dataLayerClient` imports in pages and components, down from 213 → 195 → 176. No acute risk;
steady structural work.

### PERF-01 — bundle headroom is still short of target

3.10 MB gzip against a 3.32 MB ceiling: **6.6% headroom** where PERF-01 asks for 15%. `maps-lib`
(~510 kB), `pdf-libs` (~342 kB) and `spreadsheet-libs` (~265 kB) still dominate. Unchanged in
substance since July.

### DB-02 — pgTAP breadth still trails the policied schema

The suite has grown (new files for anonymous catalog access, profile/rate visibility, staffing
summary, calendar-token isolation, schema attribution) and now covers the tables this audit
touched. It still does not approach 100% of the 184 policied tables, and the catalog comparison
explicitly "does not test application row visibility or replace pgTAP".

---

## Closed and verified on production — 2026-09-05

Each row was re-measured against the live database or a re-run gate, not inferred from the diff.

| ID | What was wrong | What closed it | Measured proof |
| --- | --- | --- | --- |
| **SEC-13** | `profiles_select` was `USING (true)`: 313 rows readable by any account, including 313 ICS bearer tokens and 286 national IDs | #920 moved tokens to an owner-scoped vault with client writes revoked and rotated every one; #920 narrowed `profiles_select` and added `get_profile_directory()` | Claimless authenticated session reads **0** profile rows and **0** vault rows; legacy column holds **0** non-null tokens; a real technician reads exactly their shared-job set (103 = 103) and exactly **1** vault row |
| **SEC-12** | Ten SELECT policies short-circuited via `true OR …`; three tables readable with the public anon key, `festival_artists` at 598 rows; `ja.job_id = ja.job_id` self-comparison | #920 and #929 rewrote the predicates, corrected the correlation and revoked `anon` grants | Anon sweep over every `anon`-SELECTable table returns rows from **one** table (`activity_catalog`, 54, deliberate); **0** policies contain `true OR`/`OR true`; `rate_cards_2025` SELECT is now `is_admin_or_management()` |
| **SEC-15** | Seven email functions interpolated user-controlled values into HTML with no escaping | #928 | **0** email functions build HTML without `escapeHtml`/sanitiser |
| **QLT-05** | The file-size gate scanned only `src/`, so six Edge Functions over 800 lines were invisible | #927 split the budget into two domains | Gate reports both domains; `supabase/functions/` baselined at 6 |
| **QLT-07** | 88 unreferenced app modules, ~13,955 LOC, including five components July had already flagged | #925 | Sweep finds **0** app-owned dead modules; only `src/stubs/html2canvas-unused.ts` remains, which is an intentional Rollup alias target |
| **QLT-01 (gate)** | `check-lint-warning-baseline.mjs` enforced only per-file ceilings; `baseline.total` was printed, `baseline.rules` never read | #927 added `lint-warning-policy.mjs` | Budgets enforced at total, per-rule, per-domain, per-domain-rule and per-file |
| **REL-02** | Coverage thresholds existed for 5 files and no workflow ran coverage | #927 | 10 thresholds including every shared trust boundary (`auth`, `rateLimit`, `hojaLinkToken`, `emailHtmlPolicy`, `memoriaSecurity`), executed in CI because `test:critical` chains `test:critical:coverage` |
| **DB-06 (substance)** | 552 live policies vs 590 replayed, undiagnosed, with four cited body differences | #924 built the normalized exporter/comparator and applied a reconciliation migration | Production comparison found 199 object differences and **zero** policy differences; reconciliation verified applied; **206/206** repository migrations applied |
| — | Staffing summary view was directly reachable | #922 | `v_job_staffing_summary` has no grants to `anon` or `authenticated` |
| — | Offline cache retained private state across accounts and accepted cached fallback for authorization errors | #923 | Not independently re-verified here — see Method and limits |
| — | Expense edit permission bypass | #929 | Not independently re-verified here — see Method and limits |

Also verified still holding from the July → September closures: `strict: true` type-checks clean;
enforced CSP with no `unsafe-eval` and no `unsafe-inline` in `script-src`; `image-proxy` retired;
dependency audit at zero; **141 SECURITY DEFINER functions, 0 with an unpinned `search_path`**;
only two `anon`-targeted policies remain (`activity_catalog_read` and `system_errors_insert`, a
write-only error sink).

### One class worth an explicit decision

Fifteen `USING (true)` SELECT policies remain, all scoped to `authenticated` except
`activity_catalog` (anon + authenticated, deliberate). Most are reference data. Two are not:
`jobs_select` and `job_assignments_select` make the entire job book and assignment history readable
by every authenticated account. That is plausibly intended for this product — and
`job_assignments` being broadly readable is what makes the new correlated `profiles_select` work —
but it is currently intent-by-inheritance rather than a recorded decision. Worth confirming, then
either documenting or narrowing.

---

## Next moves — prioritized register

Ranked by risk removed (or future defects prevented) per unit of effort. Re-ranked 2026-09-05:
everything above the line in the previous register has shipped.

| # | ID | Move | Why it ranks here | Effort | Exit criteria |
| --- | --- | --- | --- | --- | --- |
| 1 | **SEC-16** | Move colleague-facing reads onto `get_profile_directory()`, then drop the shared-job branch from `profiles_select` | The only remaining measured exposure of personal data: one technician can read up to 134 colleagues' `dni`, `residencia`, `phone` and `email`. The safe projection already exists — it just is not the only path | M (touches several read sites; do the migration to the RPC first, the policy narrowing second, so the UI never breaks) | A technician reads 0 rows from `profiles` for a shared-job colleague; pgTAP asserts it; colleague-facing UI unchanged |
| 2 | **DB-06 (residual)** | Make drift detection a real gate: either record the manual catalog comparison as a required release-checklist item, or add a scheduled read-only production comparison | The tooling and the first reconciliation are done; without a gate, drift resumes silently and the next audit re-derives it from scratch — which is how this finding arose | S (checklist) / M (scheduled workflow) | A diff between replayed and production catalogs fails something a human will see, on a defined cadence |
| 3 | **SEC-09** | Keep draining the 560 frozen console sites, identifier-handling functions first | Ratcheted and safe, but 80 files still log through an unstructured path | L, incremental | `legacy-console-allowlist.json` shrinks each release; no function handling identifiers remains on the list |
| 4 | — | Confirm or narrow org-wide `jobs_select` / `job_assignments_select` | Currently intent-by-inheritance; the correlated `profiles_select` depends on it, so decide deliberately rather than discover later | S (decision) | Either a recorded rationale or a narrowed policy with pgTAP |
| 5 | **PERF-01** | Route-level budgets for the map, PDF and spreadsheet chunks | 6.6% headroom against a 15% target; no acute risk, but the ceiling is approached rather than defended | M | Headroom ≥15%, or per-route budgets replacing the single global ceiling |
| 6 | **QLT-03** | Continue draining the 176 legacy data-layer imports | Steady structural work, no acute risk | L, incremental | Baseline falls each release |
| 7 | **DB-02** | Extend pgTAP toward the untested half of the 184 policied tables | The catalog comparison explicitly does not test row visibility, so pgTAP remains the only behavioural check | L | Deny coverage for every table holding personal or financial data |

Items 1 and 2 are the ones worth doing next. Item 1 is the last measured data exposure; item 2 is
what stops the register from silently regressing between audits.

---

## Method and limits

- Numbers are produced by running the command or query at the stated date. Commands re-run for the
  2026-09-05 pass: `npm ci`, `lint`, `typecheck`, `test:run`, `build`, `budget:bundle`, the full
  `governance` chain (12 sub-gates), plus a module-graph sweep for unreferenced code.
- **SQL findings are verified against the live production database**, not inferred from the
  migration chain. The 2026-09-05 pass used read-only catalog queries plus role-impersonated
  (`SET LOCAL ROLE anon` / `authenticated`, with `request.jwt.claim.sub` set to a real technician)
  row counts. This matters: in the 2026-09-04 pass the same check overturned two findings that a
  migration replay had produced.
- **Not independently re-verified in this pass:** the offline account-scoping and cancellation
  fixes (#923) and the expense edit permission fix (#929). Both are application-behaviour changes
  rather than catalog state, so confirming them needs an authenticated end-to-end exercise rather
  than a database query. They ship with their own tests and are recorded as closed by their PRs,
  not by measurement here.
- `npm run typecheck:functions` and the Playwright suite were not run in this pass. CI covers both;
  the sandbox's Chromium revision does not match the pinned Playwright.
- The replay-versus-production distinction remains the central methodological caution. Treat the
  migration chain as intent and `pg_policies` / `pg_proc` / `information_schema` as truth, and note
  that CI's catalog comparison currently compares an artifact against itself — see DB-06.
