-- Add home location coordinates to profiles for proximity scoring
-- These will be populated via Google Places autocomplete on the residencia field

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_latitude double precision,
  ADD COLUMN IF NOT EXISTS home_longitude double precision;

-- Add index for profiles with location data
CREATE INDEX IF NOT EXISTS idx_profiles_home_location
  ON public.profiles(home_latitude, home_longitude)
  WHERE home_latitude IS NOT NULL AND home_longitude IS NOT NULL;

-- Update the ranking function to include proximity scoring
CREATE OR REPLACE FUNCTION public.rank_staffing_candidates(
  p_job_id uuid,
  p_department text,
  p_role_code text,
  p_mode text,
  p_policy jsonb
) RETURNS TABLE (
  profile_id uuid,
  full_name text,
  department text,
  skills_score int,
  distance_to_madrid_km double precision,
  proximity_score int,
  experience_score int,
  reliability_score int,
  fairness_score int,
  soft_conflict boolean,
  hard_conflict boolean,
  final_score int,
  reasons jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w_skills numeric := COALESCE((p_policy->'weights'->>'skills')::numeric, 0.5);
  w_proximity numeric := COALESCE((p_policy->'weights'->>'proximity')::numeric, 0.1);
  w_reliability numeric := COALESCE((p_policy->'weights'->>'reliability')::numeric, 0.2);
  w_fairness numeric := COALESCE((p_policy->'weights'->>'fairness')::numeric, 0.1);
  w_experience numeric := COALESCE((p_policy->'weights'->>'experience')::numeric, 0.1);
  w_sum numeric;
  v_soft_conflict_policy text := COALESCE(p_policy->>'soft_conflict_policy', 'warn');
  v_exclude_fridge boolean := COALESCE((p_policy->>'exclude_fridge')::boolean, true);
  v_job_start timestamptz;
  v_job_end timestamptz;
  v_role_prefix text;
  v_venue_lat double precision;
  v_venue_lng double precision;
BEGIN
  -- Access control
  IF auth.role() <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management', 'logistics')
        AND (
          p.role IN ('admin', 'logistics')
          OR p.department IS NULL
          OR p.department = p_department
          OR (p_department = 'production' AND p.department = 'logistics')
        )
    ) THEN
      RAISE EXCEPTION 'Not authorized to rank candidates';
    END IF;
  END IF;

  -- Get job time range and venue location
  SELECT
    j.start_time,
    j.end_time,
    COALESCE(l.latitude, v.latitude) AS lat,
    COALESCE(l.longitude, v.longitude) AS lng
  INTO v_job_start, v_job_end, v_venue_lat, v_venue_lng
  FROM jobs j
  LEFT JOIN locations l ON l.id = j.location_id
  LEFT JOIN venues v ON v.id = l.venue_id
  WHERE j.id = p_job_id;

  IF v_job_start IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  -- Extract role prefix from role code (e.g., 'SND-FOH' from 'SND-FOH-R')
  -- Format is DEPT-POSITION-LEVEL, we want DEPT-POSITION
  v_role_prefix := CASE
    WHEN p_role_code ~ '^([A-Z]+-[A-Z]+)-[RET]$'
    THEN (regexp_match(p_role_code, '^([A-Z]+-[A-Z]+)-[RET]$'))[1]
    ELSE p_role_code  -- Fallback to full code if format doesn't match
  END;

  w_sum := w_skills + w_proximity + w_reliability + w_fairness + w_experience;
  IF w_sum <= 0 THEN
    w_skills := 0.5;
    w_proximity := 0.1;
    w_reliability := 0.2;
    w_fairness := 0.1;
    w_experience := 0.1;
    w_sum := 1;
  END IF;

  w_skills := w_skills / w_sum;
  w_proximity := w_proximity / w_sum;
  w_reliability := w_reliability / w_sum;
  w_fairness := w_fairness / w_sum;
  w_experience := w_experience / w_sum;

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id AS profile_id,
      NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), '') AS full_name,
      COALESCE(p.department, '') AS department,
      p.role AS user_role,
      p.home_latitude,
      p.home_longitude,
      COALESCE(tf.in_fridge, false) AS in_fridge,
      (
        SELECT MAX(ts.date)::date
        FROM timesheets ts
        WHERE ts.technician_id = p.id
          AND ts.is_active = true
      ) AS last_work_date,
      (
        SELECT COUNT(DISTINCT ts.job_id)
        FROM timesheets ts
        WHERE ts.technician_id = p.id
          AND ts.is_active = true
      ) AS jobs_worked,
      (
        SELECT COUNT(*)
        FROM timesheets ts
        WHERE ts.technician_id = p.id
          AND ts.is_active = true
          AND ts.date >= date_trunc('month', now())::date
          AND ts.date < (date_trunc('month', now()) + interval '1 month')::date
      ) AS current_month_days,
      -- Check for overlapping job assignments (only confirmed/invited, not declined)
      EXISTS (
        SELECT 1
        FROM job_assignments ja2
        JOIN jobs j2 ON j2.id = ja2.job_id
        WHERE ja2.technician_id = p.id
          AND ja2.job_id != p_job_id
          AND COALESCE(ja2.status, 'invited') NOT IN ('declined')
          AND j2.time_range && tstzrange(v_job_start, v_job_end, '[]')
      ) AS has_job_overlap,
      -- Check for soft conflicts (jobs on same day but not overlapping)
      EXISTS (
        SELECT 1
        FROM job_assignments ja2
        JOIN jobs j2 ON j2.id = ja2.job_id
        WHERE ja2.technician_id = p.id
          AND ja2.job_id != p_job_id
          AND COALESCE(ja2.status, 'invited') NOT IN ('declined')
          AND j2.start_time::date = v_job_start::date
          AND NOT (j2.time_range && tstzrange(v_job_start, v_job_end, '[]'))
      ) AS has_same_day_job
    FROM profiles p
    LEFT JOIN technician_fridge tf ON tf.technician_id = p.id
    WHERE
      (
        p.role IN ('technician', 'house_tech')
        OR (p.role NOT IN ('technician', 'house_tech') AND p.assignable_as_tech = true)
      )
      AND (
        (p_department <> 'production' AND p.department = p_department)
        OR (p_department = 'production' AND p.department IN ('production', 'logistics'))
      )
      AND (NOT v_exclude_fridge OR COALESCE(tf.in_fridge, false) = false)
      -- Filter out already assigned
      AND NOT EXISTS (
        SELECT 1
        FROM job_assignments ja
        WHERE ja.job_id = p_job_id
          AND ja.technician_id = p.id
          AND COALESCE(ja.status, 'invited') <> 'declined'
      )
      -- Filter out unavailable techs directly in WHERE clause
      AND NOT EXISTS (
        SELECT 1
        FROM technician_availability ta
        WHERE ta.technician_id = p.id::text
          AND ta.date >= v_job_start::date
          AND ta.date <= v_job_end::date
      )
  ),
  -- Calculate skills score using the mapping table
  skill_scores AS (
    SELECT
      b.profile_id,
      COALESCE(
        (
          SELECT MAX(
            LEAST(100,
              (CASE WHEN ps.is_primary THEN 60 ELSE 40 END) +
              (COALESCE(ps.proficiency, 0) * 8)
            ) * rsm.weight
          )::int
          FROM profile_skills ps
          JOIN skills s ON s.id = ps.skill_id AND s.active = true
          JOIN role_skill_mapping rsm ON LOWER(rsm.skill_name) = LOWER(s.name)
          WHERE ps.profile_id = b.profile_id
            AND rsm.role_prefix = v_role_prefix
            AND COALESCE(ps.proficiency, 0) > 0
        ),
        0
      ) AS skills_score,
      -- Get best matching skill info for reasons
      (
        SELECT jsonb_build_object(
          'name', s.name,
          'proficiency', ps.proficiency,
          'is_primary', ps.is_primary,
          'weight', rsm.weight
        )
        FROM profile_skills ps
        JOIN skills s ON s.id = ps.skill_id AND s.active = true
        JOIN role_skill_mapping rsm ON LOWER(rsm.skill_name) = LOWER(s.name)
        WHERE ps.profile_id = b.profile_id
          AND rsm.role_prefix = v_role_prefix
          AND COALESCE(ps.proficiency, 0) > 0
        ORDER BY
          LEAST(100, (CASE WHEN ps.is_primary THEN 60 ELSE 40 END) + (COALESCE(ps.proficiency, 0) * 8)) * rsm.weight DESC
        LIMIT 1
      ) AS best_skill
    FROM base b
  ),
  reliability_stats AS (
    SELECT
      sr.profile_id,
      COUNT(*) FILTER (WHERE sr.phase = 'availability' AND sr.status = 'confirmed') AS avail_yes,
      COUNT(*) FILTER (WHERE sr.phase = 'availability' AND sr.status IN ('confirmed', 'declined')) AS avail_total,
      COUNT(*) FILTER (WHERE sr.phase = 'offer' AND sr.status = 'confirmed') AS offer_yes,
      COUNT(*) FILTER (WHERE sr.phase = 'offer' AND sr.status IN ('confirmed', 'declined')) AS offer_total
    FROM staffing_requests sr
    GROUP BY sr.profile_id
  ),
  with_reliability AS (
    SELECT
      b.*,
      ss.skills_score,
      ss.best_skill,
      COALESCE(rs.avail_yes, 0) AS avail_yes,
      COALESCE(rs.avail_total, 0) AS avail_total,
      COALESCE(rs.offer_yes, 0) AS offer_yes,
      COALESCE(rs.offer_total, 0) AS offer_total
    FROM base b
    LEFT JOIN skill_scores ss ON ss.profile_id = b.profile_id
    LEFT JOIN reliability_stats rs ON rs.profile_id = b.profile_id
  ),
  scored AS (
    SELECT
      wr.profile_id,
      wr.full_name,
      wr.department,
      wr.user_role,
      wr.skills_score,
      wr.best_skill,
      wr.jobs_worked,
      wr.current_month_days,
      -- Calculate distance to venue (NULL if either location is missing)
      CASE
        WHEN wr.home_latitude IS NOT NULL
          AND wr.home_longitude IS NOT NULL
          AND v_venue_lat IS NOT NULL
          AND v_venue_lng IS NOT NULL
        THEN distance_km(wr.home_latitude, wr.home_longitude, v_venue_lat, v_venue_lng)
        ELSE NULL
      END AS distance_to_venue_km,
      LEAST(wr.jobs_worked, 10)::int AS experience_score,
      (
        CASE
          WHEN wr.avail_total > 0 OR wr.offer_total > 0 THEN
            ROUND(
              COALESCE(wr.avail_yes::numeric / NULLIF(wr.avail_total, 0), 0) * 5 +
              COALESCE(wr.offer_yes::numeric / NULLIF(wr.offer_total, 0), 0) * 5
            )
          ELSE 5
        END
      )::int AS reliability_score,
      (
        CASE
          WHEN wr.user_role = 'house_tech' AND wr.current_month_days < 4 THEN 10
          WHEN wr.last_work_date IS NULL THEN 10
          WHEN (now()::date - wr.last_work_date) > 30 THEN 10
          WHEN (now()::date - wr.last_work_date) > 14 THEN 7
          ELSE 3
        END
      )::int AS fairness_score,
      wr.has_same_day_job AS soft_conflict,
      wr.has_job_overlap AS hard_conflict
    FROM with_reliability wr
  ),
  with_proximity AS (
    SELECT
      s.*,
      -- Convert distance to proximity score (0-10)
      -- 0-25km = 10pts, 25-50km = 8pts, 50-100km = 6pts, 100-200km = 4pts, 200-400km = 2pts, >400km = 1pt
      -- NULL distance (no location data) = 5pts (neutral)
      CASE
        WHEN s.distance_to_venue_km IS NULL THEN 5
        WHEN s.distance_to_venue_km <= 25 THEN 10
        WHEN s.distance_to_venue_km <= 50 THEN 8
        WHEN s.distance_to_venue_km <= 100 THEN 6
        WHEN s.distance_to_venue_km <= 200 THEN 4
        WHEN s.distance_to_venue_km <= 400 THEN 2
        ELSE 1
      END AS proximity_score
    FROM scored s
  ),
  filtered AS (
    SELECT s.*
    FROM with_proximity s
    WHERE s.hard_conflict = false
      AND (v_soft_conflict_policy <> 'block' OR s.soft_conflict = false)
  )
  SELECT
    f.profile_id,
    COALESCE(f.full_name, 'Unknown') AS full_name,
    f.department,
    f.skills_score,
    f.distance_to_venue_km AS distance_to_madrid_km,  -- Keep column name for backwards compat
    f.proximity_score,
    f.experience_score,
    f.reliability_score,
    f.fairness_score,
    f.soft_conflict,
    f.hard_conflict,
    LEAST(
      100,
      ROUND(
        (
          (f.skills_score::numeric) * w_skills +
          (f.proximity_score::numeric * 10) * w_proximity +
          (f.reliability_score::numeric * 10) * w_reliability +
          (f.fairness_score::numeric * 10) * w_fairness +
          (f.experience_score::numeric * 10) * w_experience
        ) * (
          CASE
            WHEN f.user_role = 'house_tech' AND f.current_month_days < 4 THEN 1.3
            ELSE 1.0
          END
        )
      )::int
    ) AS final_score,
    jsonb_build_array(
      CASE
        WHEN f.skills_score > 0 AND f.best_skill IS NOT NULL THEN
          (CASE WHEN (f.best_skill->>'is_primary')::boolean THEN 'Primary skill: ' ELSE 'Skill: ' END) ||
          (f.best_skill->>'name') || ' (lvl ' || (f.best_skill->>'proficiency') || ')' ||
          (CASE WHEN (f.best_skill->>'weight')::numeric < 1 THEN ' [related]' ELSE '' END)
        ELSE 'No matching skill for ' || v_role_prefix
      END,
      CASE
        WHEN f.distance_to_venue_km IS NOT NULL THEN
          'Proximity: ' || ROUND(f.distance_to_venue_km::numeric, 1) || 'km (' || f.proximity_score || '/10)'
        ELSE 'Proximity: No location data'
      END,
      'Reliability: ' || f.reliability_score || '/10',
      'Fairness: ' || f.fairness_score || '/10',
      'Experience: ' || f.experience_score || '/10'
    ) ||
    (CASE
      WHEN f.user_role = 'house_tech' AND f.current_month_days < 4
      THEN jsonb_build_array('House tech boost (+30%)')
      ELSE '[]'::jsonb
    END) ||
    (CASE WHEN f.soft_conflict THEN jsonb_build_array('⚠ Same-day job (different time)') ELSE '[]'::jsonb END) AS reasons
  FROM filtered f
  ORDER BY final_score DESC, f.profile_id
  LIMIT 50;
END;
$$;

-- Grant execute permissions for the function
GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO service_role;
