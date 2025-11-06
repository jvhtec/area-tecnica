# Fix Task #1: Add Missing Unique Constraints to job_assignments

**Priority:** 🔴 CRITICAL
**Estimated Effort:** 2-3 hours
**Risk Level:** Medium (requires database migration with existing data)

---

## Problem Statement

The `job_assignments` table lacks proper unique constraints to prevent duplicate assignments. Currently, the code relies on upsert operations with `onConflict` keys that don't have corresponding database constraints:

1. **Whole-Job Assignments:** Should have unique constraint on `(job_id, technician_id)` where `single_day = false`
2. **Single-Day Assignments:** Should have unique constraint on `(job_id, technician_id, assignment_date)` where `single_day = true`

**Evidence:**
- `staffing-click/index.ts:355-356` uses onConflict with these keys
- `staffing-click/index.ts:368-395` has fallback manual upsert logic indicating constraint failure
- `AssignJobDialog.tsx:351` checks for error code `23505` (unique violation) suggesting constraint should exist

**Impact:**
- Multiple assignments can be created for same job/technician/date
- Race conditions in concurrent scenarios (two managers assigning simultaneously)
- Data integrity compromised
- Timesheet generation may create duplicates
- Flex crew sync may fail or create duplicate line items

---

## Solution Design

### Approach

Create two **partial unique indexes** that enforce uniqueness based on the assignment type:

1. **For whole-job assignments:**
   - Unique on `(job_id, technician_id)`
   - Only when `single_day = false` OR `assignment_date IS NULL`

2. **For single-day assignments:**
   - Unique on `(job_id, technician_id, assignment_date)`
   - Only when `single_day = true` AND `assignment_date IS NOT NULL`

### Why Partial Indexes?

Partial indexes with `WHERE` clauses allow us to have different uniqueness rules based on the assignment type, which is exactly what we need.

---

## Implementation Steps

### Step 1: Analyze Existing Data

Before creating constraints, we must check for existing duplicates that would violate the new constraints.

**Query to find whole-job duplicates:**
```sql
SELECT job_id, technician_id, COUNT(*) as count
FROM job_assignments
WHERE single_day = false OR assignment_date IS NULL
GROUP BY job_id, technician_id
HAVING COUNT(*) > 1;
```

**Query to find single-day duplicates:**
```sql
SELECT job_id, technician_id, assignment_date, COUNT(*) as count
FROM job_assignments
WHERE single_day = true AND assignment_date IS NOT NULL
GROUP BY job_id, technician_id, assignment_date
HAVING COUNT(*) > 1;
```

**If duplicates exist:**
- Export duplicate records for manual review
- Decide on merge strategy (keep earliest, latest, or manual review)
- Create cleanup script before migration

### Step 2: Create Migration File

**File:** `supabase/migrations/20251107000000_add_job_assignments_unique_constraints.sql`

```sql
-- Add unique constraints for job_assignments to prevent duplicates
-- This migration addresses the critical data integrity issue identified in audit

-- First, we'll identify and log any existing duplicates
-- (In production, this should be done in a separate pre-migration script)

DO $$
DECLARE
  whole_job_dupes INTEGER;
  single_day_dupes INTEGER;
BEGIN
  -- Count whole-job duplicates
  SELECT COUNT(*) INTO whole_job_dupes
  FROM (
    SELECT job_id, technician_id
    FROM job_assignments
    WHERE single_day = false OR assignment_date IS NULL
    GROUP BY job_id, technician_id
    HAVING COUNT(*) > 1
  ) sub;

  -- Count single-day duplicates
  SELECT COUNT(*) INTO single_day_dupes
  FROM (
    SELECT job_id, technician_id, assignment_date
    FROM job_assignments
    WHERE single_day = true AND assignment_date IS NOT NULL
    GROUP BY job_id, technician_id, assignment_date
    HAVING COUNT(*) > 1
  ) sub;

  -- Raise notice (not error) to inform about duplicates
  IF whole_job_dupes > 0 THEN
    RAISE NOTICE 'WARNING: Found % duplicate whole-job assignments', whole_job_dupes;
  END IF;

  IF single_day_dupes > 0 THEN
    RAISE NOTICE 'WARNING: Found % duplicate single-day assignments', single_day_dupes;
  END IF;

  -- If duplicates exist, the constraint creation below will fail
  -- This is intentional - duplicates must be resolved first
END $$;

-- Create partial unique index for whole-job assignments
-- Prevents multiple whole-job assignments for same technician on same job
CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_whole_job_unique
  ON job_assignments (job_id, technician_id)
  WHERE (single_day = false OR assignment_date IS NULL);

COMMENT ON INDEX job_assignments_whole_job_unique IS
  'Ensures a technician can only have one whole-job assignment per job';

-- Create partial unique index for single-day assignments
-- Prevents multiple single-day assignments for same technician on same job and date
CREATE UNIQUE INDEX IF NOT EXISTS job_assignments_single_day_unique
  ON job_assignments (job_id, technician_id, assignment_date)
  WHERE (single_day = true AND assignment_date IS NOT NULL);

COMMENT ON INDEX job_assignments_single_day_unique IS
  'Ensures a technician can only have one single-day assignment per job per date';

-- Verify constraints by attempting invalid inserts (should fail)
DO $$
BEGIN
  -- This block is for testing only - comment out in production
  RAISE NOTICE 'Unique constraints created successfully';
END $$;
```

### Step 3: Test Migration Locally

**Test Script:** `test_unique_constraints.sql`

```sql
-- Test script for unique constraints
-- Run this against a test database with sample data

BEGIN;

-- Insert test job
INSERT INTO jobs (id, title, start_time, end_time)
VALUES ('test-job-1', 'Test Job', '2025-11-10 10:00:00', '2025-11-12 18:00:00')
ON CONFLICT (id) DO NOTHING;

-- Insert test technician
INSERT INTO profiles (id, first_name, last_name, department, role)
VALUES ('test-tech-1', 'Test', 'Technician', 'sound', 'technician')
ON CONFLICT (id) DO NOTHING;

-- Test 1: Insert whole-job assignment
INSERT INTO job_assignments (job_id, technician_id, sound_role, single_day, assignment_date)
VALUES ('test-job-1', 'test-tech-1', 'MON', false, NULL);

-- Test 2: Try to insert duplicate whole-job assignment (should FAIL with unique violation)
DO $$
BEGIN
  INSERT INTO job_assignments (job_id, technician_id, sound_role, single_day, assignment_date)
  VALUES ('test-job-1', 'test-tech-1', 'A1', false, NULL);

  RAISE EXCEPTION 'ERROR: Duplicate whole-job assignment was allowed (constraint not working)';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'SUCCESS: Duplicate whole-job assignment correctly rejected';
END $$;

-- Clean up whole-job assignment for next test
DELETE FROM job_assignments WHERE job_id = 'test-job-1' AND technician_id = 'test-tech-1';

-- Test 3: Insert single-day assignment
INSERT INTO job_assignments (job_id, technician_id, sound_role, single_day, assignment_date)
VALUES ('test-job-1', 'test-tech-1', 'MON', true, '2025-11-10');

-- Test 4: Try to insert duplicate single-day assignment for same date (should FAIL)
DO $$
BEGIN
  INSERT INTO job_assignments (job_id, technician_id, sound_role, single_day, assignment_date)
  VALUES ('test-job-1', 'test-tech-1', 'A1', true, '2025-11-10');

  RAISE EXCEPTION 'ERROR: Duplicate single-day assignment was allowed (constraint not working)';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'SUCCESS: Duplicate single-day assignment correctly rejected';
END $$;

-- Test 5: Insert single-day assignment for different date (should SUCCEED)
INSERT INTO job_assignments (job_id, technician_id, sound_role, single_day, assignment_date)
VALUES ('test-job-1', 'test-tech-1', 'MON', true, '2025-11-11');

-- Test 6: Verify we now have 2 single-day assignments
DO $$
DECLARE
  assignment_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO assignment_count
  FROM job_assignments
  WHERE job_id = 'test-job-1' AND technician_id = 'test-tech-1';

  IF assignment_count = 2 THEN
    RAISE NOTICE 'SUCCESS: Multiple single-day assignments for different dates allowed';
  ELSE
    RAISE EXCEPTION 'ERROR: Expected 2 assignments, found %', assignment_count;
  END IF;
END $$;

-- Clean up test data
DELETE FROM job_assignments WHERE job_id = 'test-job-1';
DELETE FROM jobs WHERE id = 'test-job-1';
DELETE FROM profiles WHERE id = 'test-tech-1';

ROLLBACK;  -- Don't commit test data
```

### Step 4: Update Code to Remove Fallback Logic

Once constraints are in place and working, remove the fallback manual upsert logic.

**File:** `supabase/functions/staffing-click/index.ts`

**Lines to remove:** 368-395

```typescript
// BEFORE (with fallback):
if (upsertErr && /no unique/i.test(upsertErr.message) && /constraint/i.test(upsertErr.message)) {
  console.warn('⚠️ job_assignments per-day upsert missing composite constraint, falling back to manual flow', {...});
  // Manual SELECT -> UPDATE or INSERT logic
}

// AFTER (trust the constraint):
if (upsertErr) {
  console.error('❌ job_assignments upsert failed', {...});
  await supabase.from('staffing_events').insert({
    staffing_request_id: rid,
    event: 'auto_assign_upsert_error',
    meta: { message: upsertErr.message, target_date: targetDate }
  });
  return; // Fail fast, don't continue
}
```

### Step 5: Add Integration Tests

**File:** `tests/integration/job-assignments-uniqueness.test.ts` (new file)

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '@/lib/supabase';

describe('Job Assignments Uniqueness', () => {
  const testJobId = 'test-job-' + Date.now();
  const testTechId = 'test-tech-' + Date.now();

  beforeEach(async () => {
    // Create test job and technician
    await supabase.from('jobs').insert({
      id: testJobId,
      title: 'Test Job',
      start_time: '2025-11-10T10:00:00Z',
      end_time: '2025-11-12T18:00:00Z'
    });

    await supabase.from('profiles').insert({
      id: testTechId,
      first_name: 'Test',
      last_name: 'Tech',
      department: 'sound',
      role: 'technician'
    });
  });

  afterEach(async () => {
    // Clean up
    await supabase.from('job_assignments').delete().eq('job_id', testJobId);
    await supabase.from('jobs').delete().eq('id', testJobId);
    await supabase.from('profiles').delete().eq('id', testTechId);
  });

  it('should prevent duplicate whole-job assignments', async () => {
    // First assignment should succeed
    const { error: error1 } = await supabase.from('job_assignments').insert({
      job_id: testJobId,
      technician_id: testTechId,
      sound_role: 'MON',
      single_day: false
    });
    expect(error1).toBeNull();

    // Second assignment should fail with unique violation
    const { error: error2 } = await supabase.from('job_assignments').insert({
      job_id: testJobId,
      technician_id: testTechId,
      sound_role: 'A1',
      single_day: false
    });
    expect(error2).toBeTruthy();
    expect(error2?.code).toBe('23505'); // Unique violation
  });

  it('should prevent duplicate single-day assignments for same date', async () => {
    const assignmentDate = '2025-11-10';

    // First assignment should succeed
    const { error: error1 } = await supabase.from('job_assignments').insert({
      job_id: testJobId,
      technician_id: testTechId,
      sound_role: 'MON',
      single_day: true,
      assignment_date: assignmentDate
    });
    expect(error1).toBeNull();

    // Second assignment for same date should fail
    const { error: error2 } = await supabase.from('job_assignments').insert({
      job_id: testJobId,
      technician_id: testTechId,
      sound_role: 'A1',
      single_day: true,
      assignment_date: assignmentDate
    });
    expect(error2).toBeTruthy();
    expect(error2?.code).toBe('23505');
  });

  it('should allow multiple single-day assignments for different dates', async () => {
    const { error: error1 } = await supabase.from('job_assignments').insert({
      job_id: testJobId,
      technician_id: testTechId,
      sound_role: 'MON',
      single_day: true,
      assignment_date: '2025-11-10'
    });
    expect(error1).toBeNull();

    const { error: error2 } = await supabase.from('job_assignments').insert({
      job_id: testJobId,
      technician_id: testTechId,
      sound_role: 'MON',
      single_day: true,
      assignment_date: '2025-11-11'
    });
    expect(error2).toBeNull();

    // Verify both exist
    const { data, error } = await supabase
      .from('job_assignments')
      .select('*')
      .eq('job_id', testJobId)
      .eq('technician_id', testTechId);

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('should allow upsert to update existing whole-job assignment', async () => {
    // Initial insert
    await supabase.from('job_assignments').insert({
      job_id: testJobId,
      technician_id: testTechId,
      sound_role: 'MON',
      single_day: false
    });

    // Upsert should update
    const { error } = await supabase.from('job_assignments')
      .upsert({
        job_id: testJobId,
        technician_id: testTechId,
        sound_role: 'A1', // Changed role
        single_day: false
      }, {
        onConflict: 'job_id,technician_id'
      });

    expect(error).toBeNull();

    // Verify role was updated
    const { data } = await supabase
      .from('job_assignments')
      .select('sound_role')
      .eq('job_id', testJobId)
      .eq('technician_id', testTechId)
      .single();

    expect(data?.sound_role).toBe('A1');
  });
});
```

---

## Deployment Plan

### Pre-Deployment

1. ✅ Run duplicate detection queries on production database
2. ✅ Export any duplicates found
3. ✅ Resolve duplicates (merge or delete)
4. ✅ Test migration on staging database
5. ✅ Run test script to verify constraints work
6. ✅ Review code changes for fallback removal

### Deployment

1. ✅ Schedule maintenance window (off-peak hours)
2. ✅ Create database backup
3. ✅ Run migration: `supabase db push`
4. ✅ Verify constraints created: `\d job_assignments` in psql
5. ✅ Test upsert operations manually
6. ✅ Deploy code changes (remove fallback logic)
7. ✅ Monitor error logs for unique violations

### Post-Deployment

1. ✅ Run integration tests
2. ✅ Monitor for any assignment creation failures
3. ✅ Check Sentry/logs for error code 23505
4. ✅ Verify Flex crew sync still works correctly
5. ✅ Test all assignment flows:
   - Direct assignment (single/multi/whole)
   - Availability request confirmation
   - Offer confirmation (auto-assignment)

### Rollback Plan

If critical issues arise:

1. Drop the new indexes:
   ```sql
   DROP INDEX IF EXISTS job_assignments_whole_job_unique;
   DROP INDEX IF EXISTS job_assignments_single_day_unique;
   ```

2. Revert code changes (restore fallback logic)

3. Investigate issues and create new fix

---

## Success Criteria

- ✅ Migration runs without errors
- ✅ No duplicate assignments can be created
- ✅ Upsert operations work correctly for both assignment types
- ✅ All integration tests pass
- ✅ No production errors related to assignments for 48 hours post-deployment
- ✅ Flex crew sync continues to work
- ✅ Fallback code successfully removed

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing duplicates prevent constraint creation | Medium | High | Pre-deployment duplicate detection and cleanup |
| Upsert operations fail due to wrong onConflict key | Low | High | Comprehensive testing before deployment |
| Race condition during migration | Low | Medium | Run during low-traffic window |
| Performance impact of new indexes | Very Low | Low | Indexes on frequently-queried columns, should improve performance |
| Code still uses wrong column name | Low | Medium | Code review before deployment |

---

## Estimated Timeline

- **Duplicate Analysis:** 1 hour
- **Migration Creation:** 1 hour
- **Testing:** 2 hours
- **Code Updates:** 1 hour
- **Deployment:** 1 hour
- **Monitoring:** 2 hours (first 48 hours)

**Total:** ~8 hours (1 day)

---

## Notes

- This fix is a prerequisite for Fix Task #2 (batch auto-assignment duplicates)
- Once constraints are in place, many edge cases will be handled automatically by the database
- Consider adding application-level validation as defense-in-depth
- Document the constraints in schema documentation

---

**Created:** November 6, 2025
**Status:** Ready for Implementation
**Assigned To:** TBD
