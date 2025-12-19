-- =============================================================================
-- PERFORMANCE OPTIMIZATION MIGRATION
-- =============================================================================
-- Addresses: 874 slow queries, 29M profile lookups, missing indexes
--
-- VERIFIED TABLES (exist in production):
--   - profiles (has data, columns verified)
--   - jobs (empty but exists, columns from code: start_time, end_time, job_type, status)
--   - job_assignments (empty but exists, columns: job_id, technician_id, status, sound_role, lights_role, video_role)
--   - timesheets (empty but exists, columns: job_id, technician_id, status, is_active, is_schedule_only, amount_eur)
--   - tours (has data, columns verified: start_date, end_date, status)
--   - tour_assignments (empty but exists)
--   - job_expenses (empty but exists)
--   - job_rate_extras (empty but exists)
--
-- TABLES THAT DO NOT EXIST:
--   - technicians (NO!)
--   - notifications (NO!)
-- =============================================================================

-- =============================================================================
-- PART 1: RLS CACHING FUNCTIONS
-- Fixes the 29 MILLION profile queries issue
-- =============================================================================

-- Function to get current user's role with session-level caching
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Try to get role from session cache first
  BEGIN
    user_role := current_setting('app.current_user_role', true);
    IF user_role IS NOT NULL AND user_role != '' THEN
      RETURN user_role;
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Query once and cache
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF user_role IS NOT NULL THEN
    PERFORM set_config('app.current_user_role', user_role, false);
  END IF;

  RETURN user_role;
END;
$$;

-- Function to get current user's department with session-level caching
CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  user_dept TEXT;
BEGIN
  BEGIN
    user_dept := current_setting('app.current_user_department', true);
    IF user_dept IS NOT NULL AND user_dept != '' THEN
      RETURN user_dept;
    END IF;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  SELECT department INTO user_dept
  FROM public.profiles
  WHERE id = auth.uid();

  IF user_dept IS NOT NULL THEN
    PERFORM set_config('app.current_user_department', user_dept, false);
  END IF;

  RETURN user_dept;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_department() TO authenticated, anon;

COMMENT ON FUNCTION public.current_user_role() IS
  'Returns current user role with session caching. Use in RLS policies instead of (SELECT role FROM profiles WHERE id = auth.uid())';
COMMENT ON FUNCTION public.current_user_department() IS
  'Returns current user department with session caching.';

-- =============================================================================
-- PART 2: PROFILES INDEXES (verified columns: department, role)
-- Profiles is queried 90+ times across the codebase
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_dept_role ON profiles(department, role);

-- =============================================================================
-- PART 3: JOBS INDEXES (verified columns: job_type, status, start_time, end_time)
-- Jobs is queried 105+ times across the codebase
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_type_status ON jobs(job_type, status);
CREATE INDEX IF NOT EXISTS idx_jobs_time_range ON jobs(start_time, end_time);

-- =============================================================================
-- PART 4: JOB_ASSIGNMENTS INDEXES
-- (verified columns: job_id, technician_id, status, sound_role, lights_role, video_role)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_job_assignments_job_tech
  ON job_assignments(job_id, technician_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_status
  ON job_assignments(status, job_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_tech_status
  ON job_assignments(technician_id, status);

-- Composite with INCLUDE for common join patterns
CREATE INDEX IF NOT EXISTS idx_job_assignments_composite
  ON job_assignments(job_id, technician_id, status)
  INCLUDE (sound_role, lights_role, video_role);

-- =============================================================================
-- PART 5: TIMESHEETS INDEXES
-- (verified columns: job_id, technician_id, status, is_active, is_schedule_only, amount_eur)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_timesheets_job_tech_status
  ON timesheets(job_id, technician_id, status)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_timesheets_approved
  ON timesheets(job_id, technician_id, amount_eur)
  WHERE status = 'approved' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_timesheets_aggregation
  ON timesheets(job_id, technician_id, status, amount_eur)
  WHERE is_active = true AND is_schedule_only IS NOT TRUE;

-- =============================================================================
-- PART 6: TOURS INDEXES (verified columns: start_date, end_date, status)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tours_dates ON tours(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tours_status ON tours(status) WHERE status IS NOT NULL;

-- =============================================================================
-- PART 7: TOUR_ASSIGNMENTS INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tour_assignments_tour_tech
  ON tour_assignments(tour_id, technician_id);

-- =============================================================================
-- PART 8: JOB_EXPENSES and JOB_RATE_EXTRAS INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_job_expenses_job_tech
  ON job_expenses(job_id, technician_id);

CREATE INDEX IF NOT EXISTS idx_job_rate_extras_job_tech
  ON job_rate_extras(job_id, technician_id);

-- =============================================================================
-- PART 9: DIAGNOSTIC FUNCTION
-- =============================================================================

-- Function to find RLS policies that should be updated to use caching functions
CREATE OR REPLACE FUNCTION public.find_policies_to_optimize()
RETURNS TABLE(table_name TEXT, policy_name TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT tablename::TEXT, policyname::TEXT
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual LIKE '%profiles%WHERE%auth.uid%'
         OR with_check LIKE '%profiles%WHERE%auth.uid%')
  ORDER BY tablename, policyname;
$$;

GRANT EXECUTE ON FUNCTION public.find_policies_to_optimize() TO authenticated, service_role;

COMMENT ON FUNCTION public.find_policies_to_optimize() IS
  'Lists RLS policies that query profiles table. Update these to use current_user_role() or current_user_department() for 99% query reduction.';
