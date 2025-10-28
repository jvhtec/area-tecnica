-- Fix compute_timesheet_amount_2025 to calculate worked hours from start_time, end_time, break_minutes
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
  base_day_eur numeric;
  plus_10_12_eur numeric;
  overtime_hour_eur numeric;
  hours_raw numeric;
  hours_rounded numeric;
  overtime_hours numeric := 0;
  base_amount numeric := 0;
  overtime_amount numeric := 0;
  total_amount numeric;
  breakdown jsonb;
  worked_minutes integer;
BEGIN
  -- 1) Fetch the timesheet
  SELECT
    ts.id, ts.technician_id, ts.job_id,
    ts.start_time, ts.end_time, ts.break_minutes, ts.ends_next_day,
    ts.category AS category_override
  INTO t
  FROM timesheets ts
  WHERE ts.id = _timesheet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timesheet % not found', _timesheet_id;
  END IF;

  -- Calculate worked hours from start_time, end_time, break_minutes
  IF t.start_time IS NULL OR t.end_time IS NULL THEN
    hours_raw := 0;
  ELSE
    -- Calculate time difference in minutes
    worked_minutes := EXTRACT(EPOCH FROM (t.end_time - t.start_time)) / 60;
    
    -- Handle overnight shifts (ends_next_day)
    IF t.ends_next_day OR worked_minutes < 0 THEN
      worked_minutes := worked_minutes + (24 * 60); -- Add 24 hours
    END IF;
    
    -- Subtract break time
    worked_minutes := worked_minutes - COALESCE(t.break_minutes, 0);
    
    -- Convert to hours
    hours_raw := GREATEST(0, worked_minutes::numeric / 60);
  END IF;

  -- 2) Determine category
  cat := COALESCE(
    t.category_override,
    (SELECT default_timesheet_category FROM profiles WHERE id = t.technician_id),
    'tecnico'
  );

  -- 3) Check if technician is a house tech
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE id = t.technician_id AND role = 'house_tech'
  ) INTO is_house_tech;

  -- 4) Build effective rates
  SELECT
    -- Overrides from house_tech_rates
    htr.base_day_eur       AS base_day_override,
    htr.plus_10_12_eur     AS plus_10_12_override,
    htr.overtime_hour_eur  AS overtime_override,
    -- Defaults from rate_cards_2025
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

  -- 5) Choose overrides when present; otherwise defaults
  base_day_eur     := COALESCE(eff.base_day_override, eff.base_day_default);
  plus_10_12_eur   := COALESCE(eff.plus_10_12_override, eff.plus_10_12_default);

  -- Special logic for house tech overtime
  IF is_house_tech AND eff.base_day_override IS NOT NULL THEN
    -- House techs get 1/10 of their base rate, unless explicitly overridden
    overtime_hour_eur := COALESCE(eff.overtime_override, ROUND(base_day_eur / 10, 2));
  ELSE
    -- Standard logic for everyone else
    overtime_hour_eur := COALESCE(eff.overtime_override, eff.overtime_default);
  END IF;

  -- 6) Round up: if minutes >= 30, count as next full hour
  hours_rounded := CEIL(hours_raw);
  IF (hours_raw - FLOOR(hours_raw)) < 0.5 THEN
    hours_rounded := FLOOR(hours_raw);
  END IF;

  -- 7) Compute base and overtime
  IF hours_rounded <= 10 THEN
    base_amount := base_day_eur;
  ELSIF hours_rounded <= 12 THEN
    base_amount := base_day_eur + plus_10_12_eur;
  ELSE
    base_amount := base_day_eur + plus_10_12_eur;
    overtime_hours := hours_rounded - 12;
    overtime_amount := overtime_hours * overtime_hour_eur;
  END IF;

  total_amount := base_amount + overtime_amount;

  -- 8) Build breakdown
  breakdown := jsonb_build_object(
    'category', cat,
    'base_day_eur', base_day_eur,
    'plus_10_12_eur', plus_10_12_eur,
    'overtime_hour_eur', overtime_hour_eur,
    'worked_minutes', COALESCE(worked_minutes, 0),
    'hours_raw', ROUND(hours_raw,2),
    'worked_hours_rounded', hours_rounded,
    'base_day_hours', 10,
    'mid_tier_hours', 12,
    'overtime_hours', overtime_hours,
    'base_amount_eur', ROUND(base_amount, 2),
    'overtime_amount_eur', ROUND(overtime_amount,2),
    'total_eur', ROUND(total_amount,2),
    'notes', jsonb_build_array(
      'Rounding: next hour starts at ≥ 30 minutes',
      CASE 
        WHEN eff.base_day_override IS NOT NULL THEN 'Using profile-specific rates'
        ELSE 'Using category default rates'
      END,
      CASE
        WHEN is_house_tech AND eff.overtime_override IS NULL AND eff.base_day_override IS NOT NULL
        THEN 'House tech OT = base rate ÷ 10'
        ELSE NULL
      END
    ) - 'null'::jsonb
  );

  -- 9) Optionally persist
  IF _persist THEN
    UPDATE timesheets
    SET 
      amount_eur = ROUND(total_amount,2),
      amount_breakdown = breakdown,
      updated_at = now()
    WHERE id = _timesheet_id;
  END IF;

  RETURN breakdown;
END;
$function$;