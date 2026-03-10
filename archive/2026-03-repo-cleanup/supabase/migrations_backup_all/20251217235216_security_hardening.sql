-- =============================================================================
-- SECURITY HARDENING (PROD)
-- =============================================================================
-- Fixes:
--   - Transaction-unsafe current_user_role/current_user_department caching
--   - Dangerous default privileges (TRUNCATE/REFERENCES/TRIGGER + EXECUTE) for anon/authenticated
--   - SSRF surface via pg_net + net schema exposure
--   - Missing/unsafe RLS tables exposed via Data APIs
--   - SECURITY DEFINER views (set security_invoker=true)
--   - Exposed materialized view v_job_staffing_summary + refresh function grants
--   - corporate_email_logs: RLS enabled but no policy
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Fix caching helpers to be txn-local and uid-scoped (prevents cross-request leaks)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_uid uuid := auth.uid();
  cached_uid text;
  cached_role text;
  user_role text;
BEGIN
  -- Never trust cached values for anon requests
  IF current_uid IS NULL THEN
    RETURN NULL;
  END IF;

  cached_uid := current_setting('app.current_user_role_uid', true);
  cached_role := nullif(current_setting('app.current_user_role', true), '');

  IF cached_uid IS NOT NULL AND cached_uid = current_uid::text AND cached_role IS NOT NULL THEN
    RETURN cached_role;
  END IF;

  SELECT p.role INTO user_role
  FROM public.profiles p
  WHERE p.id = current_uid;

  IF user_role IS NOT NULL THEN
    PERFORM set_config('app.current_user_role_uid', current_uid::text, true);
    PERFORM set_config('app.current_user_role', user_role, true);
  END IF;

  RETURN user_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_uid uuid := auth.uid();
  cached_uid text;
  cached_dept text;
  user_dept text;
BEGIN
  IF current_uid IS NULL THEN
    RETURN NULL;
  END IF;

  cached_uid := current_setting('app.current_user_department_uid', true);
  cached_dept := nullif(current_setting('app.current_user_department', true), '');

  IF cached_uid IS NOT NULL AND cached_uid = current_uid::text AND cached_dept IS NOT NULL THEN
    RETURN cached_dept;
  END IF;

  SELECT p.department INTO user_dept
  FROM public.profiles p
  WHERE p.id = current_uid;

  IF user_dept IS NOT NULL THEN
    PERFORM set_config('app.current_user_department_uid', current_uid::text, true);
    PERFORM set_config('app.current_user_department', user_dept, true);
  END IF;

  RETURN user_dept;
END;
$$;

-- Keep existing grants (required by RLS policies)
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_department() TO authenticated, anon;

-- -----------------------------------------------------------------------------
-- 2) Reduce profile lookups for legacy policies (delegate to cached helper)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_role();
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.is_admin_or_management()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.current_user_role() IN ('admin', 'management');
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_management() TO authenticated, anon;

-- -----------------------------------------------------------------------------
-- 3) Stop shipping dangerous grants by default (root cause)
-- -----------------------------------------------------------------------------

-- Existing tables: remove TRUNCATE/REFERENCES/TRIGGER from anon/authenticated.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Future objects created by postgres in public.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4) Lock down pg_net exposure (SSRF surface)
-- -----------------------------------------------------------------------------

REVOKE USAGE ON SCHEMA net FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA net FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA net FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA net FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5) Fix RLS gaps (tables exposed via Data APIs)
-- -----------------------------------------------------------------------------

-- system_errors: allow inserts (anon/auth), restrict reads to management/service_role
ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_errors_insert ON public.system_errors;
CREATE POLICY system_errors_insert
  ON public.system_errors
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS system_errors_select_management ON public.system_errors;
CREATE POLICY system_errors_select_management
  ON public.system_errors
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_management() OR auth.role() = 'service_role');

-- timesheet_audit_log: restrict reads to management/service_role
ALTER TABLE public.timesheet_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timesheet_audit_log_select_management ON public.timesheet_audit_log;
CREATE POLICY timesheet_audit_log_select_management
  ON public.timesheet_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_management() OR auth.role() = 'service_role');

-- corporate_email_logs: RLS enabled but no policy (edge functions use service_role)
DROP POLICY IF EXISTS corporate_email_logs_service_role ON public.corporate_email_logs;
CREATE POLICY corporate_email_logs_service_role
  ON public.corporate_email_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 6) Views: enforce invoker permissions (avoid SECURITY DEFINER behavior)
-- -----------------------------------------------------------------------------

ALTER VIEW public.current_stock_levels SET (security_invoker = true);
ALTER VIEW public.equipment_availability_with_rentals SET (security_invoker = true);
ALTER VIEW public.system_health_assignments SET (security_invoker = true);
ALTER VIEW public.system_health_timesheets SET (security_invoker = true);
ALTER VIEW public.v_job_expense_summary SET (security_invoker = true);
ALTER VIEW public.v_job_tech_payout_2025 SET (security_invoker = true);
ALTER VIEW public.v_job_tech_payout_2025_base SET (security_invoker = true);
ALTER VIEW public.v_tour_job_rate_quotes_2025 SET (security_invoker = true);

-- -----------------------------------------------------------------------------
-- 7) Materialized view exposure: remove anon access
-- -----------------------------------------------------------------------------

REVOKE SELECT ON public.v_job_staffing_summary FROM anon;

REVOKE EXECUTE ON FUNCTION public.refresh_v_job_staffing_summary() FROM anon, authenticated;
