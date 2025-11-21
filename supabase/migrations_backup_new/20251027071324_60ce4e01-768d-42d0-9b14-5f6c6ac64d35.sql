-- Add completion metadata columns to sound_job_tasks
ALTER TABLE sound_job_tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS completion_source text;

-- Add completion metadata columns to lights_job_tasks
ALTER TABLE lights_job_tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS completion_source text;

-- Add completion metadata columns to video_job_tasks
ALTER TABLE video_job_tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS completion_source text;