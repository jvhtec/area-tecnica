-- Add unique constraint to job_date_types table to prevent duplicate entries
-- This fixes the "there is no unique or exclusion constraint matching the ON CONFLICT specification" error

-- First, remove any duplicate entries that might exist
-- Keep the first row (by created_at) for each (job_id, date) combination
DELETE FROM job_date_types
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY job_id, date ORDER BY created_at ASC, id) as rn
    FROM job_date_types
  ) t
  WHERE t.rn > 1
);

-- Add the unique constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_date_types_job_id_date_unique'
  ) THEN
    ALTER TABLE job_date_types
    ADD CONSTRAINT job_date_types_job_id_date_unique
    UNIQUE (job_id, date);
  END IF;
END $$;

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_job_date_types_job_id_date
ON job_date_types(job_id, date);
