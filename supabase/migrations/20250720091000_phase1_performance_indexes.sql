-- Phase 1.1 – Zero-risk index improvements
-- All indexes use CONCURRENTLY + IF NOT EXISTS for safe deployments.

-- Timesheets indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_job_id
  ON timesheets(job_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_technician_id
  ON timesheets(technician_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_status
  ON timesheets(status)
  WHERE status IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_date
  ON timesheets(date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_approved_by
  ON timesheets(approved_by)
  WHERE approved_by IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_job_status
  ON timesheets(job_id, status);

-- Assignment indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_assignments_technician_id
  ON job_assignments(technician_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_assignments_status
  ON job_assignments(status)
  WHERE status IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_assignments_assigned_at
  ON job_assignments(assigned_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_tech_date
  ON job_assignments(technician_id, assignment_date)
  WHERE single_day = true;

-- Availability schedules optimization for conflict checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_availability_schedules_user_date
  ON availability_schedules(user_id, date);

-- Staffing workflow indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staffing_requests_batch_id
  ON staffing_requests(batch_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staffing_requests_expires_at
  ON staffing_requests(token_expires_at);

COMMENT ON INDEX idx_timesheets_job_id IS 'Phase 1: Optimizes job timesheet fetching';
