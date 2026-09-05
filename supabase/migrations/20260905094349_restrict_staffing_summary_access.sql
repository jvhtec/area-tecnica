-- SEC-01: this materialized result contains cross-job payroll aggregates.
-- Source-table RLS cannot protect materialized rows. Interactive callers use
-- public.get_job_staffing_summary(uuid[]), which checks management/admin role.
-- Revoke PUBLIC as well as named clients so inherited grants cannot reopen it.
REVOKE ALL PRIVILEGES ON TABLE public.v_job_staffing_summary
  FROM PUBLIC, anon, authenticated;

-- Preserve background reads/refreshes and the existing guarded RPC contract.
GRANT SELECT ON TABLE public.v_job_staffing_summary TO service_role;

-- PL/pgSQL IF NOT NULL does not enter the denial branch. Missing identity or
-- role must fail closed, while the existing service-role path remains valid.
CREATE OR REPLACE FUNCTION public.get_job_staffing_summary(p_job_ids uuid[])
RETURNS TABLE (
  job_id uuid,
  assigned_count bigint,
  worked_count bigint,
  total_cost_eur numeric,
  approved_cost_eur numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NOT (
    COALESCE(auth.role() = 'service_role', false)
    OR (auth.uid() IS NOT NULL AND COALESCE(public.is_admin_or_management(), false))
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT v.job_id, v.assigned_count, v.worked_count,
    v.total_cost_eur, v.approved_cost_eur
  FROM public.v_job_staffing_summary v
  WHERE v.job_id = ANY(p_job_ids);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_job_staffing_summary(uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_job_staffing_summary(uuid[])
  TO authenticated, service_role;

COMMENT ON MATERIALIZED VIEW public.v_job_staffing_summary IS
  'Private staffing/payroll cache. Client access is only through the role-checked get_job_staffing_summary(uuid[]) RPC; no direct anon/authenticated grants.';
