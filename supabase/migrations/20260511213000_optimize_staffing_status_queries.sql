-- Reduce assignment matrix load by letting callers constrain staffing status
-- rollups before DISTINCT ON sorts the staffing_requests table.

CREATE INDEX IF NOT EXISTS idx_staffing_requests_matrix_latest
  ON public.staffing_requests (job_id, profile_id, phase, updated_at DESC, created_at DESC)
  INCLUDE (status, single_day, target_date, requested_by);

CREATE OR REPLACE FUNCTION public.get_assignment_matrix_staffing_filtered(
  p_job_ids uuid[],
  p_profile_ids uuid[]
)
RETURNS TABLE(
  job_id uuid,
  profile_id uuid,
  availability_status text,
  availability_updated_at timestamptz,
  offer_status text,
  offer_updated_at timestamptz,
  last_change timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH authorized AS (
    SELECT auth.role() = 'service_role' OR public.is_admin_or_management() AS allowed
  ),
  latest AS (
    SELECT DISTINCT ON (sr.job_id, sr.profile_id, sr.phase)
      sr.job_id,
      sr.profile_id,
      sr.phase,
      sr.status,
      sr.updated_at,
      sr.created_at
    FROM public.staffing_requests sr
    CROSS JOIN authorized a
    WHERE a.allowed
      AND sr.job_id = ANY(p_job_ids)
      AND sr.profile_id = ANY(p_profile_ids)
    ORDER BY
      sr.job_id,
      sr.profile_id,
      sr.phase,
      sr.updated_at DESC NULLS LAST,
      sr.created_at DESC NULLS LAST
  ),
  pivoted AS (
    SELECT
      l.job_id,
      l.profile_id,
      max(l.status) FILTER (WHERE l.phase = 'availability') AS availability_status,
      max(l.updated_at) FILTER (WHERE l.phase = 'availability') AS availability_updated_at,
      max(l.status) FILTER (WHERE l.phase = 'offer') AS offer_status,
      max(l.updated_at) FILTER (WHERE l.phase = 'offer') AS offer_updated_at
    FROM latest l
    GROUP BY l.job_id, l.profile_id
  )
  SELECT
    p.job_id,
    p.profile_id,
    p.availability_status,
    p.availability_updated_at,
    p.offer_status,
    p.offer_updated_at,
    GREATEST(
      COALESCE(p.availability_updated_at, '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(p.offer_updated_at, '1970-01-01 00:00:00+00'::timestamptz)
    ) AS last_change
  FROM pivoted p;
$function$;

COMMENT ON FUNCTION public.get_assignment_matrix_staffing_filtered(uuid[], uuid[])
  IS 'Returns latest staffing availability/offer status for bounded job/profile sets. Use instead of filtering get_assignment_matrix_staffing() client-side.';

GRANT EXECUTE ON FUNCTION public.get_assignment_matrix_staffing_filtered(uuid[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assignment_matrix_staffing_filtered(uuid[], uuid[]) TO service_role;
