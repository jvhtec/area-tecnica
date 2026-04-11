-- Make job_rehearsal_dates the sole source of truth for rehearsal pricing.
-- Preserve current live behavior by backfilling existing rehearsal tour dates
-- before removing tour_date_type as a pricing trigger.

INSERT INTO public.job_rehearsal_dates (job_id, date)
SELECT
  seeded.job_id,
  seeded.date
FROM (
  SELECT
    j.id AS job_id,
    scheduled_date::date AS date
  FROM public.jobs j
  JOIN public.tour_dates td
    ON td.id = j.tour_date_id
  CROSS JOIN LATERAL generate_series(
    COALESCE(td.start_date, td.date),
    COALESCE(td.end_date, td.start_date, td.date),
    INTERVAL '1 day'
  ) AS scheduled_date
  WHERE j.job_type = 'tourdate'
    AND td.tour_date_type = 'rehearsal'

  UNION

  -- Historical rehearsal pricing was also driven by tour_date_type, even when
  -- persisted timesheet dates drifted outside the scheduled tour-date range.
  -- Seed those dates too so existing payouts do not silently change on deploy.
  SELECT
    t.job_id,
    t.date
  FROM public.timesheets t
  JOIN public.jobs j
    ON j.id = t.job_id
  JOIN public.tour_dates td
    ON td.id = j.tour_date_id
  WHERE j.job_type = 'tourdate'
    AND td.tour_date_type = 'rehearsal'
    AND t.date IS NOT NULL
) AS seeded
ON CONFLICT (job_id, date) DO NOTHING;

CREATE OR REPLACE FUNCTION public.compute_timesheet_amount_2025(
  _timesheet_id uuid,
  _persist boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_timesheet RECORD;
  v_job_type TEXT;
  v_category TEXT;
  v_rate_card RECORD;
  v_worked_hours NUMERIC;
  v_raw_worked_hours NUMERIC;
  v_billable_hours NUMERIC;
  v_base_day_amount NUMERIC := 0;
  v_plus_10_12_hours NUMERIC := 0;
  v_plus_10_12_amount NUMERIC := 0;
  v_overtime_hours NUMERIC := 0;
  v_overtime_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_breakdown JSONB;
  v_result JSONB;
  v_is_rehearsal BOOLEAN := FALSE;
  v_is_extended_shift BOOLEAN := FALSE;
  v_rehearsal_flat_rate NUMERIC := NULL;
  v_is_autonomo BOOLEAN := TRUE;
  v_is_house_tech BOOLEAN := FALSE;
  v_is_reduced_rehearsal BOOLEAN := FALSE;
  v_autonomo_discount NUMERIC := 0;
  v_forced_rehearsal BOOLEAN := FALSE;
BEGIN
  -- Fetch timesheet with job info, category, autonomo status, and role-based flags
  SELECT
    t.*,
    j.job_type,
    CASE WHEN p.role = 'technician' THEN COALESCE(p.autonomo, true) ELSE true END as is_autonomo,
    COALESCE(p.role = 'house_tech', false) as is_house_tech,
    COALESCE(p.role IN ('house_tech', 'admin', 'management'), false) as is_reduced_rehearsal,
    COALESCE(
      t.category,
      CASE
        WHEN a.sound_role LIKE '%-R' OR a.lights_role LIKE '%-R' OR a.video_role LIKE '%-R' THEN 'responsable'
        WHEN a.sound_role LIKE '%-E' OR a.lights_role LIKE '%-E' OR a.video_role LIKE '%-E' THEN 'especialista'
        WHEN a.sound_role LIKE '%-T' OR a.lights_role LIKE '%-T' OR a.video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END,
      'tecnico'
    ) as category
  INTO v_timesheet
  FROM public.timesheets t
  LEFT JOIN public.jobs j ON t.job_id = j.id
  LEFT JOIN public.job_assignments a ON t.job_id = a.job_id AND t.technician_id = a.technician_id
  LEFT JOIN public.profiles p ON t.technician_id = p.id
  WHERE t.id = _timesheet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timesheet not found: %', _timesheet_id;
  END IF;

  IF NOT (
    auth.role() = 'service_role'
    OR public.is_admin_or_management()
    OR auth.uid() = v_timesheet.technician_id
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  v_job_type := v_timesheet.job_type;
  v_category := v_timesheet.category;

  -- Rehearsal pricing now depends only on the per-date toggle table.
  IF v_timesheet.date IS NOT NULL AND v_timesheet.job_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.job_rehearsal_dates
      WHERE job_id = v_timesheet.job_id AND date = v_timesheet.date
    ) INTO v_forced_rehearsal;
  END IF;

  v_is_rehearsal := v_forced_rehearsal;

  -- Get autonomo / house_tech / reduced rehearsal status from the main query
  v_is_autonomo := v_timesheet.is_autonomo;
  v_is_house_tech := v_timesheet.is_house_tech;
  v_is_reduced_rehearsal := v_timesheet.is_reduced_rehearsal;

  -- Calculate worked hours once for both rehearsal and standard paths
  IF v_timesheet.end_time < v_timesheet.start_time OR COALESCE(v_timesheet.ends_next_day, false) THEN
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time + INTERVAL '24 hours'
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  ELSE
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  END IF;
  -- Preserve raw fractional hours for audit trail, then round to nearest whole hour
  -- IMPORTANT: Do NOT change this to half-hour rounding (ROUND(x*2)/2). See PR #467.
  v_raw_worked_hours := v_worked_hours;
  v_worked_hours := ROUND(v_worked_hours);

  -- Handle rehearsal flat rate
  IF v_is_rehearsal THEN
    -- Check for custom rehearsal rate first
    SELECT rehearsal_day_eur INTO v_rehearsal_flat_rate
    FROM public.custom_tech_rates
    WHERE profile_id = v_timesheet.technician_id;

    -- If no custom rate, use role-based defaults:
    -- house_tech / admin / management -> EUR 60, regular technicians -> EUR 180
    IF v_rehearsal_flat_rate IS NULL THEN
      IF v_is_reduced_rehearsal THEN
        v_rehearsal_flat_rate := 60.00;
      ELSE
        v_rehearsal_flat_rate := 180.00;
      END IF;
    END IF;

    -- Apply discount for non-autonomo regular technicians only.
    -- House techs, admin, and management are exempt from the autonomo discount.
    IF NOT v_is_autonomo AND NOT v_is_reduced_rehearsal THEN
      v_autonomo_discount := 30.00;
      v_rehearsal_flat_rate := v_rehearsal_flat_rate - v_autonomo_discount;
    END IF;

    v_total_amount := v_rehearsal_flat_rate;
    v_billable_hours := v_worked_hours;
    v_base_day_amount := v_rehearsal_flat_rate;

    v_breakdown := jsonb_build_object(
      'worked_hours', v_raw_worked_hours,
      'worked_hours_rounded', v_worked_hours,
      'hours_rounded', v_worked_hours,
      'billable_hours', v_billable_hours,
      'is_rehearsal', true,
      'is_rehearsal_flat_rate', true,
      'rehearsal_rate_eur', v_rehearsal_flat_rate,
      'autonomo_discount_eur', v_autonomo_discount,
      'base_day_before_discount_eur', CASE WHEN v_autonomo_discount > 0 THEN v_rehearsal_flat_rate + v_autonomo_discount ELSE v_rehearsal_flat_rate END,
      'base_amount_eur', v_rehearsal_flat_rate,
      'base_day_eur', v_rehearsal_flat_rate,
      'plus_10_12_hours', 0,
      'plus_10_12_eur', 0,
      'plus_10_12_amount_eur', 0,
      'overtime_hours', 0,
      'overtime_hour_eur', 0,
      'overtime_amount_eur', 0,
      'total_eur', v_total_amount,
      'category', 'rehearsal',
      'forced_rehearsal_rate', v_forced_rehearsal
    );

    v_result := jsonb_build_object(
      'timesheet_id', _timesheet_id,
      'amount_eur', v_total_amount,
      'amount_breakdown', v_breakdown
    );

    IF _persist THEN
      UPDATE public.timesheets
      SET
        amount_eur = v_total_amount,
        amount_breakdown = v_breakdown,
        category = v_category,
        updated_at = NOW()
      WHERE id = _timesheet_id;
    END IF;

    RETURN v_result;
  END IF;

  -- Standard rate card lookup (non-rehearsal).
  -- House-tech OT is category-aware; non-house roles preserve legacy behavior.
  SELECT
    COALESCE(
      CASE
        WHEN v_category = 'responsable' THEN COALESCE(ctr.base_day_responsable_eur, ctr.base_day_especialista_eur, ctr.base_day_eur)
        WHEN v_category = 'especialista' THEN COALESCE(ctr.base_day_especialista_eur, ctr.base_day_eur)
        ELSE ctr.base_day_eur
      END,
      (SELECT rc.base_day_eur FROM public.rate_cards_2025 rc WHERE rc.category = v_category)
    ) AS base_day_eur,
    COALESCE(ctr.plus_10_12_eur, (SELECT rc.plus_10_12_eur FROM public.rate_cards_2025 rc WHERE rc.category = v_category)) as plus_10_12_eur,
    COALESCE(
      CASE
        WHEN v_is_house_tech AND v_category = 'tecnico' THEN ctr.overtime_hour_eur
        WHEN v_is_house_tech AND v_category = 'especialista' THEN COALESCE(ctr.overtime_hour_especialista_eur, ctr.overtime_hour_eur)
        WHEN v_is_house_tech AND v_category = 'responsable' THEN COALESCE(
          ctr.overtime_hour_responsable_eur,
          CASE WHEN ctr.overtime_hour_eur = 15.00 THEN 20.00 END,
          ctr.overtime_hour_eur
        )
        ELSE ctr.overtime_hour_eur
      END,
      (SELECT rc.overtime_hour_eur FROM public.rate_cards_2025 rc WHERE rc.category = v_category)
    ) as overtime_hour_eur
  INTO v_rate_card
  FROM public.custom_tech_rates ctr
  WHERE ctr.profile_id = v_timesheet.technician_id;

  IF NOT FOUND THEN
    SELECT * INTO v_rate_card
    FROM public.rate_cards_2025
    WHERE category = v_category;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rate card not found for category: %', v_category;
    END IF;
  END IF;

  -- Handle evento jobs (fixed 12-hour rate)
  IF v_job_type = 'evento' THEN
    v_billable_hours := 12.0;
    v_base_day_amount := v_rate_card.base_day_eur;
    v_plus_10_12_hours := 0;
    v_plus_10_12_amount := v_rate_card.plus_10_12_eur;
    v_overtime_hours := 0;
    v_overtime_amount := 0;
    v_total_amount := v_base_day_amount + v_plus_10_12_amount;
  -- Handle extended shifts (21+ hours / over 20.5 hrs): double base rate only
  ELSIF v_worked_hours > 20.5 THEN
    v_is_extended_shift := TRUE;
    v_billable_hours := v_worked_hours;
    v_base_day_amount := v_rate_card.base_day_eur * 2;
    v_plus_10_12_hours := 0;
    v_plus_10_12_amount := 0;
    v_overtime_hours := 0;
    v_overtime_amount := 0;
    v_total_amount := v_base_day_amount;
  ELSE
    -- Standard rate calculation tiers
    v_billable_hours := v_worked_hours;
    v_base_day_amount := v_rate_card.base_day_eur;

    IF v_worked_hours <= 10.5 THEN
      v_total_amount := v_base_day_amount;
    ELSIF v_worked_hours <= 12.5 THEN
      v_plus_10_12_hours := 0;
      v_plus_10_12_amount := v_rate_card.plus_10_12_eur;
      v_total_amount := v_base_day_amount + v_plus_10_12_amount;
    ELSE
      v_plus_10_12_hours := 0;
      v_plus_10_12_amount := v_rate_card.plus_10_12_eur;

      v_overtime_hours := v_worked_hours - 12;

      v_overtime_amount := v_rate_card.overtime_hour_eur * v_overtime_hours;
      v_total_amount := v_base_day_amount + v_plus_10_12_amount + v_overtime_amount;
    END IF;
  END IF;

  v_breakdown := jsonb_build_object(
    'worked_hours', v_raw_worked_hours,
    'worked_hours_rounded', v_worked_hours,
    'hours_rounded', v_worked_hours,
    'billable_hours', v_billable_hours,
    'is_evento', (v_job_type = 'evento'),
    'is_extended_shift', v_is_extended_shift,
    'is_double_base_rate', v_is_extended_shift,
    'base_amount_eur', COALESCE(v_base_day_amount, 0),
    'base_day_eur', COALESCE(v_base_day_amount, 0),
    'single_base_day_eur', CASE WHEN v_is_extended_shift THEN v_rate_card.base_day_eur ELSE v_base_day_amount END,
    'plus_10_12_hours', COALESCE(v_plus_10_12_hours, 0),
    'plus_10_12_eur', v_rate_card.plus_10_12_eur,
    'plus_10_12_amount_eur', COALESCE(v_plus_10_12_amount, 0),
    'overtime_hours', COALESCE(v_overtime_hours, 0),
    'overtime_hour_eur', v_rate_card.overtime_hour_eur,
    'overtime_amount_eur', COALESCE(v_overtime_amount, 0),
    'total_eur', v_total_amount,
    'category', v_category
  );

  v_result := jsonb_build_object(
    'timesheet_id', _timesheet_id,
    'amount_eur', v_total_amount,
    'amount_breakdown', v_breakdown
  );

  IF _persist THEN
    UPDATE public.timesheets
    SET
      amount_eur = v_total_amount,
      amount_breakdown = v_breakdown,
      category = v_category,
      updated_at = NOW()
    WHERE id = _timesheet_id;
  END IF;

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.compute_timesheet_amount_2025(uuid,boolean) IS
  'Calculates timesheet amounts based on rate cards. Hours rounded to nearest whole number (not half hour). Rehearsal flat rate: EUR 60 for house_tech/admin/management roles, EUR 180 for regular technicians. Rehearsal pricing is triggered only by matching rows in job_rehearsal_dates. House-tech overtime is category-aware: tecnico uses overtime_hour_eur, especialista uses overtime_hour_especialista_eur fallback to overtime_hour_eur, responsable uses overtime_hour_responsable_eur fallback (including 15->20 rule) then overtime_hour_eur.';

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
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  -- Fetch job info
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

  SELECT
    COALESCE(td.start_date, td.date, job_start_date),
    COALESCE(td.end_date, td.start_date, td.date, job_end_date, job_start_date)
  INTO schedule_start, schedule_end
  FROM public.tour_dates td
  WHERE td.id = tour_date_ref;

  schedule_start := COALESCE(schedule_start, job_start_date);
  schedule_end := COALESCE(schedule_end, schedule_start, job_end_date, job_start_date);
  IF schedule_end < schedule_start THEN
    schedule_end := schedule_start;
  END IF;

  scheduled_days := GREATEST(1, (schedule_end - schedule_start) + 1);

  SELECT count(*)
  INTO rehearsal_days
  FROM public.job_rehearsal_dates
  WHERE job_id = _job_id
    AND date BETWEEN schedule_start AND schedule_end;

  rehearsal_days := LEAST(rehearsal_days, scheduled_days);
  standard_days := scheduled_days - rehearsal_days;

  -- Check house tech, autonomo status, and reduced-rehearsal role
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
    SELECT COALESCE(ja.use_tour_multipliers, FALSE)
    INTO has_override
    FROM public.job_assignments ja
    WHERE ja.job_id = _job_id AND ja.technician_id = _tech_id;
  END IF;

  IF tour_group IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.tour_assignments ta
      WHERE ta.tour_id = tour_group
        AND ta.technician_id = _tech_id
    ) OR has_override
    INTO team_member;
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

        -- Full-week tour team multiplier tiers: 1 date=1.5x, 2 dates=2.25x total,
        -- 3+ dates use baseline 1.0x to avoid over-scaling longer runs.
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
    -- Resolve category for everyone when any standard day remains.
    SELECT
      CASE
        WHEN sound_role LIKE '%-R' OR lights_role LIKE '%-R' OR video_role LIKE '%-R' THEN 'responsable'
        WHEN sound_role LIKE '%-E' OR lights_role LIKE '%-E' OR video_role LIKE '%-E' THEN 'especialista'
        WHEN sound_role LIKE '%-T' OR lights_role LIKE '%-T' OR video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END
    INTO cat
    FROM public.job_assignments
    WHERE job_id = _job_id AND technician_id = _tech_id;

    IF cat IS NULL THEN
      SELECT default_timesheet_category INTO cat
      FROM public.profiles
      WHERE id = _tech_id AND default_timesheet_category IN ('tecnico','especialista','responsable');
    END IF;

    IF cat IS NULL THEN
      RETURN jsonb_build_object('error','category_missing','profile_id',_tech_id,'job_id',_job_id);
    END IF;

    -- Base rate lookup - custom_tech_rates for all technicians (category-aware)
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
    -- Mixed and full-rehearsal jobs already return an aggregated base total from SQL.
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
      'rehearsal_rate_eur', CASE WHEN rehearsal_days > 0 THEN rehearsal_day_rate ELSE NULL END,
      'standard_day_rate_eur', CASE WHEN standard_days > 0 THEN standard_day_rate ELSE NULL END,
      'forced_rehearsal_rate', (rehearsal_days > 0)
    )
  );
END;
$function$;

COMMENT ON FUNCTION public.compute_tour_job_rate_quote_2025(uuid,uuid) IS
  'Calculates tour job rate quotes for technicians. job_rehearsal_dates is the only rehearsal-rate trigger. The quote aggregates rehearsal and standard days across the full scheduled tour-date range, preserving manual payout overrides in downstream consumers.';
