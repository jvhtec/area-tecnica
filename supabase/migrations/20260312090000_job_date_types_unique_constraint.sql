-- Remove any duplicate job/date rows before creating the constraint
DELETE FROM job_date_types a
USING job_date_types b
WHERE a.job_id = b.job_id
  AND a.date = b.date
  AND a.ctid < b.ctid;

-- Ensure we can target job_id + date with ON CONFLICT
ALTER TABLE job_date_types
  DROP CONSTRAINT IF EXISTS job_date_types_job_id_date_key;

ALTER TABLE job_date_types
  ADD CONSTRAINT job_date_types_job_id_date_key UNIQUE (job_id, date);
