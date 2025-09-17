-- Enhance compute_timesheet_amount_2025 to derive category from job_assignments when missing
-- Maps role code level (R/E/T) to category (responsable/especialista/tecnico)

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
  derived_category text;
BEGIN
  SELECT * INTO t FROM timesheets WHERE id = _timesheet_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Timesheet % not found', _timesheet_id; END IF;

  -- Derive category from job_assignments if missing
  IF t.category IS NULL THEN
    WITH roles AS (
      SELECT unnest(ARRAY[ja.sound_role, ja.lights_role, ja.video_role]) AS role_code
      FROM job_assignments ja
      WHERE ja.job_id = t.job_id AND ja.technician_id = t.technician_id
    ), levels AS (
      SELECT upper(split_part(role_code, '-', 3)) AS lvl_raw, role_code
      FROM roles WHERE role_code IS NOT NULL
    ), normalized AS (
      SELECT CASE 
               WHEN lvl_raw IS NOT NULL AND lvl_raw <> '' THEN lvl_raw
               WHEN role_code ~* 'responsable' THEN 'R'
               WHEN role_code ~* 'especialista' THEN 'E'
               WHEN role_code ~* 't[eé]cnico' THEN 'T'
               ELSE NULL
             END AS lvl
      FROM levels
    ), ranked AS (
      SELECT lvl,
             CASE lvl WHEN 'R' THEN 3 WHEN 'E' THEN 2 WHEN 'T' THEN 1 ELSE 0 END AS rnk
      FROM normalized
    ), best AS (
      SELECT lvl FROM ranked ORDER BY rnk DESC LIMIT 1
    )
    SELECT CASE lvl WHEN 'R' THEN 'responsable' WHEN 'E' THEN 'especialista' WHEN 'T' THEN 'tecnico' END
    INTO derived_category
    FROM best;

    IF derived_category IS NOT NULL THEN
      UPDATE timesheets SET category = derived_category WHERE id = _timesheet_id;
      t.category := derived_category;
    END IF;
  END IF;

  IF t.category IS NULL THEN RAISE EXCEPTION 'Timesheet % missing category and could not derive from assignments', _timesheet_id; END IF;

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

  -- Tiers logic
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
