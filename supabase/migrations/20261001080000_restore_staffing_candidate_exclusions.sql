-- Restore the May/June 2026 candidate exclusions dropped by the full
-- 2026-07-30 rank_staffing_candidates replacement. Patch the current function
-- in-place so the July seasonal-house-tech and financial scoring changes survive.
-- Abort rather than silently skip if another migration changes these anchors.
-- The original May/June indexes already exist; no schema or privilege expansion.
DO $restore_rank_exclusions$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef(
    to_regprocedure('public.rank_staffing_candidates(uuid,text,text,text,jsonb)')
  ) INTO v_sql;

  IF v_sql IS NULL THEN
    RAISE EXCEPTION 'rank_staffing_candidates is missing';
  END IF;

  IF position($before_availability$
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
$before_availability$ IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Unexpected rank_staffing_candidates availability block; aborting restoration';
  END IF;

  v_sql := replace(
    v_sql,
    $before_availability$
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
$before_availability$,
    $after_availability$
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
$after_availability$
  );

  IF position($before_declined$
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
$before_declined$ IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Unexpected rank_staffing_candidates decline block; aborting restoration';
  END IF;

  v_sql := replace(
    v_sql,
    $before_declined$
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
$before_declined$,
    $after_declined$
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
$after_declined$
  );

  IF position('p.seasonal_house_tech = false' IN v_sql) = 0
     OR position('Availability is job-scoped:' IN v_sql) = 0
     OR position('latest_role.event_role_code' IN v_sql) = 0
  THEN
    RAISE EXCEPTION 'rank_staffing_candidates restoration failed its postconditions';
  END IF;

  EXECUTE v_sql;
END;
$restore_rank_exclusions$;

-- Preserve the callable surface of the existing function.
GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid,text,text,text,jsonb)
  TO authenticated, service_role;
