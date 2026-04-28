-- Tour-date quotes must follow the technician's assigned dates, not the full
-- job span. For tourdate jobs those dates are encoded in active timesheets,
-- including schedule-only rows created for staffing coverage.

CREATE OR REPLACE FUNCTION public.compute_tour_job_rate_quote_2025(_job_id uuid, _tech_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  jtype job_type;
  st timestamptz;
  et timestamptz;
  job_start_date date;
  job_end_date date;
  tour_group uuid;
  tour_date_ref uuid;
  schedule_start date;
  schedule_end date;
  scheduled_days int := 1;
  rehearsal_days int := 0;
  standard_days int := 0;
  technician_override_days int := 0;
  cat text;
  house boolean := false;
  is_autonomo boolean := true;
  is_reduced_rehearsal boolean := false;
  standard_discount_per_day numeric(10,2) := 0;
  rehearsal_discount_per_day numeric(10,2) := 0;
  total_autonomo_discount numeric(10,2) := 0;
  standard_base_before_discount numeric(10,2) := 0;
  standard_after_discount numeric(10,2) := 0;
  rehearsal_base_before_discount numeric(10,2) := 0;
  team_member boolean := false;
  has_override boolean := false;
  standard_base numeric(10,2);
  standard_day_rate numeric(10,2) := 0;
  rehearsal_day_rate numeric(10,2) := 0;
  standard_total numeric(10,2) := 0;
  rehearsal_total numeric(10,2) := 0;
  total_base numeric(10,2) := 0;
  base_calculation_total numeric(10,2) := 0;
  after_discount_total numeric(10,2) := 0;
  mult numeric(6,3) := 1.0;
  per_job_multiplier numeric(6,3) := 1.0;
  display_multiplier numeric(6,3) := 1.0;
  display_per_job_multiplier numeric(6,3) := 1.0;
  cnt int := 1;
  y int := NULL;
  w int := NULL;
  extras jsonb;
  extras_total numeric(10,2);
  final_total numeric(10,2);
  disclaimer boolean;
  has_custom_standard_rate boolean := FALSE;
  has_custom_rehearsal_rate boolean := FALSE;
  has_custom_rate boolean := FALSE;
  display_category text := 'rehearsal';
  job_date_type_start date;
  job_date_type_end date;
  tour_date_start date;
  tour_date_end date;
  tour_date_legacy_date date;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT job_type, start_time, end_time, tour_id, tour_date_id
  INTO jtype, st, et, tour_group, tour_date_ref
  FROM public.jobs
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','job_not_found');
  END IF;

  IF jtype <> 'tourdate' THEN
    RETURN jsonb_build_object('error','not_tour_date');
  END IF;

  job_start_date := (st AT TIME ZONE 'Europe/Madrid')::date;
  job_end_date := COALESCE((et AT TIME ZONE 'Europe/Madrid')::date, job_start_date);

  -- job_date_types is the canonical scheduled span for payout logic because it
  -- reflects the real per-day schedule even when an older tour_dates row still
  -- points at a single legacy date.
  SELECT MIN(jdt.date), MAX(jdt.date)
  INTO job_date_type_start, job_date_type_end
  FROM public.job_date_types jdt
  WHERE jdt.job_id = _job_id;

  SELECT td.start_date, td.end_date, td.date
  INTO tour_date_start, tour_date_end, tour_date_legacy_date
  FROM public.tour_dates td
  WHERE td.id = tour_date_ref;

  schedule_start := COALESCE(
    job_date_type_start,
    tour_date_start,
    job_start_date,
    tour_date_legacy_date
  );
  schedule_end := COALESCE(
    job_date_type_end,
    tour_date_end,
    job_end_date,
    tour_date_start,
    tour_date_legacy_date,
    job_start_date
  );

  schedule_start := COALESCE(schedule_start, job_start_date);
  schedule_end := COALESCE(schedule_end, schedule_start, job_end_date, job_start_date);
  IF schedule_end < schedule_start THEN
    schedule_end := schedule_start;
  END IF;

  -- Pricing must follow the technician's active assignment dates first.
  -- This covers partial staffing on multi-day tour dates, including the
  -- schedule-only timesheets created for tour/tourdate coverage.
  WITH active_timesheet_dates AS (
    SELECT DISTINCT t.date AS payable_date
    FROM public.timesheets t
    WHERE t.job_id = _job_id
      AND t.technician_id = _tech_id
      AND COALESCE(t.is_active, TRUE)
  ),
  fallback_assignment_dates AS (
    SELECT ja.assignment_date AS payable_date
    FROM public.job_assignments ja
    WHERE ja.job_id = _job_id
      AND ja.technician_id = _tech_id
      AND COALESCE(ja.single_day, FALSE)
      AND ja.assignment_date IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM active_timesheet_dates
      )
  ),
  fallback_schedule_dates AS (
    SELECT generated_series.date_value::date AS payable_date
    FROM generate_series(schedule_start, schedule_end, INTERVAL '1 day') AS generated_series(date_value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM active_timesheet_dates
    )
      AND NOT EXISTS (
        SELECT 1
        FROM fallback_assignment_dates
      )
  ),
  payable_dates AS (
    SELECT payable_date
    FROM active_timesheet_dates
    UNION
    SELECT payable_date
    FROM fallback_assignment_dates
    UNION
    SELECT payable_date
    FROM fallback_schedule_dates
  )
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (
      WHERE COALESCE(trmd.use_rehearsal_rate, jrd.job_id IS NOT NULL)
    )::int,
    COUNT(*) FILTER (WHERE trmd.job_id IS NOT NULL)::int
  INTO scheduled_days, rehearsal_days, technician_override_days
  FROM payable_dates pd
  LEFT JOIN public.job_technician_rate_mode_dates trmd
    ON trmd.job_id = _job_id
   AND trmd.technician_id = _tech_id
   AND trmd.date = pd.payable_date
  LEFT JOIN public.job_rehearsal_dates jrd
    ON jrd.job_id = _job_id
   AND jrd.date = pd.payable_date;

  rehearsal_days := LEAST(rehearsal_days, scheduled_days);
  standard_days := GREATEST(0, scheduled_days - rehearsal_days);

  SELECT
    (role = 'house_tech'),
    CASE WHEN role = 'technician' THEN COALESCE(autonomo, true) ELSE true END,
    COALESCE(role IN ('house_tech', 'admin', 'management'), false)
  INTO house, is_autonomo, is_reduced_rehearsal
  FROM public.profiles
  WHERE id = _tech_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','profile_not_found','technician_id',_tech_id);
  END IF;

  IF tour_group IS NOT NULL THEN
    SELECT COALESCE(bool_or(ja.use_tour_multipliers), FALSE)
    INTO has_override
    FROM public.job_assignments ja
    WHERE ja.job_id = _job_id AND ja.technician_id = _tech_id;

    has_override := COALESCE(has_override, FALSE);
  END IF;

  IF tour_group IS NOT NULL THEN
    SELECT COALESCE(
      EXISTS (
        SELECT 1
        FROM public.tour_assignments ta
        WHERE ta.tour_id = tour_group
          AND ta.technician_id = _tech_id
      ) OR has_override,
      FALSE
    )
    INTO team_member;

    team_member := COALESCE(team_member, FALSE);
  END IF;

  SELECT iso_year, iso_week INTO y, w
  FROM public.iso_year_week_madrid(st);

  IF team_member THEN
    DECLARE
      total_tour_dates int;
      tech_assigned_dates int;
    BEGIN
      SELECT count(DISTINCT j.id) INTO total_tour_dates
      FROM public.jobs j
      WHERE j.job_type = 'tourdate'
        AND j.tour_id = tour_group
        AND j.status != 'Cancelado'
        AND (SELECT iso_year FROM public.iso_year_week_madrid(j.start_time)) = y
        AND (SELECT iso_week FROM public.iso_year_week_madrid(j.start_time)) = w;

      SELECT count(DISTINCT j.id) INTO tech_assigned_dates
      FROM public.jobs j
      JOIN public.job_assignments a ON a.job_id = j.id
      WHERE a.technician_id = _tech_id
        AND j.job_type = 'tourdate'
        AND j.tour_id = tour_group
        AND j.status != 'Cancelado'
        AND (SELECT iso_year FROM public.iso_year_week_madrid(j.start_time)) = y
        AND (SELECT iso_week FROM public.iso_year_week_madrid(j.start_time)) = w;

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

  IF standard_days > 0 THEN
    SELECT
      CASE
        WHEN sound_role LIKE '%-R' OR lights_role LIKE '%-R' OR video_role LIKE '%-R' THEN 'responsable'
        WHEN sound_role LIKE '%-E' OR lights_role LIKE '%-E' OR video_role LIKE '%-E' THEN 'especialista'
        WHEN sound_role LIKE '%-T' OR lights_role LIKE '%-T' OR video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END
    INTO cat
    FROM public.job_assignments
    WHERE job_id = _job_id AND technician_id = _tech_id
    ORDER BY assigned_at DESC
    LIMIT 1;

    IF cat IS NULL THEN
      SELECT default_timesheet_category INTO cat
      FROM public.profiles
      WHERE id = _tech_id AND default_timesheet_category IN ('tecnico','especialista','responsable');
    END IF;

    IF cat IS NULL THEN
      RETURN jsonb_build_object('error','category_missing','profile_id',_tech_id,'job_id',_job_id);
    END IF;

    IF cat = 'responsable' THEN
      SELECT COALESCE(
        tour_base_responsable_eur,
        base_day_responsable_eur,
        base_day_especialista_eur,
        base_day_eur
      ) INTO standard_base
      FROM public.custom_tech_rates
      WHERE profile_id = _tech_id;
    ELSIF cat = 'especialista' THEN
      SELECT COALESCE(
        tour_base_especialista_eur,
        tour_base_other_eur,
        base_day_especialista_eur,
        base_day_eur
      ) INTO standard_base
      FROM public.custom_tech_rates
      WHERE profile_id = _tech_id;
    ELSE
      SELECT COALESCE(
        tour_base_other_eur,
        base_day_eur
      ) INTO standard_base
      FROM public.custom_tech_rates
      WHERE profile_id = _tech_id;
    END IF;

    IF standard_base IS NOT NULL THEN
      has_custom_standard_rate := TRUE;
      has_custom_rate := TRUE;
    ELSE
      SELECT base_day_eur INTO standard_base
      FROM public.rate_cards_tour_2025
      WHERE category = cat;

      IF standard_base IS NULL THEN
        RETURN jsonb_build_object('error','tour_base_missing','category',cat);
      END IF;
    END IF;

    standard_base_before_discount := standard_base;

    IF NOT house AND NOT is_autonomo THEN
      standard_discount_per_day := 30.00;
      standard_base := standard_base - standard_discount_per_day;
    END IF;

    standard_after_discount := standard_base;
    standard_day_rate := ROUND(standard_base * per_job_multiplier, 2);
    standard_total := ROUND(standard_day_rate * standard_days, 2);
    display_category := cat;
  END IF;

  IF rehearsal_days > 0 THEN
    SELECT rehearsal_day_eur INTO rehearsal_day_rate
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;

    IF rehearsal_day_rate IS NOT NULL THEN
      has_custom_rehearsal_rate := TRUE;
      has_custom_rate := TRUE;
      rehearsal_base_before_discount := rehearsal_day_rate;
    ELSE
      IF is_reduced_rehearsal THEN
        rehearsal_day_rate := 60.00;
        rehearsal_base_before_discount := 60.00;
      ELSE
        rehearsal_day_rate := 180.00;
        rehearsal_base_before_discount := 180.00;
      END IF;
    END IF;

    IF NOT is_autonomo AND NOT is_reduced_rehearsal THEN
      rehearsal_discount_per_day := 30.00;
      rehearsal_day_rate := rehearsal_day_rate - rehearsal_discount_per_day;
    END IF;

    rehearsal_total := ROUND(rehearsal_day_rate * rehearsal_days, 2);

    IF standard_days = 0 THEN
      display_category := 'rehearsal';
    END IF;
  END IF;

  total_base := ROUND(standard_total + rehearsal_total, 2);
  total_autonomo_discount := ROUND(
    (standard_discount_per_day * standard_days) + (rehearsal_discount_per_day * rehearsal_days),
    2
  );
  base_calculation_total := ROUND(
    (standard_base_before_discount * standard_days) + (rehearsal_base_before_discount * rehearsal_days),
    2
  );

  IF rehearsal_days > 0 THEN
    display_multiplier := 1.0;
    display_per_job_multiplier := 1.0;
    after_discount_total := total_base;
  ELSE
    display_multiplier := mult;
    display_per_job_multiplier := per_job_multiplier;
    after_discount_total := ROUND(standard_after_discount * standard_days, 2);
  END IF;

  extras := public.extras_total_for_job_tech(_job_id, _tech_id);
  extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
  final_total := ROUND(total_base + extras_total, 2);

  disclaimer := public.needs_vehicle_disclaimer(_tech_id);

  RETURN jsonb_build_object(
    'job_id', _job_id,
    'technician_id', _tech_id,
    'start_time', st,
    'job_type', jtype,
    'tour_id', tour_group,
    'is_house_tech', house,
    'is_tour_team_member', team_member,
    'use_tour_multipliers', has_override,
    'category', display_category,
    'base_day_eur', total_base,
    'has_custom_rate', has_custom_rate,
    'autonomo_discount_eur', total_autonomo_discount,
    'base_day_before_discount_eur', base_calculation_total,
    'week_count', cnt,
    'multiplier', ROUND(display_multiplier, 3),
    'per_job_multiplier', ROUND(display_per_job_multiplier, 3),
    'iso_year', y,
    'iso_week', w,
    'total_eur', total_base,
    'extras', extras,
    'extras_total_eur', ROUND(extras_total, 2),
    'total_with_extras_eur', final_total,
    'vehicle_disclaimer', disclaimer,
    'vehicle_disclaimer_text', CASE WHEN disclaimer THEN 'Se requiere vehículo propio' ELSE NULL END,
    'breakdown', jsonb_build_object(
      'base_calculation', base_calculation_total,
      'autonomo_discount', total_autonomo_discount,
      'after_discount', after_discount_total,
      'multiplier', ROUND(display_multiplier, 3),
      'per_job_multiplier', ROUND(display_per_job_multiplier, 3),
      'final_base', total_base,
      'has_custom_rate', has_custom_rate,
      'has_custom_standard_rate', has_custom_standard_rate,
      'has_custom_rehearsal_rate', has_custom_rehearsal_rate,
      'scheduled_days', scheduled_days,
      'rehearsal_days', rehearsal_days,
      'standard_days', standard_days,
      'technician_override_days', technician_override_days,
      'rehearsal_rate_eur', CASE WHEN rehearsal_days > 0 THEN rehearsal_day_rate ELSE NULL END,
      'standard_day_rate_eur', CASE WHEN standard_days > 0 THEN standard_day_rate ELSE NULL END,
      'forced_rehearsal_rate', (rehearsal_days > 0)
    )
  );
END;
$function$;

COMMENT ON FUNCTION public.compute_tour_job_rate_quote_2025(uuid,uuid) IS
  'Calculates tour job rate quotes for technicians. Rehearsal pricing precedence is technician/date overrides in job_technician_rate_mode_dates, then job_rehearsal_dates. The quote derives its multi-day span from job_date_types first, but counts payable days from the technician''s active timesheets before falling back to legacy assignment metadata or the job span.';
