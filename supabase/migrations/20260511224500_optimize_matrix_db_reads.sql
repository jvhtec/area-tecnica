-- Further reduce matrix load by aggregating common read patterns in SQL and
-- backing the remaining high-frequency filters with narrower partial indexes.

CREATE INDEX IF NOT EXISTS idx_staffing_requests_profile_job_latest
  ON public.staffing_requests (profile_id, job_id, phase, updated_at DESC, created_at DESC)
  INCLUDE (status, single_day, target_date, requested_by);

CREATE INDEX IF NOT EXISTS idx_timesheets_active_date_tech_job
  ON public.timesheets (date, technician_id, job_id)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.get_staffing_requests_matrix_filtered(
  p_job_ids uuid[],
  p_profile_ids uuid[]
)
RETURNS TABLE(
  job_id uuid,
  profile_id uuid,
  phase text,
  status text,
  updated_at timestamptz,
  single_day boolean,
  target_date date,
  created_at timestamptz,
  requested_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH authorized AS (
    SELECT auth.role() = 'service_role' OR public.is_admin_or_management() AS allowed
  )
  SELECT
    sr.job_id,
    sr.profile_id,
    sr.phase,
    sr.status,
    sr.updated_at,
    sr.single_day,
    sr.target_date,
    sr.created_at,
    sr.requested_by
  FROM public.staffing_requests sr
  CROSS JOIN authorized a
  WHERE a.allowed
    AND sr.job_id = ANY(p_job_ids)
    AND sr.profile_id = ANY(p_profile_ids)
  ORDER BY sr.profile_id, sr.job_id, sr.phase, sr.updated_at DESC NULLS LAST, sr.created_at DESC NULLS LAST;
$function$;

COMMENT ON FUNCTION public.get_staffing_requests_matrix_filtered(uuid[], uuid[])
  IS 'Returns raw staffing request rows for bounded matrix job/profile sets so callers do not fan out many PostgREST reads.';

GRANT EXECUTE ON FUNCTION public.get_staffing_requests_matrix_filtered(uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staffing_requests_matrix_filtered(uuid[], uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.get_active_timesheet_counts_by_technician(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  technician_id uuid,
  department text,
  timesheet_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH authorized AS (
    SELECT auth.role() = 'service_role' OR public.is_admin_or_management() AS allowed
  )
  SELECT
    t.technician_id,
    p.department,
    count(*)::bigint AS timesheet_count
  FROM public.timesheets t
  JOIN public.profiles p ON p.id = t.technician_id
  CROSS JOIN authorized a
  WHERE a.allowed
    AND t.is_active = true
    AND t.date >= p_start_date
    AND t.date <= p_end_date
  GROUP BY t.technician_id, p.department;
$function$;

COMMENT ON FUNCTION public.get_active_timesheet_counts_by_technician(date, date)
  IS 'Aggregates active timesheet counts by technician and department for matrix medals without returning every timesheet row to the client.';

GRANT EXECUTE ON FUNCTION public.get_active_timesheet_counts_by_technician(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_timesheet_counts_by_technician(date, date) TO service_role;
