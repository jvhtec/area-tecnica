# Full Codebase Audit — 2026-06-20 (re-audit)

**Scope:** entire repository at `claude/codebase-audit-ue5wny` (branched from `main` @ `b7ef5ea`, PR #703). Re-run of the [2026-06-12 audit](CODEBASE_AUDIT_2026-06-12.md). Focus areas: (1) verify the 2026-06-12 remediation held, (2) deep-dive the ~39 commits of feature work landed since then (tour package size defaults, logistics/hoja venue resolution, WhatsApp hoja attachments, timesheet rejection workflow), (3) fresh sweep for new issues.

**Codebase size:** ~1,256 TS/TSX files in `src/`, 65 edge functions, 149 migrations, 168 unit test files / 1,038 tests + Playwright smoke specs.

---

## Executive Summary

The codebase remains in strong shape. The 2026-06-12 remediation held: anon RLS, SSRF, default-password, token-logging, Flex retry/idempotency, WhatsApp quotas, the payroll `is_active` sweep, and the shared Brevo/email refactor are all still in place. The new feature work is high quality — `tourPackages.ts`, `venue-resolution.ts`, and the new edge-function paths ship with tests, HTML escaping, and well-formed migrations (CHECK constraints, FK indexes, `search_path`-pinned SECURITY INVOKER functions, idempotent guards).

**The audit found three genuine correctness issues introduced or missed by recent work**, all in the tour/payroll area:

1. **`TourRatesPanel` approval indicator counts voided timesheets** — the `is_active` sweep missed this query, so a voided/replaced timesheet row can make a technician show as *not approved* when their active timesheet is approved. **(M)**
2. **`useToggleTechnicianPayoutApproval` writes approval to voided rows too** — same missing filter, on the write side. **(L/M)**
3. **Power summary can silently go empty for legacy tour dates** — the new package-resolution path drops *both* the default tables and the legacy-defaults fallback when a department has multiple default sets and no package size assigned (`ambiguous` resolution). **(M)**

Everything else is carry-over accepted risk or structural debt that is stable or improving.

### Health checks (local, this branch)

| Check | Result |
|---|---|
| `npm install --legacy-peer-deps` | OK |
| `npm run lint` | **0 errors**, 406 warnings |
| `npm run typecheck` (`tsc -p tsconfig.app.json`) | **Clean** |
| `npm run test:run` | **168 files / 1,038 tests — all pass** |
| `npm audit` (prod) | 4 moderate (`uuid` via `exceljs`, accepted) |
| `npm audit` (incl. dev) | +6 high, all dev-only (`xcode`/capacitor `uuid` chain), no runtime exposure |

---

## 1. New / Newly-Found Issues

### M1 — `TourRatesPanel` approval map includes voided timesheets
**File:** `src/components/tours/TourRatesPanel.tsx:162-184`

The query selects `approved_by_manager` for all timesheet rows of the tour's jobs **without `.eq('is_active', true)`**, then computes per-tech approval as `statuses.every(s => s === true)`. A voided/replaced timesheet (`is_active = false`) — which typically carries `approved_by_manager = false` — drags the `.every()` to `false`, so the technician renders as **not approved** on the Tour Rates panel even though their *active* timesheet is approved (and vice-versa a stale voided approval can mask a real pending row).

The 2026-06-12 sweep (`36f0679`) fixed the payout math views and several queries but missed this one. Payout *amounts* are correct; the **approval status indicator is wrong**.

**Fix:** add `.eq('is_active', true)` to the select at line 164.

### M2 — `useToggleTechnicianPayoutApproval` updates voided rows
**File:** `src/hooks/useToggleTechnicianPayoutApproval.ts:21-24`

```ts
.from('timesheets')
.update({ approved_by_manager: approved })
.eq('job_id', jobId)
.eq('technician_id', technicianId);   // no is_active filter
```

Toggling approval writes `approved_by_manager` onto **all** rows for the tech/job, including voided ones. Mostly harmless today (voided rows are excluded from payout math), but it leaves stale approval state that would resurface if a row were ever un-voided, and it is semantically inconsistent with M1.

**Fix:** add `.eq('is_active', true)`.

### M3 — Power summary silently empties on ambiguous package resolution
**File:** `src/utils/powerSummaryData.ts:486-540`

The new package model resolves a single default set per department via `resolveDefaultSetForTourDate`. When a department has **multiple default sets and no package size** on the tour date, resolution returns `status: 'ambiguous'`. In that case:
- `departmentDefaultTables` = `[]` (only populated when `status === 'resolved'`), and
- `canUseLegacyDefaults` = `false` (because `ambiguous` is not in the `missing | resolved` allow-list),

so **both** the default tables and the legacy-defaults fallback are dropped and the department's power summary comes back empty.

Previously the code aggregated default tables from **all** of a department's sets, so this scenario produced data. The migration only backfills `package_size` for tour-pack-only / `'s'`-named sets, so a pre-existing tour with 2+ default sets in one department and no package intent will regress to an empty power summary. Same applies to `invalid_explicit` (e.g. `package_mismatch` / `wrong_department`), which also blocks the legacy fallback.

This may be intended ("force disambiguation"), but it changes behavior silently for legacy data. **Recommendation:** either fall back to legacy defaults on `ambiguous`/`invalid_explicit`, or surface a visible "select a package/set" prompt instead of an empty summary.

---

## 2. Lower-severity / Informational (new)

- **L1 — Tour package backfill heuristic is over-broad.** `supabase/migrations/20260616120000_tour_package_size_defaults.sql:197-198` sets `package_size = 's'` for any default set whose `name`/`description` contains a standalone `s`/`S` token (`~ '(^|[^[:alnum:]])[sS]([^[:alnum:]]|$)'`). Names like `"Main S"`, `"PA - S"`, or an isolated initial will be mislabeled as the *small* package. This is an irreversible data write at migrate time. Low likelihood of harm (S is also the legacy tour-pack default) but worth a note; consider tightening to explicit "pack"/"tour pack" tokens only.

- **L2 — `wallboard-feed` rejection precedence.** `supabase/functions/wallboard-feed/index.ts` `computeStatus` returns `'rejected'` if *any* of a tech's timesheet rows for a job is rejected, ahead of `approved`/`submitted`. For multi-date jobs, one rejected date flips the whole tech/job tile to rejected. Confirm this is the intended wallboard semantic (it likely is — "needs attention" — but the aggregate hides the approved dates).

- **L3 — God components grew.** 24 files now exceed 1,000 LOC (was 21 on 2026-06-12). New/grown: `TourDefaultsManager.tsx` (1,507), `TourDateManagementDialog.tsx` (1,254), `TimesheetView.tsx` (1,137). `TourOpsManagementHub.tsx` (2,116) and `useConsumosTool.ts` (1,690) unchanged.

## 3. Carry-over open items (re-verified, status unchanged)

- **staffing-orchestrator `index.ts` (≈1,200 LOC money path) still untested** — `__tests__/` covers only `policyUtils.ts`. Largest remaining test gap.
- **CORS wildcard on 53 edge functions** — accepted risk; all state-changing endpoints are auth/token-gated. Needs the production origin allow-list (incl. Capacitor origins) to close.
- **Realtime channel usage:** ~20 files call `.channel(` directly (now mostly via `dataLayerClient` rather than raw `supabase`); still bypasses the unified subscription manager. Add a lint rule to stop new ones.
- **Type safety flat:** 337 files with `: any`, 146 with `as any`. 3 `@ts-ignore`. 0 TODO/FIXME/HACK.
- **Two toast systems** (sonner + `use-toast`) — stable.
- **ICS token rotation** — product decision, not done (rate-limited + hashed compare on 2026-06-12).
- **Catalog tables INSERT-for-all-authenticated** (`consumos_components`, `technical_tool_quick_presets`) — designed collaborative feature; accept or restrict.
- **8 empty catch blocks** — all graceful-degradation paths (Flex/PDF/optional UI), acceptable.
- **npm audit** — same posture as 2026-06-12: 4 moderate prod (accepted in SECURITY.md), dev-only capacitor/xcode `uuid` chain high but no runtime exposure / no upstream fix.

---

## 4. Verified-clean new feature work

- `src/utils/tourPackages.ts` — package/default-set resolution: exhaustive result union, validated, **tested** (`__tests__/tourPackages.test.ts`, 200 LOC).
- `src/utils/hoja-de-ruta/venue-resolution.ts` — coordinate parsing with range validation, address normalization, authoritative-saved-venue logic; **tested**.
- `src/features/festival-management/queries.ts` — venue resolution refactor; correctly switched `.single()` → `.maybeSingle()` (was a latent throw-on-zero-rows bug) and parallelized fetches.
- `send-timesheet-reminder` rejection path — HTML-escapes all interpolated values, doesn't stamp `reminder_sent_at` for rejections, skips voided timesheets.
- Migrations `20260612170000` (rejected status) and `20260616120000` (package defaults) — `ALTER TYPE ADD VALUE` handled via text comparison to avoid same-transaction enum use; CHECK constraints, FK indexes, `search_path`-pinned SECURITY INVOKER validation trigger.
- Shared `_shared/brevo.ts` (15s timeout) adopted across the touched send-* functions.

---

## 5. Prioritized action plan

**This week — small, high-value**
1. Add `.eq('is_active', true)` to `TourRatesPanel.tsx:164` (M1) and `useToggleTechnicianPayoutApproval.ts:24` (M2). One line each; both are payroll-adjacent.
2. Decide power-summary `ambiguous` behavior (M3): legacy fallback vs. explicit "assign a package" prompt — don't ship a silent empty.

**Next 2–3 weeks**
3. Add a regression test asserting voided timesheets never affect approval display or payout (locks M1/M2 + the 2026-06-12 sweep).
4. Test staffing-orchestrator `index.ts` HTTP handlers / wave progression.

**Backlog (unchanged)**
5. Lint rule banning new direct `.channel(` calls; finish migration to the unified subscription manager.
6. Break up the 1,000+ LOC tour components; continue phased `any` reduction; consolidate toast systems.

---

## 6. Remediation addendum (session 2026-06-20)

| Item | Status | Notes |
|---|---|---|
| M1 — `TourRatesPanel` approval map counts voided timesheets | ✅ Fixed & verified | Added `.eq('is_active', true)` at `TourRatesPanel.tsx:166` |
| M2 — `useToggleTechnicianPayoutApproval` writes approval to voided rows | ✅ Fixed & verified | Added `.eq('is_active', true)` at `useToggleTechnicianPayoutApproval.ts:26` + regression test |
| Test import path | ✅ Fixed | Updated `useToggleTechnicianPayoutApproval.test.tsx` to use `@/` alias per convention |
| M3 — power summary empties on ambiguous resolution | ⏸️ Deferred | Technically valid but requires product decision: enable legacy fallback on `ambiguous`/`invalid_explicit` or prompt user to select. No test case demonstrates production impact. Revisit once backlog clarifies expected behavior. |

**Verification:** All 169 test files / 1,039 tests pass (gained 1 regression test). ESLint and `tsc -p tsconfig.app.json` clean.
