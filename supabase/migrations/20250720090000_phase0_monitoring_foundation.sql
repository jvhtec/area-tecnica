-- Phase 0.1 – Monitoring & Observability foundation
-- Adds read-only health views plus error logging table/indexes.

CREATE VIEW IF NOT EXISTS system_health_timesheets AS
SELECT
  COUNT(*) FILTER (WHERE status = 'draft') AS drafts,
  COUNT(*) FILTER (WHERE status = 'submitted') AS submitted,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved,
  COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') AS created_24h,
  COUNT(*) FILTER (WHERE updated_at > now() - interval '1 hour') AS updated_1h,
  AVG(EXTRACT(epoch FROM (approved_at - created_at))) AS avg_approval_time_seconds
FROM timesheets;

CREATE VIEW IF NOT EXISTS system_health_assignments AS
SELECT
  COUNT(*) AS total_assignments,
  COUNT(DISTINCT job_id) AS active_jobs,
  COUNT(DISTINCT technician_id) AS assigned_technicians,
  COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') AS created_24h,
  COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
  COUNT(*) FILTER (WHERE status = 'invited') AS invited
FROM job_assignments;

CREATE TABLE IF NOT EXISTS system_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system TEXT NOT NULL CHECK (system IN ('timesheets', 'assignments')),
  error_type TEXT NOT NULL,
  error_message TEXT,
  context JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_errors_created ON system_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_system_type ON system_errors(system, error_type);
