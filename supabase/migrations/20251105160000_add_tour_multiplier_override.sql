-- Add tour multiplier override flag to job_assignments
-- Allows forcing tour multiplier calculation for specific job+tech assignments
-- even when the tech is not assigned tour-wide in tour_assignments table

-- Add the override column
ALTER TABLE job_assignments
ADD COLUMN IF NOT EXISTS use_tour_multipliers BOOLEAN DEFAULT FALSE;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_job_assignments_use_tour_multipliers
ON job_assignments(use_tour_multipliers) WHERE use_tour_multipliers = TRUE;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN job_assignments.use_tour_multipliers IS
'Override flag to force tour multiplier calculation even if tech is not in tour_assignments table. Used for edge cases where tech only works specific dates but should still receive tour multipliers.';
