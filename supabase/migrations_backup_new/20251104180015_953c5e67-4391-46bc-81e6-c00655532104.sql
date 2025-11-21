-- Add autonomo column to profiles table (applies only to technicians)
ALTER TABLE public.profiles 
ADD COLUMN autonomo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.autonomo IS 'Indicates if technician is autonomous (self-employed). When false, applies -30 EUR/day discount to rates. Only applies to role=technician, not house_tech.';

-- Update the compute_timesheet_amount_2025 function to apply autonomo discount
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

  -- 3) Is house tech? Check autonomo status for non-house techs
  SELECT 
    (role = 'house_tech'),
    CASE WHEN role = 'technician' THEN COALESCE(autonomo, true) ELSE true END
  INTO is_house_tech, is_autonomo
  FROM profiles 
  WHERE id = t.technician_id;

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
  
  -- Store base before discount for transparency
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

  -- 5) Round hours (≥30 minutes round up)
  hours_rounded := CEIL(hours_raw);
  IF (hours_raw - FLOOR(hours_raw)) < 0.5 THEN
    hours_rounded := FLOOR(hours_raw);
  END IF;

  -- 6) Compute amounts
  base_amount := base_day_eur;

  IF hours_rounded > 10 THEN
    IF is_house_tech THEN
      plus_hours := LEAST(GREATEST(hours_rounded - 10, 0), 2);
      plus_amount := CASE WHEN plus_hours > 0 THEN plus_10_12_eur * 1 ELSE 0 END;
    ELSE
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

  -- 7) Breakdown with autonomo discount details
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

-- Update the compute_tour_job_rate_quote_2025 function to apply autonomo discount
CREATE OR REPLACE FUNCTION public.compute_tour_job_rate_quote_2025(_job_id uuid, _tech_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  jtype job_type;
  st timestamptz;
  tour_group uuid;
  cat text;
  house boolean := false;
  is_autonomo boolean := true;
  autonomo_discount numeric := 0;
  base_day_before_discount numeric;
  team_member boolean := false;
  base numeric(10,2);
  mult numeric(6,3) := 1.0;
  cnt int := 1;
  y int := NULL;
  w int := NULL;
  extras jsonb;
  extras_total numeric(10,2);
  final_total numeric(10,2);
  disclaimer boolean;
BEGIN
  -- Fetch job info
  SELECT job_type, start_time, tour_id
  INTO jtype, st, tour_group
  FROM jobs
  WHERE id = _job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','job_not_found');
  END IF;
  IF jtype <> 'tourdate' THEN
    RETURN jsonb_build_object('error','not_tour_date');
  END IF;

  -- Check if house tech and autonomo status
  SELECT 
    (role = 'house_tech'),
    CASE WHEN role = 'technician' THEN COALESCE(autonomo, true) ELSE true END
  INTO house, is_autonomo
  FROM profiles
  WHERE id = _tech_id;

  -- Resolve category (non-house)
  IF NOT house THEN
    SELECT 
      CASE
        WHEN sound_role LIKE '%-R' OR lights_role LIKE '%-R' OR video_role LIKE '%-R' THEN 'responsable'
        WHEN sound_role LIKE '%-E' OR lights_role LIKE '%-E' OR video_role LIKE '%-E' THEN 'especialista'
        WHEN sound_role LIKE '%-T' OR lights_role LIKE '%-T' OR video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END
    INTO cat
    FROM job_assignments
    WHERE job_id = _job_id AND technician_id = _tech_id;

    IF cat IS NULL THEN
      SELECT default_timesheet_category INTO cat
      FROM profiles
      WHERE id = _tech_id AND default_timesheet_category IN ('tecnico','especialista','responsable');
    END IF;

    IF cat IS NULL THEN
      RETURN jsonb_build_object('error','category_missing','profile_id',_tech_id,'job_id',_job_id);
    END IF;
  END IF;

  -- Base rate lookup
  IF house THEN
    SELECT base_day_eur INTO base
    FROM house_tech_rates
    WHERE profile_id = _tech_id;

    IF base IS NULL THEN
      RETURN jsonb_build_object('error','house_rate_missing','profile_id',_tech_id);
    END IF;
  ELSE
    SELECT base_day_eur INTO base
    FROM rate_cards_tour_2025
    WHERE category = cat;

    IF base IS NULL THEN
      RETURN jsonb_build_object('error','tour_base_missing','category',cat);
    END IF;
  END IF;

  -- Store base before discount
  base_day_before_discount := base;
  
  -- Apply autonomo discount for non-house technicians BEFORE multipliers
  IF NOT house AND NOT is_autonomo THEN
    autonomo_discount := 30;
    base := base - autonomo_discount;
  END IF;

  -- Determine if technician belongs to the tour team
  IF tour_group IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM tour_assignments ta
      WHERE ta.tour_id = tour_group
        AND ta.technician_id = _tech_id
    )
    INTO team_member;
  END IF;

  -- Multiplier logic (applies to house techs if they are on the tour team)
  SELECT iso_year, iso_week INTO y, w
  FROM iso_year_week_madrid(st);

  IF team_member THEN
    SELECT count(*) INTO cnt
    FROM job_assignments a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.technician_id = _tech_id
      AND j.job_type = 'tourdate'
      AND j.tour_id = tour_group
      AND (SELECT iso_year FROM iso_year_week_madrid(j.start_time)) = y
      AND (SELECT iso_week FROM iso_year_week_madrid(j.start_time)) = w;

    SELECT multiplier INTO mult
    FROM tour_week_multipliers_2025
    WHERE GREATEST(1, cnt) BETWEEN min_dates AND max_dates
    ORDER BY min_dates
    LIMIT 1;

    IF mult IS NULL THEN
      mult := 1.0;
    END IF;
  ELSE
    cnt := 1;
    mult := 1.0;
  END IF;

  -- Apply multiplier
  base := ROUND(base * mult, 2);

  extras := extras_total_for_job_tech(_job_id, _tech_id);
  extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
  final_total := ROUND(base + extras_total, 2);

  disclaimer := needs_vehicle_disclaimer(_tech_id);

  RETURN jsonb_build_object(
    'job_id', _job_id,
    'technician_id', _tech_id,
    'start_time', st,
    'end_time', st,
    'job_type', 'tourdate',
    'tour_id', tour_group,
    'title', '',
    'is_house_tech', house,
    'is_tour_team_member', team_member,
    'category', cat,
    'autonomo_discount_eur', ROUND(autonomo_discount, 2),
    'base_day_before_discount_eur', ROUND(base_day_before_discount, 2),
    'base_day_eur', base / GREATEST(mult, 1.0),
    'week_count', GREATEST(1, cnt),
    'multiplier', mult,
    'iso_year', y,
    'iso_week', w,
    'total_eur', base,
    'extras', extras,
    'extras_total_eur', extras_total,
    'total_with_extras_eur', final_total,
    'vehicle_disclaimer', disclaimer,
    'vehicle_disclaimer_text', CASE
      WHEN disclaimer THEN 'Vehicle usage requires prior approval'
      ELSE NULL
    END,
    'breakdown', jsonb_build_object(
      'autonomo_discount_applied', autonomo_discount > 0,
      'base_before_discount', ROUND(base_day_before_discount, 2),
      'discount_amount', ROUND(autonomo_discount, 2)
    )
  );
END;
$function$;