-- Fix tour multiplier to count tour dates in the week, not per-technician assignments
-- This ensures the multiplier is based on the number of scheduled tour dates for the tour
-- in a given week, rather than counting individual technician assignments

CREATE OR REPLACE FUNCTION public.compute_tour_job_rate_quote_2025(_job_id uuid, _tech_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jtype job_type;
  st timestamptz;
  tour_group uuid;
  cat text;
  house boolean := false;
  is_autonomo boolean := true;
  autonomo_discount numeric := 0;
  base_day_before_discount numeric;
  base_after_discount numeric(10,2);
  team_member boolean := false;
  base numeric(10,2);
  mult numeric(6,3) := 1.0;
  per_job_multiplier numeric(6,3) := 1.0;
  cnt int := 1;
  y int := NULL;
  w int := NULL;
  extras jsonb;
  extras_total numeric(10,2);
  final_total numeric(10,2);
  disclaimer boolean;
  tour_date_type text := NULL;
  rehearsal_flat_rate numeric := NULL;
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

  -- Check for rehearsal tour date type
  SELECT td.tour_date_type INTO tour_date_type
  FROM tour_dates td
  JOIN jobs j ON j.tour_date_id = td.id
  WHERE j.id = _job_id
  LIMIT 1;

  -- Check if house tech and autonomo status
  SELECT
    (role = 'house_tech'),
    CASE WHEN role = 'technician' THEN COALESCE(autonomo, true) ELSE true END
  INTO house, is_autonomo
  FROM profiles
  WHERE id = _tech_id;

  -- Handle rehearsal flat rate for tour dates
  IF tour_date_type = 'rehearsal' THEN
    IF house THEN
      -- Check for custom house tech rehearsal rate
      SELECT rehearsal_day_eur INTO rehearsal_flat_rate
      FROM house_tech_rates
      WHERE profile_id = _tech_id;
    ELSE
      -- Technician rehearsal: €180 base
      rehearsal_flat_rate := 180.00;
      base_day_before_discount := 180.00;

      -- Apply autonomo discount if applicable
      IF NOT is_autonomo THEN
        autonomo_discount := 30.00;
        rehearsal_flat_rate := rehearsal_flat_rate - autonomo_discount;
      END IF;
    END IF;
  END IF;

  -- If rehearsal flat rate applies, return early
  IF rehearsal_flat_rate IS NOT NULL THEN
    extras := extras_total_for_job_tech(_job_id, _tech_id);
    extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
    final_total := ROUND(rehearsal_flat_rate + extras_total, 2);
    disclaimer := needs_vehicle_disclaimer(_tech_id);

    RETURN jsonb_build_object(
      'job_id', _job_id,
      'technician_id', _tech_id,
      'is_rehearsal_flat_rate', true,
      'rehearsal_rate_eur', ROUND(rehearsal_flat_rate, 2),
      'autonomo_discount_eur', ROUND(autonomo_discount, 2),
      'base_day_before_discount_eur', ROUND(COALESCE(base_day_before_discount, rehearsal_flat_rate), 2),
      'base_day_eur', ROUND(rehearsal_flat_rate, 2),
      'total_eur', ROUND(rehearsal_flat_rate, 2),
      'extras', extras,
      'extras_total_eur', ROUND(extras_total, 2),
      'total_with_extras_eur', ROUND(final_total, 2),
      'vehicle_disclaimer', disclaimer,
      'vehicle_disclaimer_text', CASE WHEN disclaimer THEN 'Se requiere vehículo propio' ELSE NULL END,
      'category', 'rehearsal',
      'breakdown', jsonb_build_object('notes', ARRAY['Rehearsal flat rate applied'])
    );
  END IF;

  -- Normal tour rate calculation continues...
  -- Resolve category (non-house)
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
  ELSE
    SELECT base_day_eur INTO base
    FROM rate_cards_tour_2025
    WHERE category = cat;

    IF base IS NULL THEN
      RETURN jsonb_build_object('error','tour_base_missing','category',cat);
    END IF;
  END IF;

  base_day_before_discount := base;

  -- Apply autonomo discount for non-house technicians BEFORE multipliers
  IF NOT house AND NOT is_autonomo THEN
    autonomo_discount := 30;
    base := base - autonomo_discount;
  END IF;

  base_after_discount := base;

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

  -- Multiplier logic: Count TOUR DATES in the week and check if tech is assigned to all
  SELECT iso_year, iso_week INTO y, w
  FROM iso_year_week_madrid(st);

  IF team_member THEN
    DECLARE
      total_tour_dates int;
      tech_assigned_dates int;
    BEGIN
      -- Count total tour dates for this tour in the same ISO week
      SELECT count(DISTINCT j.id) INTO total_tour_dates
      FROM jobs j
      WHERE j.job_type = 'tourdate'
        AND j.tour_id = tour_group
        AND j.status NOT IN ('cancelled', 'deleted')
        AND (SELECT iso_year FROM iso_year_week_madrid(j.start_time)) = y
        AND (SELECT iso_week FROM iso_year_week_madrid(j.start_time)) = w;

      -- Count how many of those dates this specific technician is assigned to
      SELECT count(DISTINCT j.id) INTO tech_assigned_dates
      FROM jobs j
      JOIN job_assignments a ON a.job_id = j.id
      WHERE a.technician_id = _tech_id
        AND j.job_type = 'tourdate'
        AND j.tour_id = tour_group
        AND j.status NOT IN ('cancelled', 'deleted')
        AND (SELECT iso_year FROM iso_year_week_madrid(j.start_time)) = y
        AND (SELECT iso_week FROM iso_year_week_madrid(j.start_time)) = w;

      -- Only apply multiplier if technician is assigned to ALL tour dates in the week
      IF tech_assigned_dates = total_tour_dates THEN
        cnt := total_tour_dates;

        IF cnt <= 1 THEN
          mult := 1.5;
          per_job_multiplier := 1.5;
        ELSIF cnt = 2 THEN
          mult := 2.25;
          per_job_multiplier := 1.125;
        ELSE
          mult := 1.0;
          per_job_multiplier := 1.0;
        END IF;
      ELSE
        -- Tech is not assigned to all dates, use default multiplier
        cnt := tech_assigned_dates;
        mult := 1.0;
        per_job_multiplier := 1.0;
      END IF;
    END;
  ELSE
    cnt := 1;
    mult := 1.0;
    per_job_multiplier := 1.0;
  END IF;

  -- Apply multiplier per job
  base := ROUND(base * per_job_multiplier, 2);

  extras := extras_total_for_job_tech(_job_id, _tech_id);
  extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
  final_total := ROUND(base + extras_total, 2);

  disclaimer := needs_vehicle_disclaimer(_tech_id);

  RETURN jsonb_build_object(
    'job_id', _job_id,
    'technician_id', _tech_id,
    'start_time', st,
    'job_type', jtype,
    'tour_id', tour_group,
    'is_house_tech', house,
    'is_tour_team_member', team_member,
    'category', cat,
    'base_day_eur', base,
    'autonomo_discount_eur', ROUND(autonomo_discount, 2),
    'base_day_before_discount_eur', ROUND(base_day_before_discount, 2),
    'week_count', cnt,
    'multiplier', mult,
    'per_job_multiplier', ROUND(per_job_multiplier, 3),
    'iso_year', y,
    'iso_week', w,
    'total_eur', ROUND(base, 2),
    'extras', extras,
    'extras_total_eur', ROUND(extras_total, 2),
    'total_with_extras_eur', ROUND(final_total, 2),
    'vehicle_disclaimer', disclaimer,
    'vehicle_disclaimer_text', CASE WHEN disclaimer THEN 'Se requiere vehículo propio' ELSE NULL END,
    'breakdown', jsonb_build_object(
      'base_calculation', ROUND(base_day_before_discount, 2),
      'autonomo_discount', ROUND(autonomo_discount, 2),
      'after_discount', ROUND(base_after_discount, 2),
      'multiplier', mult,
      'per_job_multiplier', ROUND(per_job_multiplier, 3),
      'final_base', ROUND(base, 2)
    )
  );
END;
$function$;
