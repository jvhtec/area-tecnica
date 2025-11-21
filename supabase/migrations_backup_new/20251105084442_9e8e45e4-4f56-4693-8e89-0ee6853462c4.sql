-- Part 1: Add rehearsal rate column for house techs
ALTER TABLE house_tech_rates
ADD COLUMN IF NOT EXISTS rehearsal_day_eur NUMERIC(10,2) DEFAULT NULL;

COMMENT ON COLUMN house_tech_rates.rehearsal_day_eur IS 
'Fixed daily rate for rehearsals. If NULL, uses normal calculation.';

-- Part 2: Update compute_timesheet_amount_2025 to handle rehearsal flat rates
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

-- Part 3: Update compute_tour_job_rate_quote_2025 to handle rehearsal flat rates
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
  tour_date_type text := NULL;
  rehearsal_flat_rate numeric := NULL;
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

  -- Check for rehearsal tour date type
  SELECT td.tour_date_type INTO tour_date_type
  FROM tour_dates td
  JOIN jobs j ON j.tour_date_id = td.id
  WHERE j.id = _job_id
  LIMIT 1;

  -- Check if house tech and autonomo status
  SELECT 
    (role = 'house_tech'),
    CASE WHEN role = 'technician' THEN COALESCE(autonomo, true) ELSE true END
  INTO house, is_autonomo
  FROM profiles
  WHERE id = _tech_id;

  -- Handle rehearsal flat rate for tour dates
  IF tour_date_type = 'rehearsal' THEN
    IF house THEN
      -- Check for custom house tech rehearsal rate
      SELECT rehearsal_day_eur INTO rehearsal_flat_rate
      FROM house_tech_rates
      WHERE profile_id = _tech_id;
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

  -- If rehearsal flat rate applies, return early
  IF rehearsal_flat_rate IS NOT NULL THEN
    extras := extras_total_for_job_tech(_job_id, _tech_id);
    extras_total := COALESCE((extras->>'total_eur')::numeric, 0);
    final_total := ROUND(rehearsal_flat_rate + extras_total, 2);
    disclaimer := needs_vehicle_disclaimer(_tech_id);

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
      'breakdown', jsonb_build_object('notes', ARRAY['Rehearsal flat rate applied'])
    );
  END IF;

  -- Normal tour rate calculation continues...
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

  -- Multiplier logic
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
    'job_type', jtype,
    'tour_id', tour_group,
    'is_house_tech', house,
    'is_tour_team_member', team_member,
    'category', cat,
    'base_day_eur', base,
    'autonomo_discount_eur', ROUND(autonomo_discount, 2),
    'base_day_before_discount_eur', ROUND(base_day_before_discount, 2),
    'week_count', cnt,
    'multiplier', mult,
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
      'after_discount', ROUND(base_day_before_discount - autonomo_discount, 2),
      'multiplier', mult,
      'final_base', ROUND(base, 2)
    )
  );
END;
$function$;

-- Part 4: Create cascade delete trigger for timesheets
CREATE OR REPLACE FUNCTION delete_timesheets_on_assignment_removal()
RETURNS TRIGGER AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete timesheets for this assignment
  DELETE FROM timesheets
  WHERE job_id = OLD.job_id
    AND technician_id = OLD.technician_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log for audit trail
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Deleted % timesheet(s) for job % and technician % due to assignment removal', 
      deleted_count,
      OLD.job_id, 
      OLD.technician_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS trigger_delete_timesheets ON job_assignments;

CREATE TRIGGER trigger_delete_timesheets
AFTER DELETE ON job_assignments
FOR EACH ROW
EXECUTE FUNCTION delete_timesheets_on_assignment_removal();

COMMENT ON TRIGGER trigger_delete_timesheets ON job_assignments IS 
'Automatically deletes all timesheets when a technician assignment is removed from a job';