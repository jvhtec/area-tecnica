# Fix Task #3: Improve Conflict Checking Logic

**Priority:** 🟡 HIGH PRIORITY
**Estimated Effort:** 4-6 hours
**Risk Level:** Medium (affects core business logic)
**Dependencies:** Should be done after Fix Task #1

---

## Problem Statement

The conflict checking logic in `technicianAvailability.ts` has several issues:

1. **Doesn't Consider Pending Assignments:**
   - Only checks `confirmed` assignments (line 226)
   - Ignores `invited` (pending) assignments
   - Two managers can send offers/assignments to same technician simultaneously

2. **Whole-Job vs Single-Day Mismatch:**
   - When checking a whole-job assignment, may not properly detect conflicts with existing single-day assignments
   - Logic at lines 237-243 filters out single-day assignments for different dates, but doesn't account for whole-job span

3. **No Warning for Soft Conflicts:**
   - No distinction between hard conflicts (confirmed) and soft conflicts (pending/invited)
   - User should see warnings like "technician has pending invite for overlapping job"

**Impact:**
- Double-booking possible
- Poor coordination between multiple managers
- Technicians receive conflicting offers
- User confusion when both invites are accepted
- Need for manual conflict resolution

---

## Solution Design

### Enhanced Conflict Detection

Create a **tiered conflict system**:

1. **Hard Conflicts** (should block operation):
   - Confirmed overlapping assignments
   - Technician marked unavailable

2. **Soft Conflicts** (should warn but allow override):
   - Pending (`invited`) overlapping assignments
   - Close proximity assignments (same day, different time)

3. **Information** (should inform but not warn):
   - Other assignments on same job but different dates
   - Recent declines for this job

### API Changes

Modify `checkTimeConflict()` to return more information:

```typescript
export interface ConflictCheckResult {
  hasHardConflict: boolean;
  hasSoftConflict: boolean;
  hardConflicts: TechnicianJobConflict[];
  softConflicts: TechnicianJobConflict[];
  unavailabilityConflicts: Array<{
    date: string;
    reason: string;
    source: string;
  }>;
}
```

---

## Implementation Steps

### Step 1: Enhance Conflict Detection Utility

**File:** `src/utils/technicianAvailability.ts`

Add new comprehensive conflict checker:

```typescript
/**
 * Enhanced conflict detection with hard/soft conflict distinction
 */
export interface ConflictCheckResult {
  hasHardConflict: boolean;
  hasSoftConflict: boolean;
  hardConflicts: Array<TechnicianJobConflict & { status: string }>;
  softConflicts: Array<TechnicianJobConflict & { status: string }>;
  unavailabilityConflicts: Array<{
    date: string;
    reason: string;
    source: string;
    notes?: string;
  }>;
  recentDeclines?: Array<{
    job_id: string;
    job_title: string;
    declined_at: string;
  }>;
}

export async function checkTimeConflictEnhanced(
  technicianId: string,
  targetJobId: string,
  options?: {
    targetDateIso?: string;
    singleDayOnly?: boolean;
    includePending?: boolean;
    includeDeclineHistory?: boolean;
  }
): Promise<ConflictCheckResult> {
  const {
    targetDateIso,
    singleDayOnly = false,
    includePending = true,
    includeDeclineHistory = false
  } = options || {};

  try {
    // 1. Fetch target job
    const { data: targetJob, error: jobError } = await supabase
      .from("jobs")
      .select("id,title,start_time,end_time")
      .eq("id", targetJobId)
      .maybeSingle();

    if (jobError || !targetJob) {
      return emptyConflictResult();
    }

    // 2. Fetch ALL assignments (confirmed and invited)
    const statusFilter = includePending ? ['confirmed', 'invited'] : ['confirmed'];
    const { data: assignments, error: assignmentsError } = await supabase
      .from("job_assignments")
      .select("job_id,status,single_day,assignment_date")
      .eq("technician_id", technicianId)
      .in("status", statusFilter);

    if (assignmentsError) {
      console.warn("Error fetching assignments for conflict check:", assignmentsError);
      return emptyConflictResult();
    }

    // 3. Separate confirmed and pending assignments
    const confirmedAssignments = (assignments || []).filter(a => a.status === 'confirmed');
    const pendingAssignments = (assignments || []).filter(a => a.status === 'invited');

    // 4. Filter assignments based on target date logic
    const filterAssignments = (assignmentList: typeof assignments) => {
      return (assignmentList || []).filter((assignment) => {
        // Skip the target job itself
        if (assignment.job_id === targetJobId) {
          return false;
        }

        // If we're checking a single-day assignment
        if (singleDayOnly && targetDateIso) {
          // If existing assignment is also single-day
          if (assignment.single_day && assignment.assignment_date) {
            // Only conflict if same date
            return assignment.assignment_date === targetDateIso;
          }
          // If existing assignment is whole-job, need to check if targetDateIso falls within its span
          // This will be checked in the overlap logic below
          return true;
        }

        // If we're checking a whole-job assignment
        if (!singleDayOnly) {
          // If existing assignment is single-day
          if (assignment.single_day && assignment.assignment_date) {
            // Check if this single-day falls within the target job's span
            const targetStart = new Date(targetJob.start_time!).toISOString().split('T')[0];
            const targetEnd = new Date(targetJob.end_time!).toISOString().split('T')[0];
            return assignment.assignment_date >= targetStart && assignment.assignment_date <= targetEnd;
          }
          // Both whole-job, will check overlap below
          return true;
        }

        return true;
      });
    };

    const filteredConfirmed = filterAssignments(confirmedAssignments);
    const filteredPending = filterAssignments(pendingAssignments);

    // 5. Get job details for conflicting assignments
    const allConflictingIds = [
      ...filteredConfirmed.map(a => a.job_id),
      ...filteredPending.map(a => a.job_id)
    ];

    if (allConflictingIds.length === 0) {
      return await checkUnavailabilityConflicts(technicianId, targetJob, targetDateIso, singleDayOnly);
    }

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("id,title,start_time,end_time")
      .in("id", allConflictingIds);

    if (jobsError) {
      console.warn("Error fetching jobs for conflict check:", jobsError);
      return emptyConflictResult();
    }

    // 6. Calculate target time range
    const { targetStart, targetEnd } = calculateTargetRange(targetJob, targetDateIso, singleDayOnly);

    if (!targetStart || !targetEnd) {
      return emptyConflictResult();
    }

    // 7. Find overlapping jobs
    const findOverlaps = (assignmentList: typeof assignments) => {
      return (jobs || [])
        .filter((job) => {
          // Find the assignment for this job
          const assignment = assignmentList?.find(a => a.job_id === job.id);
          if (!assignment) return false;

          if (!job.start_time || !job.end_time) {
            return false;
          }

          // If assignment is single-day, check that specific date
          if (assignment.single_day && assignment.assignment_date) {
            const assignDate = new Date(`${assignment.assignment_date}T00:00:00Z`);
            const assignDateEnd = new Date(`${assignment.assignment_date}T23:59:59Z`);
            return assignDate < targetEnd && assignDateEnd > targetStart;
          }

          // Whole-job assignment: check full span overlap
          const jobStart = new Date(job.start_time);
          const jobEnd = new Date(job.end_time);
          return jobStart < targetEnd && jobEnd > targetStart;
        })
        .map(job => {
          const assignment = assignmentList?.find(a => a.job_id === job.id);
          return {
            id: job.id,
            title: job.title,
            start_time: job.start_time!,
            end_time: job.end_time!,
            status: assignment!.status
          };
        });
    };

    const hardConflicts = findOverlaps(filteredConfirmed);
    const softConflicts = findOverlaps(filteredPending);

    // 8. Check unavailability
    const unavailabilityResult = await checkUnavailabilityConflicts(
      technicianId,
      targetJob,
      targetDateIso,
      singleDayOnly
    );

    // 9. Optionally check decline history
    let recentDeclines: ConflictCheckResult['recentDeclines'] = undefined;
    if (includeDeclineHistory) {
      recentDeclines = await getRecentDeclines(technicianId, targetJobId);
    }

    return {
      hasHardConflict: hardConflicts.length > 0 || unavailabilityResult.unavailabilityConflicts.length > 0,
      hasSoftConflict: softConflicts.length > 0,
      hardConflicts,
      softConflicts,
      unavailabilityConflicts: unavailabilityResult.unavailabilityConflicts,
      recentDeclines
    };
  } catch (error) {
    console.warn("Enhanced conflict check error", error);
    return emptyConflictResult();
  }
}

// Helper functions
function emptyConflictResult(): ConflictCheckResult {
  return {
    hasHardConflict: false,
    hasSoftConflict: false,
    hardConflicts: [],
    softConflicts: [],
    unavailabilityConflicts: []
  };
}

function calculateTargetRange(
  targetJob: any,
  targetDateIso?: string,
  singleDayOnly?: boolean
) {
  const targetStart = singleDayOnly && targetDateIso
    ? new Date(`${targetDateIso}T00:00:00Z`)
    : (targetJob.start_time ? new Date(targetJob.start_time) : null);

  const targetEnd = singleDayOnly && targetDateIso
    ? new Date(`${targetDateIso}T23:59:59Z`)
    : (targetJob.end_time ? new Date(targetJob.end_time) : null);

  return { targetStart, targetEnd };
}

async function checkUnavailabilityConflicts(
  technicianId: string,
  targetJob: any,
  targetDateIso?: string,
  singleDayOnly?: boolean
): Promise<Pick<ConflictCheckResult, 'unavailabilityConflicts'>> {
  const jobStartDate = targetDateIso || new Date(targetJob.start_time).toISOString().split('T')[0];
  const jobEndDate = targetDateIso || new Date(targetJob.end_time).toISOString().split('T')[0];

  const { data: unavailabilityData, error } = await supabase
    .from("availability_schedules")
    .select("date, status, source, notes")
    .eq("user_id", technicianId)
    .eq("status", "unavailable")
    .gte("date", jobStartDate)
    .lte("date", jobEndDate);

  if (error) {
    console.warn("Error fetching unavailability:", error);
    return { unavailabilityConflicts: [] };
  }

  return {
    unavailabilityConflicts: (unavailabilityData || []).map(avail => ({
      date: avail.date,
      reason: avail.source === 'vacation' ? 'Vacation' : 'Unavailable',
      source: avail.source,
      notes: avail.notes
    }))
  };
}

async function getRecentDeclines(
  technicianId: string,
  targetJobId: string
): Promise<ConflictCheckResult['recentDeclines']> {
  // Look for declined assignments for this specific job in last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("job_assignments")
    .select(`
      job_id,
      response_time,
      jobs!inner (
        id,
        title
      )
    `)
    .eq("technician_id", technicianId)
    .eq("job_id", targetJobId)
    .eq("status", "declined")
    .gte("response_time", thirtyDaysAgo.toISOString())
    .order("response_time", { ascending: false });

  if (error || !data?.length) {
    return undefined;
  }

  return data.map(d => ({
    job_id: d.job_id,
    job_title: (d.jobs as any).title,
    declined_at: d.response_time!
  }));
}
```

### Step 2: Update AssignJobDialog to Use Enhanced Checking

**File:** `src/components/matrix/AssignJobDialog.tsx`

Update the `checkForConflicts` function:

```typescript
const checkForConflicts = async (): Promise<{
  result: ConflictCheckResult;
  targetDate?: string;
  mode: 'full' | 'single' | 'multi';
} | null> => {
  if (!selectedJobId) {
    return null;
  }

  if (coverageMode === 'multi') {
    const uniqueKeys = Array.from(new Set((multiDates || []).map(d => format(d, 'yyyy-MM-dd'))));
    for (const key of uniqueKeys) {
      const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
        targetDateIso: key,
        singleDayOnly: true,
        includePending: true,
        includeDeclineHistory: true
      });
      if (result.hasHardConflict || result.hasSoftConflict) {
        return { result, targetDate: key, mode: 'multi' };
      }
    }
    return null;
  }

  if (coverageMode === 'single') {
    const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
      targetDateIso: assignmentDate,
      singleDayOnly: true,
      includePending: true,
      includeDeclineHistory: true
    });
    return (result.hasHardConflict || result.hasSoftConflict)
      ? { result, targetDate: assignmentDate, mode: 'single' }
      : null;
  }

  const result = await checkTimeConflictEnhanced(technicianId, selectedJobId, {
    includePending: true,
    includeDeclineHistory: true
  });
  return (result.hasHardConflict || result.hasSoftConflict)
    ? { result, mode: 'full' }
    : null;
};
```

### Step 3: Enhance Conflict Warning Dialog

**File:** `src/components/matrix/AssignJobDialog.tsx`

Update the AlertDialog to show more detailed conflict information:

```typescript
<AlertDialogContent className="max-w-2xl">
  <AlertDialogHeader>
    <AlertDialogTitle>
      {conflictData?.result.hasHardConflict ? '⛔ Scheduling Conflict' : '⚠️ Potential Conflict'}
    </AlertDialogTitle>
    <AlertDialogDescription className="space-y-3">
      {conflictData && (
        <>
          {/* Hard Conflicts */}
          {conflictData.result.hardConflicts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="font-semibold text-red-900 mb-2">Confirmed Assignments:</div>
              <ul className="list-disc list-inside space-y-1">
                {conflictData.result.hardConflicts.map(conflict => (
                  <li key={conflict.id} className="text-red-800 text-sm">
                    <strong>{conflict.title}</strong>
                    {' '}({formatJobRange(conflict.start_time, conflict.end_time)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Soft Conflicts */}
          {conflictData.result.softConflicts.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <div className="font-semibold text-yellow-900 mb-2">Pending Invitations:</div>
              <ul className="list-disc list-inside space-y-1">
                {conflictData.result.softConflicts.map(conflict => (
                  <li key={conflict.id} className="text-yellow-800 text-sm">
                    <strong>{conflict.title}</strong>
                    {' '}({formatJobRange(conflict.start_time, conflict.end_time)})
                  </li>
                ))}
              </ul>
              <p className="text-xs text-yellow-700 mt-2">
                Technician has not yet responded to these invitations.
              </p>
            </div>
          )}

          {/* Unavailability */}
          {conflictData.result.unavailabilityConflicts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <div className="font-semibold text-red-900 mb-2">Unavailable Dates:</div>
              <ul className="list-disc list-inside space-y-1">
                {conflictData.result.unavailabilityConflicts.map((unav, idx) => (
                  <li key={idx} className="text-red-800 text-sm">
                    {formatDateLabel(unav.date)} - {unav.reason}
                    {unav.notes && <span className="text-xs"> ({unav.notes})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent Declines */}
          {conflictData.result.recentDeclines && conflictData.result.recentDeclines.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="font-semibold text-gray-900 mb-2">ℹ️ Recent History:</div>
              <p className="text-sm text-gray-700">
                Technician declined this job {format(new Date(conflictData.result.recentDeclines[0].declined_at), 'PPP')}
              </p>
            </div>
          )}

          <div className="text-sm text-gray-600 mt-3">
            {conflictData.result.hasHardConflict
              ? 'Proceeding will create a double-booking. Are you sure?'
              : 'Technician may not be available. Do you want to proceed anyway?'}
          </div>
        </>
      )}
    </AlertDialogDescription>
  </AlertDialogHeader>
  <AlertDialogFooter>
    <AlertDialogCancel onClick={() => setConflictData(null)}>Go back</AlertDialogCancel>
    <AlertDialogAction
      onClick={() => {
        setConflictData(null);
        void attemptAssign(true);
      }}
      className={conflictData?.result.hasHardConflict ? 'bg-red-600 hover:bg-red-700' : ''}
    >
      {conflictData?.result.hasHardConflict ? 'Force assign anyway' : 'Proceed anyway'}
    </AlertDialogAction>
  </AlertDialogFooter>
</AlertDialogContent>
```

### Step 4: Update Staffing Email Conflict Check

**File:** `supabase/functions/send-staffing-email/index.ts`

Update lines 281-387 to use the enhanced conflict checker (call it via an RPC or replicate the logic in Deno).

Since edge functions run in Deno (not the React frontend), we need to either:
1. Create an RPC function that calls the enhanced checker, or
2. Port the logic to the edge function

**Option 1 (Recommended): Create RPC Function**

```sql
-- Migration: Add RPC for enhanced conflict checking
CREATE OR REPLACE FUNCTION check_technician_conflicts(
  _technician_id uuid,
  _target_job_id uuid,
  _target_date date DEFAULT NULL,
  _single_day boolean DEFAULT false,
  _include_pending boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  target_job record;
  hard_conflicts jsonb := '[]'::jsonb;
  soft_conflicts jsonb := '[]'::jsonb;
  unavailability_conflicts jsonb := '[]'::jsonb;
BEGIN
  -- Fetch target job
  SELECT id, title, start_time, end_time INTO target_job
  FROM jobs
  WHERE id = _target_job_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'hasHardConflict', false,
      'hasSoftConflict', false,
      'hardConflicts', '[]'::jsonb,
      'softConflicts', '[]'::jsonb,
      'unavailabilityConflicts', '[]'::jsonb
    );
  END IF;

  -- Check confirmed assignments (hard conflicts)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', j.id,
      'title', j.title,
      'start_time', j.start_time,
      'end_time', j.end_time,
      'status', a.status
    )
  ) INTO hard_conflicts
  FROM job_assignments a
  INNER JOIN jobs j ON a.job_id = j.id
  WHERE a.technician_id = _technician_id
    AND a.job_id != _target_job_id
    AND a.status = 'confirmed'
    AND (
      -- Handle different scenarios based on _single_day and _target_date
      CASE
        WHEN _single_day AND _target_date IS NOT NULL THEN
          -- Checking a single-day assignment
          CASE
            WHEN a.single_day AND a.assignment_date IS NOT NULL THEN
              -- Both single-day: check same date
              a.assignment_date = _target_date
            ELSE
              -- Existing is whole-job: check if _target_date falls in range
              _target_date::timestamp >= DATE(j.start_time) AND _target_date::timestamp <= DATE(j.end_time)
          END
        ELSE
          -- Checking a whole-job assignment
          CASE
            WHEN a.single_day AND a.assignment_date IS NOT NULL THEN
              -- Existing is single-day: check if it falls in target job range
              a.assignment_date >= DATE(target_job.start_time) AND a.assignment_date <= DATE(target_job.end_time)
            ELSE
              -- Both whole-job: check overlap
              j.start_time < target_job.end_time AND j.end_time > target_job.start_time
          END
      END
    );

  -- Check pending assignments (soft conflicts)
  IF _include_pending THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', j.id,
        'title', j.title,
        'start_time', j.start_time,
        'end_time', j.end_time,
        'status', a.status
      )
    ) INTO soft_conflicts
    FROM job_assignments a
    INNER JOIN jobs j ON a.job_id = j.id
    WHERE a.technician_id = _technician_id
      AND a.job_id != _target_job_id
      AND a.status = 'invited'
      AND (
        -- Same logic as above for conflict detection
        CASE
          WHEN _single_day AND _target_date IS NOT NULL THEN
            CASE
              WHEN a.single_day AND a.assignment_date IS NOT NULL THEN
                a.assignment_date = _target_date
              ELSE
                _target_date::timestamp >= DATE(j.start_time) AND _target_date::timestamp <= DATE(j.end_time)
            END
          ELSE
            CASE
              WHEN a.single_day AND a.assignment_date IS NOT NULL THEN
                a.assignment_date >= DATE(target_job.start_time) AND a.assignment_date <= DATE(target_job.end_time)
              ELSE
                j.start_time < target_job.end_time AND j.end_time > target_job.start_time
            END
        END
      );
  END IF;

  -- Check unavailability
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'reason', CASE WHEN source = 'vacation' THEN 'Vacation' ELSE 'Unavailable' END,
      'source', source,
      'notes', notes
    )
  ) INTO unavailability_conflicts
  FROM availability_schedules
  WHERE user_id = _technician_id
    AND status = 'unavailable'
    AND date >= COALESCE(_target_date, DATE(target_job.start_time))
    AND date <= COALESCE(_target_date, DATE(target_job.end_time));

  RETURN jsonb_build_object(
    'hasHardConflict', (COALESCE(jsonb_array_length(hard_conflicts), 0) > 0 OR COALESCE(jsonb_array_length(unavailability_conflicts), 0) > 0),
    'hasSoftConflict', COALESCE(jsonb_array_length(soft_conflicts), 0) > 0,
    'hardConflicts', COALESCE(hard_conflicts, '[]'::jsonb),
    'softConflicts', COALESCE(soft_conflicts, '[]'::jsonb),
    'unavailabilityConflicts', COALESCE(unavailability_conflicts, '[]'::jsonb)
  );
END;
$$;
```

Then use it in `send-staffing-email`:

```typescript
// Replace lines 281-387
const { data: conflictResult, error: conflictErr } = await supabase.rpc(
  'check_technician_conflicts',
  {
    _technician_id: profile_id,
    _target_job_id: job_id,
    _target_date: normalizedTargetDate,
    _single_day: isSingleDayRequest,
    _include_pending: true
  }
);

if (conflictErr) {
  console.warn('⚠️ Conflict check failed:', conflictErr);
} else if (conflictResult && (conflictResult.hasHardConflict || conflictResult.hasSoftConflict)) {
  // Return detailed conflict information
  const conflictType = conflictResult.hasHardConflict ? 'confirmed' : 'pending';
  const conflicts = conflictResult.hasHardConflict
    ? conflictResult.hardConflicts
    : conflictResult.softConflicts;

  return new Response(JSON.stringify({
    error: `Technician has ${conflictType} overlapping assignment`,
    details: {
      conflict_type: conflictType,
      conflicts: conflicts,
      unavailability: conflictResult.unavailabilityConflicts,
      target_job: {
        id: job.id,
        title: job.title,
        start_time: job.start_time,
        end_time: job.end_time,
        single_day: isSingleDayRequest,
        target_date: normalizedTargetDate
      }
    }
  }), {
    status: 409,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

### Step 5: Add Tests

**File:** `tests/unit/conflict-checking.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkTimeConflictEnhanced } from '@/utils/technicianAvailability';
import { supabase } from '@/lib/supabase';

describe('Enhanced Conflict Checking', () => {
  const testJobId1 = 'test-job-1-' + Date.now();
  const testJobId2 = 'test-job-2-' + Date.now();
  const testTechId = 'test-tech-' + Date.now();

  beforeEach(async () => {
    // Create test jobs
    await supabase.from('jobs').insert([
      {
        id: testJobId1,
        title: 'Test Job 1',
        start_time: '2025-11-10T10:00:00Z',
        end_time: '2025-11-12T18:00:00Z'
      },
      {
        id: testJobId2,
        title: 'Test Job 2',
        start_time: '2025-11-11T14:00:00Z',
        end_time: '2025-11-11T22:00:00Z'
      }
    ]);

    // Create test technician
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
    await supabase.from('job_assignments').delete().eq('technician_id', testTechId);
    await supabase.from('jobs').delete().in('id', [testJobId1, testJobId2]);
    await supabase.from('profiles').delete().eq('id', testTechId);
  });

  it('should detect hard conflict with confirmed assignment', async () => {
    // Create confirmed assignment for Job 1
    await supabase.from('job_assignments').insert({
      job_id: testJobId1,
      technician_id: testTechId,
      sound_role: 'MON',
      status: 'confirmed',
      single_day: false
    });

    // Check conflict for Job 2 (overlaps on 11th)
    const result = await checkTimeConflictEnhanced(testTechId, testJobId2);

    expect(result.hasHardConflict).toBe(true);
    expect(result.hasSoftConflict).toBe(false);
    expect(result.hardConflicts).toHaveLength(1);
    expect(result.hardConflicts[0].id).toBe(testJobId1);
  });

  it('should detect soft conflict with pending invitation', async () => {
    // Create pending (invited) assignment for Job 1
    await supabase.from('job_assignments').insert({
      job_id: testJobId1,
      technician_id: testTechId,
      sound_role: 'MON',
      status: 'invited',
      single_day: false
    });

    // Check conflict for Job 2
    const result = await checkTimeConflictEnhanced(testTechId, testJobId2, {
      includePending: true
    });

    expect(result.hasHardConflict).toBe(false);
    expect(result.hasSoftConflict).toBe(true);
    expect(result.softConflicts).toHaveLength(1);
    expect(result.softConflicts[0].id).toBe(testJobId1);
    expect(result.softConflicts[0].status).toBe('invited');
  });

  it('should not detect soft conflict when includePending is false', async () => {
    // Create pending assignment
    await supabase.from('job_assignments').insert({
      job_id: testJobId1,
      technician_id: testTechId,
      sound_role: 'MON',
      status: 'invited',
      single_day: false
    });

    // Check without includePending
    const result = await checkTimeConflictEnhanced(testTechId, testJobId2, {
      includePending: false
    });

    expect(result.hasHardConflict).toBe(false);
    expect(result.hasSoftConflict).toBe(false);
  });

  it('should detect conflict between single-day and whole-job', async () => {
    // Create whole-job confirmed assignment for Job 1 (Nov 10-12)
    await supabase.from('job_assignments').insert({
      job_id: testJobId1,
      technician_id: testTechId,
      sound_role: 'MON',
      status: 'confirmed',
      single_day: false
    });

    // Check single-day assignment for Job 2 on Nov 11
    const result = await checkTimeConflictEnhanced(testTechId, testJobId2, {
      targetDateIso: '2025-11-11',
      singleDayOnly: true
    });

    expect(result.hasHardConflict).toBe(true);
    expect(result.hardConflicts).toHaveLength(1);
  });

  it('should NOT detect conflict for single-day on different dates', async () => {
    // Create single-day assignment for Nov 10
    await supabase.from('job_assignments').insert({
      job_id: testJobId1,
      technician_id: testTechId,
      sound_role: 'MON',
      status: 'confirmed',
      single_day: true,
      assignment_date: '2025-11-10'
    });

    // Check single-day for Nov 11
    const result = await checkTimeConflictEnhanced(testTechId, testJobId2, {
      targetDateIso: '2025-11-11',
      singleDayOnly: true
    });

    expect(result.hasHardConflict).toBe(false);
    expect(result.hasSoftConflict).toBe(false);
  });
});
```

---

## Deployment Plan

### Pre-Deployment
1. ✅ Create and test RPC function on staging
2. ✅ Update frontend conflict checking code
3. ✅ Update edge function conflict checking
4. ✅ Run all tests
5. ✅ Manual testing of conflict scenarios

### Deployment
1. ✅ Deploy database migration (RPC function)
2. ✅ Deploy frontend code changes
3. ✅ Deploy edge function code changes
4. ✅ Test in production

### Post-Deployment
1. ✅ Monitor assignment creation for conflicts
2. ✅ Verify warnings show correctly in UI
3. ✅ Check that email sending respects soft conflicts
4. ✅ Monitor user feedback

---

## Success Criteria

- ✅ Pending (invited) assignments are detected as soft conflicts
- ✅ UI shows clear distinction between hard and soft conflicts
- ✅ Whole-job vs single-day conflict logic works correctly in all combinations
- ✅ Users can override soft conflicts but get clear warnings
- ✅ Hard conflicts can still be forced but with strong warning
- ✅ All tests pass
- ✅ No false positives in conflict detection

---

## Estimated Timeline

- **RPC Function:** 2 hours
- **Frontend Updates:** 2 hours
- **Edge Function Updates:** 1 hour
- **Testing:** 2 hours
- **Deployment:** 1 hour

**Total:** ~8 hours (1 day)

---

**Created:** November 6, 2025
**Status:** Ready for Implementation
**Assigned To:** TBD
