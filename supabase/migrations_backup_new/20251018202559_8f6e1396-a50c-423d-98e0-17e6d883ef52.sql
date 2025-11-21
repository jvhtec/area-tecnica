-- Add status column to job_rate_extras table
DO $$ BEGIN
  CREATE TYPE job_rate_extras_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE job_rate_extras 
ADD COLUMN IF NOT EXISTS status job_rate_extras_status 
NOT NULL DEFAULT 'pending';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_rate_extras_status 
ON job_rate_extras(status);

CREATE INDEX IF NOT EXISTS idx_job_rate_extras_job_id 
ON job_rate_extras(job_id);

COMMENT ON COLUMN job_rate_extras.status IS 
'Approval status for rate extras: pending (awaiting review), approved (manager approved), rejected (manager rejected)';