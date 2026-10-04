-- Production/logistics roles (PROD-*-R/E/T, stored in production_role) feed
-- the timesheet category like the sound/lights/video roles always have. The
-- category drives the rate card (compute_timesheet_amount_2025), so a
-- Responsable de Producción was priced from their profile default or
-- "tecnico" instead of "responsable". Only step 1 changes; signature, grants
-- and the fallbacks are untouched. Approved rows keep their category (the
-- autofill trigger only fills NULL categories).

CREATE OR REPLACE FUNCTION public.resolve_category_for_timesheet(_job_id uuid, _tech_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cat text;
BEGIN
  -- 1) Attempt to resolve from job assignment roles (production included)
  --    using the same
  --    normalization as compute_timesheet_amount_2025
  WITH roles AS (
         SELECT unnest(ARRAY[ja.sound_role, ja.lights_role, ja.video_role, ja.production_role]) AS role_code
         FROM job_assignments ja
         WHERE ja.job_id = _job_id
           AND ja.technician_id = _tech_id
       ),
       prepared AS (
         SELECT role_code,
                UPPER(NULLIF(split_part(role_code, '-', 3), '')) AS lvl_raw
         FROM roles
         WHERE role_code IS NOT NULL
       ),
       normalized AS (
         SELECT CASE
                  WHEN lvl_raw IS NOT NULL AND lvl_raw <> '' THEN lvl_raw
                  WHEN role_code ~* 'responsable' THEN 'R'
                  WHEN role_code ~* 'especialista' THEN 'E'
                  WHEN role_code ~* 't[eé]cnico' THEN 'T'
                  ELSE NULL
                END AS lvl
         FROM prepared
       ),
       ranked AS (
         SELECT lvl,
                CASE lvl
                  WHEN 'R' THEN 3
                  WHEN 'E' THEN 2
                  WHEN 'T' THEN 1
                  ELSE 0
                END AS weight
         FROM normalized
         WHERE lvl IS NOT NULL
       )
  SELECT CASE lvl
           WHEN 'R' THEN 'responsable'
           WHEN 'E' THEN 'especialista'
           WHEN 'T' THEN 'tecnico'
         END
  INTO cat
  FROM ranked
  ORDER BY weight DESC
  LIMIT 1;

  IF cat IS NOT NULL THEN
    RETURN cat;
  END IF;

  -- 2) Last known category for the same (job, tech)
  SELECT category INTO cat
  FROM timesheets
  WHERE job_id = _job_id AND technician_id = _tech_id AND category IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF cat IS NOT NULL THEN
    RETURN cat;
  END IF;

  -- 3) From profile default
  SELECT default_timesheet_category INTO cat
  FROM profiles
  WHERE id = _tech_id AND default_timesheet_category IN ('tecnico', 'especialista', 'responsable')
  LIMIT 1;

  IF cat IS NOT NULL THEN
    RETURN cat;
  END IF;

  RETURN NULL;
END;
$function$;

-- The amount engine's fallback for a row that still has no category reads the
-- same role columns; production joins them. Nothing else in the function
-- changes (pricing rules, authorization, approved-row handling).
CREATE OR REPLACE FUNCTION public.compute_timesheet_amount_2025(_timesheet_id uuid, _persist boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
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
  v_is_seasonal_house_tech BOOLEAN := FALSE;
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
    COALESCE(p.role = 'house_tech' AND p.seasonal_house_tech, false) as is_seasonal_house_tech,
    COALESCE(p.role IN ('house_tech', 'admin', 'management'), false) as is_reduced_rehearsal,
    COALESCE(
      t.category,
      CASE
        WHEN a.sound_role LIKE '%-R' OR a.lights_role LIKE '%-R' OR a.video_role LIKE '%-R' OR a.production_role LIKE '%-R' THEN 'responsable'
        WHEN a.sound_role LIKE '%-E' OR a.lights_role LIKE '%-E' OR a.video_role LIKE '%-E' OR a.production_role LIKE '%-E' THEN 'especialista'
        WHEN a.sound_role LIKE '%-T' OR a.lights_role LIKE '%-T' OR a.video_role LIKE '%-T' OR a.production_role LIKE '%-T' THEN 'tecnico'
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
      v_rate_mode := COALESCE(
        v_rate_mode,
        CASE WHEN COALESCE(v_technician_rate_mode_override, FALSE) THEN 'rehearsal' ELSE 'standard' END
      );
      v_forced_rehearsal := v_rate_mode = 'rehearsal';
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
  v_is_seasonal_house_tech := v_timesheet.is_seasonal_house_tech;

  -- Seasonal house techs always use overtime-only hourly pricing. This profile
  -- rule intentionally takes precedence over per-date fixed/rehearsal modes.
  IF v_is_seasonal_house_tech THEN
    v_is_rehearsal := FALSE;
    v_forced_rehearsal := FALSE;
    v_rate_mode := 'hourly';
    v_fixed_amount := NULL;
    v_rate_mode_source := 'seasonal_house_tech_profile';
  END IF;
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
  IF v_rate_mode = 'fixed' AND NOT v_is_seasonal_house_tech THEN
    IF v_fixed_amount IS NULL OR v_fixed_amount < 0 THEN
      RAISE EXCEPTION 'Invalid fixed amount for timesheet %', _timesheet_id;
    END IF;

    v_total_amount := v_fixed_amount;
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
  IF v_is_rehearsal AND NOT v_is_seasonal_house_tech THEN
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
      'technician_rate_mode_override_rehearsal', v_technician_rate_mode_override,
      'technician_rate_mode', CASE WHEN v_is_seasonal_house_tech THEN 'hourly' ELSE v_rate_mode END
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

  -- Seasonal house techs earn only category-aware overtime above 12 rounded hours.
  IF v_is_seasonal_house_tech THEN
    v_billable_hours := v_worked_hours;
    v_base_day_amount := 0;
    v_plus_10_12_hours := 0;
    v_plus_10_12_amount := 0;
    v_overtime_hours := GREATEST(v_worked_hours - 12, 0);
    v_overtime_amount := v_rate_card.overtime_hour_eur * v_overtime_hours;
    v_total_amount := v_overtime_amount;
  -- Handle evento jobs (fixed 12-hour rate)
  ELSIF v_job_type = 'evento' THEN
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
    'is_evento', (v_job_type = 'evento' AND NOT v_is_seasonal_house_tech),
    'is_seasonal_house_tech', v_is_seasonal_house_tech,
    'seasonal_overtime_only', v_is_seasonal_house_tech,
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
    'technician_rate_mode_override_rehearsal', v_technician_rate_mode_override,
    'technician_rate_mode', CASE WHEN v_is_seasonal_house_tech THEN 'hourly' ELSE v_rate_mode END
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
