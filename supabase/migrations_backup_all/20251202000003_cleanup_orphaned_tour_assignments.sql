-- Clean up orphaned job_assignments and timesheets from deleted tour assignments
-- This fixes the issue where removed tour techs still show up in job cards

BEGIN;

DO $$
DECLARE
    v_deleted_assignments integer := 0;
    v_deleted_timesheets integer := 0;
BEGIN
    RAISE NOTICE 'Cleaning up orphaned tour-sourced assignments...';

    -- Delete job_assignments that no longer have a corresponding tour_assignment
    -- These are assignments where the tour tech was removed but the job assignment remained
    WITH orphaned_assignments AS (
        DELETE FROM job_assignments ja
        WHERE ja.assignment_source = 'tour'
        AND NOT EXISTS (
            SELECT 1
            FROM tour_assignments ta
            INNER JOIN jobs j ON j.tour_id = ta.tour_id
            WHERE ta.technician_id = ja.technician_id
            AND j.id = ja.job_id
        )
        RETURNING *
    )
    SELECT COUNT(*) INTO v_deleted_assignments FROM orphaned_assignments;

    -- Delete timesheets that no longer have a corresponding tour_assignment
    -- These are timesheets where the tour tech was removed but the timesheets remained
    WITH orphaned_timesheets AS (
        DELETE FROM timesheets ts
        WHERE ts.source = 'tour'
        AND NOT EXISTS (
            SELECT 1
            FROM tour_assignments ta
            INNER JOIN jobs j ON j.tour_id = ta.tour_id
            WHERE ta.technician_id = ts.technician_id
            AND j.id = ts.job_id
        )
        RETURNING *
    )
    SELECT COUNT(*) INTO v_deleted_timesheets FROM orphaned_timesheets;

    RAISE NOTICE 'Deleted % orphaned job_assignments', v_deleted_assignments;
    RAISE NOTICE 'Deleted % orphaned timesheets', v_deleted_timesheets;
END $$;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✓ Orphaned tour assignments cleaned up';
    RAISE NOTICE '';
    RAISE NOTICE 'Removed tour techs should no longer appear in job cards or matrix';
END $$;

COMMIT;
