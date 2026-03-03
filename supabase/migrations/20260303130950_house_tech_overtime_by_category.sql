-- House-tech overtime by category:
-- - regular OT (tecnico/especialista) can be 15
-- - responsable OT should be 20 when legacy OT is 15
-- Keeps legacy overtime_hour_eur for backward compatibility/fallback.

ALTER TABLE public.custom_tech_rates
  ADD COLUMN IF NOT EXISTS overtime_hour_especialista_eur numeric(10,2),
  ADD COLUMN IF NOT EXISTS overtime_hour_responsable_eur numeric(10,2);

COMMENT ON COLUMN public.custom_tech_rates.overtime_hour_eur IS
  'Legacy overtime override used as regular OT fallback (tecnico) and compatibility fallback for non-house roles.';
COMMENT ON COLUMN public.custom_tech_rates.overtime_hour_especialista_eur IS
  'Optional overtime override when category = especialista for house tech. Falls back to overtime_hour_eur.';
COMMENT ON COLUMN public.custom_tech_rates.overtime_hour_responsable_eur IS
  'Optional overtime override when category = responsable for house tech. Falls back to 20 when overtime_hour_eur=15, then overtime_hour_eur.';

-- Initialize new OT columns from legacy OT for house-tech rows only.
UPDATE public.custom_tech_rates ctr
SET
  overtime_hour_especialista_eur = COALESCE(ctr.overtime_hour_especialista_eur, ctr.overtime_hour_eur),
  overtime_hour_responsable_eur = COALESCE(
    ctr.overtime_hour_responsable_eur,
    CASE
      WHEN ctr.overtime_hour_eur = 15.00 THEN 20.00
      ELSE ctr.overtime_hour_eur
    END
  )
FROM public.profiles p
WHERE p.id = ctr.profile_id
  AND p.role = 'house_tech';

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
  v_tour_date_type TEXT := NULL;
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
    j.tour_date_id,
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
  'Calculates timesheet amounts based on rate cards. Hours rounded to nearest whole number (not half hour). Rehearsal flat rate: EUR 60 for house_tech/admin/management roles, EUR 180 for regular technicians. House-tech overtime is category-aware: tecnico uses overtime_hour_eur, especialista uses overtime_hour_especialista_eur fallback to overtime_hour_eur, responsable uses overtime_hour_responsable_eur fallback (including 15->20 rule) then overtime_hour_eur.';

-- Backfill only affected persisted timesheets:
-- house-tech + responsable + persisted overtime hours > 0.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT t.id
    FROM public.timesheets t
    JOIN public.profiles p ON p.id = t.technician_id
    WHERE p.role = 'house_tech'
      AND t.category = 'responsable'
      AND t.amount_breakdown IS NOT NULL
      AND COALESCE((t.amount_breakdown->>'overtime_hours')::numeric, 0) > 0
      AND t.start_time IS NOT NULL
      AND t.end_time IS NOT NULL
  LOOP
    PERFORM public.compute_timesheet_amount_2025(rec.id, true);
  END LOOP;
END;
$$;
