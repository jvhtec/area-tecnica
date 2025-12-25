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
-- Allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read job stage plots"
  ON job_stage_plots
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update their own stage plots
CREATE POLICY "Allow authenticated users to insert job stage plots"
  ON job_stage_plots
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update job stage plots"
  ON job_stage_plots
  FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete
CREATE POLICY "Allow authenticated users to delete job stage plots"
  ON job_stage_plots
  FOR DELETE
  TO authenticated
  USING (true);

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
