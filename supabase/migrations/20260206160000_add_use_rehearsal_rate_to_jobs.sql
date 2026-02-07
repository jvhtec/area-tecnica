-- Allow admin/management users to force rehearsal flat rate on specific dates
-- of any job type, not just tour dates with tour_date_type = 'rehearsal'.
--
-- Uses a per-date model: job_rehearsal_dates stores (job_id, date) pairs.
-- Both RPC functions check this table in addition to the existing
-- tour_date_type = 'rehearsal' trigger.

-- 1. Create per-date rehearsal rate table
CREATE TABLE IF NOT EXISTS public.job_rehearsal_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE(job_id, date)
);

CREATE INDEX IF NOT EXISTS idx_job_rehearsal_dates_job
  ON public.job_rehearsal_dates(job_id);

ALTER TABLE public.job_rehearsal_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_rehearsal_dates_select"
  ON public.job_rehearsal_dates FOR SELECT TO authenticated USING (true);

CREATE POLICY "job_rehearsal_dates_insert"
  ON public.job_rehearsal_dates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_management());

CREATE POLICY "job_rehearsal_dates_delete"
  ON public.job_rehearsal_dates FOR DELETE TO authenticated
  USING (public.is_admin_or_management());

COMMENT ON TABLE public.job_rehearsal_dates IS
  'Per-date overrides that force rehearsal flat rate on specific dates of any job.';

-- 2. Update compute_timesheet_amount_2025 — check job_rehearsal_dates per timesheet date
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
  v_billable_hours NUMERIC;
  v_base_day_amount NUMERIC := 0;
  v_plus_10_12_hours NUMERIC := 0;
  v_plus_10_12_amount NUMERIC := 0;
  v_overtime_hours NUMERIC := 0;
  v_overtime_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_breakdown JSONB;
  v_result JSONB;
  v_tour_date_type TEXT := NULL;
  v_is_rehearsal BOOLEAN := FALSE;
  v_is_extended_shift BOOLEAN := FALSE;
  v_rehearsal_flat_rate NUMERIC := NULL;
  v_is_autonomo BOOLEAN := TRUE;
  v_is_house_tech BOOLEAN := FALSE;
  v_autonomo_discount NUMERIC := 0;
  v_forced_rehearsal BOOLEAN := FALSE;
BEGIN
  -- Fetch timesheet with job info, category, and autonomo status
  SELECT
    t.*,
    j.job_type,
    j.tour_date_id,
    COALESCE(p.autonomo, true) as is_autonomo,
    COALESCE(p.role = 'house_tech', false) as is_house_tech,
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

  -- Check if this specific date is marked as rehearsal via job_rehearsal_dates
  IF v_timesheet.date IS NOT NULL AND v_timesheet.job_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.job_rehearsal_dates
      WHERE job_id = v_timesheet.job_id AND date = v_timesheet.date
    ) INTO v_forced_rehearsal;
  END IF;

  -- Check if job is a rehearsal (via forced override, or tour_date_type)
  IF v_forced_rehearsal THEN
    v_is_rehearsal := TRUE;
  ELSIF v_timesheet.tour_date_id IS NOT NULL THEN
    SELECT td.tour_date_type INTO v_tour_date_type
    FROM public.tour_dates td
    WHERE td.id = v_timesheet.tour_date_id;

    IF v_tour_date_type = 'rehearsal' THEN
      v_is_rehearsal := TRUE;
    END IF;
  END IF;

  -- Get autonomo status from the main query
  v_is_autonomo := v_timesheet.is_autonomo;
  v_is_house_tech := v_timesheet.is_house_tech;

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
  v_worked_hours := ROUND(v_worked_hours * 2) / 2.0;

  -- Handle rehearsal flat rate
  IF v_is_rehearsal THEN
    -- Check for custom rehearsal rate first
    SELECT rehearsal_day_eur INTO v_rehearsal_flat_rate
    FROM public.custom_tech_rates
    WHERE profile_id = v_timesheet.technician_id;

    -- If no custom rate, use default €180
    IF v_rehearsal_flat_rate IS NULL THEN
      v_rehearsal_flat_rate := 180.00;
    END IF;

    -- Apply discount for non-autonomo non-house technicians.
    IF NOT v_is_autonomo AND NOT v_is_house_tech THEN
      v_autonomo_discount := 30.00;
      v_rehearsal_flat_rate := v_rehearsal_flat_rate - v_autonomo_discount;
    END IF;

    v_total_amount := v_rehearsal_flat_rate;
    v_billable_hours := v_worked_hours;
    v_base_day_amount := v_rehearsal_flat_rate;

    v_breakdown := jsonb_build_object(
      'worked_hours', v_worked_hours,
      'worked_hours_rounded', v_worked_hours,
      'hours_rounded', v_worked_hours,
      'billable_hours', v_billable_hours,
      'is_rehearsal', true,
      'is_rehearsal_flat_rate', true,
      'rehearsal_rate_eur', v_rehearsal_flat_rate,
      'autonomo_discount_eur', v_autonomo_discount,
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

  -- Standard rate card lookup (non-rehearsal)
  SELECT
    COALESCE(
      CASE
        WHEN v_category = 'responsable' THEN COALESCE(base_day_responsable_eur, base_day_especialista_eur, base_day_eur)
        WHEN v_category = 'especialista' THEN COALESCE(base_day_especialista_eur, base_day_eur)
        ELSE base_day_eur
      END,
      (SELECT rc.base_day_eur FROM public.rate_cards_2025 rc WHERE rc.category = v_category)
    ) AS base_day_eur,
    COALESCE(plus_10_12_eur, (SELECT rc.plus_10_12_eur FROM public.rate_cards_2025 rc WHERE rc.category = v_category)) as plus_10_12_eur,
    COALESCE(overtime_hour_eur, (SELECT rc.overtime_hour_eur FROM public.rate_cards_2025 rc WHERE rc.category = v_category)) as overtime_hour_eur
  INTO v_rate_card
  FROM public.custom_tech_rates
  WHERE profile_id = v_timesheet.technician_id;

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

      v_overtime_hours := v_worked_hours - 12.5;
      v_overtime_hours := CEILING(v_overtime_hours);

      v_overtime_amount := v_rate_card.overtime_hour_eur * v_overtime_hours;
      v_total_amount := v_base_day_amount + v_plus_10_12_amount + v_overtime_amount;
    END IF;
  END IF;

  v_breakdown := jsonb_build_object(
    'worked_hours', v_worked_hours,
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
  'Calculates timesheet amounts based on rate cards. Rehearsal flat €180 rate triggered by tour_date_type=rehearsal OR a matching row in job_rehearsal_dates for the timesheet date. Extended shifts >20.5h use double base rate. Checks custom_tech_rates first, falls back to rate_cards_2025.';

-- 3. Update compute_tour_job_rate_quote_2025 — check job_rehearsal_dates for the job start date
CREATE OR REPLACE FUNCTION public.compute_tour_job_rate_quote_2025(_job_id uuid, _tech_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  jtype job_type;
  st timestamptz;
  job_start_date date;
  tour_group uuid;
  cat text;
  house boolean := false;
  is_autonomo boolean := true;
  autonomo_discount numeric := 0;
  base_day_before_discount numeric;
  base_after_discount numeric(10,2);
  team_member boolean := false;
  has_override boolean := false;
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
  has_custom_rate boolean := FALSE;
  v_forced_rehearsal boolean := FALSE;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.is_admin_or_management()) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = '42501';
  END IF;

  -- Fetch job info
  SELECT job_type, start_time, tour_id
  INTO jtype, st, tour_group
  FROM public.jobs
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','job_not_found');
  END IF;
  IF jtype <> 'tourdate' THEN
    RETURN jsonb_build_object('error','not_tour_date');
  END IF;

  job_start_date := (st AT TIME ZONE 'Europe/Madrid')::date;

  -- Check for rehearsal tour date type
  SELECT td.tour_date_type INTO tour_date_type
  FROM public.tour_dates td
  JOIN public.jobs j ON j.tour_date_id = td.id
  WHERE j.id = _job_id
  LIMIT 1;

  -- Check if this job start date is forced as rehearsal via job_rehearsal_dates
  SELECT EXISTS (
    SELECT 1 FROM public.job_rehearsal_dates
    WHERE job_id = _job_id
      AND date = job_start_date
  ) INTO v_forced_rehearsal;

  -- Check if house tech and autonomo status
  SELECT
    (role = 'house_tech'),
    CASE WHEN role = 'technician' THEN COALESCE(autonomo, true) ELSE true END
  INTO house, is_autonomo
  FROM public.profiles
  WHERE id = _tech_id;

  -- Handle rehearsal flat rate for tour dates
  -- Triggered by tour_date_type = 'rehearsal' OR presence in job_rehearsal_dates
  IF tour_date_type = 'rehearsal' OR v_forced_rehearsal THEN
    -- Check for custom rehearsal rate (works for both house_tech and technician roles)
    SELECT rehearsal_day_eur INTO rehearsal_flat_rate
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;

    -- If no custom rate, use defaults
    IF rehearsal_flat_rate IS NULL THEN
      rehearsal_flat_rate := 180.00;
      base_day_before_discount := 180.00;

      IF NOT is_autonomo AND NOT house THEN
        autonomo_discount := 30.00;
        rehearsal_flat_rate := rehearsal_flat_rate - autonomo_discount;
      END IF;
    ELSE
      base_day_before_discount := rehearsal_flat_rate;
      IF NOT is_autonomo AND NOT house THEN
        autonomo_discount := 30.00;
        rehearsal_flat_rate := rehearsal_flat_rate - autonomo_discount;
      END IF;
    END IF;
  END IF;

  -- If rehearsal flat rate applies, return early
  IF rehearsal_flat_rate IS NOT NULL THEN
    extras := public.extras_total_for_job_tech(_job_id, _tech_id);
    extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
    final_total := ROUND(rehearsal_flat_rate + extras_total, 2);
    disclaimer := public.needs_vehicle_disclaimer(_tech_id);

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
      'forced_rehearsal_rate', v_forced_rehearsal,
      'breakdown', jsonb_build_object('notes', ARRAY['Rehearsal flat rate applied'])
    );
  END IF;

  -- Resolve category for everyone (for rate selection)
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
    ) INTO base
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;
  ELSIF cat = 'especialista' THEN
    SELECT COALESCE(
      tour_base_especialista_eur,
      tour_base_other_eur,
      base_day_especialista_eur,
      base_day_eur
    ) INTO base
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;
  ELSE
    SELECT COALESCE(
      tour_base_other_eur,
      base_day_eur
    ) INTO base
    FROM public.custom_tech_rates
    WHERE profile_id = _tech_id;
  END IF;

  IF base IS NOT NULL THEN
    has_custom_rate := TRUE;
  ELSE
    SELECT base_day_eur INTO base
    FROM public.rate_cards_tour_2025
    WHERE category = cat;

    IF base IS NULL THEN
      RETURN jsonb_build_object('error','tour_base_missing','category',cat);
    END IF;
  END IF;

  base_day_before_discount := base;

  IF NOT house AND NOT is_autonomo THEN
    autonomo_discount := 30;
    base := base - autonomo_discount;
  END IF;

  base_after_discount := base;

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

  base := ROUND(base * per_job_multiplier, 2);

  extras := public.extras_total_for_job_tech(_job_id, _tech_id);
  extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
  final_total := ROUND(base + extras_total, 2);

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
    'category', cat,
    'base_day_eur', base,
    'has_custom_rate', has_custom_rate,
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
      'final_base', ROUND(base, 2),
      'has_custom_rate', has_custom_rate
    )
  );
END;
$function$;

COMMENT ON FUNCTION public.compute_tour_job_rate_quote_2025(uuid,uuid) IS
  'Calculates tour job rate quotes for technicians. Rehearsal flat rate via tour_date_type=rehearsal OR job_rehearsal_dates table. Checks custom_tech_rates first (category-aware), then falls back to rate_cards_tour_2025.';
