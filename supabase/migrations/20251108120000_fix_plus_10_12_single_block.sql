-- Fix: Hours 11-12 should add €30 total, not €30 per hour
-- The +10-12 augmentation should be a flat €30 for working 1 or 2 hours in that range,
-- not €30 per hour (which would give €60 for 2 hours).

CREATE OR REPLACE FUNCTION public.compute_timesheet_amount_2025(_timesheet_id uuid, _persist boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t record;
  eff record;
  cat text;
  is_house_tech boolean := false;
  is_autonomo boolean := true;
  autonomo_discount numeric := 0;
  base_day_before_discount numeric;
  base_day_eur numeric;
  plus_10_12_eur numeric;
  overtime_hour_eur numeric;
  hours_raw numeric;
  hours_rounded numeric;
  plus_hours numeric := 0;
  plus_amount numeric := 0;
  overtime_hours numeric := 0;
  base_amount numeric := 0;
  overtime_amount numeric := 0;
  total_amount numeric;
  breakdown jsonb;
  worked_minutes integer;
  date_type text := NULL;
  rehearsal_flat_rate numeric := NULL;
BEGIN
  -- 1) Fetch the timesheet core fields
  SELECT
    ts.id, ts.technician_id, ts.job_id,
    ts.start_time, ts.end_time, ts.break_minutes, ts.ends_next_day,
    ts.category AS category_override, ts.date
  INTO t
  FROM timesheets ts
  WHERE ts.id = _timesheet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timesheet % not found', _timesheet_id;
  END IF;

  -- Calculate worked hours (with overnight and break handling)
  IF t.start_time IS NULL OR t.end_time IS NULL THEN
    hours_raw := 0;
    worked_minutes := 0;
  ELSE
    worked_minutes := EXTRACT(EPOCH FROM (t.end_time - t.start_time)) / 60;
    IF t.ends_next_day OR worked_minutes < 0 THEN
      worked_minutes := worked_minutes + (24 * 60);
    END IF;
    worked_minutes := worked_minutes - COALESCE(t.break_minutes, 0);
    hours_raw := GREATEST(0, worked_minutes::numeric / 60);
  END IF;

  -- Round hours (≥30 minutes round up)
  hours_rounded := CEIL(hours_raw);
  IF (hours_raw - FLOOR(hours_raw)) < 0.5 THEN
    hours_rounded := FLOOR(hours_raw);
  END IF;

  -- 2) Check if this timesheet date is a rehearsal
  SELECT type INTO date_type
  FROM job_date_types
  WHERE job_id = t.job_id
    AND date = t.date
  LIMIT 1;

  -- 3) Determine if house tech and autonomo status
  SELECT
    (role = 'house_tech'),
    CASE WHEN role = 'technician' THEN COALESCE(autonomo, true) ELSE true END
  INTO is_house_tech, is_autonomo
  FROM profiles
  WHERE id = t.technician_id;

  -- 4) Handle rehearsal flat rate
  IF date_type = 'rehearsal' THEN
    IF is_house_tech THEN
      -- Check for custom house tech rehearsal rate
      SELECT rehearsal_day_eur INTO rehearsal_flat_rate
      FROM house_tech_rates
      WHERE profile_id = t.technician_id;

      -- If no custom rate set, fall through to normal calculation
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

  -- If rehearsal flat rate determined, use it and return early
  IF rehearsal_flat_rate IS NOT NULL THEN
    total_amount := rehearsal_flat_rate;

    breakdown := jsonb_build_object(
      'is_rehearsal_flat_rate', true,
      'rehearsal_rate_eur', ROUND(rehearsal_flat_rate, 2),
      'autonomo_discount_eur', ROUND(autonomo_discount, 2),
      'base_day_before_discount_eur', ROUND(COALESCE(base_day_before_discount, rehearsal_flat_rate), 2),
      'category', COALESCE(cat, 'rehearsal'),
      'worked_minutes', COALESCE(worked_minutes, 0),
      'hours_raw', ROUND(hours_raw, 2),
      'worked_hours_rounded', hours_rounded,
      'base_day_hours', 0,
      'mid_tier_hours', 0,
      'base_amount_eur', ROUND(total_amount, 2),
      'overtime_hours', 0,
      'overtime_hour_eur', 0,
      'overtime_amount_eur', 0,
      'total_eur', ROUND(total_amount, 2),
      'notes', ARRAY['Rehearsal flat rate applied']
    );

    IF _persist THEN
      UPDATE timesheets
      SET amount_eur = ROUND(total_amount, 2),
          amount_breakdown = breakdown,
          updated_at = now()
      WHERE id = _timesheet_id;
    END IF;

    RETURN breakdown;
  END IF;

  -- 5) Normal calculation: Determine category
  cat := COALESCE(
    t.category_override,
    (SELECT default_timesheet_category FROM profiles WHERE id = t.technician_id),
    'tecnico'
  );

  -- 6) Effective rates
  SELECT
    htr.base_day_eur       AS base_day_override,
    htr.plus_10_12_eur     AS plus_10_12_override,
    htr.overtime_hour_eur  AS overtime_override,
    rc.base_day_eur        AS base_day_default,
    rc.plus_10_12_eur      AS plus_10_12_default,
    rc.overtime_hour_eur   AS overtime_default
  INTO eff
  FROM rate_cards_2025 rc
  LEFT JOIN house_tech_rates htr
    ON htr.profile_id = t.technician_id
  WHERE rc.category = cat;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No rate card found for category %', cat;
  END IF;

  base_day_eur   := COALESCE(eff.base_day_override, eff.base_day_default);
  plus_10_12_eur := COALESCE(eff.plus_10_12_override, eff.plus_10_12_default);

  base_day_before_discount := base_day_eur;

  -- Apply autonomo discount for non-house technicians
  IF NOT is_house_tech AND NOT is_autonomo THEN
    autonomo_discount := 30;
    base_day_eur := base_day_eur - autonomo_discount;
  END IF;

  IF is_house_tech AND eff.base_day_override IS NOT NULL THEN
    overtime_hour_eur := COALESCE(eff.overtime_override, ROUND(base_day_eur / 10, 2));
  ELSE
    overtime_hour_eur := COALESCE(eff.overtime_override, eff.overtime_default);
  END IF;

  -- 7) Compute amounts
  base_amount := base_day_eur;

  -- FIX: Hours 11-12 should add €30 total (flat), not €30 per hour
  -- Both house and non-house technicians get the same treatment:
  -- +€30 if working any hours in the 10-12 range (hours 11 and/or 12)
  IF hours_rounded > 10 THEN
    plus_hours := LEAST(GREATEST(hours_rounded - 10, 0), 2);
    plus_amount := CASE WHEN plus_hours > 0 THEN plus_10_12_eur * 1 ELSE 0 END;
    base_amount := base_amount + plus_amount;
  END IF;

  IF hours_rounded > 12 THEN
    overtime_hours := hours_rounded - 12;
    overtime_amount := overtime_hours * overtime_hour_eur;
  END IF;

  total_amount := base_amount + overtime_amount;

  -- 8) Breakdown
  breakdown := jsonb_build_object(
    'category', cat,
    'autonomo_discount_eur', ROUND(autonomo_discount, 2),
    'base_day_before_discount_eur', ROUND(base_day_before_discount, 2),
    'base_day_eur', base_day_eur,
    'plus_10_12_eur', plus_10_12_eur,
    'plus_10_12_hours', plus_hours,
    'plus_10_12_amount_eur', ROUND(plus_amount, 2),
    'overtime_hour_eur', overtime_hour_eur,
    'worked_minutes', COALESCE(worked_minutes, 0),
    'hours_raw', ROUND(hours_raw,2),
    'worked_hours_rounded', hours_rounded,
    'base_day_hours', 10,
    'mid_tier_hours', 12,
    'overtime_hours', overtime_hours,
    'base_amount_eur', ROUND(base_amount, 2),
    'overtime_amount_eur', ROUND(overtime_amount,2),
    'total_eur', ROUND(total_amount,2)
  );

  IF _persist THEN
    UPDATE timesheets
    SET amount_eur = ROUND(total_amount,2),
        amount_breakdown = breakdown,
        updated_at = now()
    WHERE id = _timesheet_id;
  END IF;

  RETURN breakdown;
END;
$function$;
