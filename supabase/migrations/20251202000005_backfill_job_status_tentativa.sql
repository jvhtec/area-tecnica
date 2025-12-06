-- Backfill jobs with null status to 'Tentativa'
-- This fixes wallboard showing no data because jobs don't have status values

BEGIN;

DO $$
DECLARE
    v_updated_count integer := 0;
BEGIN
    RAISE NOTICE 'Backfilling jobs with null status to Tentativa...';

    -- Update all jobs with null status to 'Tentativa'
    WITH updated_jobs AS (
        UPDATE jobs
        SET status = 'Tentativa'
        WHERE status IS NULL
        RETURNING *
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated_jobs;

    RAISE NOTICE 'Updated % jobs to status = Tentativa', v_updated_count;
END $$;

-- Set default value for status column going forward
ALTER TABLE jobs
    ALTER COLUMN status SET DEFAULT 'Tentativa';

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✓ Job status backfill completed';
    RAISE NOTICE '✓ Default status set to Tentativa for new jobs';
    RAISE NOTICE '';
    RAISE NOTICE 'All jobs now have status values for wallboard filtering';
END $$;

COMMIT;
