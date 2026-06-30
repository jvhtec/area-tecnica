-- Treat declined staffing requests on overlapping dates as a hard exclusion.
--
-- Availability responses are job-scoped, so a declined availability request for
-- another job on the same dates means Carlos should not ask the technician again.
-- Declined offers are role-sensitive: block when the prior offer role is missing
-- or matches the current role prefix.

CREATE INDEX IF NOT EXISTS idx_staffing_requests_declined_profile_job_date
  ON public.staffing_requests (profile_id, job_id, phase, target_date)
  WHERE status = 'declined';

DO $$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.rank_staffing_candidates(uuid,text,text,text,jsonb)'::regprocedure)
  INTO v_sql;

  IF POSITION(
$old$
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
      AND NOT EXISTS (
        SELECT 1
        FROM technician_availability ta
$old$ IN v_sql) = 0
  THEN
    RAISE EXCEPTION 'Failed to find rank_staffing_candidates staffing request exclusion block';
  END IF;

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
            AND sr.phase = 'offer'
            AND sr.status IN ('pending', 'confirmed', 'declined')
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM technician_availability ta
$old$,
$new$
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
      AND NOT EXISTS (
        SELECT 1
        FROM staffing_requests sr
        JOIN jobs declined_job ON declined_job.id = sr.job_id
        LEFT JOIN LATERAL (
          SELECT NULLIF(BTRIM(se.meta->>'role'), '') AS event_role_code
          FROM staffing_events se
          WHERE se.staffing_request_id = sr.id
            AND se.event IN ('email_sent', 'whatsapp_sent')
            AND se.meta->>'phase' = sr.phase
            AND NULLIF(BTRIM(se.meta->>'role'), '') IS NOT NULL
          ORDER BY se.created_at DESC
          LIMIT 1
        ) latest_role ON true
        WHERE sr.profile_id = p.id
          AND sr.job_id IS DISTINCT FROM p_job_id
          AND sr.status = 'declined'
          AND sr.phase IN ('availability', 'offer')
          AND EXISTS (
            SELECT 1
            FROM target_dates td
            WHERE (
              COALESCE(sr.single_day, false) = true
              AND sr.target_date IS NOT NULL
              AND td.target_date = sr.target_date
            ) OR (
              (COALESCE(sr.single_day, false) = false OR sr.target_date IS NULL)
              AND td.target_date BETWEEN declined_job.start_time::date AND declined_job.end_time::date
            )
          )
          AND (
            sr.phase = 'availability'
            OR v_role_prefix IS NULL
            OR public.staffing_role_prefix(
              COALESCE(NULLIF(BTRIM(sr.role_code), ''), latest_role.event_role_code)
            ) IS NULL
            OR public.staffing_role_prefix(
              COALESCE(NULLIF(BTRIM(sr.role_code), ''), latest_role.event_role_code)
            ) = v_role_prefix
          )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM technician_availability ta
$new$
  );

  IF v_sql NOT LIKE '%declined_job ON declined_job.id = sr.job_id%'
    OR v_sql NOT LIKE '%sr.job_id IS DISTINCT FROM p_job_id%'
    OR v_sql NOT LIKE '%sr.phase = ''availability''%'
    OR v_sql NOT LIKE '%td.target_date BETWEEN declined_job.start_time::date AND declined_job.end_time::date%'
  THEN
    RAISE EXCEPTION 'Failed to patch rank_staffing_candidates with same-date declined request blocking';
  END IF;

  EXECUTE v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO service_role;
