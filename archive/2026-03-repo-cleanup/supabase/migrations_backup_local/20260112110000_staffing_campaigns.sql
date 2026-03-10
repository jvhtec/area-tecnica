-- Create staffing_campaigns table for persistent campaign tracking
CREATE TABLE IF NOT EXISTS staffing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  department text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  mode text NOT NULL CHECK (mode IN ('assisted', 'auto')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped', 'completed', 'failed')),
  policy jsonb NOT NULL,
  offer_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_lock uuid,
  version int DEFAULT 1,

  UNIQUE(job_id, department)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS staffing_campaigns_status_next_run
  ON staffing_campaigns(status, next_run_at);

CREATE INDEX IF NOT EXISTS staffing_campaigns_dept_status
  ON staffing_campaigns(department, status);

-- Enable RLS
ALTER TABLE staffing_campaigns ENABLE ROW LEVEL SECURITY;

-- Read: allow admin/management/logistics, scoped to department (unless admin/logistics or no dept set)
CREATE POLICY "staffing_campaigns_select_management"
  ON staffing_campaigns
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management', 'logistics')
        AND (
          p.role IN ('admin', 'logistics')
          OR p.department IS NULL
          OR p.department = staffing_campaigns.department
          OR (staffing_campaigns.department = 'production' AND p.department = 'logistics')
        )
    )
  );

-- Write: allow admin/management/logistics, scoped to department (unless admin/logistics or no dept set)
CREATE POLICY "staffing_campaigns_write_management"
  ON staffing_campaigns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management', 'logistics')
        AND (
          p.role IN ('admin', 'logistics')
          OR p.department IS NULL
          OR p.department = staffing_campaigns.department
          OR (staffing_campaigns.department = 'production' AND p.department = 'logistics')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'management', 'logistics')
        AND (
          p.role IN ('admin', 'logistics')
          OR p.department IS NULL
          OR p.department = staffing_campaigns.department
          OR (staffing_campaigns.department = 'production' AND p.department = 'logistics')
        )
    )
  );
