-- Performance Optimization Migration
-- Adds critical indexes for mobile performance and reduces query latency
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ============================================
-- TIMESHEETS TABLE OPTIMIZATIONS
-- ============================================

-- Index for fetching recent timesheets (activity logs, dashboard)
CREATE INDEX IF NOT EXISTS idx_timesheets_created_at
ON timesheets(created_at DESC);

-- Index for manager approval workflows
CREATE INDEX IF NOT EXISTS idx_timesheets_approved_by
ON timesheets(approved_by)
WHERE approved_by IS NOT NULL;

-- Composite index for technician + date range queries (very common pattern)
CREATE INDEX IF NOT EXISTS idx_timesheets_tech_date_range
ON timesheets(technician_id, date DESC);

-- Index for version tracking queries
CREATE INDEX IF NOT EXISTS idx_timesheets_version
ON timesheets(version DESC)
WHERE version > 1;

-- Partial index for pending timesheets (most common filter)
CREATE INDEX IF NOT EXISTS idx_timesheets_pending
ON timesheets(technician_id, date DESC)
WHERE status = 'pending';

-- ============================================
-- JOB_ASSIGNMENTS TABLE OPTIMIZATIONS
-- ============================================

-- Index for single-day assignment filtering (critical for mobile calendar views)
CREATE INDEX IF NOT EXISTS idx_job_assignments_assignment_date
ON job_assignments(assignment_date DESC);

-- Index for recent assignments (dashboard, activity)
CREATE INDEX IF NOT EXISTS idx_job_assignments_created_at
ON job_assignments(created_at DESC);

-- Composite index for date range + technician (availability checking)
CREATE INDEX IF NOT EXISTS idx_job_assignments_tech_date
ON job_assignments(technician_id, assignment_date DESC);

-- Partial index for active assignments only
CREATE INDEX IF NOT EXISTS idx_job_assignments_active
ON job_assignments(job_id, technician_id, assignment_date)
WHERE sound_role IS NOT NULL OR lights_role IS NOT NULL OR video_role IS NOT NULL;

-- ============================================
-- AVAILABILITY_SCHEDULES TABLE OPTIMIZATIONS
-- ============================================

-- Index for status filtering (unavailable/vacation lookups)
CREATE INDEX IF NOT EXISTS idx_availability_schedules_status
ON availability_schedules(status);

-- Index for date range queries (availability calendar)
CREATE INDEX IF NOT EXISTS idx_availability_schedules_date_range
ON availability_schedules(user_id, date DESC);

-- Partial index for only unavailable entries (most common lookup)
CREATE INDEX IF NOT EXISTS idx_availability_unavailable
ON availability_schedules(user_id, date)
WHERE status IN ('unavailable', 'vacation', 'sick');

-- ============================================
-- JOBS TABLE OPTIMIZATIONS
-- ============================================

-- Index for department-based filtering (RLS and dashboard)
CREATE INDEX IF NOT EXISTS idx_jobs_department
ON jobs(department);

-- Composite index for date range + status (most common dashboard query)
CREATE INDEX IF NOT EXISTS idx_jobs_date_status
ON jobs(start_time, status);

-- Index for tour-related job lookups
CREATE INDEX IF NOT EXISTS idx_jobs_tour_composite
ON jobs(tour_id, tour_date_id, start_time)
WHERE tour_id IS NOT NULL;

-- Partial index for active jobs only (excludes cancelled/completed)
CREATE INDEX IF NOT EXISTS idx_jobs_active
ON jobs(start_time, department)
WHERE status NOT IN ('cancelled', 'completed');

-- ============================================
-- PROFILES TABLE OPTIMIZATIONS
-- ============================================

-- Index for quick technician lookup (assignable techs)
CREATE INDEX IF NOT EXISTS idx_profiles_assignable_tech
ON profiles(id, first_name, last_name)
WHERE assignable_as_tech = true;

-- Index for department-based user filtering
CREATE INDEX IF NOT EXISTS idx_profiles_department
ON profiles(department);

-- Index for role-based access control
CREATE INDEX IF NOT EXISTS idx_profiles_role
ON profiles(role);

-- ============================================
-- ACTIVITY_LOG TABLE OPTIMIZATIONS
-- ============================================

-- Index for fetching recent activity (dashboard feed)
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
ON activity_log(created_at DESC);

-- Composite index for user-specific activity
CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
ON activity_log(user_id, created_at DESC);

-- ============================================
-- TOUR_DATES TABLE OPTIMIZATIONS
-- ============================================

-- Index for date range queries on tours
CREATE INDEX IF NOT EXISTS idx_tour_dates_date
ON tour_dates(date DESC);

-- Composite for tour + date filtering
CREATE INDEX IF NOT EXISTS idx_tour_dates_tour_date
ON tour_dates(tour_id, date);

-- ============================================
-- FLEX TABLES OPTIMIZATIONS
-- ============================================

-- Index for work order lookups by job
CREATE INDEX IF NOT EXISTS idx_flex_work_orders_job
ON flex_work_orders(job_id);

-- Index for folder existence checks
CREATE INDEX IF NOT EXISTS idx_flex_folders_job
ON flex_folders(job_id);

-- ============================================
-- HOJA_DE_RUTA TABLE OPTIMIZATIONS
-- ============================================

-- Index for job-based lookups
CREATE INDEX IF NOT EXISTS idx_hoja_de_ruta_job
ON hoja_de_ruta(job_id);

-- Index for date-based filtering
CREATE INDEX IF NOT EXISTS idx_hoja_de_ruta_date
ON hoja_de_ruta(travel_date DESC);

-- ============================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================

-- Refresh statistics for query optimizer
ANALYZE timesheets;
ANALYZE job_assignments;
ANALYZE availability_schedules;
ANALYZE jobs;
ANALYZE profiles;
ANALYZE activity_log;
ANALYZE tour_dates;
ANALYZE flex_work_orders;
ANALYZE flex_folders;
ANALYZE hoja_de_ruta;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON INDEX idx_timesheets_created_at IS 'Optimizes recent timesheet fetches for activity feeds';
COMMENT ON INDEX idx_job_assignments_assignment_date IS 'Critical for mobile calendar single-day views';
COMMENT ON INDEX idx_jobs_active IS 'Partial index excludes cancelled jobs for faster dashboard queries';
COMMENT ON INDEX idx_profiles_assignable_tech IS 'Fast lookup for technician assignment dropdowns';
