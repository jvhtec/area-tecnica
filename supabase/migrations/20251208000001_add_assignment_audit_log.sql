-- Migration: Add assignment audit log for tracking lifecycle events
-- This provides an audit trail for all assignment changes, especially important
-- for hard-deleted tour assignments

-- Create the audit log table
CREATE TABLE IF NOT EXISTS assignment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- assignment_id can be NULL for hard-deleted records (the row no longer exists)
  assignment_id UUID,
  job_id UUID NOT NULL,
  technician_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'confirmed', 'declined', 'hard_deleted', 'soft_deleted', 'reassigned'
  previous_status TEXT,
  new_status TEXT,
  actor_id UUID, -- NULL for system/auto actions
  metadata JSONB DEFAULT '{}',
  deleted_timesheet_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_audit_log_job_id ON assignment_audit_log(job_id);
CREATE INDEX idx_audit_log_technician_id ON assignment_audit_log(technician_id);
CREATE INDEX idx_audit_log_created_at ON assignment_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON assignment_audit_log(action);

-- Add RLS policy (admin and management can read, system can write)
ALTER TABLE assignment_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow reading for authenticated users with admin/management roles
CREATE POLICY "Allow read for authorized roles" ON assignment_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'management')
    )
  );

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access" ON assignment_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE assignment_audit_log IS 
  'Audit trail for assignment lifecycle events. Records all status changes and deletions for compliance and debugging.';
