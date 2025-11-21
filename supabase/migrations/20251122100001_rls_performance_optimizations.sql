-- RLS Performance Optimization Migration
-- Optimizes row-level security for faster mobile queries
-- Creates helper functions and materialized views for common patterns

-- ============================================
-- OPTIMIZED USER ROLE CACHING FUNCTION
-- ============================================

-- Drop and recreate with better caching
CREATE OR REPLACE FUNCTION get_current_user_role_cached()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Use a single query with proper caching hints
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN COALESCE(user_role, 'authenticated');
END;
$$;

-- ============================================
-- OPTIMIZED USER DEPARTMENT FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_current_user_department_cached()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_dept TEXT;
BEGIN
  SELECT department INTO user_dept
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN user_dept;
END;
$$;

-- ============================================
-- FAST USER JOB ACCESS CHECK
-- ============================================

-- Create a fast lookup function that uses indexes efficiently
CREATE OR REPLACE FUNCTION user_has_job_access(target_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  has_access BOOLEAN := FALSE;
BEGIN
  -- Get user role first (cached in session)
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;

  -- Admins and management have full access
  IF user_role IN ('admin', 'management') THEN
    RETURN TRUE;
  END IF;

  -- Check if user is assigned to this job
  SELECT EXISTS(
    SELECT 1
    FROM job_assignments
    WHERE job_id = target_job_id
    AND technician_id = auth.uid()
    LIMIT 1
  ) INTO has_access;

  RETURN has_access;
END;
$$;

-- ============================================
-- BATCH JOB ACCESS CHECK (for list views)
-- ============================================

CREATE OR REPLACE FUNCTION get_accessible_job_ids(job_ids UUID[])
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  accessible_ids UUID[];
BEGIN
  -- Get user role
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;

  -- Admins and management can access all
  IF user_role IN ('admin', 'management') THEN
    RETURN job_ids;
  END IF;

  -- For technicians, filter to assigned jobs only
  SELECT ARRAY_AGG(DISTINCT ja.job_id)
  INTO accessible_ids
  FROM job_assignments ja
  WHERE ja.job_id = ANY(job_ids)
  AND ja.technician_id = auth.uid();

  RETURN COALESCE(accessible_ids, ARRAY[]::UUID[]);
END;
$$;

-- ============================================
-- OPTIMIZED DATE RANGE JOBS FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_jobs_in_date_range(
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  dept TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT,
  department TEXT,
  color TEXT,
  job_type TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  user_dept TEXT;
BEGIN
  -- Get user info once
  SELECT p.role, p.department INTO user_role, user_dept
  FROM profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;

  -- Admins/management see all jobs in range
  IF user_role IN ('admin', 'management') THEN
    RETURN QUERY
    SELECT j.id, j.title, j.start_time, j.end_time, j.status, j.department, j.color, j.job_type
    FROM jobs j
    WHERE j.start_time >= start_date
    AND j.start_time <= end_date
    AND (dept IS NULL OR j.department = dept)
    AND j.status NOT IN ('cancelled')
    ORDER BY j.start_time;
    RETURN;
  END IF;

  -- Technicians see only assigned jobs
  RETURN QUERY
  SELECT DISTINCT j.id, j.title, j.start_time, j.end_time, j.status, j.department, j.color, j.job_type
  FROM jobs j
  INNER JOIN job_assignments ja ON ja.job_id = j.id
  WHERE j.start_time >= start_date
  AND j.start_time <= end_date
  AND ja.technician_id = auth.uid()
  AND (dept IS NULL OR j.department = dept)
  AND j.status NOT IN ('cancelled')
  ORDER BY j.start_time;
END;
$$;

-- ============================================
-- FAST TIMESHEET ACCESS CHECK
-- ============================================

CREATE OR REPLACE FUNCTION user_can_view_timesheet(target_technician_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Users can always see their own timesheets
  IF target_technician_id = auth.uid() THEN
    RETURN TRUE;
  END IF;

  -- Check role for others' timesheets
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN user_role IN ('admin', 'management');
END;
$$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_current_user_role_cached() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_user_department_cached() TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_job_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_accessible_job_ids(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_jobs_in_date_range(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION user_can_view_timesheet(UUID) TO authenticated;

-- ============================================
-- CREATE OPTIMIZED VIEWS FOR COMMON QUERIES
-- ============================================

-- View for active technicians (used in assignment dropdowns)
CREATE OR REPLACE VIEW active_technicians AS
SELECT
  id,
  first_name,
  last_name,
  email,
  department,
  phone
FROM profiles
WHERE assignable_as_tech = true
ORDER BY first_name, last_name;

-- View for upcoming jobs (next 30 days)
CREATE OR REPLACE VIEW upcoming_jobs AS
SELECT
  id,
  title,
  start_time,
  end_time,
  status,
  department,
  color,
  job_type,
  location,
  tour_id
FROM jobs
WHERE start_time >= CURRENT_DATE
AND start_time <= CURRENT_DATE + INTERVAL '30 days'
AND status NOT IN ('cancelled', 'completed')
ORDER BY start_time;

-- Grant access to views
GRANT SELECT ON active_technicians TO authenticated;
GRANT SELECT ON upcoming_jobs TO authenticated;
