-- Phase 2: Consolidate multiple single-day assignments into single records
-- This migration merges multiple single-day assignments for the same job+technician

BEGIN;

-- For each job+technician pair with multiple assignments,
-- keep one record with the best metadata and clear single_day/assignment_date
CREATE TEMP TABLE consolidated_assignments AS
SELECT
  -- Use the first assignment's ID (earliest by assigned_at)
  (array_agg(id ORDER BY assigned_at NULLS LAST))[1] as keep_id,
  job_id,
  technician_id,
  -- Keep the most specific role assignments (prefer non-null)
  COALESCE(
    MAX(sound_role) FILTER (WHERE sound_role IS NOT NULL),
    MAX(sound_role)
  ) as sound_role,
  COALESCE(
    MAX(lights_role) FILTER (WHERE lights_role IS NOT NULL),
    MAX(lights_role)
  ) as lights_role,
  COALESCE(
    MAX(video_role) FILTER (WHERE video_role IS NOT NULL),
    MAX(video_role)
  ) as video_role,
  MIN(assigned_at) as assigned_at,
  (array_agg(assigned_by ORDER BY assigned_at NULLS LAST) FILTER (WHERE assigned_by IS NOT NULL))[1] as assigned_by,
  COALESCE(
    MAX(assignment_source) FILTER (WHERE assignment_source IS NOT NULL),
    MAX(assignment_source)
  ) as assignment_source,
  COALESCE(
    MIN(response_time) FILTER (WHERE response_time IS NOT NULL),
    MIN(response_time)
  ) as response_time,
  COALESCE(
    MAX(status) FILTER (WHERE status IS NOT NULL),
    MAX(status)
  ) as status,
  COALESCE(
    MAX(external_technician_name) FILTER (WHERE external_technician_name IS NOT NULL),
    MAX(external_technician_name)
  ) as external_technician_name,
  bool_or(use_tour_multipliers) as use_tour_multipliers,
  array_agg(id ORDER BY assigned_at NULLS LAST) as all_ids,
  COUNT(*) as original_count
FROM job_assignments
GROUP BY job_id, technician_id
HAVING COUNT(*) > 1;

-- Log what we're about to consolidate
DO $$
DECLARE
  v_consolidation_count INTEGER;
  v_records_to_delete INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_consolidation_count FROM consolidated_assignments;
  SELECT SUM(original_count - 1) INTO v_records_to_delete FROM consolidated_assignments;

  RAISE NOTICE 'Consolidation plan:';
  RAISE NOTICE '  Job+Tech pairs to consolidate: %', v_consolidation_count;
  RAISE NOTICE '  Assignment records to delete: %', v_records_to_delete;
END $$;

-- Update the records we're keeping with consolidated data
UPDATE job_assignments ja
SET
  sound_role = ca.sound_role,
  lights_role = ca.lights_role,
  video_role = ca.video_role,
  assigned_at = ca.assigned_at,
  assigned_by = ca.assigned_by,
  assignment_source = ca.assignment_source,
  response_time = ca.response_time,
  status = ca.status,
  external_technician_name = ca.external_technician_name,
  use_tour_multipliers = ca.use_tour_multipliers,
  single_day = false,
  assignment_date = NULL
FROM consolidated_assignments ca
WHERE ja.id = ca.keep_id;

-- Delete duplicate assignments (keep only the first one)
DELETE FROM job_assignments
WHERE id IN (
  SELECT unnest(all_ids[2:])
  FROM consolidated_assignments
);

-- Update all remaining single-day assignments to whole-job style
-- (timesheets now track which specific days)
UPDATE job_assignments
SET
  single_day = false,
  assignment_date = NULL
WHERE single_day = true;

-- Verify final state
DO $$
DECLARE
  v_remaining_count INTEGER;
  v_duplicate_check INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_remaining_count FROM job_assignments;

  SELECT COUNT(*) INTO v_duplicate_check
  FROM (
    SELECT job_id, technician_id
    FROM job_assignments
    GROUP BY job_id, technician_id
    HAVING COUNT(*) > 1
  ) dups;

  RAISE NOTICE 'Post-consolidation state:';
  RAISE NOTICE '  Total assignments remaining: %', v_remaining_count;
  RAISE NOTICE '  Duplicate job+tech pairs: %', v_duplicate_check;

  IF v_duplicate_check > 0 THEN
    RAISE EXCEPTION 'Consolidation failed: still have duplicate job+technician pairs';
  END IF;
END $$;

COMMIT;
