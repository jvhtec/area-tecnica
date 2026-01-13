-- Clean up declined tour assignments that should have been deleted
-- Tour assignments that are declined should be completely removed

BEGIN;

DO $$
DECLARE
    v_deleted_assignments integer := 0;
    v_deleted_timesheets integer := 0;
BEGIN
    RAISE NOTICE 'Cleaning up declined tour assignments...';

    -- Delete timesheets for declined tour assignments
    WITH deleted_timesheets AS (
        DELETE FROM timesheets
        WHERE (job_id, technician_id) IN (
            SELECT job_id, technician_id
            FROM job_assignments
            WHERE assignment_source = 'tour'
            AND status = 'declined'
        )
        RETURNING *
    )
    SELECT COUNT(*) INTO v_deleted_timesheets FROM deleted_timesheets;

    -- Delete declined tour assignments
    WITH deleted_assignments AS (
        DELETE FROM job_assignments
        WHERE assignment_source = 'tour'
        AND status = 'declined'
        RETURNING *
    )
    SELECT COUNT(*) INTO v_deleted_assignments FROM deleted_assignments;

    RAISE NOTICE 'Deleted % declined tour assignments', v_deleted_assignments;
    RAISE NOTICE 'Deleted % related timesheets', v_deleted_timesheets;
END $$;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✓ Declined tour assignments cleaned up';
    RAISE NOTICE '';
    RAISE NOTICE 'Declined tour techs should no longer appear in job cards or payout breakdowns';
END $$;

COMMIT;
