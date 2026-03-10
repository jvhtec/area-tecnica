-- Hotfix for missing external_technician_name column on production
-- This migration adds the missing column 'external_technician_name' to the 'job_assignments' table.
-- It uses IF NOT EXISTS to be safe to run even if partially applied.

ALTER TABLE public.job_assignments 
ADD COLUMN IF NOT EXISTS external_technician_name TEXT;

-- Add check constraint to ensure either technician_id or external_technician_name is set
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'technician_assignment_check'
    ) THEN
        ALTER TABLE public.job_assignments
        ADD CONSTRAINT technician_assignment_check 
        CHECK (
            (technician_id IS NOT NULL AND external_technician_name IS NULL) OR 
            (technician_id IS NULL AND external_technician_name IS NOT NULL)
        );
    END IF;
END $$;
