# Fix Task #2: Standardize Column Naming for Assignment Dates

**Priority:** 🟡 MODERATE
**Estimated Effort:** 2-3 hours
**Risk Level:** Low (mostly code changes, minimal schema impact)
**Dependencies:** Should be done after Fix Task #1

---

## Problem Statement

There's inconsistent naming for date columns related to assignments:

1. **job_assignments table:**
   - Migration `20260301000000` adds `single_day_date` column
   - Migration `20250719090000` adds `assignment_date` column
   - Code uses `assignment_date` (correct)
   - Both columns might exist, causing confusion

2. **staffing_requests table:**
   - Uses `target_date` (this is semantically correct for staffing context)

3. **Code inconsistencies:**
   - `useJobAssignmentsRealtime.ts:36` uses `single_day_date` and `assignment_date`
   - Most other code uses `assignment_date`

**Impact:**
- Developer confusion about which column to use
- Potential bugs from reading/writing wrong column
- Data synchronization issues if both columns exist
- Extra storage for duplicate data

---

## Solution Design

### Standardization Strategy

1. **For job_assignments:** Use `assignment_date` exclusively
   - Drop `single_day_date` column if it exists
   - Migrate any data from `single_day_date` to `assignment_date`
   - Update all code references

2. **For staffing_requests:** Keep `target_date` (semantically different from assignment_date)
   - `target_date` = the date being requested for staffing
   - `assignment_date` = the date actually assigned

3. **Documentation:** Add clear comments explaining the semantic difference

---

## Implementation Steps

### Step 1: Audit Current State

**Check if both columns exist:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'job_assignments'
  AND column_name IN ('assignment_date', 'single_day_date')
ORDER BY column_name;
```

**Check for data in single_day_date:**
```sql
SELECT COUNT(*) as total_rows,
       COUNT(assignment_date) as has_assignment_date,
       COUNT(single_day_date) as has_single_day_date,
       COUNT(CASE WHEN assignment_date IS NOT NULL AND single_day_date IS NOT NULL
                  AND assignment_date != single_day_date THEN 1 END) as mismatched
FROM job_assignments
WHERE single_day = true;
```

### Step 2: Create Migration to Clean Up

**File:** `supabase/migrations/20251107100000_standardize_assignment_date_column.sql`

```sql
-- Standardize job_assignments date column naming
-- Remove single_day_date in favor of assignment_date

DO $$
BEGIN
  -- Check if single_day_date column exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'job_assignments'
      AND column_name = 'single_day_date'
  ) THEN
    -- First, migrate any data from single_day_date to assignment_date
    -- Only update rows where assignment_date is NULL but single_day_date has a value
    UPDATE job_assignments
    SET assignment_date = single_day_date
    WHERE assignment_date IS NULL
      AND single_day_date IS NOT NULL;

    -- Log how many rows were updated
    RAISE NOTICE 'Migrated single_day_date to assignment_date for % rows',
      (SELECT COUNT(*) FROM job_assignments WHERE assignment_date IS NOT NULL);

    -- Check for any mismatches (data integrity issue)
    IF EXISTS (
      SELECT 1
      FROM job_assignments
      WHERE assignment_date IS NOT NULL
        AND single_day_date IS NOT NULL
        AND assignment_date != single_day_date
    ) THEN
      RAISE WARNING 'Found rows with mismatched assignment_date and single_day_date. Manual review required.';
      -- Log the mismatches for review
      RAISE NOTICE 'Mismatched rows: %',
        (SELECT json_agg(json_build_object('job_id', job_id, 'technician_id', technician_id, 'assignment_date', assignment_date, 'single_day_date', single_day_date))
         FROM job_assignments
         WHERE assignment_date IS NOT NULL
           AND single_day_date IS NOT NULL
           AND assignment_date != single_day_date);
    END IF;

    -- Drop the redundant column
    ALTER TABLE job_assignments DROP COLUMN single_day_date;

    RAISE NOTICE 'Dropped single_day_date column successfully';
  ELSE
    RAISE NOTICE 'Column single_day_date does not exist, nothing to migrate';
  END IF;
END $$;

-- Add comment to clarify column usage
COMMENT ON COLUMN job_assignments.assignment_date IS
  'Specific date covered by this assignment when single_day=true. NULL for whole-job assignments.';

COMMENT ON COLUMN job_assignments.single_day IS
  'True when the assignment covers only a single day (assignment_date must be set). False for whole-job assignments.';

-- Verify CHECK constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_assignments_single_day_check'
      AND conrelid = 'public.job_assignments'::regclass
  ) THEN
    ALTER TABLE job_assignments
      ADD CONSTRAINT job_assignments_single_day_check
      CHECK (single_day = false OR assignment_date IS NOT NULL);
    RAISE NOTICE 'Added CHECK constraint for single_day assignments';
  ELSE
    RAISE NOTICE 'CHECK constraint already exists';
  END IF;
END $$;
```

### Step 3: Update Code References

**Files to update:**

1. **useJobAssignmentsRealtime.ts** (lines 35-37, 164-165)

```typescript
// BEFORE:
return {
  // ...
  single_day: payload.single_day,
  single_day_date: payload.single_day_date,  // ❌ Remove this
  assignment_date: (payload as any).assignment_date ?? null,
  // ...
};

// AFTER:
return {
  // ...
  single_day: payload.single_day,
  assignment_date: payload.assignment_date,  // ✅ Only use assignment_date
  // ...
};
```

2. **buildAssignmentInsertPayload function** (useJobAssignmentsRealtime.ts:15-39)

```typescript
// BEFORE:
return {
  // ...
  single_day: shouldFlagSingleDay,
  // Populate both columns for compatibility across older and newer schema
  single_day_date: shouldFlagSingleDay ? options?.singleDayDate ?? null : null,  // ❌ Remove
  assignment_date: shouldFlagSingleDay ? options?.singleDayDate ?? null : null,
};

// AFTER:
return {
  // ...
  single_day: shouldFlagSingleDay,
  assignment_date: shouldFlagSingleDay ? options?.singleDayDate ?? null : null,  // ✅ Only one
};
```

3. **Search for any other references:**

```bash
# Find all references to single_day_date
grep -r "single_day_date" src/ supabase/functions/
```

Update all findings to use `assignment_date` instead.

### Step 4: Update TypeScript Types

**File:** `src/types/assignment.ts`

Ensure the `Assignment` type definition uses `assignment_date`:

```typescript
export interface Assignment {
  id: string;
  job_id: string;
  technician_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  status: 'invited' | 'confirmed' | 'declined';
  assigned_at: string;
  assigned_by: string | null;
  response_time: string | null;
  single_day: boolean;
  assignment_date: string | null;  // ✅ Only this, not single_day_date
  assignment_source: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
    department: string;
  };
  jobs?: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
  };
}
```

### Step 5: Add Tests

**File:** `tests/unit/assignment-date-naming.test.ts` (new)

```typescript
import { describe, it, expect } from 'vitest';
import { buildAssignmentInsertPayload } from '@/hooks/useJobAssignmentsRealtime';

describe('Assignment Date Column Naming', () => {
  it('should use assignment_date for single-day assignments', () => {
    const payload = buildAssignmentInsertPayload(
      'job-1',
      'tech-1',
      'MON',
      'none',
      'user-1',
      { singleDay: true, singleDayDate: '2025-11-10' }
    );

    expect(payload).toHaveProperty('assignment_date', '2025-11-10');
    expect(payload).toHaveProperty('single_day', true);
    expect(payload).not.toHaveProperty('single_day_date');  // Should NOT exist
  });

  it('should have null assignment_date for whole-job assignments', () => {
    const payload = buildAssignmentInsertPayload(
      'job-1',
      'tech-1',
      'MON',
      'none',
      'user-1',
      { singleDay: false }
    );

    expect(payload).toHaveProperty('assignment_date', null);
    expect(payload).toHaveProperty('single_day', false);
  });
});
```

---

## Deployment Plan

### Pre-Deployment

1. ✅ Run audit queries to check current state
2. ✅ Verify no critical data in single_day_date that differs from assignment_date
3. ✅ Test migration on staging
4. ✅ Review all code changes
5. ✅ Run unit tests

### Deployment

1. ✅ Run migration: `supabase db push`
2. ✅ Verify column dropped: `\d job_assignments`
3. ✅ Deploy code changes
4. ✅ Run integration tests

### Post-Deployment

1. ✅ Verify assignments can be created
2. ✅ Test single-day and whole-job assignments
3. ✅ Check that UI correctly displays assignment dates
4. ✅ Monitor logs for any errors related to missing column

### Rollback Plan

If issues occur:

1. **Schema rollback:**
   ```sql
   ALTER TABLE job_assignments ADD COLUMN single_day_date date;
   UPDATE job_assignments SET single_day_date = assignment_date WHERE single_day = true;
   ```

2. **Code rollback:** Revert code changes

---

## Success Criteria

- ✅ Only `assignment_date` column exists in `job_assignments`
- ✅ All code uses `assignment_date` (no references to `single_day_date`)
- ✅ TypeScript types updated and consistent
- ✅ All tests pass
- ✅ Documentation updated
- ✅ No production errors for 24 hours post-deployment

---

## Documentation Updates

### Database Schema Documentation

Add to schema docs:

```markdown
## job_assignments Table

| Column | Type | Description |
|--------|------|-------------|
| assignment_date | date | The specific date covered when single_day=true. NULL for whole-job assignments. |
| single_day | boolean | Whether this assignment covers only one date (true) or the entire job (false). |

**Constraints:**
- CHECK: `single_day = false OR assignment_date IS NOT NULL`
- UNIQUE (partial): `(job_id, technician_id, assignment_date)` WHERE `single_day = true`
- UNIQUE (partial): `(job_id, technician_id)` WHERE `single_day = false`

## staffing_requests Table

| Column | Type | Description |
|--------|------|-------------|
| target_date | date | The specific date being requested for staffing when single_day=true. |
| single_day | boolean | Whether this request is for one date (true) or entire job (false). |

**Note:** `target_date` and `assignment_date` have different semantics:
- `target_date`: The date for which staffing is being *requested*
- `assignment_date`: The date for which the technician is *assigned*
```

---

## Estimated Timeline

- **Audit Current State:** 30 minutes
- **Migration Creation:** 1 hour
- **Code Updates:** 1 hour
- **Testing:** 1 hour
- **Deployment:** 30 minutes

**Total:** ~4 hours

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Data in single_day_date differs from assignment_date | Low | Medium | Pre-deployment audit and manual review |
| Missed code references | Medium | Medium | Comprehensive grep search and code review |
| Type checking breaks | Low | Low | TypeScript will catch at compile time |

---

**Created:** November 6, 2025
**Status:** Ready for Implementation
**Assigned To:** TBD
