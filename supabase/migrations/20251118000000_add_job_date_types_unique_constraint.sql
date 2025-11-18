-- Add unique constraint to job_date_types table to prevent duplicate entries
-- This fixes the "there is no unique or exclusion constraint matching the ON CONFLICT specification" error

-- First, remove any duplicate entries that might exist
DELETE FROM job_date_types a USING (
  SELECT MIN(id) as id, job_id, date
  FROM job_date_types
  GROUP BY job_id, date
  HAVING COUNT(*) > 1
) b
WHERE a.job_id = b.job_id
  AND a.date = b.date
  AND a.id <> b.id;

-- Add the unique constraint
ALTER TABLE job_date_types
ADD CONSTRAINT job_date_types_job_id_date_unique
UNIQUE (job_id, date);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_job_date_types_job_id_date
ON job_date_types(job_id, date);
