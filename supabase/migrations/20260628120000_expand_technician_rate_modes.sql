-- Expand the admin-only per-technician/per-date pricing exceptions beyond the
-- original rehearsal/standard boolean. Adds a richer `rate_mode` plus an
-- optional `fixed_amount_eur`, and teaches both pricing engines about the new
-- modes:
--   * rehearsal        -> rehearsal flat rate (unchanged)
--   * standard         -> standard day/hours rate (unchanged default)
--   * tour_multipliers -> force tour multipliers for this tech+date even when
--                         the technician is not a full-week tour-team member
--   * no_multipliers   -> force the plain base day rate (multiplier = 1.0)
--   * hourly           -> price the date from the technician timesheet's
--                         worked-hours amount instead of the flat tour day rate
--   * fixed            -> use a custom fixed EUR amount for the tech+date
--
-- Absence of a row still means "inherit the job-wide rehearsal toggle".
-- `use_rehearsal_rate` is kept (and maintained = rate_mode = 'rehearsal') so any
-- not-yet-updated reader keeps working.

-- ---------------------------------------------------------------------------
-- Part A — schema
-- ---------------------------------------------------------------------------

ALTER TABLE public.job_technician_rate_mode_dates
  ADD COLUMN IF NOT EXISTS rate_mode text,
  ADD COLUMN IF NOT EXISTS fixed_amount_eur numeric(10,2);

-- Backfill existing rows from the legacy boolean.
UPDATE public.job_technician_rate_mode_dates
SET rate_mode = CASE WHEN use_rehearsal_rate THEN 'rehearsal' ELSE 'standard' END
WHERE rate_mode IS NULL;

ALTER TABLE public.job_technician_rate_mode_dates
  ALTER COLUMN rate_mode SET DEFAULT 'standard',
  ALTER COLUMN rate_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_technician_rate_mode_dates_rate_mode_check'
  ) THEN
    ALTER TABLE public.job_technician_rate_mode_dates
      ADD CONSTRAINT job_technician_rate_mode_dates_rate_mode_check
      CHECK (rate_mode IN ('rehearsal','standard','tour_multipliers','no_multipliers','hourly','fixed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_technician_rate_mode_dates_fixed_amount_check'
  ) THEN
    ALTER TABLE public.job_technician_rate_mode_dates
      ADD CONSTRAINT job_technician_rate_mode_dates_fixed_amount_check
      CHECK (rate_mode <> 'fixed' OR (fixed_amount_eur IS NOT NULL AND fixed_amount_eur >= 0));
  END IF;
END
$$;

COMMENT ON COLUMN public.job_technician_rate_mode_dates.rate_mode IS
  'Pricing mode for this technician/date exception: rehearsal, standard, tour_multipliers, no_multipliers, hourly, fixed. Missing row = inherit job-wide rehearsal toggle.';
COMMENT ON COLUMN public.job_technician_rate_mode_dates.fixed_amount_eur IS
  'Custom fixed EUR amount applied when rate_mode = fixed.';

-- ---------------------------------------------------------------------------
-- Part B — compute_timesheet_amount_2025 (standard jobs + all timesheet pricing)
-- Adds the `fixed` short-circuit and reads rate_mode for the rehearsal decision.
-- ---------------------------------------------------------------------------

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
  v_technician_rate_mode_override BOOLEAN := NULL;
  v_has_technician_rate_mode_override BOOLEAN := FALSE;
  v_rate_mode_source TEXT := 'standard';
  v_rate_mode TEXT := NULL;
  v_fixed_amount NUMERIC := NULL;
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

  -- Rehearsal/fixed pricing uses technician/date overrides first, then the
  -- job-wide rehearsal toggle table.
  IF v_timesheet.date IS NOT NULL AND v_timesheet.job_id IS NOT NULL THEN
    SELECT trmd.use_rehearsal_rate, trmd.rate_mode, trmd.fixed_amount_eur
    INTO v_technician_rate_mode_override, v_rate_mode, v_fixed_amount
    FROM public.job_technician_rate_mode_dates trmd
    WHERE trmd.job_id = v_timesheet.job_id
      AND trmd.technician_id = v_timesheet.technician_id
      AND trmd.date = v_timesheet.date;

    IF FOUND THEN
      v_has_technician_rate_mode_override := TRUE;
      v_forced_rehearsal := COALESCE(v_rate_mode = 'rehearsal', v_technician_rate_mode_override, FALSE);
      v_rate_mode_source := 'technician_override';
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.job_rehearsal_dates
        WHERE job_id = v_timesheet.job_id AND date = v_timesheet.date
      ) INTO v_forced_rehearsal;

      v_rate_mode_source := CASE
        WHEN v_forced_rehearsal THEN 'job_rehearsal_date'
        ELSE 'standard'
      END;
    END IF;
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

  -- Fixed-amount override short-circuits both rehearsal and standard pricing.
  IF v_rate_mode = 'fixed' THEN
    v_total_amount := COALESCE(v_fixed_amount, 0);
    v_billable_hours := v_worked_hours;

    v_breakdown := jsonb_build_object(
      'worked_hours', v_raw_worked_hours,
      'worked_hours_rounded', v_worked_hours,
      'hours_rounded', v_worked_hours,
      'billable_hours', v_billable_hours,
      'is_fixed_amount', true,
      'fixed_amount_eur', v_total_amount,
      'base_amount_eur', v_total_amount,
      'base_day_eur', v_total_amount,
      'plus_10_12_hours', 0,
      'plus_10_12_eur', 0,
      'plus_10_12_amount_eur', 0,
      'overtime_hours', 0,
      'overtime_hour_eur', 0,
      'overtime_amount_eur', 0,
      'total_eur', v_total_amount,
      'category', v_category,
      'forced_rehearsal_rate', false,
      'rate_mode_source', 'technician_override',
      'has_technician_rate_mode_override', true,
      'technician_rate_mode', 'fixed'
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
      'forced_rehearsal_rate', v_forced_rehearsal,
      'rate_mode_source', v_rate_mode_source,
      'has_technician_rate_mode_override', v_has_technician_rate_mode_override,
      'technician_rate_mode_override_rehearsal', v_technician_rate_mode_override
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
    'category', v_category,
    'forced_rehearsal_rate', false,
    'rate_mode_source', v_rate_mode_source,
    'has_technician_rate_mode_override', v_has_technician_rate_mode_override,
    'technician_rate_mode_override_rehearsal', v_technician_rate_mode_override
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
  'Calculates timesheet amounts based on rate cards. Hours rounded to nearest whole number (not half hour). Rehearsal flat rate: EUR 60 for house_tech/admin/management roles, EUR 180 for regular technicians. Pricing precedence per technician/date is job_technician_rate_mode_dates (rate_mode: fixed short-circuits to fixed_amount_eur; rehearsal forces the rehearsal flat rate; standard/hourly/tour_multipliers/no_multipliers use the standard hours-based tiers), then job_rehearsal_dates. House-tech overtime is category-aware.';

-- ---------------------------------------------------------------------------
-- Part C — compute_tour_job_rate_quote_2025 (tour dates)
-- Resolves each payable date's effective rate_mode and prices it:
--   rehearsal -> rehearsal day rate; standard -> base day rate w/ team multiplier;
--   tour_multipliers -> base day rate w/ forced multiplier; no_multipliers -> base
--   day rate w/ multiplier 1.0; hourly -> the date's timesheet amount; fixed ->
--   fixed_amount_eur.
-- ---------------------------------------------------------------------------

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
  hourly_days int := 0;
  fixed_days int := 0;
  hourly_total numeric(10,2) := 0;
  fixed_total numeric(10,2) := 0;
  forced_multiplier_days int := 0;
  no_multiplier_days int := 0;
  cat text;
  house boolean := false;
  is_autonomo boolean := true;
  is_reduced_rehearsal boolean := false;
  standard_discount_per_day numeric(10,2) := 0;
  rehearsal_discount_per_day numeric(10,2) := 0;
  total_autonomo_discount numeric(10,2) := 0;
  standard_base_before_discount numeric(10,2) := 0;
  standard_after_discount numeric(10,2) := 0;
  standard_multiplier_bonus numeric(10,2) := 0;
  multiplied_standard_days int := 0;
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

  SELECT MIN(jdt.date), MAX(jdt.date)
  INTO job_date_type_start, job_date_type_end
  FROM public.job_date_types jdt
  WHERE jdt.job_id = _job_id
    AND jdt.type <> 'prep_day';

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

  WITH raw_scheduled_job_date_type_dates AS (
    SELECT DISTINCT jdt.date AS payable_date, jdt.type
    FROM public.job_date_types jdt
    WHERE jdt.job_id = _job_id
      AND jdt.type <> 'prep_day'
  ),
  scheduled_job_date_type_dates AS (
    SELECT raw.payable_date
    FROM raw_scheduled_job_date_type_dates raw
    WHERE raw.type <> 'rigging'
       OR EXISTS (
          SELECT 1
          FROM public.job_assignments rja
          WHERE rja.job_id = _job_id
            AND rja.technician_id = _tech_id
            AND COALESCE(rja.single_day, FALSE)
            AND rja.assignment_date = raw.payable_date
        )
       OR EXISTS (
          SELECT 1
          FROM public.timesheets rt
          WHERE rt.job_id = _job_id
            AND rt.technician_id = _tech_id
            AND rt.date = raw.payable_date
            AND COALESCE(rt.is_active, TRUE)
        )
  ),
  active_timesheet_dates AS (
    SELECT DISTINCT t.date AS payable_date
    FROM public.timesheets t
    WHERE t.job_id = _job_id
      AND t.technician_id = _tech_id
      AND COALESCE(t.is_active, TRUE)
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_date_types prep_jdt
        WHERE prep_jdt.job_id = t.job_id
          AND prep_jdt.date = t.date
          AND prep_jdt.type = 'prep_day'
      )
  ),
  single_day_assignment_dates AS (
    SELECT DISTINCT ja.assignment_date AS payable_date
    FROM public.job_assignments ja
    WHERE ja.job_id = _job_id
      AND ja.technician_id = _tech_id
      AND COALESCE(ja.single_day, FALSE)
      AND ja.assignment_date IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_date_types prep_jdt
        WHERE prep_jdt.job_id = ja.job_id
          AND prep_jdt.date = ja.assignment_date
          AND prep_jdt.type = 'prep_day'
      )
  ),
  fallback_schedule_dates AS (
    SELECT generated_series.date_value::date AS payable_date
    FROM generate_series(schedule_start, schedule_end, INTERVAL '1 day') AS generated_series(date_value)
    WHERE NOT EXISTS (SELECT 1 FROM raw_scheduled_job_date_type_dates)
      AND NOT EXISTS (
        SELECT 1
        FROM public.job_date_types prep_jdt
        WHERE prep_jdt.job_id = _job_id
          AND prep_jdt.date = generated_series.date_value::date
          AND prep_jdt.type = 'prep_day'
      )
  ),
  payable_dates AS (
    SELECT payable_date
    FROM active_timesheet_dates
    UNION
    SELECT payable_date
    FROM single_day_assignment_dates
    UNION
    SELECT payable_date
    FROM scheduled_job_date_type_dates
    WHERE NOT EXISTS (SELECT 1 FROM single_day_assignment_dates)
    UNION
    SELECT payable_date
    FROM fallback_schedule_dates
    WHERE NOT EXISTS (SELECT 1 FROM single_day_assignment_dates)
  ),
  classified_payable_dates AS (
    SELECT
      pd.payable_date,
      (trmd.job_id IS NOT NULL) AS has_override,
      COALESCE(
        trmd.rate_mode,
        CASE WHEN jrd.job_id IS NOT NULL THEN 'rehearsal' ELSE 'standard' END
      ) AS eff_mode,
      trmd.fixed_amount_eur,
      (
        SELECT COALESCE(SUM(COALESCE(t.amount_eur, 0)), 0)
        FROM public.timesheets t
        WHERE t.job_id = _job_id
          AND t.technician_id = _tech_id
          AND t.date = pd.payable_date
          AND COALESCE(t.is_active, TRUE)
      ) AS ts_amount
    FROM payable_dates pd
    LEFT JOIN public.job_technician_rate_mode_dates trmd
      ON trmd.job_id = _job_id
     AND trmd.technician_id = _tech_id
     AND trmd.date = pd.payable_date
    LEFT JOIN public.job_rehearsal_dates jrd
      ON jrd.job_id = _job_id
     AND jrd.date = pd.payable_date
  )
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE cpd.eff_mode = 'rehearsal')::int,
    COUNT(*) FILTER (WHERE cpd.has_override)::int,
    COUNT(*) FILTER (WHERE cpd.eff_mode = 'hourly')::int,
    COUNT(*) FILTER (WHERE cpd.eff_mode = 'fixed')::int,
    ROUND(COALESCE(SUM(cpd.ts_amount) FILTER (WHERE cpd.eff_mode = 'hourly'), 0), 2),
    ROUND(COALESCE(SUM(cpd.fixed_amount_eur) FILTER (WHERE cpd.eff_mode = 'fixed'), 0), 2)
  INTO scheduled_days, rehearsal_days, technician_override_days, hourly_days, fixed_days, hourly_total, fixed_total
  FROM classified_payable_dates cpd;

  scheduled_days := COALESCE(scheduled_days, 0);
  rehearsal_days := LEAST(COALESCE(rehearsal_days, 0), scheduled_days);
  hourly_days := COALESCE(hourly_days, 0);
  fixed_days := COALESCE(fixed_days, 0);
  standard_days := GREATEST(0, scheduled_days - rehearsal_days - hourly_days - fixed_days);

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

    -- This deliberately duplicates the canonical payable-date CTEs above
    -- because PL/pgSQL CTEs cannot be reused across separate statements. Keep
    -- raw_scheduled_job_date_type_dates, scheduled_job_date_type_dates,
    -- active_timesheet_dates, single_day_assignment_dates, and
    -- fallback_schedule_dates in sync with the first copy, or refactor them
    -- into a shared SQL function.
    WITH raw_scheduled_job_date_type_dates AS (
      SELECT DISTINCT jdt.date AS payable_date, jdt.type
      FROM public.job_date_types jdt
      WHERE jdt.job_id = _job_id
        AND jdt.type <> 'prep_day'
    ),
    scheduled_job_date_type_dates AS (
      SELECT raw.payable_date
      FROM raw_scheduled_job_date_type_dates raw
      WHERE raw.type <> 'rigging'
         OR EXISTS (
            SELECT 1
            FROM public.job_assignments rja
            WHERE rja.job_id = _job_id
              AND rja.technician_id = _tech_id
              AND COALESCE(rja.single_day, FALSE)
              AND rja.assignment_date = raw.payable_date
          )
         OR EXISTS (
            SELECT 1
            FROM public.timesheets rt
            WHERE rt.job_id = _job_id
              AND rt.technician_id = _tech_id
              AND rt.date = raw.payable_date
              AND COALESCE(rt.is_active, TRUE)
          )
    ),
    active_timesheet_dates AS (
      SELECT DISTINCT t.date AS payable_date
      FROM public.timesheets t
      WHERE t.job_id = _job_id
        AND t.technician_id = _tech_id
        AND COALESCE(t.is_active, TRUE)
        AND NOT EXISTS (
          SELECT 1
          FROM public.job_date_types prep_jdt
          WHERE prep_jdt.job_id = t.job_id
            AND prep_jdt.date = t.date
            AND prep_jdt.type = 'prep_day'
        )
    ),
    single_day_assignment_dates AS (
      SELECT DISTINCT ja.assignment_date AS payable_date
      FROM public.job_assignments ja
      WHERE ja.job_id = _job_id
        AND ja.technician_id = _tech_id
        AND COALESCE(ja.single_day, FALSE)
        AND ja.assignment_date IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.job_date_types prep_jdt
          WHERE prep_jdt.job_id = ja.job_id
            AND prep_jdt.date = ja.assignment_date
            AND prep_jdt.type = 'prep_day'
        )
    ),
    fallback_schedule_dates AS (
      SELECT generated_series.date_value::date AS payable_date
      FROM generate_series(schedule_start, schedule_end, INTERVAL '1 day') AS generated_series(date_value)
      WHERE NOT EXISTS (SELECT 1 FROM raw_scheduled_job_date_type_dates)
        AND NOT EXISTS (
          SELECT 1
          FROM public.job_date_types prep_jdt
          WHERE prep_jdt.job_id = _job_id
            AND prep_jdt.date = generated_series.date_value::date
            AND prep_jdt.type = 'prep_day'
        )
    ),
    payable_dates AS (
      SELECT payable_date
      FROM active_timesheet_dates
      UNION
      SELECT payable_date
      FROM single_day_assignment_dates
      UNION
      SELECT payable_date
      FROM scheduled_job_date_type_dates
      WHERE NOT EXISTS (SELECT 1 FROM single_day_assignment_dates)
      UNION
      SELECT payable_date
      FROM fallback_schedule_dates
      WHERE NOT EXISTS (SELECT 1 FROM single_day_assignment_dates)
    ),
    standard_payable_dates AS (
      SELECT
        pd.payable_date,
        COALESCE(
          trmd.rate_mode,
          CASE WHEN jrd.job_id IS NOT NULL THEN 'rehearsal' ELSE 'standard' END
        ) AS eff_mode
      FROM payable_dates pd
      LEFT JOIN public.job_technician_rate_mode_dates trmd
        ON trmd.job_id = _job_id
       AND trmd.technician_id = _tech_id
       AND trmd.date = pd.payable_date
      LEFT JOIN public.job_rehearsal_dates jrd
        ON jrd.job_id = _job_id
       AND jrd.date = pd.payable_date
      WHERE COALESCE(
              trmd.rate_mode,
              CASE WHEN jrd.job_id IS NOT NULL THEN 'rehearsal' ELSE 'standard' END
            ) IN ('standard','tour_multipliers','no_multipliers')
    ),
    date_multipliers AS (
      SELECT
        spd.payable_date,
        spd.eff_mode,
        CASE
          WHEN NOT team_member AND spd.eff_mode <> 'tour_multipliers' THEN 1
          ELSE GREATEST(COALESCE(weekly_counts.cnt, 0), 1)
        END AS week_count,
        CASE
          WHEN spd.eff_mode = 'no_multipliers' THEN 1.0::numeric
          WHEN NOT team_member AND spd.eff_mode <> 'tour_multipliers' THEN 1.0::numeric
          WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 1 THEN 1.5::numeric
          WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 2 THEN 1.125::numeric
          ELSE 1.0::numeric
        END AS week_multiplier,
        CASE
          WHEN spd.eff_mode = 'no_multipliers' THEN 1.0::numeric
          WHEN NOT team_member AND spd.eff_mode <> 'tour_multipliers' THEN 1.0::numeric
          WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 1 THEN 1.5::numeric
          WHEN GREATEST(COALESCE(weekly_counts.cnt, 0), 1) = 2 THEN 1.125::numeric
          ELSE 1.0::numeric
        END AS date_multiplier
      FROM standard_payable_dates spd
      CROSS JOIN LATERAL public.iso_year_week_madrid(spd.payable_date::timestamptz) iw
      LEFT JOIN LATERAL (
        WITH tour_jobs AS (
          SELECT
            j.id AS job_id,
            j.start_time,
            j.end_time,
            j.tour_date_id
          FROM public.jobs j
          WHERE j.job_type = 'tourdate'
            AND j.tour_id = tour_group
            AND j.status != 'Cancelado'
        ),
        technician_job_assignments AS (
          SELECT DISTINCT ja.job_id
          FROM public.job_assignments ja
          JOIN tour_jobs tj
            ON tj.job_id = ja.job_id
          WHERE ja.technician_id = _tech_id
        ),
        raw_scheduled_job_date_type_dates AS (
          SELECT DISTINCT
            tj.job_id,
            jdt.date AS payable_date,
            jdt.type
          FROM tour_jobs tj
          JOIN public.job_date_types jdt
            ON jdt.job_id = tj.job_id
           AND jdt.type <> 'prep_day'
        ),
        scheduled_job_date_type_dates AS (
          SELECT raw.job_id, raw.payable_date
          FROM raw_scheduled_job_date_type_dates raw
          JOIN technician_job_assignments tja
            ON tja.job_id = raw.job_id
          WHERE raw.type <> 'rigging'
             OR EXISTS (
                SELECT 1
                FROM public.job_assignments rja
                WHERE rja.job_id = raw.job_id
                  AND rja.technician_id = _tech_id
                  AND COALESCE(rja.single_day, FALSE)
                  AND rja.assignment_date = raw.payable_date
              )
             OR EXISTS (
                SELECT 1
                FROM public.timesheets rt
                WHERE rt.job_id = raw.job_id
                  AND rt.technician_id = _tech_id
                  AND rt.date = raw.payable_date
                  AND COALESCE(rt.is_active, TRUE)
              )
        ),
        active_timesheet_dates AS (
          SELECT DISTINCT
            tj.job_id,
            t.date AS payable_date
          FROM tour_jobs tj
          JOIN public.timesheets t
            ON t.job_id = tj.job_id
           AND t.technician_id = _tech_id
           AND COALESCE(t.is_active, TRUE)
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.job_date_types prep_jdt
            WHERE prep_jdt.job_id = t.job_id
              AND prep_jdt.date = t.date
              AND prep_jdt.type = 'prep_day'
          )
        ),
        single_day_assignment_dates AS (
          SELECT DISTINCT
            tj.job_id,
            ja.assignment_date AS payable_date
          FROM tour_jobs tj
          JOIN public.job_assignments ja
            ON ja.job_id = tj.job_id
           AND ja.technician_id = _tech_id
           AND COALESCE(ja.single_day, FALSE)
           AND ja.assignment_date IS NOT NULL
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.job_date_types prep_jdt
            WHERE prep_jdt.job_id = ja.job_id
              AND prep_jdt.date = ja.assignment_date
              AND prep_jdt.type = 'prep_day'
          )
        ),
        jobs_with_single_day_assignments AS (
          SELECT DISTINCT job_id
          FROM single_day_assignment_dates
        ),
        job_ranges AS (
          SELECT
            tj.job_id,
            COALESCE(
              MIN(raw.payable_date),
              td.start_date,
              (tj.start_time AT TIME ZONE 'Europe/Madrid')::date,
              td.date
            ) AS schedule_start,
            COALESCE(
              MAX(raw.payable_date),
              td.end_date,
              (tj.end_time AT TIME ZONE 'Europe/Madrid')::date,
              td.start_date,
              td.date,
              (tj.start_time AT TIME ZONE 'Europe/Madrid')::date
            ) AS schedule_end
          FROM tour_jobs tj
          LEFT JOIN public.tour_dates td
            ON td.id = tj.tour_date_id
          LEFT JOIN raw_scheduled_job_date_type_dates raw
            ON raw.job_id = tj.job_id
          GROUP BY
            tj.job_id,
            tj.start_time,
            tj.end_time,
            td.start_date,
            td.end_date,
            td.date
        ),
        fallback_schedule_dates AS (
          SELECT
            jr.job_id,
            generated_series.date_value::date AS payable_date
          FROM job_ranges jr
          JOIN technician_job_assignments tja
            ON tja.job_id = jr.job_id
          CROSS JOIN LATERAL generate_series(
            jr.schedule_start,
            GREATEST(jr.schedule_start, jr.schedule_end),
            INTERVAL '1 day'
          ) AS generated_series(date_value)
          WHERE NOT EXISTS (
              SELECT 1
              FROM raw_scheduled_job_date_type_dates raw
              WHERE raw.job_id = jr.job_id
            )
            AND NOT EXISTS (
              SELECT 1
              FROM public.job_date_types prep_jdt
              WHERE prep_jdt.job_id = jr.job_id
                AND prep_jdt.date = generated_series.date_value::date
                AND prep_jdt.type = 'prep_day'
            )
        ),
        counted_payable_dates AS (
          SELECT job_id, payable_date
          FROM active_timesheet_dates
          UNION
          SELECT job_id, payable_date
          FROM single_day_assignment_dates
          UNION
          SELECT job_id, payable_date
          FROM scheduled_job_date_type_dates scheduled
          WHERE NOT EXISTS (
            SELECT 1
            FROM jobs_with_single_day_assignments single_day_jobs
            WHERE single_day_jobs.job_id = scheduled.job_id
          )
          UNION
          SELECT job_id, payable_date
          FROM fallback_schedule_dates fallback
          WHERE NOT EXISTS (
            SELECT 1
            FROM jobs_with_single_day_assignments single_day_jobs
            WHERE single_day_jobs.job_id = fallback.job_id
          )
        )
        SELECT COUNT(DISTINCT cpd.payable_date)::int AS cnt
        FROM counted_payable_dates cpd
        CROSS JOIN LATERAL public.iso_year_week_madrid(cpd.payable_date::timestamptz) other_iw
        WHERE other_iw.iso_year = iw.iso_year
          AND other_iw.iso_week = iw.iso_week
      ) weekly_counts ON TRUE
    )
    SELECT
      ROUND(COALESCE(SUM(standard_after_discount * dm.date_multiplier), 0), 2),
      ROUND(COALESCE(SUM((standard_after_discount * dm.date_multiplier) - standard_after_discount), 0), 2),
      COUNT(*) FILTER (WHERE dm.date_multiplier > 1.0)::int,
      COUNT(*) FILTER (WHERE dm.eff_mode = 'tour_multipliers')::int,
      COUNT(*) FILTER (WHERE dm.eff_mode = 'no_multipliers')::int,
      GREATEST(COALESCE(MAX(dm.week_count), 1), 1)::int,
      COALESCE(ROUND(SUM(dm.week_multiplier * dm.week_count) / NULLIF(SUM(dm.week_count), 0), 3), 1.0),
      COALESCE(ROUND(SUM(dm.date_multiplier * dm.week_count) / NULLIF(SUM(dm.week_count), 0), 3), 1.0)
    INTO standard_total, standard_multiplier_bonus, multiplied_standard_days, forced_multiplier_days, no_multiplier_days, cnt, display_multiplier, display_per_job_multiplier
    FROM date_multipliers dm;

    per_job_multiplier := display_per_job_multiplier;
    mult := display_multiplier;
    standard_day_rate := ROUND(standard_total / GREATEST(standard_days, 1), 2);
    display_category := cat;
  ELSE
    cnt := 1;
    mult := 1.0;
    per_job_multiplier := 1.0;
    display_multiplier := 1.0;
    display_per_job_multiplier := 1.0;
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

  IF standard_days = 0 AND rehearsal_days = 0 THEN
    display_category := CASE
      WHEN hourly_days > 0 AND fixed_days > 0 THEN 'mixed'
      WHEN hourly_days > 0 THEN 'hourly'
      WHEN fixed_days > 0 THEN 'fixed'
      ELSE display_category
    END;
  END IF;

  total_base := ROUND(standard_total + rehearsal_total + hourly_total + fixed_total, 2);
  total_autonomo_discount := ROUND(
    (standard_discount_per_day * standard_days) + (rehearsal_discount_per_day * rehearsal_days),
    2
  );
  base_calculation_total := ROUND(
    (standard_base_before_discount * standard_days) + (rehearsal_base_before_discount * rehearsal_days)
      + hourly_total + fixed_total,
    2
  );

  IF standard_days > 0 THEN
    after_discount_total := ROUND(
      (standard_after_discount * standard_days) + (rehearsal_day_rate * rehearsal_days)
        + hourly_total + fixed_total,
      2
    );
  ELSE
    after_discount_total := ROUND(
      (rehearsal_day_rate * rehearsal_days) + hourly_total + fixed_total,
      2
    );
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
      'multiplied_standard_days', multiplied_standard_days,
      'standard_multiplier_bonus_eur', standard_multiplier_bonus,
      'hourly_days', hourly_days,
      'hourly_total_eur', hourly_total,
      'fixed_days', fixed_days,
      'fixed_total_eur', fixed_total,
      'forced_multiplier_days', forced_multiplier_days,
      'no_multiplier_days', no_multiplier_days,
      'rehearsal_rate_eur', CASE WHEN rehearsal_days > 0 THEN rehearsal_day_rate ELSE NULL END,
      'standard_day_rate_eur', CASE WHEN standard_days > 0 THEN standard_day_rate ELSE NULL END,
      'forced_rehearsal_rate', (rehearsal_days > 0),
      'prep_days_excluded_from_multiplier', true,
      'rigging_dates_scoped_to_assigned_techs', true,
      'weekly_multiplier_rule', '1_date_1_5x__2_dates_1_125x__3_plus_1x',
      'per_payable_date_weekly_multipliers', true,
      'weekly_multiplier_count_uses_timesheets', true
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.compute_tour_job_rate_quote_2025(uuid,uuid) FROM PUBLIC;

COMMENT ON FUNCTION public.compute_tour_job_rate_quote_2025(uuid,uuid) IS
  'Calculates tour job rate quotes. Each payable date resolves an effective rate_mode from job_technician_rate_mode_dates (rehearsal, standard, tour_multipliers, no_multipliers, hourly, fixed) then job_rehearsal_dates. Standard-family dates use the per-payable-date weekly multipliers (1 date 1.5x, 2 dates 1.125x each, 3+ dates 1x); tour_multipliers forces those multipliers even off-team, no_multipliers forces 1x. Hourly dates add the technician timesheet amount; fixed dates add fixed_amount_eur. Prep days are excluded.';
