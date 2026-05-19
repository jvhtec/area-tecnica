-- Smarter staffing recommendations and manager-editable role skill mappings.

CREATE OR REPLACE FUNCTION public.staffing_role_prefix(p_role_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(regexp_replace(BTRIM(COALESCE(p_role_code, '')), '-[RET]$', ''), '');
$$;

CREATE OR REPLACE FUNCTION public.department_for_role_prefix(p_role_prefix text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE UPPER(split_part(COALESCE(p_role_prefix, ''), '-', 1))
    WHEN 'SND' THEN 'sound'
    WHEN 'LGT' THEN 'lights'
    WHEN 'VID' THEN 'video'
    WHEN 'PROD' THEN 'production'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_skill_category(p_category text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.get_current_user_role();
  v_department text := lower(coalesce(public.current_user_department(), ''));
  v_category text := lower(coalesce(nullif(btrim(p_category), ''), 'general'));
BEGIN
  IF auth.role() = 'service_role' OR v_role = 'admin' THEN
    RETURN true;
  END IF;

  IF v_role <> 'management' OR v_department = '' THEN
    RETURN false;
  END IF;

  RETURN v_category = 'general'
    OR v_category = v_department
    OR v_category LIKE v_department || '-%'
    OR v_category LIKE v_department || '_%';
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_role_skill_mapping(
  p_role_prefix text,
  p_skill_name text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.get_current_user_role();
  v_department text := lower(coalesce(public.current_user_department(), ''));
  v_mapping_department text := public.department_for_role_prefix(p_role_prefix);
BEGIN
  IF auth.role() = 'service_role' OR v_role = 'admin' THEN
    RETURN true;
  END IF;

  IF v_role <> 'management'
    OR v_department = ''
    OR v_mapping_department IS NULL
    OR v_mapping_department <> v_department
  THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.skills s
    WHERE lower(s.name) = lower(btrim(coalesce(p_skill_name, '')))
      AND public.can_manage_skill_category(s.category)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.staffing_role_prefix(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.department_for_role_prefix(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_skill_category(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_role_skill_mapping(text, text) TO authenticated, service_role;

-- Replace broad manager write access to skills with department/category scoped access.
DROP POLICY IF EXISTS "p_skills_public_insert_b16e7f" ON public.skills;
DROP POLICY IF EXISTS "p_skills_public_update_c0f308" ON public.skills;
DROP POLICY IF EXISTS "p_skills_public_delete_ff6ad9" ON public.skills;
DROP POLICY IF EXISTS "skills_insert_admin_or_scoped_management" ON public.skills;
DROP POLICY IF EXISTS "skills_update_admin_or_scoped_management" ON public.skills;
DROP POLICY IF EXISTS "skills_delete_admin_or_scoped_management" ON public.skills;

CREATE POLICY "skills_insert_admin_or_scoped_management"
  ON public.skills
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_skill_category(category));

CREATE POLICY "skills_update_admin_or_scoped_management"
  ON public.skills
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_skill_category(category))
  WITH CHECK (public.can_manage_skill_category(category));

CREATE POLICY "skills_delete_admin_or_scoped_management"
  ON public.skills
  FOR DELETE
  TO authenticated
  USING (public.can_manage_skill_category(category));

-- Existing migrations granted only SELECT on role_skill_mapping. Add scoped writes.
DROP POLICY IF EXISTS "role_skill_mapping_insert_admin_or_scoped_management" ON public.role_skill_mapping;
DROP POLICY IF EXISTS "role_skill_mapping_update_admin_or_scoped_management" ON public.role_skill_mapping;
DROP POLICY IF EXISTS "role_skill_mapping_delete_admin_or_scoped_management" ON public.role_skill_mapping;

CREATE POLICY "role_skill_mapping_insert_admin_or_scoped_management"
  ON public.role_skill_mapping
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_role_skill_mapping(role_prefix, skill_name));

CREATE POLICY "role_skill_mapping_update_admin_or_scoped_management"
  ON public.role_skill_mapping
  FOR UPDATE
  TO authenticated
  USING (public.can_manage_role_skill_mapping(role_prefix, skill_name))
  WITH CHECK (public.can_manage_role_skill_mapping(role_prefix, skill_name));

CREATE POLICY "role_skill_mapping_delete_admin_or_scoped_management"
  ON public.role_skill_mapping
  FOR DELETE
  TO authenticated
  USING (public.can_manage_role_skill_mapping(role_prefix, skill_name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_skill_mapping TO authenticated;
GRANT ALL ON public.role_skill_mapping TO service_role;

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
  v_normalized_role_code text := NULLIF(BTRIM(p_role_code), '');
  v_role_prefix text;
  v_base_lat double precision := 40.4168;
  v_base_lng double precision := -3.7038;
BEGIN
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

  SELECT j.start_time, j.end_time
  INTO v_job_start, v_job_end
  FROM jobs j
  WHERE j.id = p_job_id;

  IF v_job_start IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  v_role_prefix := public.staffing_role_prefix(v_normalized_role_code);

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
  WITH target_dates AS (
    SELECT generate_series(v_job_start::date, v_job_end::date, interval '1 day')::date AS target_date
  ),
  base AS (
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
      EXISTS (
        SELECT 1
        FROM job_assignments ja2
        JOIN jobs j2 ON j2.id = ja2.job_id
        WHERE ja2.technician_id = p.id
          AND ja2.job_id IS DISTINCT FROM p_job_id
          AND COALESCE(ja2.status, 'invited') <> 'declined'
          AND EXISTS (
            SELECT 1
            FROM target_dates td
            WHERE td.target_date BETWEEN j2.start_time::date AND j2.end_time::date
          )
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
      AND NOT EXISTS (
        SELECT 1
        FROM job_assignments ja
        WHERE ja.job_id = p_job_id
          AND ja.technician_id = p.id
          AND COALESCE(ja.status, 'invited') <> 'declined'
      )
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
      AND NOT EXISTS (
        SELECT 1
        FROM technician_availability ta
        JOIN target_dates td ON td.target_date = ta.date
        WHERE ta.technician_id = p.id::text
      )
      AND NOT EXISTS (
        SELECT 1
        FROM timesheets ts
        JOIN target_dates td ON td.target_date = ts.date
        WHERE ts.technician_id = p.id
          AND ts.job_id IS DISTINCT FROM p_job_id
          AND ts.is_active = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM job_assignments ja2
        JOIN jobs j2 ON j2.id = ja2.job_id
        WHERE ja2.technician_id = p.id
          AND ja2.job_id IS DISTINCT FROM p_job_id
          AND COALESCE(ja2.status, 'invited') <> 'declined'
          AND j2.time_range && tstzrange(v_job_start, v_job_end, '[]')
      )
  ),
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
      ) AS manual_skill_score,
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
  role_experience AS (
    SELECT
      b.profile_id,
      COUNT(DISTINCT ja.job_id)::int AS role_completed_jobs
    FROM base b
    JOIN job_assignments ja ON ja.technician_id = b.profile_id
      AND ja.status = 'confirmed'
    JOIN jobs j ON j.id = ja.job_id
      AND j.status = 'Completado'
    WHERE public.staffing_role_prefix(
      CASE p_department
        WHEN 'sound' THEN ja.sound_role
        WHEN 'lights' THEN ja.lights_role
        WHEN 'video' THEN ja.video_role
        WHEN 'production' THEN ja.production_role
        ELSE COALESCE(ja.sound_role, ja.lights_role, ja.video_role, ja.production_role)
      END
    ) = v_role_prefix
    GROUP BY b.profile_id
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
      ss.manual_skill_score,
      ss.best_skill,
      COALESCE(re.role_completed_jobs, 0)::int AS role_completed_jobs,
      (
        CASE
          WHEN COALESCE(re.role_completed_jobs, 0) >= 11 THEN 80
          WHEN COALESCE(re.role_completed_jobs, 0) >= 7 THEN 65
          WHEN COALESCE(re.role_completed_jobs, 0) >= 4 THEN 50
          WHEN COALESCE(re.role_completed_jobs, 0) >= 2 THEN 35
          WHEN COALESCE(re.role_completed_jobs, 0) = 1 THEN 20
          ELSE 0
        END
      )::int AS role_experience_score,
      COALESCE(rs.avail_yes, 0) AS avail_yes,
      COALESCE(rs.avail_total, 0) AS avail_total,
      COALESCE(rs.offer_yes, 0) AS offer_yes,
      COALESCE(rs.offer_total, 0) AS offer_total
    FROM base b
    LEFT JOIN skill_scores ss ON ss.profile_id = b.profile_id
    LEFT JOIN role_experience re ON re.profile_id = b.profile_id
    LEFT JOIN reliability_stats rs ON rs.profile_id = b.profile_id
  ),
  scored AS (
    SELECT
      wr.profile_id,
      wr.full_name,
      wr.department,
      wr.user_role,
      GREATEST(wr.manual_skill_score, wr.role_experience_score)::int AS skills_score,
      wr.manual_skill_score,
      wr.best_skill,
      wr.role_completed_jobs,
      wr.role_experience_score,
      wr.jobs_worked,
      wr.current_month_days,
      CASE
        WHEN wr.home_latitude IS NOT NULL
          AND wr.home_longitude IS NOT NULL
        THEN distance_km(wr.home_latitude, wr.home_longitude, v_base_lat, v_base_lng)
        ELSE NULL
      END AS distance_to_base_km,
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
      false AS hard_conflict
    FROM with_reliability wr
  ),
  with_proximity AS (
    SELECT
      s.*,
      CASE
        WHEN s.distance_to_base_km IS NULL THEN 5
        WHEN s.distance_to_base_km <= 25 THEN 10
        WHEN s.distance_to_base_km <= 50 THEN 8
        WHEN s.distance_to_base_km <= 100 THEN 6
        WHEN s.distance_to_base_km <= 200 THEN 4
        WHEN s.distance_to_base_km <= 400 THEN 2
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
    f.distance_to_base_km AS distance_to_madrid_km,
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
        WHEN f.manual_skill_score > 0 AND f.best_skill IS NOT NULL THEN
          (CASE WHEN (f.best_skill->>'is_primary')::boolean THEN 'Primary skill: ' ELSE 'Skill: ' END) ||
          (f.best_skill->>'name') || ' (lvl ' || (f.best_skill->>'proficiency') || ')' ||
          (CASE WHEN (f.best_skill->>'weight')::numeric < 1 THEN ' [related]' ELSE '' END)
        ELSE 'No matching manual skill for ' || COALESCE(v_role_prefix, p_role_code)
      END,
      CASE
        WHEN f.distance_to_base_km IS NOT NULL THEN
          'Proximity: ' || ROUND(f.distance_to_base_km::numeric, 1) || 'km (' || f.proximity_score || '/10)'
        ELSE 'Proximity: No location data'
      END,
      'Reliability: ' || f.reliability_score || '/10',
      'Fairness: ' || f.fairness_score || '/10',
      'Experience: ' || f.experience_score || '/10'
    ) ||
    (CASE
      WHEN f.role_completed_jobs > 0
      THEN jsonb_build_array('Role experience: ' || f.role_completed_jobs || ' completed ' || COALESCE(v_role_prefix, p_role_code) || ' jobs')
      ELSE '[]'::jsonb
    END) ||
    (CASE
      WHEN f.role_experience_score > f.manual_skill_score
      THEN jsonb_build_array('Skill score boosted by completed role history')
      ELSE '[]'::jsonb
    END) ||
    (CASE
      WHEN f.user_role = 'house_tech' AND f.current_month_days < 4
      THEN jsonb_build_array('House tech boost (+30%)')
      ELSE '[]'::jsonb
    END) ||
    (CASE WHEN f.soft_conflict THEN jsonb_build_array('Same-day job (different time)') ELSE '[]'::jsonb END) AS reasons
  FROM filtered f
  ORDER BY final_score DESC, f.profile_id
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rank_staffing_candidates(uuid, text, text, text, jsonb) TO service_role;
