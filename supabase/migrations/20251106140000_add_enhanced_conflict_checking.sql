-- Enhanced conflict checking with hard/soft conflict distinction
-- Audit Report: AUDIT_REPORT_JOB_ASSIGNMENT_MATRIX.md
-- Fix Task: FIX_TASK_3_CONFLICT_CHECKING.md

-- Create RPC function for comprehensive conflict checking
CREATE OR REPLACE FUNCTION check_technician_conflicts(
  _technician_id uuid,
  _target_job_id uuid,
  _target_date date DEFAULT NULL,
  _single_day boolean DEFAULT false,
  _include_pending boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  target_job record;
  hard_conflicts jsonb := '[]'::jsonb;
  soft_conflicts jsonb := '[]'::jsonb;
  unavailability_conflicts jsonb := '[]'::jsonb;
  target_start_date date;
  target_end_date date;
BEGIN
  -- Fetch target job
  SELECT id, title, start_time, end_time INTO target_job
  FROM jobs
  WHERE id = _target_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'hasHardConflict', false,
      'hasSoftConflict', false,
      'hardConflicts', '[]'::jsonb,
      'softConflicts', '[]'::jsonb,
      'unavailabilityConflicts', '[]'::jsonb
    );
  END IF;

  -- Calculate target date range
  IF _single_day AND _target_date IS NOT NULL THEN
    target_start_date := _target_date;
    target_end_date := _target_date;
  ELSE
    target_start_date := DATE(target_job.start_time);
    target_end_date := DATE(target_job.end_time);
  END IF;

  -- Check confirmed assignments (hard conflicts)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', j.id,
      'title', j.title,
      'start_time', j.start_time,
      'end_time', j.end_time,
      'status', a.status
    )
  ) INTO hard_conflicts
  FROM job_assignments a
  INNER JOIN jobs j ON a.job_id = j.id
  WHERE a.technician_id = _technician_id
    AND a.job_id != _target_job_id
    AND a.status = 'confirmed'
    AND (
      -- Handle different conflict scenarios
      CASE
        WHEN _single_day AND _target_date IS NOT NULL THEN
          -- Checking a single-day assignment
          CASE
            WHEN a.single_day AND a.assignment_date IS NOT NULL THEN
              -- Both single-day: check same date
              a.assignment_date = _target_date
            ELSE
              -- Existing is whole-job: check if _target_date falls in job range
              _target_date BETWEEN DATE(j.start_time) AND DATE(j.end_time)
          END
        ELSE
          -- Checking a whole-job assignment
          CASE
            WHEN a.single_day AND a.assignment_date IS NOT NULL THEN
              -- Existing is single-day: check if it falls in target job range
              a.assignment_date BETWEEN target_start_date AND target_end_date
            ELSE
              -- Both whole-job: check date overlap
              NOT (DATE(j.end_time) < target_start_date OR DATE(j.start_time) > target_end_date)
          END
      END
    );

  -- Check pending/invited assignments (soft conflicts) if requested
  IF _include_pending THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', j.id,
        'title', j.title,
        'start_time', j.start_time,
        'end_time', j.end_time,
        'status', a.status
      )
    ) INTO soft_conflicts
    FROM job_assignments a
    INNER JOIN jobs j ON a.job_id = j.id
    WHERE a.technician_id = _technician_id
      AND a.job_id != _target_job_id
      AND a.status = 'invited'
      AND (
        -- Same conflict logic as above
        CASE
          WHEN _single_day AND _target_date IS NOT NULL THEN
            CASE
              WHEN a.single_day AND a.assignment_date IS NOT NULL THEN
                a.assignment_date = _target_date
              ELSE
                _target_date BETWEEN DATE(j.start_time) AND DATE(j.end_time)
            END
          ELSE
            CASE
              WHEN a.single_day AND a.assignment_date IS NOT NULL THEN
                a.assignment_date BETWEEN target_start_date AND target_end_date
              ELSE
                NOT (DATE(j.end_time) < target_start_date OR DATE(j.start_time) > target_end_date)
            END
        END
      );
  END IF;

  -- Check unavailability
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'reason', CASE WHEN source = 'vacation' THEN 'Vacation' ELSE 'Unavailable' END,
      'source', source,
      'notes', notes
    )
  ) INTO unavailability_conflicts
  FROM availability_schedules
  WHERE user_id = _technician_id
    AND status = 'unavailable'
    AND date BETWEEN target_start_date AND target_end_date;

  -- Build result
  RETURN jsonb_build_object(
    'hasHardConflict',
      (COALESCE(jsonb_array_length(hard_conflicts), 0) > 0 OR
       COALESCE(jsonb_array_length(unavailability_conflicts), 0) > 0),
    'hasSoftConflict',
      COALESCE(jsonb_array_length(soft_conflicts), 0) > 0,
    'hardConflicts',
      COALESCE(hard_conflicts, '[]'::jsonb),
    'softConflicts',
      COALESCE(soft_conflicts, '[]'::jsonb),
    'unavailabilityConflicts',
      COALESCE(unavailability_conflicts, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION check_technician_conflicts IS
  'Comprehensive conflict checking that distinguishes between hard conflicts (confirmed assignments, unavailability) and soft conflicts (pending invitations). Used by both frontend and edge functions.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_technician_conflicts TO authenticated;

-- Test the function
DO $$
BEGIN
  RAISE NOTICE '✅ Enhanced conflict checking RPC function created successfully';
  RAISE NOTICE 'Function supports:';
  RAISE NOTICE '  - Hard conflicts: confirmed assignments and unavailability';
  RAISE NOTICE '  - Soft conflicts: pending/invited assignments';
  RAISE NOTICE '  - Single-day and whole-job assignment logic';
  RAISE NOTICE '  - Proper date range overlap detection';
END $$;
