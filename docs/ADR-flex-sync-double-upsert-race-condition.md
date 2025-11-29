# ADR: Flex Crew Sync Race Condition & Double-Upsert Analysis

**Status:** Proposed  
**Date:** 2024-12-01  
**Author:** System Audit  
**Related:** `sync-flex-crew-for-job` Edge Function, `flex_crew_assignments` table

## Context

The `sync-flex-crew-for-job` Edge Function is responsible for synchronizing technician assignments between Supabase (`job_assignments` table) and Flex Rental Solutions crew calls. It is invoked from multiple UI entry points:

1. **JobAssignments component** (`src/components/jobs/JobAssignments.tsx:92`) - "Sync Flex" button per department
2. **JobAssignmentDialog component** (`src/components/jobs/JobAssignmentDialog.tsx:383`) - "Sync Flex" button in assignment dialog

The function performs a diff-and-sync operation: it determines which technicians should be on the crew call (desired state), compares with current state (both in DB and Flex), then adds missing technicians, removes extras, and optionally sets business roles.

## Problem Statement

The current implementation has **two critical race conditions** that lead to:

1. **Duplicate database rows** when multiple sync requests run concurrently
2. **Missing crew members** when technicians are deleted as "stale" but not re-added in the same run

### Root Causes

#### 1. Single Snapshot Read-After-Write Gap

**Location:** `supabase/functions/sync-flex-crew-for-job/index.ts:148-178`

**Control Flow:**

```typescript
// Line 148-151: Initial snapshot (ONLY read of DB state)
const { data: currentRows } = await supabase
  .from("flex_crew_assignments")
  .select("id, technician_id, flex_line_item_id")
  .eq("crew_call_id", crew_call_id);

// Line 154-168: Fetch Flex state to discover which line items are present
const presentLineItemIds: Set<string> = new Set();
// ... fetch from Flex row-data endpoint ...

// Line 170-175: Delete stale DB rows (rows whose line items no longer exist in Flex)
const freshCurrentRows = (currentRows ?? []).filter(/* presentLineItemIds check */);
const staleRows = (currentRows ?? []).filter(/* not present */);
if (staleRows.length) {
  await supabase.from("flex_crew_assignments").delete().in("id", staleRows.map(...));
}

// Line 177-178: Compute diff using the ORIGINAL snapshot
const currentIds = new Set(freshCurrentRows.map((r: any) => r.technician_id));
const toAdd = desired.filter((d) => !currentIds.has(d.technician_id));
```

**Problem:**

- `currentRows` is fetched **once** at line 148-151
- Stale rows are **deleted** at line 174, but `currentIds` and `toAdd` are computed from the **pre-deletion snapshot** (`freshCurrentRows` is filtered in-memory, not re-read from DB)
- If a technician had a stale line item (e.g., Flex contact was manually deleted), the DB row is deleted, but because `toAdd` was already computed, the technician is **not** re-added in this run
- **Result:** The technician is missing from both DB and Flex until a subsequent sync is manually triggered

**Scenario Example:**

1. Technician A is assigned to job X, department Sound
2. `flex_crew_assignments` has a row: `{crew_call_id: 1, technician_id: A, flex_line_item_id: "flex-123"}`
3. Someone manually deletes the contact in Flex (line item "flex-123" is gone)
4. Sync runs:
   - Reads `currentRows` → includes technician A with stale line item
   - Fetches Flex state → "flex-123" not present
   - Deletes DB row for technician A (stale)
   - Computes `toAdd` from `freshCurrentRows` (empty after filtering) → technician A NOT in `toAdd` because they were already in `currentRows`
   - Result: Technician A is missing from crew call

#### 2. Concurrent Sync Race Condition

**Location:** `supabase/functions/sync-flex-crew-for-job/index.ts:148-226`

**Control Flow:**

```typescript
// Line 148-151: Snapshot current DB state
const { data: currentRows } = await supabase.from("flex_crew_assignments").select(...);

// ... stale deletion logic ...

// Line 177-178: Compute diff
const currentIds = new Set(freshCurrentRows.map((r: any) => r.technician_id));
const toAdd = desired.filter((d) => !currentIds.has(d.technician_id));

// Line 189-234: Add missing technicians
for (const add of toAdd) {
  // ... POST to Flex API ...
  if (!lineItemId) { /* error handling */ continue; }
  
  // Line 226: BLIND INSERT (no upsert, no conflict handling)
  await supabase.from("flex_crew_assignments").insert({
    crew_call_id,
    technician_id: add.technician_id,
    flex_line_item_id: lineItemId
  });
  added += 1;
}
```

**Problem:**

- No database **unique constraint** on `(crew_call_id, technician_id)` in `flex_crew_assignments`
- Uses blind `.insert()` instead of `.upsert()` at line 226
- If two sync requests run concurrently (e.g., user clicks "Sync Flex" in both JobAssignments and JobAssignmentDialog):
  1. **Request A** reads `currentRows` at time T0 → no entry for technician B
  2. **Request B** reads `currentRows` at time T1 (before A completes) → no entry for technician B
  3. **Request A** computes `toAdd` → includes technician B
  4. **Request B** computes `toAdd` → includes technician B
  5. **Request A** inserts row for technician B
  6. **Request B** inserts row for technician B again
  7. **Result:** Two duplicate rows in `flex_crew_assignments` for the same `(crew_call_id, technician_id)` pair

**Impact:**

- Duplicate entries in `flex_crew_assignments` table
- Inconsistent state tracking (same assignment counted multiple times)
- Potential duplicate Flex API calls (both requests may call `add-resource` for the same technician)
- Manual cleanup required to fix database inconsistencies

#### 3. Orphan Pruning Timing Issue

**Location:** `supabase/functions/sync-flex-crew-for-job/index.ts:246-401`

**Control Flow:**

```typescript
// Line 189-244: Add/remove operations complete

// Line 246-401: Discover and prune orphaned Flex contacts
try {
  // Fetch ALL contacts from Flex (multiple fallback attempts)
  const items = /* ... fetch from /line-items, /children, /row-data ... */;
  
  // Find contacts not in desired set
  let extraIds: string[] = [];
  for (const [resId, liId] of flexByResource.entries()) {
    if (!desiredResourceIds.has(resId)) extraIds.push(liId);
  }
  
  // Delete extras from Flex
  if (extraIds.length) {
    // ... bulk or individual DELETE calls ...
  }
} catch (_) { /* ignore */ }
```

**Problem:**

- Orphan pruning runs **after** the add/remove phase
- If a technician's stale row was deleted but they weren't re-added (due to issue #1), they won't be in Flex yet when orphan pruning runs
- Orphan pruning may delete legitimate contacts that were just removed from Flex due to stale line items
- **Order dependency:** Ideally, stale Flex contact pruning should happen **before** DB diffing to avoid delete-then-add cycles

---

## Affected Components

### Database Tables

#### `flex_crew_assignments`

**Current Schema (inferred):**

```sql
CREATE TABLE flex_crew_assignments (
  id UUID PRIMARY KEY,
  crew_call_id UUID NOT NULL REFERENCES flex_crew_calls(id),
  technician_id UUID NOT NULL REFERENCES profiles(id),
  flex_line_item_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Missing Constraint:**

- **No unique constraint** on `(crew_call_id, technician_id)` → allows duplicate assignments

**Accessed by:**

- `sync-flex-crew-for-job` (read/write/delete)
- `manage-flex-crew-assignments` (read/write/delete)
- Reporting queries (count assignments, crew lists)

#### `flex_crew_calls`

**Schema (inferred):**

```sql
CREATE TABLE flex_crew_calls (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(id),
  department TEXT NOT NULL,
  flex_element_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Accessed by:**

- `sync-flex-crew-for-job` (read - resolve crew call element IDs)
- `manage-flex-crew-assignments` (read)
- `persist-flex-elements` (write - upserts crew call mappings)

#### `job_assignments`

**Schema (partial):**

```sql
CREATE TABLE job_assignments (
  job_id UUID NOT NULL,
  technician_id UUID NOT NULL,
  sound_role TEXT,
  lights_role TEXT,
  video_role TEXT,
  single_day BOOLEAN DEFAULT false,
  assignment_date DATE,
  confirmed BOOLEAN DEFAULT false,
  -- ... other columns ...
  PRIMARY KEY (job_id, technician_id, assignment_date)
);
```

**Accessed by:**

- `sync-flex-crew-for-job` (read - source of truth for desired state)
- UI components (write - add/remove assignments)

### UI Components

#### `JobAssignments.tsx`

**Sync Trigger:** Lines 84-121

```typescript
const handleSyncFlex = async () => {
  if (!department) { toast.message('Select a department first to sync'); return; }
  try {
    setIsSyncing(true);
    toast.info('Syncing crew to Flex…');
    const { data, error } = await supabase.functions.invoke('sync-flex-crew-for-job', {
      body: { job_id: jobId, departments: [department] }
    });
    // ... handle response ...
  } finally { setIsSyncing(false); }
};
```

**Race Condition:** Button can be clicked while a sync from `JobAssignmentDialog` is in progress.

#### `JobAssignmentDialog.tsx`

**Sync Trigger:** Lines 374-411

```typescript
const handleSyncFlex = async () => {
  const dept = (currentDepartment || '').toLowerCase();
  if (!['sound', 'lights', 'video'].includes(dept)) { /* ... */ return; }
  try {
    setIsSyncing(true);
    toast({ title: 'Syncing', description: 'Syncing crew to Flex…' });
    const { data, error } = await supabase.functions.invoke('sync-flex-crew-for-job', {
      body: { job_id: jobId, departments: [dept] }
    });
    // ... handle response ...
  } finally { setIsSyncing(false); }
};
```

**Race Condition:** Dialog can be open while JobAssignments component triggers sync, or user can rapidly click "Sync Flex" multiple times.

### External Dependencies

#### Flex API Endpoints

**Used by sync function:**

- `POST /line-item/{crewCallElementId}/add-resource/{resourceId}` - Adds contact to crew call
- `GET /line-item/{crewCallElementId}/row-data/?codeList=contact&node=root` - Lists current contacts
- `GET /element/{crewCallElementId}/line-items` - Alternative contact listing
- `GET /line-item/{crewCallElementId}/children` - Fallback contact listing
- `POST /line-item/{crewCallElementId}/row-data/` - Sets business-role field (sound only)
- `DELETE /line-item/{lineItemId}` - Removes contact
- `DELETE /line-item?lineItemIds={ids}` - Bulk removal

**Rate Limits:** Unknown, but excessive concurrent syncs may trigger Flex API throttling.

**Side Effects:**

- Each `add-resource` call creates a Flex line item and may trigger Flex-side notifications or workflows
- Business role updates (sound dept) modify Flex data model
- Bulk deletes may fail silently if Flex doesn't support the param name variant used

---

## Proposed Remediation

### Priority 1: Add Database Unique Constraint (Critical)

**Goal:** Prevent duplicate `flex_crew_assignments` rows at the database level.

**Migration:**

```sql
-- Remove existing duplicates before adding constraint
DELETE FROM flex_crew_assignments a
USING flex_crew_assignments b
WHERE a.id < b.id
  AND a.crew_call_id = b.crew_call_id
  AND a.technician_id = b.technician_id;

-- Add unique constraint
ALTER TABLE flex_crew_assignments
ADD CONSTRAINT flex_crew_assignments_crew_call_technician_key
UNIQUE (crew_call_id, technician_id);
```

**Impact:**

- Blocks duplicate inserts at DB level
- Insert statements will fail with unique constraint violation if duplicate attempted
- **Must** be paired with code change to use `.upsert()` instead of `.insert()`

**Dependencies:**

- Must audit and clean existing duplicates first
- May expose bugs if code relies on multiple rows per technician

### Priority 2: Replace Insert with Upsert (Critical)

**Goal:** Make sync operations idempotent and concurrent-safe.

**Code Change:** `supabase/functions/sync-flex-crew-for-job/index.ts:226`

**Before:**

```typescript
await supabase.from("flex_crew_assignments").insert({
  crew_call_id,
  technician_id: add.technician_id,
  flex_line_item_id: lineItemId
});
```

**After:**

```typescript
await supabase.from("flex_crew_assignments").upsert(
  {
    crew_call_id,
    technician_id: add.technician_id,
    flex_line_item_id: lineItemId
  },
  {
    onConflict: "crew_call_id,technician_id",
    ignoreDuplicates: false // Update flex_line_item_id if changed
  }
);
```

**Benefits:**

- Concurrent syncs will safely merge without duplicates
- Updates `flex_line_item_id` if Flex line item changes
- Idempotent: running sync multiple times has same result

**Risk:**

- If `flex_line_item_id` changes between syncs, last write wins (acceptable for this use case)

### Priority 3: Recompute Current State After Stale Deletion (High)

**Goal:** Fix read-after-write gap so deleted technicians are immediately re-added.

**Code Change:** `supabase/functions/sync-flex-crew-for-job/index.ts:170-178`

**Before:**

```typescript
const freshCurrentRows = (currentRows ?? []).filter((r: any) =>
  !r.flex_line_item_id || presentLineItemIds.has(r.flex_line_item_id)
);
const staleRows = (currentRows ?? []).filter((r: any) =>
  r.flex_line_item_id && !presentLineItemIds.has(r.flex_line_item_id)
);
if (staleRows.length) {
  await supabase.from("flex_crew_assignments").delete().in("id", staleRows.map((s: any) => s.id));
}

const currentIds = new Set(freshCurrentRows.map((r: any) => r.technician_id));
const toAdd = desired.filter((d) => !currentIds.has(d.technician_id));
```

**After:**

```typescript
// 1. Delete stale rows
const staleRows = (currentRows ?? []).filter((r: any) =>
  r.flex_line_item_id && !presentLineItemIds.has(r.flex_line_item_id)
);
if (staleRows.length) {
  await supabase.from("flex_crew_assignments").delete().in("id", staleRows.map((s: any) => s.id));
}

// 2. RE-READ current state after deletions
const { data: reloadedRows } = await supabase
  .from("flex_crew_assignments")
  .select("id, technician_id, flex_line_item_id")
  .eq("crew_call_id", crew_call_id);

// 3. Compute diff from fresh state
const currentIds = new Set((reloadedRows ?? []).map((r: any) => r.technician_id));
const toAdd = desired.filter((d) => !currentIds.has(d.technician_id));
```

**Benefits:**

- Technicians deleted as stale will be immediately re-added in the same run
- Eliminates need for follow-up manual sync

**Cost:**

- One additional DB query (minimal overhead)

### Priority 4: Reorder Orphan Pruning Before Diffing (Medium)

**Goal:** Avoid delete-before-add timing issues by pruning orphaned Flex contacts before computing DB diff.

**Refactor Strategy:**

1. **Phase 1: Prune Orphaned Flex Contacts**
   - Fetch current Flex state (all contacts in crew call)
   - Compare with `desiredResourceIds`
   - Delete extras from Flex
   - Delete corresponding DB rows (by `flex_line_item_id`)

2. **Phase 2: Sync DB to Desired State**
   - Fetch current DB state
   - Identify stale DB rows (line items no longer in Flex)
   - Delete stale DB rows
   - Re-read DB state
   - Add missing technicians
   - Remove unwanted DB rows (if any remain)

**Benefits:**

- Cleaner separation of concerns
- Reduces risk of deleting just-added contacts
- More predictable state transitions

**Risk:**

- More complex control flow
- May require additional Flex API calls if orphan pruning happens multiple times

### Priority 5: Add Concurrency Control (Optional)

**Goal:** Serialize sync operations per job to prevent concurrent mutations.

#### Option A: Advisory Locks

**Implementation:**

```typescript
// Line 98 (after department loop starts)
const lockKey = `sync-flex-crew-${job_id}-${dept}`;
const { data: lockAcquired } = await supabase.rpc('pg_try_advisory_lock', { key: lockKey });

if (!lockAcquired) {
  summary[dept] = { note: "sync already in progress, skipped" };
  continue;
}

try {
  // ... existing sync logic ...
} finally {
  await supabase.rpc('pg_advisory_unlock', { key: lockKey });
}
```

**Pros:**

- Prevents concurrent syncs for same job/dept
- No external dependencies

**Cons:**

- Requires PostgreSQL advisory lock functions (may not be exposed via Supabase RLS)
- Lock leaks if Edge Function crashes

#### Option B: Queue-Based Sync

**Implementation:**

- Replace direct Edge Function calls with task queue entries (e.g., Supabase Realtime broadcast, external queue like BullMQ)
- Worker processes queue serially per job
- UI shows "sync queued" status

**Pros:**

- Guaranteed serialization
- Can retry on failure
- Better observability

**Cons:**

- Adds infrastructure complexity
- Higher latency (async processing)

#### Recommendation:

- **Skip concurrency control** if Priority 1-3 are implemented (upsert + unique constraint make concurrent syncs safe)
- Only add if observing Flex API rate limit issues or deadlocks

---

## Downstream Impacts

### Reporting & Analytics

**Systems that read `flex_crew_assignments`:**

- Crew lists in UI (JobAssignments component)
- Assignment counts (may currently include duplicates)
- Audit logs or reports that aggregate technician hours

**Impact of Duplicate Removal:**

- Counts may decrease if duplicates were inflating metrics
- Historical data may need cleanup migration

**Mitigation:**

- Audit reports to identify affected queries
- Add `DISTINCT` clauses if aggregating by technician_id
- Document that duplicates were a bug, not valid data

### UI Expectations

**JobAssignments Component:**

- Expects sync to be near-instant (shows toast on completion)
- May need loading state if sync takes longer after reordering refactor

**JobAssignmentDialog Component:**

- Same expectations as JobAssignments
- May trigger sync immediately after adding assignment

**Mitigation:**

- Keep sync fast by minimizing API calls
- Add optimistic UI updates if needed (show assignment as "syncing" state)
- Consider debouncing sync triggers (e.g., 2-second cooldown)

### Database Triggers

**Potential Triggers on `flex_crew_assignments`:**

- Unknown (no triggers found in provided schema, but audit code for any)

**If triggers exist:**

- Unique constraint may cause trigger conflicts
- Upsert may fire triggers differently than insert

**Mitigation:**

- Search codebase for `CREATE TRIGGER` on `flex_crew_assignments`
- Test trigger behavior with upsert operations

### Flex API Side Effects

**Add-Resource Endpoint:**

- May trigger Flex notifications or workflows
- Concurrent calls for same resource may fail or create duplicates in Flex

**Business Role Updates:**

- Only applied to sound dept
- May overwrite manual changes in Flex

**Orphan Pruning:**

- Bulk deletes may fail silently (multiple param name attempts)
- Deleting contacts may trigger Flex-side cascades (e.g., removing from other line items)

**Mitigation:**

- Log all Flex API responses for debugging
- Add retry logic for transient Flex API failures
- Consider opt-in "preserve manual Flex changes" mode

---

## Implementation Plan

### Phase 1: Database Constraint (Week 1)

**Tasks:**

1. **Audit Existing Data:**
   ```sql
   SELECT crew_call_id, technician_id, COUNT(*)
   FROM flex_crew_assignments
   GROUP BY crew_call_id, technician_id
   HAVING COUNT(*) > 1;
   ```
   - Document duplicate counts
   - Investigate whether duplicates correlate with concurrent sync logs

2. **Cleanup Migration:**
   - Write migration to remove duplicates (keep oldest row by `created_at`)
   - Test on staging environment

3. **Add Unique Constraint:**
   - Apply migration to production
   - Monitor for constraint violation errors

**Success Criteria:**

- Zero duplicates in `flex_crew_assignments`
- Unique constraint enforced
- No application errors from constraint

### Phase 2: Code Fix - Upsert (Week 1)

**Tasks:**

1. **Update Edge Function:**
   - Replace `.insert()` with `.upsert()` at line 226
   - Add `onConflict` parameter
   - Test locally with concurrent requests

2. **Deploy Edge Function:**
   - Deploy to staging
   - Trigger concurrent syncs from UI
   - Verify no duplicates created

3. **Production Deploy:**
   - Deploy to production
   - Monitor logs for errors

**Success Criteria:**

- Concurrent syncs do not create duplicates
- Upsert updates `flex_line_item_id` when changed

### Phase 3: Recompute After Deletion (Week 2)

**Tasks:**

1. **Add Re-Read Logic:**
   - Add DB query after stale deletion
   - Update `currentIds` and `toAdd` computation

2. **Test Stale Row Scenario:**
   - Manually delete Flex contact
   - Trigger sync
   - Verify technician is re-added in same run

3. **Deploy:**
   - Staging → Production
   - Monitor sync success rates

**Success Criteria:**

- No missing crew members after sync
- Sync success rate increases

### Phase 4: Optional - Reorder Orphan Pruning (Week 3-4)

**Tasks:**

1. **Refactor Control Flow:**
   - Move orphan pruning to separate function
   - Call before DB diffing
   - Update tests

2. **Test Edge Cases:**
   - Orphan contacts with no matching resource_id
   - Orphan contacts that should be re-added

3. **Deploy:**
   - Gradual rollout with feature flag
   - Monitor Flex API call counts

**Success Criteria:**

- Fewer delete-then-add cycles
- No unintended contact deletions

### Phase 5: Monitoring & Documentation (Ongoing)

**Tasks:**

1. **Add Metrics:**
   - Track sync duration per department
   - Count adds/removes/failures
   - Alert on high failure rates

2. **Update Documentation:**
   - Document new sync algorithm
   - Add troubleshooting guide
   - Update API docs for `sync-flex-crew-for-job`

3. **Runbook:**
   - How to manually fix stuck syncs
   - How to recover from Flex API outages

**Success Criteria:**

- < 1% sync failure rate
- Mean sync duration < 5 seconds
- Zero duplicate assignments

---

## Alternatives Considered

### Alternative 1: Lock-Based Serialization

**Approach:** Use advisory locks to prevent concurrent syncs per job.

**Pros:**

- Simple to implement
- No DB schema changes needed

**Cons:**

- Doesn't fix read-after-write gap
- Lock leaks on Edge Function crash
- May block legitimate syncs

**Decision:** Rejected in favor of upsert + unique constraint (safer and simpler).

### Alternative 2: Optimistic Locking

**Approach:** Add `version` column to `flex_crew_assignments`, increment on update, fail if version mismatch.

**Pros:**

- Prevents lost updates
- No blocking locks

**Cons:**

- Requires retry logic in Edge Function
- Doesn't prevent duplicates
- More complex code

**Decision:** Rejected; unique constraint is sufficient for this use case.

### Alternative 3: Client-Side Debouncing

**Approach:** Prevent UI from triggering sync more than once per N seconds.

**Pros:**

- Simple UI change
- Reduces Flex API load

**Cons:**

- Doesn't fix race condition (two tabs can still trigger simultaneously)
- Poor UX if user needs to sync urgently

**Decision:** Implement as complementary measure, not primary fix.

---

## Open Questions

1. **Do any database triggers exist on `flex_crew_assignments`?**
   - Search for triggers in schema
   - Test trigger behavior with upsert

2. **What is Flex API rate limit?**
   - Contact Flex support or monitor rate limit headers
   - Add rate limit handling if needed

3. **Should orphan pruning be opt-in or always-on?**
   - Current behavior: always prunes orphans
   - Risk: May delete manually-added Flex contacts
   - Proposal: Add `prune_orphans: boolean` parameter (default true)

4. **How to handle partial sync failures?**
   - Current behavior: Continue on per-technician errors
   - Risk: Inconsistent state if half of adds succeed
   - Proposal: Add transaction rollback or mark crew call as "sync failed" with retry queue

5. **Should we log all sync operations for audit?**
   - Current behavior: No detailed logs
   - Proposal: Insert sync events into `flex_sync_log` table with:
     - `job_id`, `department`, `added_count`, `removed_count`, `failed_count`, `duration_ms`, `triggered_by`

---

## Success Metrics

**Before Fix:**

- Duplicate assignments: ~X% of crew calls (TBD: run audit query)
- Missing crew members: ~Y occurrences per week (based on support tickets)
- Sync failure rate: ~Z% (TBD: add metrics)

**After Fix (Target):**

- Duplicate assignments: **0%**
- Missing crew members: **0 occurrences**
- Sync failure rate: **< 1%**
- Mean sync duration: **< 5 seconds**
- Concurrent sync collisions: **0 (handled gracefully by upsert)**

---

## Conclusion

The `sync-flex-crew-for-job` Edge Function has critical race conditions caused by:

1. **Single snapshot with no re-read after deletion** → Missing crew members
2. **Blind insert without unique constraint** → Duplicate DB rows
3. **Orphan pruning after adds** → Delete-before-add timing issues

**Recommended Fix Priority:**

1. ✅ **Add unique constraint** (prevents duplicates at DB level)
2. ✅ **Replace insert with upsert** (makes sync idempotent)
3. ✅ **Re-read after stale deletion** (fixes read-after-write gap)
4. 🔶 **Reorder orphan pruning** (improves consistency, optional)
5. ⏸️ **Add concurrency control** (unnecessary if 1-3 implemented)

**Estimated Effort:**

- Phase 1-2 (Critical Fixes): **3-5 days** (includes testing)
- Phase 3 (Re-read Logic): **2-3 days**
- Phase 4 (Reorder): **5-7 days** (optional)
- Total: **10-15 days** for complete fix

**Risk Level:**

- **Low** - Changes are isolated to sync function and DB constraint
- **Mitigation** - Unique constraint prevents data corruption, upsert is well-tested Supabase feature
- **Rollback Plan** - Can remove unique constraint and revert to insert if issues arise (not recommended)

---

## References

- [sync-flex-crew-for-job Edge Function](../../supabase/functions/sync-flex-crew-for-job/index.ts)
- [JobAssignments Component](../../src/components/jobs/JobAssignments.tsx)
- [JobAssignmentDialog Component](../../src/components/jobs/JobAssignmentDialog.tsx)
- [Flex Backend Catalog](./catalog-flex-backends-delta.md#9-sync-flex-crew-for-job)
- [Supabase Upsert Documentation](https://supabase.com/docs/reference/javascript/upsert)
