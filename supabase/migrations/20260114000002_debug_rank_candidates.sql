-- Debug version - remove the with_reliability CTE to see if that's causing the issue
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
      COALESCE(skill.is_primary, false) AS is_primary,
      COALESCE(skill.proficiency, 0) AS proficiency,
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
      ) AS current_month_days
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
      -- Assignable: either role is technician/house_tech, OR other role with assignable_as_tech flag
      (
        p.role IN ('technician', 'house_tech')
        OR (p.role NOT IN ('technician', 'house_tech') AND p.assignable_as_tech = true)
      )
      -- Department match
      AND (
        (p_department <> 'production' AND p.department = p_department)
        OR (p_department = 'production' AND p.department IN ('production', 'logistics'))
      )
      -- Fridge filter
      AND (NOT v_exclude_fridge OR COALESCE(tf.in_fridge, false) = false)
      -- Not already assigned to this job
      AND NOT EXISTS (
        SELECT 1
        FROM job_assignments ja
        WHERE ja.job_id = p_job_id
          AND ja.technician_id = p.id
          AND COALESCE(ja.status, 'invited') <> 'declined'
      )
  ),
  scored AS (
    SELECT
      b.profile_id,
      b.full_name,
      b.department,
      b.user_role,
      b.is_primary,
      b.proficiency,
      b.jobs_worked,
      b.current_month_days,
      -- Component scores (skills is 0-100, others 0-10)
      (
        CASE
          WHEN b.proficiency > 0 THEN LEAST(
            100,
            (CASE WHEN b.is_primary THEN 60 ELSE 40 END) + (b.proficiency * 8)
          )
          ELSE 10
        END
      )::int AS skills_score,
      NULL::double precision AS distance_to_madrid_km,
      0::int AS proximity_score,
      LEAST(b.jobs_worked, 10)::int AS experience_score,
      5::int AS reliability_score,  -- Hardcoded for now
      (
        CASE
          WHEN b.user_role = 'house_tech' AND b.current_month_days < 4 THEN 10
          WHEN b.last_work_date IS NULL THEN 10
          WHEN (now()::date - b.last_work_date) > 30 THEN 10
          WHEN (now()::date - b.last_work_date) > 14 THEN 7
          ELSE 3
        END
      )::int AS fairness_score,
      false AS soft_conflict,  -- Simplified for now
      false AS hard_conflict
    FROM base b
  )
  SELECT
    s.profile_id,
    COALESCE(s.full_name, 'Unknown') AS full_name,
    s.department,
    s.skills_score,
    s.distance_to_madrid_km,
    s.proximity_score,
    s.experience_score,
    s.reliability_score,
    s.fairness_score,
    s.soft_conflict,
    s.hard_conflict,
    LEAST(
      100,
      ROUND(
        (
          (s.skills_score::numeric) * w_skills +
          (s.proximity_score::numeric * 10) * w_proximity +
          (s.reliability_score::numeric * 10) * w_reliability +
          (s.fairness_score::numeric * 10) * w_fairness +
          (s.experience_score::numeric * 10) * w_experience
        ) * (
          CASE
            WHEN s.user_role = 'house_tech' AND s.current_month_days < 4 THEN 1.3
            ELSE 1.0
          END
        )
      )::int
    ) AS final_score,
    jsonb_build_array(
      CASE
        WHEN s.proficiency > 0 THEN
          (CASE WHEN s.is_primary THEN 'Primary skill match' ELSE 'Skill match' END) || ' (lvl ' || s.proficiency || ')'
        ELSE 'No direct skill match'
      END,
      'Reliability: ' || s.reliability_score || '/10',
      'Fairness: ' || s.fairness_score || '/10',
      'Experience: ' || s.experience_score || '/10'
    ) AS reasons
  FROM scored s
  ORDER BY final_score DESC, s.profile_id
  LIMIT 50;
END;
$$;
