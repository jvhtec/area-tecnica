-- Fix check_technician_conflicts RPC function to filter by is_active
-- This ensures voided timesheets (day-off/travel dates) don't show as conflicts

CREATE OR REPLACE FUNCTION check_technician_conflicts(
  _technician_id UUID,
  _target_job_id UUID,
  _target_date DATE DEFAULT NULL,
  _single_day BOOLEAN DEFAULT FALSE,
  _include_pending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSONB;
  v_target_job RECORD;
  v_start_date DATE;
  v_end_date DATE;
  v_hard_conflicts JSONB := '[]'::JSONB;
  v_soft_conflicts JSONB := '[]'::JSONB;
  v_unavailability JSONB := '[]'::JSONB;
BEGIN
  -- Get target job details
  SELECT start_time::DATE, end_time::DATE
  INTO v_target_job
  FROM jobs
  WHERE id = _target_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'hasHardConflict', false,
      'hasSoftConflict', false,
      'hardConflicts', '[]'::JSONB,
      'softConflicts', '[]'::JSONB,
      'unavailabilityConflicts', '[]'::JSONB
    );
  END IF;

  -- Determine date range to check
  IF _target_date IS NOT NULL THEN
    v_start_date := _target_date;
    v_end_date := _target_date;
  ELSE
    v_start_date := v_target_job.start_time;
    v_end_date := v_target_job.end_time;
  END IF;

  -- Check for hard conflicts (confirmed assignments via ACTIVE timesheets)
  -- CRITICAL: Only check is_active = true timesheets
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', j.id,
      'title', j.title,
      'start_time', j.start_time,
      'end_time', j.end_time,
      'status', 'confirmed'
    )
  ), '[]'::JSONB)
  INTO v_hard_conflicts
  FROM timesheets ts
  JOIN jobs j ON j.id = ts.job_id
  WHERE ts.technician_id = _technician_id
    AND ts.is_active = true  -- Only check active timesheets
    AND ts.job_id != _target_job_id
    AND ts.date >= v_start_date
    AND ts.date <= v_end_date;

  -- Check for soft conflicts (pending invitations) if requested
  IF _include_pending THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', j.id,
        'title', j.title,
        'start_time', j.start_time,
        'end_time', j.end_time,
        'status', 'pending'
      )
    ), '[]'::JSONB)
    INTO v_soft_conflicts
    FROM job_assignments ja
    JOIN jobs j ON j.id = ja.job_id
    WHERE ja.technician_id = _technician_id
      AND ja.job_id != _target_job_id
      AND ja.status = 'invited'
      AND (
        (_target_date IS NOT NULL AND EXISTS (
          SELECT 1 FROM timesheets ts
          WHERE ts.job_id = ja.job_id
            AND ts.technician_id = _technician_id
            AND ts.is_active = true  -- Only check active timesheets
            AND ts.date = _target_date
        ))
        OR (_target_date IS NULL AND (
          j.start_time::DATE <= v_end_date AND
          j.end_time::DATE >= v_start_date
        ))
      );
  END IF;

  -- Check for unavailability conflicts
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'date', ta.date,
      'reason', CASE
        WHEN ta.status = 'day_off' THEN 'Day Off'
        WHEN ta.status = 'travel' THEN 'Travel'
        WHEN ta.status = 'sick' THEN 'Sick'
        WHEN ta.status = 'vacation' THEN 'Vacation'
        ELSE 'Unavailable'
      END,
      'source', 'technician_availability'
    )
  ), '[]'::JSONB)
  INTO v_unavailability
  FROM technician_availability ta
  WHERE ta.technician_id = _technician_id
    AND ta.date >= v_start_date
    AND ta.date <= v_end_date;

  -- Build result
  v_result := jsonb_build_object(
    'hasHardConflict', jsonb_array_length(v_hard_conflicts) > 0,
    'hasSoftConflict', jsonb_array_length(v_soft_conflicts) > 0,
    'hardConflicts', v_hard_conflicts,
    'softConflicts', v_soft_conflicts,
    'unavailabilityConflicts', v_unavailability
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION check_technician_conflicts IS
'Checks for scheduling conflicts for a technician. IMPORTANT: Filters by is_active = true to exclude voided timesheets (day-off/travel dates).';
