-- Availability responses are job-scoped. Keep role context in send/event
-- metadata for manager intent, but do not persist it on availability requests
-- or use it to decide whether a technician has answered availability.

UPDATE public.staffing_requests
SET role_code = NULL
WHERE phase = 'availability'
  AND role_code IS NOT NULL;

COMMENT ON COLUMN public.staffing_requests.role_code
  IS 'Role code for role-specific staffing phases, primarily offers. Availability requests are job-scoped and should keep this null.';

CREATE INDEX IF NOT EXISTS idx_staffing_requests_active_job_availability
  ON public.staffing_requests (job_id, profile_id, status, target_date)
  WHERE phase = 'availability'
    AND status IN ('pending', 'confirmed', 'declined');

DO $$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.rank_staffing_candidates(uuid,text,text,text,jsonb)'::regprocedure)
  INTO v_sql;

  v_sql := replace(
    v_sql,
$old$
      AND (
        v_normalized_role_code IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM staffing_requests sr
          WHERE sr.job_id = p_job_id
            AND sr.profile_id = p.id
            AND NULLIF(BTRIM(sr.role_code), '') = v_normalized_role_code
            AND sr.phase IN ('availability', 'offer')
            AND sr.status IN ('pending', 'confirmed', 'declined')
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM staffing_requests sr
        WHERE sr.job_id = p_job_id
          AND sr.profile_id = p.id
          AND NULLIF(BTRIM(sr.role_code), '') IS NULL
          AND sr.phase IN ('availability', 'offer')
          AND sr.status = 'declined'
          AND (
            sr.single_day = false
            OR sr.target_date IS NULL
            OR sr.target_date BETWEEN v_job_start::date AND v_job_end::date
          )
      )
$old$,
$new$
      -- Availability is job-scoped: once a technician has a pending or
      -- confirmed availability response for this job, do not recommend another
      -- availability request for any role. The role is only disclosed at offer time.
      AND NOT EXISTS (
        SELECT 1
        FROM staffing_requests sr
        WHERE sr.job_id = p_job_id
          AND sr.profile_id = p.id
          AND sr.phase = 'availability'
          AND sr.status IN ('pending', 'confirmed')
          AND (
            sr.single_day = false
            OR sr.target_date IS NULL
            OR sr.target_date BETWEEN v_job_start::date AND v_job_end::date
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM staffing_requests sr
        WHERE sr.job_id = p_job_id
          AND sr.profile_id = p.id
          AND sr.phase = 'availability'
          AND sr.status = 'declined'
          AND (
            sr.single_day = false
            OR sr.target_date IS NULL
            OR sr.target_date BETWEEN v_job_start::date AND v_job_end::date
          )
      )
      AND (
        v_normalized_role_code IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM staffing_requests sr
          WHERE sr.job_id = p_job_id
            AND sr.profile_id = p.id
            AND NULLIF(BTRIM(sr.role_code), '') = v_normalized_role_code
            AND sr.phase = 'offer'
            AND sr.status IN ('pending', 'confirmed', 'declined')
        )
      )
$new$
  );

  IF v_sql NOT LIKE '%Availability is job-scoped:%'
    OR v_sql NOT LIKE '%sr.phase = ''availability''%'
    OR v_sql NOT LIKE '%sr.phase = ''offer''%'
  THEN
    RAISE EXCEPTION 'Failed to patch rank_staffing_candidates with job-scoped availability filtering';
  END IF;

  EXECUTE v_sql;
END;
$$;
