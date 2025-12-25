-- Create table for storing stage plot data associated with jobs
CREATE TABLE IF NOT EXISTS job_stage_plots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  plot_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(job_id)
);

-- Add index for faster lookups
CREATE INDEX idx_job_stage_plots_job_id ON job_stage_plots(job_id);

-- Enable RLS
ALTER TABLE job_stage_plots ENABLE ROW LEVEL SECURITY;

-- Create policies for job_stage_plots
-- Users can read stage plots for jobs they have access to
CREATE POLICY "Users can read stage plots for accessible jobs"
  ON job_stage_plots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_stage_plots.job_id
      AND (
        -- Admin and management can see all
        auth.jwt() ->> 'user_role' IN ('admin', 'management')
        -- Or assigned to the job
        OR EXISTS (
          SELECT 1 FROM job_assignments ja
          WHERE ja.job_id = j.id
          AND ja.technician_id = auth.uid()
        )
        -- Or house tech in the job's department
        OR (
          auth.jwt() ->> 'user_role' = 'house_tech'
          AND EXISTS (
            SELECT 1 FROM job_departments jd
            WHERE jd.job_id = j.id
            AND jd.department = (
              SELECT department FROM profiles
              WHERE id = auth.uid()
            )
          )
        )
      )
    )
  );

-- Admin, management, and house_tech can insert stage plots
CREATE POLICY "Authorized users can insert job stage plots"
  ON job_stage_plots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'user_role' IN ('admin', 'management', 'house_tech')
  );

-- Users can update stage plots for jobs they have access to
CREATE POLICY "Users can update stage plots for accessible jobs"
  ON job_stage_plots
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'user_role' IN ('admin', 'management', 'house_tech')
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_stage_plots.job_id
      AND (
        auth.jwt() ->> 'user_role' IN ('admin', 'management')
        OR (
          auth.jwt() ->> 'user_role' = 'house_tech'
          AND EXISTS (
            SELECT 1 FROM job_departments jd
            WHERE jd.job_id = j.id
            AND jd.department = (
              SELECT department FROM profiles
              WHERE id = auth.uid()
            )
          )
        )
      )
    )
  );

-- Only admin and management can delete stage plots
CREATE POLICY "Only admin and management can delete job stage plots"
  ON job_stage_plots
  FOR DELETE
  TO authenticated
  USING (
    auth.jwt() ->> 'user_role' IN ('admin', 'management')
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_job_stage_plots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_job_stage_plots_updated_at
  BEFORE UPDATE ON job_stage_plots
  FOR EACH ROW
  EXECUTE FUNCTION update_job_stage_plots_updated_at();
