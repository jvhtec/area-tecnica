-- Cascade delete job_assignments and timesheets when tour_assignments are deleted
-- This ensures that removing a tech from a tour removes them from all tour jobs

BEGIN;

-- Create trigger function to clean up job_assignments and timesheets when tour assignment is deleted
CREATE OR REPLACE FUNCTION "public"."cascade_delete_tour_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
AS $$
BEGIN
    -- Delete all job_assignments for this tour's jobs + technician combination
    -- This removes the assignment from job cards and details views
    DELETE FROM job_assignments
    WHERE technician_id = OLD.technician_id
    AND job_id IN (
        SELECT id
        FROM jobs
        WHERE tour_id = OLD.tour_id
    )
    AND assignment_source = 'tour';

    -- Delete all timesheets for this tour's jobs + technician combination
    -- This removes the assignment from the matrix
    DELETE FROM timesheets
    WHERE technician_id = OLD.technician_id
    AND job_id IN (
        SELECT id
        FROM jobs
        WHERE tour_id = OLD.tour_id
    )
    AND source = 'tour';

    RAISE NOTICE 'Cleaned up job_assignments and timesheets for tour assignment deletion: tour_id=%, technician_id=%',
        OLD.tour_id, OLD.technician_id;

    RETURN OLD;
END;
$$;

-- Create trigger on tour_assignments DELETE
DROP TRIGGER IF EXISTS tour_assignment_cascade_delete ON tour_assignments;

CREATE TRIGGER tour_assignment_cascade_delete
    BEFORE DELETE ON tour_assignments
    FOR EACH ROW
    WHEN (OLD.technician_id IS NOT NULL)
    EXECUTE FUNCTION cascade_delete_tour_assignment();

COMMENT ON FUNCTION public.cascade_delete_tour_assignment IS
  'Cascades deletion of tour assignments to all related job_assignments and timesheets';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✓ cascade_delete_tour_assignment() trigger created';
    RAISE NOTICE '';
    RAISE NOTICE 'Deleting tour assignments now cascades to job_assignments and timesheets';
END $$;

COMMIT;
