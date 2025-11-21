-- Add default_timesheet_category column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS default_timesheet_category text 
CHECK (default_timesheet_category IN ('tecnico', 'especialista', 'responsable'));

-- Helper function: resolves category for a timesheet using priority logic
CREATE OR REPLACE FUNCTION public.resolve_category_for_timesheet(_job_id uuid, _tech_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE 
  cat text;
BEGIN
  -- 1) Last known category for the same (job, tech)
  SELECT category INTO cat
  FROM timesheets
  WHERE job_id = _job_id AND technician_id = _tech_id AND category IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF cat IS NOT NULL THEN 
    RETURN cat; 
  END IF;

  -- 2) From profile default
  SELECT default_timesheet_category INTO cat
  FROM profiles
  WHERE id = _tech_id AND default_timesheet_category IN ('tecnico', 'especialista', 'responsable')
  LIMIT 1;
  
  IF cat IS NOT NULL THEN 
    RETURN cat; 
  END IF;

  RETURN NULL;
END;
$$;

-- BEFORE INSERT/UPDATE trigger function: auto-fill category when NULL
CREATE OR REPLACE FUNCTION public.trg_timesheets_autofill_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE 
  resolved text;
BEGIN
  IF (NEW.category IS NULL) THEN
    resolved := resolve_category_for_timesheet(NEW.job_id, NEW.technician_id);
    IF resolved IS NOT NULL THEN
      NEW.category := resolved;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS t_bi_set_category ON timesheets;
CREATE TRIGGER t_bi_set_category
  BEFORE INSERT ON timesheets
  FOR EACH ROW EXECUTE FUNCTION trg_timesheets_autofill_category();

DROP TRIGGER IF EXISTS t_bu_set_category ON timesheets;
CREATE TRIGGER t_bu_set_category
  BEFORE UPDATE OF job_id, technician_id, category ON timesheets
  FOR EACH ROW EXECUTE FUNCTION trg_timesheets_autofill_category();

-- Add activity catalog entry for auto-fill logging
INSERT INTO activity_catalog(code, label, default_visibility, severity, toast_enabled, template) 
VALUES ('timesheet.category.autofilled', 'Timesheet category autofilled', 'management', 'info', true, 'Category set to {resolved}')
ON CONFLICT (code) DO NOTHING;

-- Update compute_timesheet_amount_2025 to handle NULL categories gracefully
CREATE OR REPLACE FUNCTION public.compute_timesheet_amount_2025(_timesheet_id uuid, _persist boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  t record;
  eff record;
  cat text;
  total_mins int;
  rounded_hours int;
  base_amount numeric(10,2) := 0;
  overtime_hours int := 0;
  overtime_amount numeric(10,2) := 0;
  total numeric(10,2) := 0;
  base_day_eur numeric(10,2);
  plus_10_12_eur numeric(10,2);
  overtime_hour_eur numeric(10,2);
  breakdown jsonb;
BEGIN
  SELECT * INTO t FROM timesheets WHERE id = _timesheet_id;
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Timesheet % not found', _timesheet_id; 
  END IF;

  cat := t.category;
  IF cat IS NULL THEN
    cat := resolve_category_for_timesheet(t.job_id, t.technician_id);
    IF cat IS NOT NULL THEN
      -- Persist the fix immediately
      UPDATE timesheets SET category = cat WHERE id = _timesheet_id;
      -- Log activity so managers know we auto-fixed
      PERFORM log_activity('timesheet.category.autofilled', t.job_id, 'timesheet', _timesheet_id::text,
        jsonb_build_object('previous', t.category, 'resolved', cat), 'management');
    ELSE
      RAISE EXCEPTION 'Missing category and could not resolve for timesheet %', _timesheet_id;
    END IF;
  END IF;

  -- Use the function we created earlier to get effective rates
  SELECT * INTO eff FROM get_timesheet_effective_rate(_timesheet_id);
  IF NOT FOUND THEN 
    RAISE EXCEPTION 'Effective rate not found (category %)', cat; 
  END IF;

  -- Choose overrides when present; otherwise defaults
  base_day_eur     := COALESCE(eff.base_day_override,   eff.base_day_default);
  plus_10_12_eur   := COALESCE(eff.plus_10_12_override, eff.plus_10_12_default);
  overtime_hour_eur:= COALESCE(eff.overtime_override,   eff.overtime_default);

  -- Calculate total worked minutes = (end - start) - break
  -- Support shifts that extend into the next day
  total_mins := GREATEST(0,
    CASE
      WHEN t.start_time IS NOT NULL AND t.end_time IS NOT NULL THEN
        CAST(EXTRACT(
          epoch FROM (
            ((timestamp '2000-01-01' + t.end_time::time)
              + CASE WHEN COALESCE(t.ends_next_day, false) THEN interval '1 day' ELSE interval '0 day' END)
            - (timestamp '2000-01-01' + t.start_time::time)
          )
        ) AS int) / 60 - COALESCE(t.break_minutes, 0)
      ELSE 0
    END
  );
  
  rounded_hours := minutes_to_hours_round_30(total_mins);

  -- Tiers: <=10h base; 10-12h +30; >12h overtime for hours over 12
  IF rounded_hours <= 10 THEN
    base_amount := base_day_eur;
  ELSIF rounded_hours <= 12 THEN
    base_amount := base_day_eur + plus_10_12_eur;
  ELSE
    base_amount := base_day_eur + plus_10_12_eur;
    overtime_hours := rounded_hours - 12;
    overtime_amount := overtime_hour_eur * overtime_hours;
  END IF;

  total := base_amount + overtime_amount;

  breakdown := jsonb_build_object(
    'rate_source', CASE WHEN eff.base_day_override IS NOT NULL THEN 'profile_override' else 'category_default' END,
    'category', cat,
    'worked_minutes', total_mins,
    'worked_hours_rounded', rounded_hours,
    'base_day_eur', ROUND(base_day_eur,2),
    'plus_10_12_eur', ROUND(plus_10_12_eur,2),
    'overtime_hour_eur', ROUND(overtime_hour_eur,2),
    'base_day_hours', 10,
    'mid_tier_hours', 12,
    'base_amount_eur', ROUND(base_amount - overtime_amount,2),
    'overtime_hours', overtime_hours,
    'overtime_amount_eur', ROUND(overtime_amount,2),
    'total_eur', ROUND(total,2),
    'notes', jsonb_build_array(
      'Rounding: next hour starts at ≥ 30 minutes',
      CASE WHEN eff.base_day_override IS NOT NULL THEN 'Using profile-specific rates' ELSE 'Using category default rates' END
    )
  );

  IF _persist THEN
    UPDATE timesheets
    SET amount_eur = ROUND(total,2),
        amount_breakdown = breakdown
    WHERE id = _timesheet_id;
  END IF;

  RETURN breakdown;
END;
$$;