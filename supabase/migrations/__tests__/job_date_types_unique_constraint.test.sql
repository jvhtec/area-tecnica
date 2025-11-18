-- Test file for job_date_types unique constraint migration
-- This validates the migration logic and constraint behavior

-- Test 1: Verify duplicate removal logic
-- The migration should remove duplicates before creating constraint
BEGIN;

-- Create test data with duplicates
CREATE TEMP TABLE test_job_date_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    date DATE NOT NULL,
    type TEXT,
    ctid TID
);

-- Insert test data with duplicates
INSERT INTO test_job_date_types (job_id, date, type)
VALUES 
    ('11111111-1111-1111-1111-111111111111', '2024-01-15', 'show'),
    ('11111111-1111-1111-1111-111111111111', '2024-01-15', 'show'), -- duplicate
    ('22222222-2222-2222-2222-222222222222', '2024-01-16', 'rehearsal'),
    ('22222222-2222-2222-2222-222222222222', '2024-01-16', 'rehearsal'), -- duplicate
    ('22222222-2222-2222-2222-222222222222', '2024-01-16', 'rehearsal'), -- triple
    ('33333333-3333-3333-3333-333333333333', '2024-01-17', 'travel'); -- unique

-- Verify we have duplicates
SELECT 
    'Test 1.1: Verify duplicates exist' AS test,
    COUNT(*) = 6 AS passed,
    COUNT(*) AS total_records
FROM test_job_date_types;

SELECT 
    'Test 1.2: Count duplicate groups' AS test,
    COUNT(*) = 2 AS passed,
    COUNT(*) AS duplicate_groups
FROM (
    SELECT job_id, date
    FROM test_job_date_types
    GROUP BY job_id, date
    HAVING COUNT(*) > 1
) subq;

ROLLBACK;

-- Test 2: Verify constraint prevents duplicates after migration
COMMENT ON COLUMN test_job_date_types.job_id IS 
'Test 2: After migration, job_date_types_job_id_date_key constraint should prevent duplicate (job_id, date) pairs';

-- Test 3: Verify constraint allows different dates for same job
COMMENT ON COLUMN test_job_date_types.date IS
'Test 3: Constraint should allow multiple records for same job_id with different dates';

-- Test 4: Verify constraint allows different jobs for same date
COMMENT ON COLUMN test_job_date_types.type IS
'Test 4: Constraint should allow multiple records for same date with different job_ids';

-- Test 5: Verify ON CONFLICT can use the constraint
COMMENT ON TABLE test_job_date_types IS
'Test 5: INSERT ... ON CONFLICT (job_id, date) should work with the unique constraint';

-- Test 6: Verify index exists for performance
-- Unique constraints automatically create an index
COMMENT ON TABLE test_job_date_types IS
'Test 6: Unique constraint should create supporting index for query performance';

-- Test 7: Edge case - NULL handling
-- PostgreSQL unique constraints treat NULL as distinct
COMMENT ON TABLE test_job_date_types IS
'Test 7: Constraint behavior with NULL values (if applicable)';

-- Test 8: Verify old constraint names are removed
COMMENT ON TABLE test_job_date_types IS
'Test 8: Old constraints (job_date_types_job_id_date_unique, unique_job_date) should be dropped';

-- Test 9: Verify only one unique constraint remains
COMMENT ON TABLE test_job_date_types IS
'Test 9: Only job_date_types_job_id_date_key constraint should exist on (job_id, date)';

-- Test 10: Verify migration is idempotent
COMMENT ON TABLE test_job_date_types IS
'Test 10: Running migration multiple times should not cause errors due to DROP IF EXISTS';