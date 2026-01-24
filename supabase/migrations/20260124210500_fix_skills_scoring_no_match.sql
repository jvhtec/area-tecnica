-- Fix skills scoring: give 0 points when there's no skill match instead of 10
-- This ensures candidates without the required skill are properly ranked lower

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

  -- Get job time range
  SELECT start_time, end_time INTO v_job_start, v_job_end
  FROM jobs
  WHERE id = p_job_id;

  IF v_job_start IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

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
      COALESCE(tf.in_fridge, false) AS in_fridge,
      skill.is_primary,
      skill.proficiency,
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
    LEFT JOIN LATERAL (
      SELECT ps.is_primary, ps.proficiency
      FROM profile_skills ps
      JOIN skills s ON s.id = ps.skill_id
      WHERE ps.profile_id = p.id
        AND s.active = true
        AND s.name = p_role_code
      ORDER BY ps.is_primary DESC, ps.proficiency DESC NULLS LAST
      LIMIT 1
    ) AS skill ON true
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
      COALESCE(rs.avail_yes, 0) AS avail_yes,
      COALESCE(rs.avail_total, 0) AS avail_total,
      COALESCE(rs.offer_yes, 0) AS offer_yes,
      COALESCE(rs.offer_total, 0) AS offer_total
    FROM base b
    LEFT JOIN reliability_stats rs ON rs.profile_id = b.profile_id
  ),
  scored AS (
    SELECT
      wr.profile_id,
      wr.full_name,
      wr.department,
      wr.user_role,
      wr.is_primary,
      wr.proficiency,
      wr.jobs_worked,
      wr.current_month_days,
      -- FIXED: Give 0 points when there's no skill match instead of 10
      -- This properly differentiates candidates with/without required skills
      (
        CASE
          WHEN wr.proficiency IS NOT NULL AND wr.proficiency > 0 THEN LEAST(
            100,
            (CASE WHEN wr.is_primary THEN 60 ELSE 40 END) + (wr.proficiency * 8)
          )
          ELSE 0
        END
      )::int AS skills_score,
      NULL::double precision AS distance_to_madrid_km,
      0::int AS proximity_score,
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
  filtered AS (
    SELECT s.*
    FROM scored s
    WHERE s.hard_conflict = false
      AND (v_soft_conflict_policy <> 'block' OR s.soft_conflict = false)
  )
  SELECT
    f.profile_id,
    COALESCE(f.full_name, 'Unknown') AS full_name,
    f.department,
    f.skills_score,
    f.distance_to_madrid_km,
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
        WHEN f.proficiency IS NOT NULL AND f.proficiency > 0 THEN
          (CASE WHEN f.is_primary THEN 'Primary skill match' ELSE 'Skill match' END) || ' (lvl ' || f.proficiency || ')'
        ELSE 'No skill match for role'
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
