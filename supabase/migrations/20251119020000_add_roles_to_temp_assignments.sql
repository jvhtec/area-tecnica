-- ============================================================================
-- TEMPORARY HOTFIX: Add Role Columns to Temp Assignment Table
-- ============================================================================
-- Purpose: Add role information (sound_role, lights_role, video_role) to the
--          temp table to ensure seamless user experience - users must see which
--          role a technician is assigned to for each day.
--
-- Lifecycle: TEMPORARY until timesheet architecture rollout (est. 2025-11-24)
--
-- Rollback: Included in migration 20251124000000_remove_temp_assignment_table.sql
-- ============================================================================

-- Add role columns to temp table
ALTER TABLE public.job_assignment_days_temp
  ADD COLUMN IF NOT EXISTS sound_role text,
  ADD COLUMN IF NOT EXISTS lights_role text,
  ADD COLUMN IF NOT EXISTS video_role text;

-- Add helpful comment
COMMENT ON COLUMN public.job_assignment_days_temp.sound_role IS
  'Sound department role for this assignment (e.g., FOH, Monitor, A1)';

COMMENT ON COLUMN public.job_assignment_days_temp.lights_role IS
  'Lighting department role for this assignment (e.g., LD, Operator)';

COMMENT ON COLUMN public.job_assignment_days_temp.video_role IS
  'Video department role for this assignment (e.g., Director, Camera Op)';
