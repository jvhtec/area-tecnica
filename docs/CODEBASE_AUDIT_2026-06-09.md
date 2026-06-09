# Full Codebase Audit — 2026-06-09

**Scope:** entire repository at `main` (`d4b2ff6`, PR #677). Six parallel domain audits (security, code quality, database, edge functions, testing/CI, frontend architecture) plus local verification (install, lint, typecheck, test runs, `npm audit`).

**Codebase size:** ~278,870 LOC across 1,222 TS/TSX files in `src/`, 65 edge functions, 135 migrations (145 tables), 144 unit test files + 12 Playwright specs.

---

## Executive Summary

The platform is architecturally mature — centralized query-key factories, a unified realtime subscription manager with multi-tab leader election, comprehensive DB indexing, RLS on 141/145 tables, and a disciplined migration history. Local health checks all pass: **lint 0 errors**, **`tsc --noEmit` clean**, **critical test suite green**.

However, the audit found **3 verified critical security issues** that should be fixed before anything else, plus a cluster of high-severity issues in edge functions and a structural testing gap around the money-handling paths (staffing orchestrator, job deletion cascades).

### Scorecard

| Domain | Grade | Headline |
|---|---|---|
| Security | ⚠️ **At risk** | Anon can read timesheets/profiles via REST; SSRF in image-proxy; default password in create-user |
| Database schema | B+ | Excellent indexing & integrity; 3 SECURITY DEFINER fns missing `search_path` |
| Edge functions | C+ | apply-flex-status always returns 200; no retry logic; heavy email duplication |
| Code quality | B− | 25 files >1,000 LOC; ~5,000 LOC duplicated; 491 files using `any` |
| Testing & CI | C+ | 10.4% test ratio; staffing orchestrator (52KB) untested; no coverage thresholds |
| Frontend perf | A− | Strong chunking/lazy-loading; 39 subscriptions bypass the unified manager |
| Dependencies | B | 4 moderate vulns (quill XSS accepted in SECURITY.md; uuid via exceljs) |

---

## 1. Critical Findings (fix first)

### C1. Anonymous SELECT access to sensitive tables — `USING (true)` policies for `anon`
`supabase/migrations/00000000000000_production_schema.sql:8962-8972`

12 tables have policies like:

```sql
CREATE POLICY "anon_timesheets_select_for_realtime" ON "public"."timesheets" FOR SELECT TO "anon" USING (true);
CREATE POLICY "anon_profiles_select_for_realtime"   ON "public"."profiles"   FOR SELECT TO "anon" USING (true);
```

Also: `announcements`, `job_assignments`, `job_departments`, `job_documents`, `job_required_roles`, `jobs`, `locations`, `logistics_event_departments`, `logistics_events`, `tours`.

Although named "for_realtime" (wallboard support), an RLS SELECT policy applies to **all** access paths — anyone holding the public anon key (it ships in the JS bundle) can query the full `timesheets` table (wage data) and `profiles` table (email, DNI, phone) via plain PostgREST, no login required. Most of these tables are also in the `supabase_realtime` publication, so changes stream live too.

**Remediation:** drop the anon policies; serve the wallboard exclusively through the already-tokenized `wallboard-feed` edge function (which uses the service role), or expose sanitized views with only display-safe columns.

### C2. SSRF in `image-proxy` edge function
`supabase/functions/image-proxy/index.ts:16-24`

```ts
const { url } = await req.json();
const response = await fetch(url);   // no scheme/host/IP validation
```

Arbitrary server-side fetch: internal services, cloud metadata endpoints, network probing.
**Remediation:** allowlist expected hosts (e.g. Flex/Supabase storage), enforce `https:`, block private IP ranges, add timeout + size cap.

### C3. Hardcoded default password in `create-user`
`supabase/functions/create-user/index.ts:100`

```ts
password: 'default',
...
needs_password_change: true,   // flag only — not enforced at login
```

Every admin-created account starts with the password `default`; nothing blocks login before the password is changed.
**Remediation:** generate a random per-user temporary password (or use invite/magic-link flow) and hard-enforce password change before granting a session.

---

## 2. High-Severity Findings

| # | Finding | Location | Notes |
|---|---|---|---|
| H1 | `wallboard-auth` falls back to hardcoded secrets (`demo-wallboard-token`, `wallboard-dev-secret`) when env vars are missing | `supabase/functions/wallboard-auth/index.ts:5-7` | Fail fast instead of falling back |
| H2 | `wallboard-debug` is unauthenticated and returns 30 days of job inventory (titles, statuses, schedule) | `supabase/functions/wallboard-debug/index.ts` | Add token check or delete the function |
| H3 | `apply-flex-status` returns HTTP 200 on missing auth, Flex API failures, and internal errors — clients can't detect failure; Flex state silently desyncs | `supabase/functions/apply-flex-status/index.ts:217,358,363` | Return 401/500/207 appropriately |
| H4 | 3 `SECURITY DEFINER` functions missing `SET search_path` (search-path injection / privilege escalation) | `20260208100000_create_achievement_tables.sql:138,~354`; `20260208140000_trigger_evaluate_achievements_on_job_complete.sql:8` | Add `SET search_path = public`; 50+ other functions already do this correctly |
| H5 | Wildcard CORS (`Access-Control-Allow-Origin: *`) on 24+ edge functions, including state-changing and service-role-backed ones | All `corsHeaders` in `supabase/functions/` | Restrict to sector-pro.work origins |
| H6 | `staffing-click` logs full request headers and URL query params, including the auth token | `supabase/functions/staffing-click/index.ts:21-34` | Redact tokens in logs |
| H7 | 39 direct `supabase.channel()` calls bypass the unified subscription manager — no dedup, no reconnect invalidation, no route-aware cleanup | e.g. `useOptimizedMatrixData.ts` (4), `useStaffingCampaignRealtime.ts` (4), `useStaffingRealtime.ts` (3), `JobCardNew.tsx`, `JobAssignmentMatrix.tsx` (2), +12 more files | Migrate to `UnifiedSubscriptionManager.subscribeToTable()` |
| H8 | Staffing orchestrator (1,511 LOC, candidate scoring + payroll-adjacent) has **zero unit tests**; job deletion cascade services also untested | `supabase/functions/staffing-orchestrator/`, `src/services/jobDeletionService.ts`, `src/services/deleteJobAssignments.ts` | Highest-risk test gap in the repo |
| H9 | No Flex API retry/timeout in 7 of 9 Flex functions — transient network failures become permanent desyncs; `create-flex-folders` is not idempotent (re-runs create duplicate folders) | `create-flex-folders`, `manage-flex-crew-assignments`, `sync-flex-crew-for-job`, etc. | Shared `fetchWithRetry` + pre-existence check |

---

## 3. Medium-Severity Findings

**Security / data**
- `wallboard-feed` uses the service-role key with token auth but no rate limiting (`wallboard-feed/index.ts:219`).
- Public artist form endpoints lack rate limiting / abuse controls (token entropy itself is fine).
- `secure-flex-api` checks authentication but not role/department — any logged-in user can call Flex operations.
- `get-mapbox-token` is unauthenticated with wildcard CORS (public-by-design token, but enables third-party quota abuse).
- `PayoutEmailPreview.tsx:383` renders generated HTML via `dangerouslySetInnerHTML` with a hand-rolled `escapeHtml` — adopt DOMPurify or render in a sandboxed iframe.
- Staffing-orchestrator bulk sends are not transaction-safe (partial failure leaves inconsistent state, still returns 200); state transitions not enforced server-side (`staffing-orchestrator/index.ts:614,1137+`).
- Timesheets use an `is_active` soft-delete flag; any query missing `WHERE is_active = true` silently includes voided entries in payroll math. Needs a code-level sweep + regression test.

**Code health**
- **God components:** 25 files >1,000 LOC. Worst: `TourOpsManagementHub.tsx` (2,116), `LightsConsumosTool.tsx` (1,426), `rates-pdf-export.ts` (1,419), `JobCardNew.tsx` (1,348, 33 hooks), `StaffingCampaignPanel.tsx` (1,297).
- **Duplication (~5,000 LOC):** the three Consumos tools (`ConsumosTool` / `VideoConsumosTool` / `LightsConsumosTool`, ~3,500 LOC, ~90% identical) and three PDF exporters (`rates-pdf-export.ts`, `artistPdfExport.ts`, `artistTablePdfExport.ts`, 3,365 LOC sharing jsPDF setup/table/logo logic).
- **Split-brain Supabase client import:** 106 files import `@/lib/supabase-client` vs 83 using the documented `@/integrations/supabase/client`. Consolidate and add a lint rule.
- **Type safety:** 342 files with `: any`, 149 with `as any` (~2,800 instances). Hotspots: `JobCardNewView.tsx` (22), `OptimizedAssignmentMatrixView.tsx` (19), `JobDetailsInfoTab.tsx` (16 `as any`).
- **Email functions:** 10 `send-*` functions each re-implement Brevo setup, HTML templates, and error handling; only 1 uses `_shared/corporateEmailTemplate.ts`.
- **React Query staleTime/gcTime** set ad hoc in 30+ places (2s–10min) with no preset helper — cache coherence is unpredictable across tabs.
- **Service worker chunk-mismatch handling** is reactive (auto-reload up to 3×) rather than preventive (no chunk-manifest validation).

**Testing / CI**
- Test-to-source ratio ~10.4% (industry norm 20–40%). Full suite: 144 files; E2E runs against a mocked Supabase, never a real database.
- No coverage thresholds in `vitest.config.ts` — untested code merges silently.
- CI installs dependencies 7× per PR with no npm cache (~15–20 min wasted per run).
- Only 8 of 65 edge functions have any tests.
- Docs drift: CLAUDE.md says "30 critical workflow tests" but `test:critical` runs 18 files / 89 tests (all passing).

---

## 4. Low / Informational

- **npm audit:** 4 moderate prod vulns — `quill` ≤2.0.3 XSS via react-quill (**accepted risk in SECURITY.md**), `uuid` <11.1.1 via exceljs; dev-only `minimatch` ReDoS and `tar` traversal (via @capacitor/assets). No high/critical.
- **Outdated majors** (mostly intentional pins per CLAUDE.md): React 18→19, react-router 6→7, zod 3→4, Tailwind 3→4, vite 6→8, date-fns 3→4 (pinned), recharts 2→3.
- 452 files contain `console.log` (~1,500 calls; stripped in prod builds — readability issue only).
- 68 floating `.then()` chains without `.catch()`; 4 empty catch blocks.
- `src/legacy/` (1,327 LOC) confirmed unreferenced — safe to delete.
- Zero TODO/FIXME/HACK markers; only 4 `@ts-ignore` (all justified); only 10 `exhaustive-deps` disables in 1,222 files — good discipline.
- Two toast systems (sonner in 82 files vs `use-toast` wrapper) — consolidate.
- 6 mobile components use `div onClick` without role/tabindex (a11y).
- One edge function (`import-users`) pins ancient `deno.land/std@0.182.0`; most use floating `@supabase/supabase-js@2` — pin a minor version.
- `lucide-react` 0.462 is far behind; low risk.

**Strengths worth keeping:** vite manual chunks + lazy loading of pdf/maps/spreadsheet libs is correctly enforced (no static imports from eager paths); provider stack is well-ordered (`SubscriptionProvider` uses `useSyncExternalStore`); Zustand stores all use selective subscription; DB indexing is comprehensive (218 FKs, filtered + GIST indexes, no missing FK indexes found); cascade triggers (tour → job assignments → timesheets) are guarded against recursion; migration hygiene is strong (consistent timestamps, 503 idempotency guards).

---

## 5. Verification performed locally

| Check | Result |
|---|---|
| `npm install --legacy-peer-deps` | OK |
| `npm run lint` | 0 errors, 413 warnings (`no-explicit-any`) |
| `npx tsc --noEmit` | Clean |
| `npm run test:critical` | 18 files, 89 tests — all pass |
| `npm run test:run` (full suite) | 144 files, 919 tests — all pass (~60s) |
| `npm audit` | 4 moderate (see above), 0 high/critical |
| Critical security claims (C1–C3, H1–H2) | Verified directly in source |

---

## 6. Prioritized Action Plan

**Week 1 — security blockers**
1. Drop/replace the 12 anon `USING (true)` policies (C1) — route wallboard data through `wallboard-feed` or sanitized views.
2. Add SSRF guards to `image-proxy` (C2).
3. Replace the `'default'` password flow in `create-user` (C3).
4. Remove hardcoded fallbacks in `wallboard-auth` (H1); auth-gate or delete `wallboard-debug` (H2).
5. Add `SET search_path = public` to the 3 achievement functions (H4).

**Week 2–3 — operational correctness**
6. Fix `apply-flex-status` status codes (H3); add shared `fetchWithRetry` to Flex functions and idempotency to `create-flex-folders` (H9).
7. Restrict CORS to known origins across edge functions (H5); redact tokens from `staffing-click` logs (H6).
8. Add coverage thresholds to vitest + npm cache to CI (2h, big payoff).
9. Write unit tests for staffing-orchestrator scoring and job-deletion cascades (H8).

**Next quarter — structural debt**
10. Migrate 39 direct `supabase.channel()` calls to the unified subscription manager (H7).
11. Consolidate Supabase client imports (106 files) and delete `src/legacy/`.
12. Merge the three Consumos tools into one parameterized component; extract a shared PDF builder.
13. Extract shared Brevo email utility + templates for the 10 send-* functions.
14. Introduce `queryOptionsPresets` for staleTime/gcTime; phased `any` reduction starting with matrix/job-card domains.
