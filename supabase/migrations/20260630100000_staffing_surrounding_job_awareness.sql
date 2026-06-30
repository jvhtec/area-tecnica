-- Make staffing recommendations aware of surrounding assignments.
--
-- A technician booked on adjacent dates should not be contacted for a separate
-- back-to-back job unless the adjacent venues are very close to the target
-- venue, or the campaign is running in Cobertura urgente (emergency_fill) mode.
-- Jobs in the same non-null tour are treated as one coherent run and are not
-- blocked by this guard.

DO $$
DECLARE
  v_sql text;
BEGIN
  SELECT pg_get_functiondef('public.rank_staffing_candidates(uuid,text,text,text,jsonb)'::regprocedure)
  INTO v_sql;

  IF POSITION(
$old$
  v_base_lat double precision := 40.4168;
  v_base_lng double precision := -3.7038;
$old$ IN v_sql) = 0
  THEN
    RAISE EXCEPTION 'Failed to find rank_staffing_candidates coordinate declaration block';
  END IF;

  v_sql := replace(
    v_sql,
$old$
  v_base_lat double precision := 40.4168;
  v_base_lng double precision := -3.7038;
$old$,
$new$
  v_base_lat double precision := 40.4168;
  v_base_lng double precision := -3.7038;
  v_target_lat double precision;
  v_target_lng double precision;
  v_target_tour_id uuid;
  v_surrounding_jobs_enabled boolean := COALESCE((p_policy->'surrounding_jobs'->>'enabled')::boolean, true);
  v_surrounding_jobs_max_distance_km double precision := COALESCE((p_policy->'surrounding_jobs'->>'max_location_distance_km')::double precision, 25);
  v_surrounding_jobs_is_urgent boolean :=
    COALESCE(p_policy->'profile'->>'selected_job_profile', p_policy->'profile'->>'inferred_job_profile', '') = 'emergency_fill'
    OR COALESCE(p_policy->'role_profiles'->NULLIF(BTRIM(COALESCE(p_role_code, '')), '')->>'selected_profile', '') = 'emergency_fill'
    OR COALESCE(p_policy->'role_profiles'->NULLIF(BTRIM(COALESCE(p_role_code, '')), '')->>'inferred_profile', '') = 'emergency_fill';
$new$
  );

  IF POSITION(
$old$
  SELECT j.start_time, j.end_time
  INTO v_job_start, v_job_end
  FROM jobs j
  WHERE j.id = p_job_id;
$old$ IN v_sql) = 0
  THEN
    RAISE EXCEPTION 'Failed to find rank_staffing_candidates target job metadata block';
  END IF;

  v_sql := replace(
    v_sql,
$old$
  SELECT j.start_time, j.end_time
  INTO v_job_start, v_job_end
  FROM jobs j
  WHERE j.id = p_job_id;
$old$,
$new$
  SELECT
    j.start_time,
    j.end_time,
    j.tour_id,
    l.latitude::double precision,
    l.longitude::double precision
  INTO v_job_start, v_job_end, v_target_tour_id, v_target_lat, v_target_lng
  FROM jobs j
  LEFT JOIN locations l ON l.id = j.location_id
  WHERE j.id = p_job_id;
$new$
  );

  IF POSITION(
$old$
          AND NOT (j2.time_range && tstzrange(v_job_start, v_job_end, '[]'))
      ) AS has_same_day_job
    FROM profiles p
$old$ IN v_sql) = 0
  THEN
    RAISE EXCEPTION 'Failed to find rank_staffing_candidates adjacent assignment projection block';
  END IF;

  v_sql := replace(
    v_sql,
$old$
          AND NOT (j2.time_range && tstzrange(v_job_start, v_job_end, '[]'))
      ) AS has_same_day_job
    FROM profiles p
$old$,
$new$
          AND NOT (j2.time_range && tstzrange(v_job_start, v_job_end, '[]'))
      ) AS has_same_day_job,
      EXISTS (
        SELECT 1
        FROM job_assignments ja3
        JOIN jobs j3 ON j3.id = ja3.job_id
        WHERE ja3.technician_id = p.id
          AND ja3.job_id IS DISTINCT FROM p_job_id
          AND COALESCE(ja3.status, 'invited') <> 'declined'
          AND (
            v_target_tour_id IS NULL
            OR j3.tour_id IS NULL
            OR j3.tour_id <> v_target_tour_id
          )
          AND (v_job_start::date - 1) BETWEEN j3.start_time::date AND j3.end_time::date
      ) AS has_previous_day_job,
      EXISTS (
        SELECT 1
        FROM job_assignments ja4
        JOIN jobs j4 ON j4.id = ja4.job_id
        WHERE ja4.technician_id = p.id
          AND ja4.job_id IS DISTINCT FROM p_job_id
          AND COALESCE(ja4.status, 'invited') <> 'declined'
          AND (
            v_target_tour_id IS NULL
            OR j4.tour_id IS NULL
            OR j4.tour_id <> v_target_tour_id
          )
          AND (v_job_end::date + 1) BETWEEN j4.start_time::date AND j4.end_time::date
      ) AS has_next_day_job,
      (
        SELECT MAX(
          distance_km(
            v_target_lat,
            v_target_lng,
            l5.latitude::double precision,
            l5.longitude::double precision
          )
        )
        FROM job_assignments ja5
        JOIN jobs j5 ON j5.id = ja5.job_id
        LEFT JOIN locations l5 ON l5.id = j5.location_id
        WHERE ja5.technician_id = p.id
          AND ja5.job_id IS DISTINCT FROM p_job_id
          AND COALESCE(ja5.status, 'invited') <> 'declined'
          AND (
            v_target_tour_id IS NULL
            OR j5.tour_id IS NULL
            OR j5.tour_id <> v_target_tour_id
          )
          AND (
            (v_job_start::date - 1) BETWEEN j5.start_time::date AND j5.end_time::date
            OR (v_job_end::date + 1) BETWEEN j5.start_time::date AND j5.end_time::date
          )
          AND v_target_lat IS NOT NULL
          AND v_target_lng IS NOT NULL
          AND l5.latitude IS NOT NULL
          AND l5.longitude IS NOT NULL
      ) AS max_surrounding_job_distance_km,
      EXISTS (
        SELECT 1
        FROM job_assignments ja6
        JOIN jobs j6 ON j6.id = ja6.job_id
        LEFT JOIN locations l6 ON l6.id = j6.location_id
        WHERE ja6.technician_id = p.id
          AND ja6.job_id IS DISTINCT FROM p_job_id
          AND COALESCE(ja6.status, 'invited') <> 'declined'
          AND (
            v_target_tour_id IS NULL
            OR j6.tour_id IS NULL
            OR j6.tour_id <> v_target_tour_id
          )
          AND (
            (v_job_start::date - 1) BETWEEN j6.start_time::date AND j6.end_time::date
            OR (v_job_end::date + 1) BETWEEN j6.start_time::date AND j6.end_time::date
          )
          AND (
            v_target_lat IS NULL
            OR v_target_lng IS NULL
            OR l6.latitude IS NULL
            OR l6.longitude IS NULL
          )
      ) AS has_unknown_surrounding_job_location
    FROM profiles p
$new$
  );

  IF POSITION(
$old$
      wr.rate_penalty,
      GREATEST(0, 100 - ROUND(wr.rate_penalty * 10)::int) AS cost_efficiency_score,
      wr.jobs_worked,
$old$ IN v_sql) = 0
  THEN
    RAISE EXCEPTION 'Failed to find rank_staffing_candidates candidate field forwarding block';
  END IF;

  v_sql := replace(
    v_sql,
$old$
      wr.rate_penalty,
      GREATEST(0, 100 - ROUND(wr.rate_penalty * 10)::int) AS cost_efficiency_score,
      wr.jobs_worked,
$old$,
$new$
      wr.rate_penalty,
      GREATEST(0, 100 - ROUND(wr.rate_penalty * 10)::int) AS cost_efficiency_score,
      wr.has_previous_day_job,
      wr.has_next_day_job,
      wr.max_surrounding_job_distance_km,
      wr.has_unknown_surrounding_job_location,
      wr.jobs_worked,
$new$
  );

  IF POSITION(
$old$
      wr.has_same_day_job AS soft_conflict,
      false AS hard_conflict
$old$ IN v_sql) = 0
  THEN
    RAISE EXCEPTION 'Failed to find rank_staffing_candidates hard conflict block';
  END IF;

  v_sql := replace(
    v_sql,
$old$
      wr.has_same_day_job AS soft_conflict,
      false AS hard_conflict
$old$,
$new$
      wr.has_same_day_job AS soft_conflict,
      (
        v_surrounding_jobs_enabled
        AND NOT v_surrounding_jobs_is_urgent
        AND (wr.has_previous_day_job OR wr.has_next_day_job)
        AND (
          wr.has_unknown_surrounding_job_location
          OR wr.max_surrounding_job_distance_km IS NULL
          OR wr.max_surrounding_job_distance_km > v_surrounding_jobs_max_distance_km
        )
      ) AS hard_conflict
$new$
  );

  IF POSITION(
$old$
    (CASE
      WHEN f.rate_penalty > 0
      THEN jsonb_build_array(
        'Rate adjustment: -' || ROUND(f.rate_penalty::numeric, 1) ||
        ' (' || ROUND(((f.rate_ratio - 1) * 100)::numeric, 0) || '% above standard)'
      )
      ELSE '[]'::jsonb
    END) ||
    (CASE WHEN f.soft_conflict THEN jsonb_build_array('Same-day job (different time)') ELSE '[]'::jsonb END) AS reasons
$old$ IN v_sql) = 0
  THEN
    RAISE EXCEPTION 'Failed to find rank_staffing_candidates reasons block';
  END IF;

  v_sql := replace(
    v_sql,
$old$
    (CASE
      WHEN f.rate_penalty > 0
      THEN jsonb_build_array(
        'Rate adjustment: -' || ROUND(f.rate_penalty::numeric, 1) ||
        ' (' || ROUND(((f.rate_ratio - 1) * 100)::numeric, 0) || '% above standard)'
      )
      ELSE '[]'::jsonb
    END) ||
    (CASE WHEN f.soft_conflict THEN jsonb_build_array('Same-day job (different time)') ELSE '[]'::jsonb END) AS reasons
$old$,
$new$
    (CASE
      WHEN f.rate_penalty > 0
      THEN jsonb_build_array(
        'Rate adjustment: -' || ROUND(f.rate_penalty::numeric, 1) ||
        ' (' || ROUND(((f.rate_ratio - 1) * 100)::numeric, 0) || '% above standard)'
      )
      ELSE '[]'::jsonb
    END) ||
    (CASE
      WHEN (f.has_previous_day_job OR f.has_next_day_job) AND NOT v_surrounding_jobs_enabled
      THEN jsonb_build_array('Adjacent job guard disabled')
      WHEN (f.has_previous_day_job OR f.has_next_day_job) AND v_surrounding_jobs_enabled AND v_surrounding_jobs_is_urgent
      THEN jsonb_build_array('Adjacent jobs allowed by Cobertura urgente')
      WHEN (f.has_previous_day_job OR f.has_next_day_job)
        AND v_surrounding_jobs_enabled
        AND f.max_surrounding_job_distance_km IS NOT NULL
        AND f.max_surrounding_job_distance_km <= v_surrounding_jobs_max_distance_km
      THEN jsonb_build_array('Adjacent jobs within ' || ROUND(f.max_surrounding_job_distance_km::numeric, 1) || 'km')
      ELSE '[]'::jsonb
    END) ||
    (CASE WHEN f.soft_conflict THEN jsonb_build_array('Same-day job (different time)') ELSE '[]'::jsonb END) AS reasons
$new$
  );

  IF v_sql NOT LIKE '%v_surrounding_jobs_max_distance_km%'
    OR v_sql NOT LIKE '%has_previous_day_job%'
    OR v_sql NOT LIKE '%has_next_day_job%'
    OR v_sql NOT LIKE '%Adjacent jobs allowed by Cobertura urgente%'
  THEN
    RAISE EXCEPTION 'Failed to patch rank_staffing_candidates with surrounding job awareness';
  END IF;

  EXECUTE v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO service_role;
