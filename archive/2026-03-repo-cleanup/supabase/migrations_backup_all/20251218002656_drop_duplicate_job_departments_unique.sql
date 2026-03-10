-- =============================================================================
-- DROP DUPLICATE INDEX/CONSTRAINT ON job_departments (PERFORMANCE)
-- =============================================================================
-- job_departments has both:
--   - PRIMARY KEY (job_id, department)
--   - UNIQUE (job_id, department)
-- The UNIQUE constraint is redundant and creates an identical index.
-- =============================================================================

ALTER TABLE public.job_departments
  DROP CONSTRAINT IF EXISTS job_departments_job_id_department_key;

