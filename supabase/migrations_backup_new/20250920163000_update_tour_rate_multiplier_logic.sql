-- Ensure tour multipliers only apply to technicians on the tour team
DROP VIEW IF EXISTS v_tour_job_rate_quotes_2025;

CREATE OR REPLACE FUNCTION compute_tour_job_rate_quote_2025(_job_id uuid, _tech_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jtype job_type;
  st timestamptz;
  tour_group uuid;
  cat text;
  house boolean := false;
  team_member boolean := false;
  base numeric(10,2);
  mult numeric(6,3) := 1.0;
  cnt int := 1;
  y int;
  w int;
  extras jsonb;
  extras_total numeric(10,2);
  final_total numeric(10,2);
  disclaimer boolean;
BEGIN
  -- Fetch job info
  SELECT job_type, start_time, tour_id
  INTO jtype, st, tour_group
  FROM jobs
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','job_not_found');
  END IF;
  IF jtype <> 'tourdate' THEN
    RETURN jsonb_build_object('error','not_tour_date');
  END IF;

  -- Determine whether technician is defined as a house tech
  house := is_house_tech(_tech_id);

  -- Resolve category for non-house technicians
  IF NOT house THEN
    SELECT 
      CASE
        WHEN sound_role LIKE '%-R' OR lights_role LIKE '%-R' OR video_role LIKE '%-R' THEN 'responsable'
        WHEN sound_role LIKE '%-E' OR lights_role LIKE '%-E' OR video_role LIKE '%-E' THEN 'especialista'
        WHEN sound_role LIKE '%-T' OR lights_role LIKE '%-T' OR video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END
    INTO cat
    FROM job_assignments
    WHERE job_id = _job_id AND technician_id = _tech_id;

    IF cat IS NULL THEN
      SELECT default_timesheet_category INTO cat
      FROM profiles
      WHERE id = _tech_id AND default_timesheet_category IN ('tecnico','especialista','responsable');
    END IF;

    IF cat IS NULL THEN
      RETURN jsonb_build_object('error','category_missing','profile_id',_tech_id,'job_id',_job_id);
    END IF;
  END IF;

  -- Base rate lookup
  IF house THEN
    SELECT base_day_eur INTO base
    FROM house_tech_rates
    WHERE profile_id = _tech_id;

    IF base IS NULL THEN
      RETURN jsonb_build_object('error','house_rate_missing','profile_id',_tech_id);
    END IF;
    mult := 1.0; -- house techs never receive weekly multipliers
  ELSE
    SELECT base_day_eur INTO base
    FROM rate_cards_tour_2025
    WHERE category = cat;

    IF base IS NULL THEN
      RETURN jsonb_build_object('error','tour_base_missing','category',cat);
    END IF;
  END IF;

  -- Determine if technician belongs to the tour team
  IF tour_group IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM tour_assignments ta
      WHERE ta.tour_id = tour_group
        AND ta.technician_id = _tech_id
    )
    INTO team_member;
  END IF;

  -- Multiplier logic (only for non-house techs that are on the tour team)
  IF NOT house THEN
    SELECT iso_year, iso_week INTO y, w
    FROM iso_year_week_madrid(st);

    IF team_member THEN
      SELECT count(*) INTO cnt
      FROM job_assignments a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.technician_id = _tech_id
        AND j.job_type = 'tourdate'
        AND j.tour_id = tour_group
        AND (SELECT iso_year FROM iso_year_week_madrid(j.start_time)) = y
        AND (SELECT iso_week FROM iso_year_week_madrid(j.start_time)) = w;

      SELECT multiplier INTO mult
      FROM tour_week_multipliers_2025
      WHERE GREATEST(1, cnt) BETWEEN min_dates AND max_dates
      ORDER BY min_dates
      LIMIT 1;

      IF mult IS NULL THEN
        mult := 1.0;
      END IF;
    ELSE
      cnt := 1;
      mult := 1.0;
    END IF;
  END IF;

  -- Calculate totals
  base := ROUND(base * mult, 2);

  extras := extras_total_for_job_tech(_job_id, _tech_id);
  extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
  final_total := ROUND(base + extras_total, 2);

  disclaimer := needs_vehicle_disclaimer(_tech_id);

  RETURN jsonb_build_object(
    'job_id', _job_id,
    'technician_id', _tech_id,
    'start_time', st,
    'end_time', st,
    'job_type', 'tourdate',
    'tour_id', tour_group,
    'title', '',
    'is_house_tech', house,
    'is_tour_team_member', team_member,
    'category', cat,
    'base_day_eur', base / GREATEST(mult, 1.0),
    'week_count', GREATEST(1, cnt),
    'multiplier', mult,
    'iso_year', y,
    'iso_week', w,
    'total_eur', base,
    'extras', extras,
    'extras_total_eur', extras_total,
    'total_with_extras_eur', final_total,
    'vehicle_disclaimer', disclaimer,
    'vehicle_disclaimer_text', CASE
      WHEN disclaimer THEN 'Fuel/drive compensation may apply when using own vehicle. Coordinate with HR on a per-job basis.'
      ELSE NULL
    END,
    'breakdown', jsonb_build_object(
      'base_calculation', jsonb_build_object(
        'base_day_eur', base / GREATEST(mult, 1.0),
        'multiplier', mult,
        'base_total_eur', base
      ),
      'extras_breakdown', extras,
      'final_total_eur', final_total
    )
  );
END;
$$;

CREATE OR REPLACE VIEW v_tour_job_rate_quotes_2025 AS
SELECT
  a.job_id,
  a.technician_id,
  j.start_time,
  j.end_time,
  j.job_type,
  j.tour_id,
  j.title,
  (q->>'is_house_tech')::boolean AS is_house_tech,
  (q->>'is_tour_team_member')::boolean AS is_tour_team_member,
  (q->>'category') AS category,
  (q->>'base_day_eur')::numeric AS base_day_eur,
  (q->>'week_count')::int AS week_count,
  (q->>'multiplier')::numeric AS multiplier,
  (q->>'iso_year')::int AS iso_year,
  (q->>'iso_week')::int AS iso_week,
  (q->>'total_eur')::numeric AS total_eur,
  (q->>'extras_total_eur')::numeric AS extras_total_eur,
  (q->>'total_with_extras_eur')::numeric AS total_with_extras_eur,
  q AS breakdown
FROM job_assignments a
JOIN jobs j ON j.id = a.job_id AND j.job_type = 'tourdate'
CROSS JOIN LATERAL compute_tour_job_rate_quote_2025(a.job_id, a.technician_id) q;
