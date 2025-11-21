-- Remove duplicate indexes to improve performance
-- Keep the idx_* prefixed versions for consistency

-- =====================================================================
-- FESTIVAL_ARTISTS TABLE
-- =====================================================================
-- Keeping: idx_festival_artists_job_id
-- Removing: festival_artists_job_id_idx
DROP INDEX IF EXISTS public.festival_artists_job_id_idx;

-- =====================================================================
-- FLEX_FOLDERS TABLE
-- =====================================================================
-- These appear to be duplicates based on linter warning
-- Keeping: idx_flex_folders_tour_department_composite (more descriptive name)
-- Removing: idx_flex_folders_folder_type_dept
DROP INDEX IF EXISTS public.idx_flex_folders_folder_type_dept;

-- =====================================================================
-- JOB_RATE_EXTRAS TABLE
-- =====================================================================
-- Both index job_id column
-- Keeping: idx_job_rate_extras_job_id (more explicit name)
-- Removing: idx_job_rate_extras_job
DROP INDEX IF EXISTS public.idx_job_rate_extras_job;

-- Add comment for documentation
COMMENT ON SCHEMA public IS 'Duplicate indexes removed for performance optimization';
