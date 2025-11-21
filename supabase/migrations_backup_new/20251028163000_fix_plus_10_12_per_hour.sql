-- Ensure +30€ per hour for hours 11 and 12 for non-house technicians
-- House techs keep existing special logic (OT = base/10 unless overridden)

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
  plus_hours numeric := 0;           -- hours in (10, 12]
  plus_amount numeric := 0;          -- plus_10_12 block amount
  overtime_hours numeric := 0;       -- hours > 12
  base_amount numeric := 0;
  overtime_amount numeric := 0;
  total_amount numeric;
  breakdown jsonb;
  worked_minutes integer;
BEGIN
  -- 1) Fetch the timesheet core fields
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

  -- 2) Determine category
  cat := COALESCE(
    t.category_override,
    (SELECT default_timesheet_category FROM profiles WHERE id = t.technician_id),
    'tecnico'
  );

  -- 3) Is house tech?
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE id = t.technician_id AND role = 'house_tech'
  ) INTO is_house_tech;

  -- 4) Effective rates
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
  IF is_house_tech AND eff.base_day_override IS NOT NULL THEN
    overtime_hour_eur := COALESCE(eff.overtime_override, ROUND(base_day_eur / 10, 2));
  ELSE
    overtime_hour_eur := COALESCE(eff.overtime_override, eff.overtime_default);
  END IF;

  -- 5) Round hours (≥30 minutes round up)
  hours_rounded := CEIL(hours_raw);
  IF (hours_raw - FLOOR(hours_raw)) < 0.5 THEN
    hours_rounded := FLOOR(hours_raw);
  END IF;

  -- 6) Compute amounts
  base_amount := base_day_eur;

  IF hours_rounded > 10 THEN
    IF is_house_tech THEN
      -- House techs: keep existing behavior (single plus between 10–12)
      plus_hours := LEAST(GREATEST(hours_rounded - 10, 0), 2);
      -- Historically, house techs applied a single block, but keep per-hour if overrides provided
      plus_amount := CASE WHEN plus_hours > 0 THEN plus_10_12_eur * 1 ELSE 0 END;
    ELSE
      -- Non-house technician: +30€/hour for hours 11 and 12 (per-hour, not single block)
      plus_hours := LEAST(GREATEST(hours_rounded - 10, 0), 2);
      plus_amount := plus_hours * plus_10_12_eur;
    END IF;
    base_amount := base_amount + plus_amount;
  END IF;

  IF hours_rounded > 12 THEN
    overtime_hours := hours_rounded - 12;
    overtime_amount := overtime_hours * overtime_hour_eur;
  END IF;

  total_amount := base_amount + overtime_amount;

  -- 7) Breakdown (add explicit plus fields)
  breakdown := jsonb_build_object(
    'category', cat,
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

