-- Add rate calculation rules for:
-- 1. Rehearsal jobs: flat €180 rate regardless of time/category
-- 2. Extended shifts (21+ hours / over 20.5 hrs): double base rate, no overtime, no plus

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
  v_autonomo_discount NUMERIC := 0;
BEGIN
  -- Fetch timesheet with job info, category, and autonomo status
  SELECT
    t.*,
    j.job_type,
    j.tour_date_id,
    COALESCE(p.autonomo, true) as is_autonomo,
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

  -- Check if job is a rehearsal (via tour_date_type)
  IF v_timesheet.tour_date_id IS NOT NULL THEN
    SELECT td.tour_date_type INTO v_tour_date_type
    FROM public.tour_dates td
    WHERE td.id = v_timesheet.tour_date_id;

    IF v_tour_date_type = 'rehearsal' THEN
      v_is_rehearsal := TRUE;
    END IF;
  END IF;

  -- Get autonomo status from the main query
  v_is_autonomo := v_timesheet.is_autonomo;

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

    -- Apply autonomo discount if applicable (for both custom and default rates)
    IF NOT v_is_autonomo THEN
      v_autonomo_discount := 30.00;
      v_rehearsal_flat_rate := v_rehearsal_flat_rate - v_autonomo_discount;
    END IF;

    -- Calculate worked hours for breakdown info only
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
      'category', 'rehearsal'
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
  -- Note: rate_cards_2025.category should have a UNIQUE constraint to ensure deterministic lookups
  SELECT
    CASE
      WHEN v_category = 'responsable' THEN COALESCE(base_day_responsable_eur, base_day_especialista_eur, base_day_eur)
      WHEN v_category = 'especialista' THEN COALESCE(base_day_especialista_eur, base_day_eur)
      ELSE base_day_eur
    END AS base_day_eur,
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

  -- Calculate worked hours
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
    v_base_day_amount := v_rate_card.base_day_eur * 2;  -- Double base rate
    v_plus_10_12_hours := 0;
    v_plus_10_12_amount := 0;  -- No plus for extended shifts
    v_overtime_hours := 0;
    v_overtime_amount := 0;  -- No overtime for extended shifts
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

REVOKE EXECUTE ON FUNCTION public.compute_timesheet_amount_2025(uuid,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.compute_timesheet_amount_2025(uuid,boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.compute_timesheet_amount_2025(uuid,boolean) IS
  'Calculates timesheet amounts based on rate cards. Special rules: (1) Rehearsal jobs (tour_date_type=rehearsal) use flat €180 rate regardless of time/category, (2) Extended shifts over 20.5 hours use double base rate with no plus/overtime. Checks custom_tech_rates first for overrides, falls back to rate_cards_2025.';

-- Ensure deterministic lookups by enforcing uniqueness on category columns
CREATE UNIQUE INDEX IF NOT EXISTS rate_cards_2025_category_unique_idx
  ON public.rate_cards_2025 (category);

CREATE UNIQUE INDEX IF NOT EXISTS rate_cards_tour_2025_category_unique_idx
  ON public.rate_cards_tour_2025 (category);

-- -----------------------------------------------------------------------------
-- Row Level Security for rate_cards_2025
-- -----------------------------------------------------------------------------
ALTER TABLE public.rate_cards_2025 ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "rate_cards_2025_select_policy" ON public.rate_cards_2025;
DROP POLICY IF EXISTS "rate_cards_2025_insert_policy" ON public.rate_cards_2025;
DROP POLICY IF EXISTS "rate_cards_2025_update_policy" ON public.rate_cards_2025;
DROP POLICY IF EXISTS "rate_cards_2025_delete_policy" ON public.rate_cards_2025;

-- Allow authenticated users to read rate cards
CREATE POLICY "rate_cards_2025_select_policy"
  ON public.rate_cards_2025
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/management can modify rate cards
CREATE POLICY "rate_cards_2025_insert_policy"
  ON public.rate_cards_2025
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_management());

CREATE POLICY "rate_cards_2025_update_policy"
  ON public.rate_cards_2025
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_management())
  WITH CHECK (public.is_admin_or_management());

CREATE POLICY "rate_cards_2025_delete_policy"
  ON public.rate_cards_2025
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_management());

-- -----------------------------------------------------------------------------
-- Row Level Security for rate_cards_tour_2025
-- -----------------------------------------------------------------------------
ALTER TABLE public.rate_cards_tour_2025 ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "rate_cards_tour_2025_select_policy" ON public.rate_cards_tour_2025;
DROP POLICY IF EXISTS "rate_cards_tour_2025_insert_policy" ON public.rate_cards_tour_2025;
DROP POLICY IF EXISTS "rate_cards_tour_2025_update_policy" ON public.rate_cards_tour_2025;
DROP POLICY IF EXISTS "rate_cards_tour_2025_delete_policy" ON public.rate_cards_tour_2025;

-- Allow authenticated users to read tour rate cards
CREATE POLICY "rate_cards_tour_2025_select_policy"
  ON public.rate_cards_tour_2025
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/management can modify tour rate cards
CREATE POLICY "rate_cards_tour_2025_insert_policy"
  ON public.rate_cards_tour_2025
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_management());

CREATE POLICY "rate_cards_tour_2025_update_policy"
  ON public.rate_cards_tour_2025
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_management())
  WITH CHECK (public.is_admin_or_management());

CREATE POLICY "rate_cards_tour_2025_delete_policy"
  ON public.rate_cards_tour_2025
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_management());
