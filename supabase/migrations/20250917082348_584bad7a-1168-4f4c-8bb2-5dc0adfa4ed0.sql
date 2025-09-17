-- Fix security issues from 2025 rate calculator implementation

-- 1) Fix function search path for security
CREATE OR REPLACE FUNCTION minutes_to_hours_round_30(mins integer)
RETURNS integer 
LANGUAGE sql 
IMMUTABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN mins IS NULL OR mins <= 0 THEN 0
    ELSE (mins / 60) + CASE WHEN (mins % 60) >= 30 THEN 1 ELSE 0 END
  END;
$$;

-- 2) Fix compute function search path
CREATE OR REPLACE FUNCTION compute_timesheet_amount_2025(_timesheet_id uuid, _persist boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t record;
  rc record;
  total_mins int;
  rounded_hours int;
  base_amount numeric(10,2) := 0;
  overtime_hours int := 0;
  overtime_amount numeric(10,2) := 0;
  total numeric(10,2) := 0;
  breakdown jsonb;
BEGIN
  SELECT * INTO t FROM timesheets WHERE id = _timesheet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Timesheet % not found', _timesheet_id; END IF;
  IF t.category IS NULL THEN RAISE EXCEPTION 'Timesheet % missing category', _timesheet_id; END IF;

  SELECT * INTO rc FROM rate_cards_2025 WHERE category = t.category;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rate card not found for %', t.category; END IF;

  -- Calculate total worked minutes = (end - start) - break
  total_mins := GREATEST(0, 
    CASE 
      WHEN t.start_time IS NOT NULL AND t.end_time IS NOT NULL THEN
        CAST(EXTRACT(epoch FROM (t.end_time::time - t.start_time::time)) AS int) / 60 - COALESCE(t.break_minutes,0)
      ELSE 0
    END
  );
  
  rounded_hours := minutes_to_hours_round_30(total_mins);

  -- Tiers:
  -- <= base_day_hours: base
  -- > base_day_hours and <= mid_tier_hours: base + plus_10_12
  -- > mid_tier_hours: base + plus_10_12 + overtime(rounded_hours - mid_tier_hours)
  IF rounded_hours <= rc.base_day_hours THEN
    base_amount := rc.base_day_eur;
  ELSIF rounded_hours <= rc.mid_tier_hours THEN
    base_amount := rc.base_day_eur + rc.plus_10_12_eur;
  ELSE
    base_amount := rc.base_day_eur + rc.plus_10_12_eur;
    overtime_hours := rounded_hours - rc.mid_tier_hours;
    overtime_amount := rc.overtime_hour_eur * overtime_hours;
  END IF;

  total := base_amount + overtime_amount;

  breakdown := jsonb_build_object(
    'category', t.category,
    'worked_minutes', total_mins,
    'worked_hours_rounded', rounded_hours,
    'base_day_hours', rc.base_day_hours,
    'mid_tier_hours', rc.mid_tier_hours,
    'base_amount_eur', ROUND(base_amount,2),
    'overtime_hours', overtime_hours,
    'overtime_hour_eur', rc.overtime_hour_eur,
    'overtime_amount_eur', ROUND(overtime_amount,2),
    'total_eur', ROUND(total,2),
    'notes', jsonb_build_array(
      'Rounding: next hour starts at ≥ 30 minutes',
      'No €30 deductions applied in math; conditions shown as disclaimers only',
      'House techs (in-house) rates will be implemented later'
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

-- 3) Replace the security definer view with a security definer function
DROP VIEW IF EXISTS timesheet_amounts_visible;

CREATE OR REPLACE FUNCTION get_timesheet_with_visible_amounts(_timesheet_id uuid)
RETURNS TABLE (
  id uuid,
  job_id uuid,
  technician_id uuid,
  date date,
  start_time time,
  end_time time,
  break_minutes integer,
  overtime_hours numeric(4,2),
  notes text,
  status timesheet_status,
  signature_data text,
  signed_at timestamptz,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  category text,
  amount_eur numeric(10,2),
  amount_breakdown jsonb,
  approved_by_manager boolean,
  amount_eur_visible numeric(10,2),
  amount_breakdown_visible jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_record record;
  is_manager boolean := false;
BEGIN
  -- Check if current user is a manager
  SELECT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'management')
  ) INTO is_manager;

  -- Get the timesheet record
  SELECT * INTO t_record FROM timesheets WHERE timesheets.id = _timesheet_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Return the record with visibility rules applied
  RETURN QUERY SELECT
    t_record.id,
    t_record.job_id,
    t_record.technician_id,
    t_record.date,
    t_record.start_time,
    t_record.end_time,
    t_record.break_minutes,
    t_record.overtime_hours,
    t_record.notes,
    t_record.status,
    t_record.signature_data,
    t_record.signed_at,
    t_record.created_by,
    t_record.approved_by,
    t_record.approved_at,
    t_record.created_at,
    t_record.updated_at,
    t_record.category,
    t_record.amount_eur,
    t_record.amount_breakdown,
    t_record.approved_by_manager,
    CASE 
      WHEN is_manager THEN t_record.amount_eur
      WHEN t_record.approved_by_manager = true THEN t_record.amount_eur
      ELSE NULL
    END as amount_eur_visible,
    CASE 
      WHEN is_manager THEN t_record.amount_breakdown
      WHEN t_record.approved_by_manager = true THEN t_record.amount_breakdown
      ELSE NULL
    END as amount_breakdown_visible;
END;
$$;
