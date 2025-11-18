-- Restore the (job_id, date) uniqueness guarantee for job_date_types so
-- ON CONFLICT clauses targeting those columns can succeed again.

BEGIN;

-- Remove duplicated rows by keeping the oldest record for each job/date pair.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY job_id, date ORDER BY created_at NULLS LAST, id) AS rn
  FROM job_date_types
)
DELETE FROM job_date_types
USING ranked
WHERE job_date_types.id = ranked.id
  AND ranked.rn > 1;

-- Recreate the unique constraint that ON CONFLICT clauses depend on.
ALTER TABLE job_date_types
  DROP CONSTRAINT IF EXISTS job_date_types_job_id_date_key;

ALTER TABLE job_date_types
  ADD CONSTRAINT job_date_types_job_id_date_key UNIQUE (job_id, date);

COMMIT;
