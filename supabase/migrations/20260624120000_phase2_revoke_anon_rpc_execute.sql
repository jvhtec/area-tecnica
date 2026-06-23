-- Phase 2 backend trust-boundary hardening (ENT-DB-01 follow-up).
--
-- Phase 0 closed the most dangerous SECURITY DEFINER grants. This migration:
--   1. Stops future functions from being auto-granted to PUBLIC (and therefore
--      to anon via PostgREST), so new RPCs must opt in to exposure explicitly.
--   2. Revokes anonymous EXECUTE from data-returning and data-mutating RPCs that
--      were still reachable by the `anon` role. Internal trigger/definer callers
--      are unaffected (they execute with the owner's privileges, not anon's).
--
-- Authenticated and service_role grants are intentionally left untouched: this
-- is a surgical removal of unauthenticated reach, not a behavior change for
-- signed-in users. Statements are static (not dynamic) so the governance gate
-- in scripts/governance/check-security-definer-grants.mjs tracks the revokes.

-- ---------------------------------------------------------------------------
-- 1. Least-privilege default for newly created functions.
-- ---------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. Revoke anonymous execution from callable, data-bearing RPCs.
-- ---------------------------------------------------------------------------

-- Expense workflow (read + mutating)
REVOKE ALL ON FUNCTION public.approve_job_expense(uuid, boolean, text) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.can_submit_job_expense(uuid, uuid, text, date, numeric, text, numeric) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.replace_job_expense_receipt(uuid, text, boolean) FROM anon, PUBLIC;

-- Timesheet / payout reads
REVOKE ALL ON FUNCTION public.get_timesheet_with_visible_amounts(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.get_timesheets_batch(uuid[], uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.get_billable_hours_for_job(uuid, numeric) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_category_for_timesheet(uuid, uuid) FROM anon, PUBLIC;

-- Staffing / profile / rate reads
REVOKE ALL ON FUNCTION public.get_assignment_matrix_staffing() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.get_profiles_with_skills() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.get_rate_for_evento_job(text, uuid) FROM anon, PUBLIC;

-- Assignment locking helper
REVOKE ALL ON FUNCTION public.acquire_assignment_lock(uuid, date) FROM anon, PUBLIC;
