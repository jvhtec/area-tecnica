# Full Codebase Audit — 2026-06-12 (re-audit)

**Scope:** entire repository at `main` (`2c999bd`, PR #694). Re-run of the [2026-06-09 audit](CODEBASE_AUDIT_2026-06-09.md): six parallel domain audits (security, code quality, database, edge functions, testing/CI, frontend architecture) plus local verification (install, lint, typecheck, test runs, `npm audit`). Every previous finding was re-verified against source; conflicting agent claims were resolved by direct file inspection.

**Codebase size:** ~283,018 LOC across 1,252 TS/TSX files in `src/`, 64 edge functions, 143 migrations, 157 unit test files + 12 Playwright specs. 62 commits (~11k insertions) landed since the previous audit baseline.

---

## Executive Summary

The 2026-06-09 audit's worst findings have been substantially remediated. **All 3 critical security issues are verified fixed** (anon RLS policies, image-proxy SSRF, default password), along with H1/H2/H4 and the Flex API authorization gap. The previously untested money-handling paths (job deletion cascades, staffing policy logic) now have tests with enforced coverage thresholds. Local health checks all pass: **lint 0 errors**, **`tsc --noEmit` clean**, **critical suite 21 files / 100 tests green**, **full suite 157 files / 978 tests green**.

Two high-severity items from last time are **still open** — `staffing-click` logs full auth tokens to server logs (H6; the claimed fix only redacts a *later* log line) and `apply-flex-status` still returns HTTP 200 on every failure (H3, deliberately). The new WhatsApp functions are well-authenticated but lack rate limiting, and the two new tables shipped without FK indexes on `created_by`.

### Scorecard

| Domain | 2026-06-09 | Now | Headline |
|---|---|---|---|
| Security | ⚠️ At risk | **B+** | All criticals fixed; token logging (H6) still leaks credentials to logs |
| Database schema | B+ | **B** | Previous fixes comprehensive; 2 new tables missing FK indexes on `created_by` |
| Edge functions | C+ | **C+** | WhatsApp functions solid; H3/H6/H9 unchanged; CORS still wildcard |
| Code quality | B− | **B+** | Consumos unified, PDF helpers shared, client import split resolved; god files 25→21 |
| Testing & CI | C+ | **B−** | Deletion cascades + policyUtils tested, coverage gates added; CI cache still missing |
| Frontend perf | A− | **A** | 100% lazy routes, safe-area work clean; channel bypass 39→34 |
| Dependencies | B | **B** | Same 4 moderate prod vulns (accepted); dev-only capacitor chain escalated to high by upstream advisories |

---

## 1. Previous Findings — Verified Status

| # | Finding | Status | Evidence |
|---|---|---|---|
| C1 | Anon `USING (true)` SELECT on 12 tables | ✅ **FIXED** | `20260609120000_security_hardening_anon_access.sql` drops all 11 anon policies + closes 9 catalog tables to `authenticated`; no later migration re-introduces anon access |
| C2 | SSRF in `image-proxy` | ✅ **FIXED** | HTTPS-only, private IPv4/IPv6 range blocking, 10s timeout, 15MB cap, auth required (`image-proxy/index.ts:14-74`) |
| C3 | Hardcoded `'default'` password in `create-user` | ✅ **FIXED** | `crypto.randomUUID()` password + `needs_password_change` (`create-user/index.ts:137`; hotfix `7111f79`) |
| H1 | `wallboard-auth` hardcoded fallback secrets | ✅ **FIXED** | Fails closed on missing env vars (`wallboard-auth/index.ts:4-11`) |
| H2 | `wallboard-debug` unauthenticated | ✅ **FIXED** | Shared-token validation added (`wallboard-debug/index.ts:21-35`) |
| H3 | `apply-flex-status` returns 200 on all errors | ❌ **STILL OPEN** | Lines 217/358/363 return 200 for missing auth, Flex failure, internal error — comment says deliberate ("avoid opaque 5xx on client") |
| H4 | 3 SECURITY DEFINER fns missing `search_path` | ✅ **FIXED** | `ALTER FUNCTION ... SET search_path` in `20260609120000:80-99`; all post-fix DEFINER functions correctly pinned |
| H5 | Wildcard CORS on 24+ functions | ❌ **STILL OPEN** | 59 `Access-Control-Allow-Origin: *` occurrences; all state-changing endpoints are auth/token-gated, so residual risk is CSRF-shaped, not data exposure |
| H6 | `staffing-click` logs token | ❌ **STILL OPEN** | `index.ts:21-25` logs **all headers** (incl. `Authorization`); `:30-34` logs **full query params** (incl. token `t`). The `substring(0,20)` redaction at `:37-44` is a later, separate log line |
| H7 | 39 direct `supabase.channel()` bypasses | 🟡 **IMPROVED** | Now 34. Worst: `useOptimizedMatrixData` (5), `useTourRateSubscriptions` (5), `useStaffingCampaignRealtime` (4). Manager itself now has dedup tests |
| H8 | Staffing orchestrator + deletion cascades untested | 🟡 **PARTIALLY FIXED** | `policyUtils.ts` (359 LOC) extracted + tested; `jobDeletionService.test.ts` (5 tests) and `deleteJobAssignments.test.ts` (2 tests) added; coverage thresholds enforced in `vitest.config.ts:41-60`. Orchestrator `index.ts` (1,196 LOC: HTTP handlers, wave progression, assignment writes) still untested |
| H9 | No Flex retry/timeout; `create-flex-folders` not idempotent | 🟡 **PARTIALLY FIXED** | Retry now in `sync-flex-crew-for-job` (3×), `manage-flex-crew-assignments` (12×), `archive-to-flex` (6×). Still no timeout/retry in 6 functions (`fetch-flex-contact-info`, `fetch-flex-image`, `fetch-flex-inventory-model`, `backfill-flex-doc-tecnica`, `create-flex-folders`, `secure-flex-api`); `create-flex-folders` still creates duplicates on re-run |
| M | `secure-flex-api` no role check | ✅ **FIXED** | Admin/management role required (`secure-flex-api/index.ts:46-58`) |
| M | User-deletion FK blockers | ✅ **FIXED** | 41 FKs across 30 tables normalized (`20260609130000` + 3 follow-ups); cascade triggers hardened with DEFINER + `search_path` |
| M | `PayoutEmailPreview` hand-rolled escapeHtml | ❌ Open (unchanged) | Still `dangerouslySetInnerHTML` + custom escaping |
| M | Email duplication across send-* functions | 🟡 **IMPROVED** | 4 functions now use `_shared/corporateEmailTemplate.ts` (was 1); 9 still re-implement Brevo setup |
| M | timesheets `is_active` filter inconsistency | ❌ Open (unchanged) | Mixed: `technicianAvailability.ts` filters correctly; several hooks rely on status/approval fields instead. Needs systematic sweep |
| M | React Query staleTime ad hoc | 🟡 **IMPROVED** | `createOptimizedQueryOptions()` exists in `optimized-react-query.ts` but ~136 inline `staleTime`/`gcTime` literals remain |

---

## 2. Open High-Severity Items (current)

| # | Finding | Location | Notes |
|---|---|---|---|
| H6 (carry-over) | Auth tokens written to server logs on every staffing click | `staffing-click/index.ts:21-34` | **Highest-priority fix — ~10 lines.** Anyone with log access can replay accept/decline links |
| H3 (carry-over) | `apply-flex-status` masks all failures as HTTP 200 | `apply-flex-status/index.ts:217,358,363` | If intentional, callers must check `success` — but Flex desyncs stay invisible to monitoring. Return 401/502/500 |
| H9 (carry-over) | 6 Flex functions without timeout/retry; folder creation not idempotent | `create-flex-folders` et al. | Shared `fetchWithRetry` + pre-existence check on `flex_folders` |
| NEW-1 | `send-job-whatsapp-message`: up to 80 recipients/request, 4 concurrent workers, no per-actor quota | `send-job-whatsapp-message/index.ts:130-132` | Auth/role checks are solid; abuse ceiling is the issue. Cap recipients, add daily quota |
| NEW-2 | `create-whatsapp-group`: no rate limit on group creation | `create-whatsapp-group/index.ts:219-550` | Compromised management account could exhaust WAHA quota. Add per-actor quota + audit log |

---

## 3. Medium-Severity Findings

**Security / data**
- New tables `consumos_components` and `technical_tool_quick_presets` allow INSERT to **all authenticated users** (UPDATE/DELETE correctly restricted to owner/management) — data-pollution vector for shared catalogs (`20260610120000:42-47`, `20260612100000:30-35`).
- `tech-calendar-ics` tokens have no TTL/rotation and no per-token rate limit — a leaked token exposes a technician's schedule indefinitely.
- Staffing-orchestrator: campaign tick has a lock (`index.ts:469-523`) but multi-row state transitions still aren't transaction-wrapped, and wave progression sends batches via concurrent `Promise.all` without backoff (`:777-888`).
- `activity_catalog` read policy is still `USING (true)` with no role — reference data, low risk, but inconsistent with the hardening pattern.
- `FLEX_API_BASE_URL` hardcoded in `secure-flex-api/index.ts:12` — move to env var.

**Database**
- Missing FK indexes on `created_by` in both new tables (`consumos_components`, `technical_tool_quick_presets`) — first break in the schema's otherwise complete FK-index hygiene. One-line fix each.
- Everything else about the new migrations is clean: RLS enabled, idempotency guards, no anon grants, `updated_at` triggers, CHECK-constrained JSONB on `hoja_de_ruta.print_excluded_sections`.

**Code health**
- **God components: 21 files >1,000 LOC** (was 25). `TourOpsManagementHub.tsx` unchanged at 2,116; `JobCardNew.tsx` grew to 1,421; new `useConsumosTool.ts` (1,451) is large but is the deliberate concentration of the 3-way unification (old pages are now 9-line wrappers — net win).
- **Supabase client split mostly resolved:** 106 files on `@/integrations/supabase/client`, 9 stragglers on `@/lib/supabase-client` (bridged via re-export). Finish the migration + add a lint rule.
- **Type safety roughly flat:** 339 files with `: any` (was 342), 149 with `as any` (unchanged). ESLint warnings 413→404.
- Two toast systems persist (sonner 45 files vs `use-toast` 55) — stable, no regression.

**Testing / CI**
- Test-to-source ratio ~12.5% (157/1,252; was ~10.4%). 13 new test files since 2026-06-09, well-targeted (subscription manager dedup, hoja sync, consumos hooks, shared PDF utils, deletion services).
- Coverage thresholds exist but only for 3 files — no global floor, so new untested code still merges silently.
- **CI still installs dependencies 7× per PR with no npm cache** (`.github/workflows/tests.yml`) — `setup-node` `cache: 'npm'` is a 5-minute change.
- Edge functions: 11/64 have tests (was 8). `send-job-whatsapp-message` (business-critical, external side effects) is untested.
- Docs drift persists: CLAUDE.md still says "30 critical workflow tests"; `test:critical` runs **21 files / 100 tests**.
- E2E still runs against mocked Supabase only (acceptable by design; noted for completeness).

---

## 4. Low / Informational

- **npm audit:** prod unchanged — 4 moderate (`quill` XSS via react-quill, accepted in SECURITY.md; `uuid` via exceljs). Dev-only `@capacitor/assets` chain (`tar`, `minimatch`, `replace`) escalated from moderate to **high** by upstream advisories — build tooling only, no runtime exposure; no upstream fix available (`fixAvailable: false`).
- `src/legacy/` (8 files) still present, still verified unreferenced — safe to delete.
- `import-users` still pins `deno.land/std@0.182.0`; most functions float `@supabase/supabase-js@2`.
- Markers stayed excellent: 0 TODO/FIXME/HACK, 3 `@ts-ignore` (was 4), 13 `exhaustive-deps` disables (was 10).
- A11y: 5 clickable `div`s without role/tabindex (was 6) — `MobileAvailabilityView` (2), `DepartmentMobileHub`, `TechnicianIncidentReportDialog`, `DashboardMobileHub`.
- ~1,196 `console.log` calls in 280 files (stripped in prod builds).
- 7 empty catch blocks, all in graceful-degradation paths (Flex fetches, PDF image fallbacks) — acceptable.

**New-feature quality (all verified clean):** mobile safe-area implementation uses the `max(base, env(safe-area-inset-*))` pattern consistently across ~70 sites with no orphaned CSS vars; unified Consumos is fully lazy-loaded with zero main-bundle impact; stage plot v2 drag handlers attach/detach pointer listeners correctly (no leaks, no re-render storms); hoja print-exclusion toggles are persisted, typed, and respected by the PDF generator; all 71 routes lazy-load (100%); new realtime hooks all have proper effect cleanup.

---

## 5. Verification performed locally

| Check | Result | vs 2026-06-09 |
|---|---|---|
| `npm install --legacy-peer-deps` | OK | — |
| `npm run lint` | 0 errors, 404 warnings | 413 warnings |
| `npx tsc --noEmit` | Clean | Clean |
| `npm run test:critical` | 21 files, 100 tests — all pass | 18 files, 89 tests |
| `npm run test:run` | 157 files, 978 tests — all pass (~80s) | 144 files, 919 tests |
| `npm audit` | 4 moderate prod; 6 high dev-only (capacitor chain) | 4 moderate, 0 high |
| Contested agent claims (H3, H6, test counts, LOC figures) | Re-verified directly in source | — |

---

## 6. Prioritized Action Plan

**This week — small, high-value fixes**
1. Redact headers + token query params from `staffing-click` logs (H6) — the one genuine credential leak left.
2. Add the two missing `created_by` FK indexes (`consumos_components`, `technical_tool_quick_presets`) — one migration.
3. Add `cache: 'npm'` to all 7 CI jobs.
4. Update CLAUDE.md: "21 critical test files" (not 30).

**Next 2–3 weeks — operational correctness**
5. Fix `apply-flex-status` status codes (H3) or, if 200-on-error is truly required by a client, add server-side alerting on `success: false`.
6. Shared `fetchWithRetry` + timeout for the 6 remaining Flex functions; idempotency pre-check in `create-flex-folders` (H9).
7. Rate limiting / per-actor quotas on `send-job-whatsapp-message` and `create-whatsapp-group` (NEW-1/2).
8. Restrict INSERT on the two new catalog tables to management, or accept and document.
9. Sweep timesheet queries for `is_active` filtering; add a regression test.

**Next quarter — structural debt (largely unchanged)**
10. Test staffing-orchestrator `index.ts` (HTTP handlers, wave progression) — the largest remaining money-path gap; add a global coverage floor.
11. Migrate the 34 remaining direct `supabase.channel()` calls; add a lint rule to stop new ones.
12. Finish the last 9 legacy supabase-client imports; delete `src/legacy/`.
13. Migrate the 9 remaining send-* functions to the shared email template.
14. Break up `TourOpsManagementHub.tsx` (2,116 LOC) and `JobCardNew.tsx` (1,421 LOC); continue phased `any` reduction.

---

## 7. Remediation addendum (same day, commits `dbc32d3`…`1b92507`)

Fixed on this branch immediately after the audit:

| Item | Status | Commit |
|---|---|---|
| H6 — staffing-click token logging | ✅ Fixed: no headers/raw URL logged; token preview 8 chars | `dbc32d3` |
| Missing `created_by` FK indexes (2 new tables) | ✅ Fixed: `20260612130000` migration | `dbc32d3` |
| CI npm cache (7 jobs) | ✅ Fixed: `actions/cache` on `~/.npm` keyed on package.json | `dbc32d3` |
| CLAUDE.md "30 critical tests" drift | ✅ Fixed | `dbc32d3` |
| H3 — apply-flex-status always 200 | ✅ Fixed: 200/207/502/503/500; callers recover the body via `extractFunctionErrorMessage` | `f6db5e6` |
| H9 — Flex timeout/retry + folder idempotency | ✅ Fixed: shared `_shared/flexFetch.ts` (tested, 8 tests) wired into 6 functions; `create-flex-folders` skips existing root/date folders | `b18c28f` |
| NEW-1/2 — WhatsApp rate limiting | ✅ Fixed: `whatsapp_send_audit` ledger + per-actor daily quotas (500 recipients, 20 groups; env-tunable), tested helper | `7d71e45` |
| Supabase client split-brain (7 stragglers) | ✅ Fixed: all on canonical import | `8ddd27e` |
| `src/legacy/` (1,327 LOC unreferenced) | ✅ Deleted | `8ddd27e` |
| `secure-flex-api` hardcoded base URL; `import-users` std 0.182 pin | ✅ Fixed | `8ddd27e` |
| PayoutEmailPreview hand-rolled escaping | ✅ Fixed: DOMPurify sanitize before render | `4e74990` |
| A11y clickable divs (3 genuine of 5 flagged) | ✅ Fixed: real buttons / role+tabIndex+keydown (other 2 are delegation wrappers over real buttons — fine) | `4e74990` |
| tech-calendar-ics abuse | ✅ Fixed: per-token rate limit (120/h) + hash-then-compare token check. Token TTL **not** added — calendar feed URLs are long-lived by design; rotation is a product decision | `29e0e25` |
| timesheets `is_active` leak into payroll | ✅ Fixed: migration `20260612150000` patches `v_job_tech_payout_2025_base`, `v_job_staffing_summary`, `get_job_total_amounts()`, `get_timesheet_amounts_visible()`; 3 app queries + 3 edge functions filtered. Verified voiding never resets `status`, so the leak was real | `36f0679` |
| Email duplication (send mechanics) | ✅ Fixed: `_shared/brevo.ts` (15s timeout) used by all 13 Brevo functions; HTML templates intentionally untouched | `1b92507` |
| Coverage thresholds | 🟡 Extended to the new shared helpers; a global floor is impractical until coverage rises | `8ddd27e` |

**Still open (the honest path to A+ everywhere):** staffing-orchestrator `index.ts` tests (H8 remainder), 34 direct `.channel()` calls (H7), CORS wildcard (accepted-risk — all endpoints auth/token-gated; restricting needs the production origin list incl. Capacitor origins), shared HTML email template adoption (needs visual review), catalog-table INSERT-for-all-authenticated (designed collaborative feature — restrict or accept explicitly), god components, phased `any` reduction, toast consolidation, ICS token rotation (product decision).
