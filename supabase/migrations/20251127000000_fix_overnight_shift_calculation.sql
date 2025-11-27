-- Fix overnight shift calculation in compute_timesheet_amount_2025
-- This migration updates the function to properly handle shifts that span midnight
-- by automatically detecting when end_time < start_time OR when ends_next_day is true

CREATE OR REPLACE FUNCTION compute_timesheet_amount_2025(
  _timesheet_id UUID,
  _persist BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_timesheet RECORD;
  v_job_type TEXT;
  v_category TEXT;
  v_rate_card RECORD;
  v_worked_hours NUMERIC;
  v_billable_hours NUMERIC;
  v_base_day_amount NUMERIC := 0;
  v_plus_10_12_hours NUMERIC := 0;
  v_plus_10_12_amount NUMERIC := 0;
  v_overtime_hours NUMERIC := 0;
  v_overtime_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_breakdown JSONB;
  v_result JSONB;
BEGIN
  -- Get timesheet data and determine category
  -- Category priority: 1) timesheet.category 2) derived from assignment role 3) profile.department
  SELECT
    t.*,
    j.job_type,
    COALESCE(
      t.category,
      -- Derive category from assignment role (R=responsable, E=especialista, T=tecnico)
      CASE
        WHEN a.sound_role LIKE '%-R' OR a.lights_role LIKE '%-R' OR a.video_role LIKE '%-R' THEN 'responsable'
        WHEN a.sound_role LIKE '%-E' OR a.lights_role LIKE '%-E' OR a.video_role LIKE '%-E' THEN 'especialista'
        WHEN a.sound_role LIKE '%-T' OR a.lights_role LIKE '%-T' OR a.video_role LIKE '%-T' THEN 'tecnico'
        ELSE NULL
      END,
      'tecnico' -- Default fallback
    ) as category
  INTO v_timesheet
  FROM timesheets t
  LEFT JOIN jobs j ON t.job_id = j.id
  LEFT JOIN job_assignments a ON t.job_id = a.job_id AND t.technician_id = a.technician_id
  LEFT JOIN profiles p ON t.technician_id = p.id
  WHERE t.id = _timesheet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timesheet not found: %', _timesheet_id;
  END IF;

  v_job_type := v_timesheet.job_type;
  v_category := v_timesheet.category;

  -- First, try to get house tech custom rates
  SELECT
    base_day_eur,
    COALESCE(plus_10_12_eur, (SELECT plus_10_12_eur FROM rate_cards_2025 WHERE category = v_category)) as plus_10_12_eur,
    COALESCE(overtime_hour_eur, (SELECT overtime_hour_eur FROM rate_cards_2025 WHERE category = v_category)) as overtime_hour_eur
  INTO v_rate_card
  FROM house_tech_rates
  WHERE profile_id = v_timesheet.technician_id;

  -- If no house tech rate, use standard rate card
  IF NOT FOUND THEN
    SELECT * INTO v_rate_card
    FROM rate_cards_2025
    WHERE category = v_category;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rate card not found for category: %', v_category;
    END IF;
  END IF;

  -- Calculate worked hours (start to end minus breaks)
  -- CRITICAL FIX: Handle overnight shifts automatically
  -- Auto-detect: if end_time < start_time, it's an overnight shift
  -- Also respect explicit ends_next_day flag
  IF v_timesheet.end_time < v_timesheet.start_time OR COALESCE(v_timesheet.ends_next_day, false) THEN
    -- Overnight shift: add 24 hours
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time + INTERVAL '24 hours'
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  ELSE
    -- Normal same-day shift
    v_worked_hours := EXTRACT(EPOCH FROM (
      v_timesheet.end_time - v_timesheet.start_time
    )) / 3600.0 - (COALESCE(v_timesheet.break_minutes, 0) / 60.0);
  END IF;

  -- Round to nearest 0.5
  v_worked_hours := ROUND(v_worked_hours * 2) / 2.0;

  -- **EVENTO SPECIAL LOGIC**: Locked rate = base_day + plus_10_12 (not time-based)
  -- ALL categories (responsable, especialista, tecnico) use the same logic
  IF v_job_type = 'evento' THEN
    v_billable_hours := 12.0;
    v_base_day_amount := v_rate_card.base_day_eur;
    v_plus_10_12_hours := 0; -- Not actually hours, just the premium
    v_plus_10_12_amount := v_rate_card.plus_10_12_eur;
    v_overtime_hours := 0;
    v_overtime_amount := 0;
    v_total_amount := v_base_day_amount + v_plus_10_12_amount;
  ELSE
    -- Standard calculation for non-evento jobs
    v_billable_hours := v_worked_hours;

    IF v_worked_hours <= 8 THEN
      -- Up to 8 hours: base day rate
      v_base_day_amount := v_rate_card.base_day_eur;
      v_total_amount := v_base_day_amount;
    ELSIF v_worked_hours <= 12 THEN
      -- 8-12 hours: 10-12 hour rate
      v_plus_10_12_hours := v_worked_hours;
      v_plus_10_12_amount := v_rate_card.plus_10_12_eur * v_worked_hours;
      v_total_amount := v_plus_10_12_amount;
    ELSE
      -- Over 12 hours: 12-hour rate + overtime
      v_plus_10_12_hours := 12.0;
      v_plus_10_12_amount := v_rate_card.plus_10_12_eur * 12.0;
      v_overtime_hours := v_worked_hours - 12.0;
      v_overtime_amount := v_rate_card.overtime_hour_eur * v_overtime_hours;
      v_total_amount := v_plus_10_12_amount + v_overtime_amount;
    END IF;
  END IF;

  -- Build breakdown JSON
  v_breakdown := jsonb_build_object(
    'worked_hours', v_worked_hours,
    'worked_hours_rounded', v_worked_hours,
    'hours_rounded', v_worked_hours,
    'billable_hours', v_billable_hours,
    'is_evento', (v_job_type = 'evento'),
    'base_amount_eur', COALESCE(v_base_day_amount, 0),
    'base_day_eur', COALESCE(v_base_day_amount, 0),
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

  -- Persist to database if requested
  IF _persist THEN
    UPDATE timesheets
    SET
      amount_eur = v_total_amount,
      amount_breakdown = v_breakdown,
      category = v_category,
      updated_at = NOW()
    WHERE id = _timesheet_id;
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION compute_timesheet_amount_2025(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION compute_timesheet_amount_2025(UUID, BOOLEAN) TO service_role;

-- Add comment
COMMENT ON FUNCTION compute_timesheet_amount_2025 IS
'Calculates timesheet amounts based on rate cards. For evento jobs, always uses 12 hours at the 12-hour rate with no overtime, regardless of actual worked hours. Automatically handles overnight shifts by detecting when end_time < start_time or when ends_next_day flag is set.';
