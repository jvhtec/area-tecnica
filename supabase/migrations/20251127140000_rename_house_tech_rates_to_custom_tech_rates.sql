-- Rename house_tech_rates to custom_tech_rates
-- This table stores custom rate overrides for ANY technician (house_tech OR technician role)
-- not just house techs

-- Step 1: Rename the table
ALTER TABLE house_tech_rates RENAME TO custom_tech_rates;

-- Step 2: Rename the foreign key constraint
ALTER TABLE custom_tech_rates
  RENAME CONSTRAINT house_tech_rates_profile_id_fkey TO custom_tech_rates_profile_id_fkey;

-- Step 3: Rename any indexes (if they exist with the old name)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'house_tech_rates_pkey') THEN
    ALTER INDEX house_tech_rates_pkey RENAME TO custom_tech_rates_pkey;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'house_tech_rates_profile_id_idx') THEN
    ALTER INDEX house_tech_rates_profile_id_idx RENAME TO custom_tech_rates_profile_id_idx;
  END IF;
END $$;

-- Step 4: Update the compute_timesheet_amount_2025 function to use the new table name
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
  -- Category priority: 1) timesheet.category 2) derived from assignment role 3) default 'tecnico'
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

  -- First, try to get custom rates for this technician (works for both house_tech and technician roles)
  SELECT
    base_day_eur,
    COALESCE(plus_10_12_eur, (SELECT plus_10_12_eur FROM rate_cards_2025 WHERE category = v_category LIMIT 1)) as plus_10_12_eur,
    COALESCE(overtime_hour_eur, (SELECT overtime_hour_eur FROM rate_cards_2025 WHERE category = v_category LIMIT 1)) as overtime_hour_eur
  INTO v_rate_card
  FROM custom_tech_rates
  WHERE profile_id = v_timesheet.technician_id;

  -- If no custom rate, use standard rate card based on category
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
    -- CORRECTED TIER LOGIC:
    -- Tier 1 (0-10.5h): Base day rate only
    -- Tier 2 (10.5-12.5h): Base day + FIXED €30 premium
    -- Tier 3 (>12.5h): Base day + FIXED €30 premium + overtime (rounded to whole hours, .5 rounds down)

    v_billable_hours := v_worked_hours;
    v_base_day_amount := v_rate_card.base_day_eur;

    IF v_worked_hours <= 10.5 THEN
      -- Tier 1: Up to 10.5 hours (10:30) - base day rate only
      v_total_amount := v_base_day_amount;
    ELSIF v_worked_hours <= 12.5 THEN
      -- Tier 2: 10.5-12.5 hours (10:31-12:30) - base + FIXED €30 premium
      v_plus_10_12_hours := 0; -- Not per hour, just a marker that the premium applies
      v_plus_10_12_amount := 30.0; -- FIXED €30 premium
      v_total_amount := v_base_day_amount + v_plus_10_12_amount;
    ELSE
      -- Tier 3: Over 12.5 hours (12:31+) - base + €30 premium + overtime
      v_plus_10_12_hours := 0; -- Not per hour
      v_plus_10_12_amount := 30.0; -- FIXED €30 premium

      -- Calculate overtime hours (hours beyond 12.5)
      v_overtime_hours := v_worked_hours - 12.5;

      -- Round to whole hours with special rule: .5 rounds DOWN
      -- Use CASE to handle .5 specifically
      v_overtime_hours := CASE
        WHEN (v_overtime_hours % 1) = 0.5 THEN FLOOR(v_overtime_hours)
        ELSE ROUND(v_overtime_hours)
      END;

      v_overtime_amount := v_rate_card.overtime_hour_eur * v_overtime_hours;
      v_total_amount := v_base_day_amount + v_plus_10_12_amount + v_overtime_amount;
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
'Calculates timesheet amounts based on rate cards. Checks custom_tech_rates first for any custom overrides (works for both house_tech and technician roles), then falls back to standard rate_cards_2025 by category. Rate tiers: (1) 0-10.5h: base only, (2) 10.5-12.5h: base + fixed €30 premium, (3) >12.5h: base + €30 + overtime (rounded to whole hours, .5 rounds down). For evento jobs, always uses fixed base + premium regardless of hours. Automatically handles overnight shifts by detecting when end_time < start_time or when ends_next_day flag is set.';

-- Add comment to the renamed table
COMMENT ON TABLE custom_tech_rates IS
'Custom rate overrides for technicians. Applies to ANY technician (house_tech OR technician role) who needs custom rates different from the standard rate_cards_2025. When present, these rates take precedence over category-based rates.';
