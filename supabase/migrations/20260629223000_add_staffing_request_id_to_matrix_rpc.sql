-- Include staffing request ids in the matrix fallback RPC so callers can join
-- rows back to staffing_events for sender/origin metadata.

DROP FUNCTION IF EXISTS public.get_staffing_requests_matrix_filtered(uuid[], uuid[]);

CREATE OR REPLACE FUNCTION public.get_staffing_requests_matrix_filtered(
  p_job_ids uuid[],
  p_profile_ids uuid[]
)
RETURNS TABLE(
  id uuid,
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
    sr.id,
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
  IS 'Returns raw staffing request rows, including ids, for bounded matrix job/profile sets so callers can join staffing_events metadata.';

GRANT EXECUTE ON FUNCTION public.get_staffing_requests_matrix_filtered(uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staffing_requests_matrix_filtered(uuid[], uuid[]) TO service_role;
