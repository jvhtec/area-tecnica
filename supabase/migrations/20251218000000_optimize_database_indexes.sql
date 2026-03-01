-- Database Performance Optimization: Add Missing Indexes
-- This migration addresses slow and frequent queries by adding critical indexes
-- Based on query pattern analysis showing 1,124+ equality filters and 202+ batch queries

-- =============================================================================
-- PRIORITY 0: Critical Composite Indexes for Most Frequent Queries
-- =============================================================================

-- job_assignments: Most queried table (50+ queries) with job_id + technician_id pattern
-- This composite index supports both individual column queries and combined lookups
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_tech
ON job_assignments(job_id, technician_id);

-- job_assignments: Status filtering is used in 25+ queries for workflow management
CREATE INDEX IF NOT EXISTS idx_job_assignments_status
ON job_assignments(status);

-- job_assignments: Combined status + job_id for filtered job queries
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_status
ON job_assignments(job_id, status);

-- timesheets: Critical for soft-delete queries (39+ queries filter on is_active)
-- Composite index job_id + is_active supports both filters efficiently
CREATE INDEX IF NOT EXISTS idx_timesheets_job_is_active
ON timesheets(job_id, is_active);

-- timesheets: Date-based filtering (25+ queries) for timesheet lookups
-- Supports both individual technician queries and date range queries
CREATE INDEX IF NOT EXISTS idx_timesheets_tech_date
ON timesheets(technician_id, date);

-- timesheets: Job + date composite for daily timesheet queries
CREATE INDEX IF NOT EXISTS idx_timesheets_job_date
ON timesheets(job_id, date);

-- =============================================================================
-- PRIORITY 1: High-Impact Simple Indexes
-- =============================================================================

-- profiles: Department filtering (45+ queries) for role-based access
CREATE INDEX IF NOT EXISTS idx_profiles_department
ON profiles(department);

-- jobs: Status filtering for workflow and dashboard queries
CREATE INDEX IF NOT EXISTS idx_jobs_status
ON jobs(status);

-- jobs: Start time ordering (71+ .order() calls) and date range queries (30+)
CREATE INDEX IF NOT EXISTS idx_jobs_start_time
ON jobs(start_time);

-- jobs: Tour relationship queries (32+ queries)
CREATE INDEX IF NOT EXISTS idx_jobs_tour_id
ON jobs(tour_id);

-- =============================================================================
-- PRIORITY 2: Composite Indexes for Complex Queries
-- =============================================================================

-- jobs: Combined status + start_time for filtered timeline queries (30+ range queries)
-- Supports queries like "get all confirmed jobs starting after date X"
CREATE INDEX IF NOT EXISTS idx_jobs_status_start_time
ON jobs(status, start_time);

-- jobs: Tour + status composite for tour-based job filtering
CREATE INDEX IF NOT EXISTS idx_jobs_tour_status
ON jobs(tour_id, status);

-- job_assignments: Department-based filtering with job_id
-- Supports department-specific assignment queries
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_dept
ON job_assignments(job_id, department)
WHERE department IS NOT NULL;

-- technician_availability: Date range queries (14+ queries) for availability checks
-- Composite index supports technician-specific availability lookups
CREATE INDEX IF NOT EXISTS idx_technician_availability_tech_date
ON technician_availability(technician_id, date);

-- =============================================================================
-- PRIORITY 3: Indexes for Supporting Tables
-- =============================================================================

-- vacation_requests: Technician + status for availability management
CREATE INDEX IF NOT EXISTS idx_vacation_requests_tech_status
ON vacation_requests(technician_id, status);

-- staffing_requests: Job + profile lookup for staffing workflow
CREATE INDEX IF NOT EXISTS idx_staffing_requests_job_profile
ON staffing_requests(job_id, profile_id);

-- staffing_requests: Status filtering for pending requests
CREATE INDEX IF NOT EXISTS idx_staffing_requests_status
ON staffing_requests(status);

-- staffing_events: Request-based event lookup for audit trails
CREATE INDEX IF NOT EXISTS idx_staffing_events_request_id
ON staffing_events(staffing_request_id);

-- activity_log: Created_at ordering for recent activity queries
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
ON activity_log(created_at DESC);

-- activity_log: Job-based activity filtering
CREATE INDEX IF NOT EXISTS idx_activity_log_job_id
ON activity_log(job_id)
WHERE job_id IS NOT NULL;

-- =============================================================================
-- PRIORITY 4: Partial Indexes for Specific Query Patterns
-- =============================================================================

-- timesheets: Active records only (most common query pattern)
-- Partial index reduces index size and improves query performance
CREATE INDEX IF NOT EXISTS idx_timesheets_active_job_date
ON timesheets(job_id, date)
WHERE is_active = true;

-- timesheets: Active records by technician
CREATE INDEX IF NOT EXISTS idx_timesheets_active_tech_date
ON timesheets(technician_id, date)
WHERE is_active = true;

-- job_assignments: Confirmed assignments only (most common status)
CREATE INDEX IF NOT EXISTS idx_job_assignments_confirmed
ON job_assignments(job_id, technician_id)
WHERE status = 'confirmed';

-- =============================================================================
-- Additional Optimizations
-- =============================================================================

-- Update table statistics to help query planner make better decisions
ANALYZE job_assignments;
ANALYZE timesheets;
ANALYZE jobs;
ANALYZE profiles;
ANALYZE staffing_requests;
ANALYZE technician_availability;

-- Add comments for documentation
COMMENT ON INDEX idx_job_assignments_job_tech IS 'Composite index for job + technician lookups (220 job_id + 47 technician_id queries)';
COMMENT ON INDEX idx_timesheets_job_is_active IS 'Composite index for active timesheet filtering (39+ queries with is_active)';
COMMENT ON INDEX idx_timesheets_tech_date IS 'Composite index for technician daily timesheet queries (25+ date-based queries)';
COMMENT ON INDEX idx_profiles_department IS 'Simple index for department-based filtering (45+ queries)';
COMMENT ON INDEX idx_jobs_status_start_time IS 'Composite index for filtered timeline queries (30+ range queries on start_time)';
COMMENT ON INDEX idx_timesheets_active_job_date IS 'Partial index for active timesheet queries (reduces index size for most common pattern)';

-- Note: The query mentioned by the user about pg_publication_tables is part of Supabase's
-- internal realtime subscription mechanism. While it shows 0.00s execution time,
-- adding an index to the system catalog table pg_publication_tables would require
-- superuser privileges and is managed by Supabase infrastructure.
-- The realtime subscription overhead can be reduced by:
-- 1. Limiting the number of concurrent subscriptions
-- 2. Using more specific filters in realtime subscriptions
-- 3. Batching updates when possible
-- These application-level optimizations are more effective than indexing system catalogs.
