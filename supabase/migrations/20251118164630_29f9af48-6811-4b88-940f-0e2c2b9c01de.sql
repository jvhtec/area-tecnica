-- Drop duplicate unique constraints on job_date_types table
-- Keep job_date_types_job_id_date_key, drop the duplicates

ALTER TABLE job_date_types 
DROP CONSTRAINT IF EXISTS job_date_types_job_id_date_unique;

ALTER TABLE job_date_types 
DROP CONSTRAINT IF EXISTS unique_job_date;

-- Verify we still have one constraint remaining
-- job_date_types_job_id_date_key should remain