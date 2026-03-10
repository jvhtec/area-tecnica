-- Migration: Add health monitoring RPC functions
-- Detects orphaned timesheets and data integrity issues

-- Function to find orphaned timesheets (no parent assignment)
CREATE OR REPLACE FUNCTION find_orphaned_timesheets()
RETURNS TABLE(
  technician_id UUID,
  job_id UUID,
  date DATE,
  timesheet_count BIGINT,
  job_title TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.technician_id,
    ts.job_id,
    ts.date,
    COUNT(*)::BIGINT as timesheet_count,
    j.title as job_title
  FROM timesheets ts
  LEFT JOIN job_assignments ja 
    ON ja.job_id = ts.job_id AND ja.technician_id = ts.technician_id
  LEFT JOIN jobs j
    ON j.id = ts.job_id
  WHERE ja.id IS NULL
    AND ts.is_active = true
  GROUP BY ts.technician_id, ts.job_id, ts.date, j.title
  ORDER BY ts.date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to find double-bookings (same tech, same date, multiple active jobs)
CREATE OR REPLACE FUNCTION find_double_bookings()
RETURNS TABLE(
  technician_id UUID,
  date DATE,
  job_count BIGINT,
  job_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t1.technician_id,
    t1.date,
    COUNT(DISTINCT t1.job_id)::BIGINT as job_count,
    ARRAY_AGG(DISTINCT t1.job_id) as job_ids
  FROM timesheets t1
  WHERE t1.is_active = true
  GROUP BY t1.technician_id, t1.date
  HAVING COUNT(DISTINCT t1.job_id) > 1
  ORDER BY t1.date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to find declined assignments with active timesheets
CREATE OR REPLACE FUNCTION find_declined_with_active_timesheets()
RETURNS TABLE(
  job_id UUID,
  technician_id UUID,
  assignment_status TEXT,
  active_timesheet_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ja.job_id,
    ja.technician_id,
    ja.status as assignment_status,
    COUNT(ts.date)::BIGINT as active_timesheet_count
  FROM job_assignments ja
  JOIN timesheets ts 
    ON ts.job_id = ja.job_id AND ts.technician_id = ja.technician_id
  WHERE ja.status = 'declined'
    AND ts.is_active = true
  GROUP BY ja.job_id, ja.technician_id, ja.status;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute to admin/management roles
GRANT EXECUTE ON FUNCTION find_orphaned_timesheets TO authenticated;
GRANT EXECUTE ON FUNCTION find_double_bookings TO authenticated;
GRANT EXECUTE ON FUNCTION find_declined_with_active_timesheets TO authenticated;
GRANT EXECUTE ON FUNCTION find_orphaned_timesheets TO service_role;
GRANT EXECUTE ON FUNCTION find_double_bookings TO service_role;
GRANT EXECUTE ON FUNCTION find_declined_with_active_timesheets TO service_role;

COMMENT ON FUNCTION find_orphaned_timesheets IS 
  'Finds timesheets without a parent job_assignment. Used for health monitoring.';
COMMENT ON FUNCTION find_double_bookings IS 
  'Finds technicians with multiple active jobs on the same date. Used for conflict detection.';
COMMENT ON FUNCTION find_declined_with_active_timesheets IS 
  'Finds declined assignments that still have active timesheets. Indicates data inconsistency.';
