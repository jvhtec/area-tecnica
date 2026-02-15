# Flex Sync Fix Implementation Checklist

**Related Documents:**
- 📋 [Audit Summary](./FLEX_SYNC_AUDIT_SUMMARY.md)
- 📖 [Full ADR](./docs/ADR-flex-sync-double-upsert-race-condition.md)
- 🔄 [Control Flow Diagram](./docs/flex-sync-control-flow-diagram.md)

---

## Phase 1: Database Constraint (Critical - 1 day)

### 1.1 Audit Existing Duplicates

- [ ] Run duplicate detection query:
  ```sql
  SELECT crew_call_id, technician_id, COUNT(*) as duplicate_count
  FROM flex_crew_assignments
  GROUP BY crew_call_id, technician_id
  HAVING COUNT(*) > 1
  ORDER BY duplicate_count DESC;
  ```

- [ ] Export results to CSV for audit trail:
  ```sql
  COPY (
    SELECT fca.*, fcc.job_id, fcc.department, p.first_name, p.last_name
    FROM flex_crew_assignments fca
    JOIN flex_crew_calls fcc ON fca.crew_call_id = fcc.id
    JOIN profiles p ON fca.technician_id = p.id
    WHERE (fca.crew_call_id, fca.technician_id) IN (
      SELECT crew_call_id, technician_id
      FROM flex_crew_assignments
      GROUP BY crew_call_id, technician_id
      HAVING COUNT(*) > 1
    )
    ORDER BY fca.crew_call_id, fca.technician_id, fca.created_at
  ) TO '/tmp/flex_crew_duplicates.csv' WITH CSV HEADER;
  ```

- [ ] Document findings:
  - Total duplicate pairs: ___
  - Most affected job: ___
  - Date range: ___

### 1.2 Create Cleanup Migration

- [ ] Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_remove_flex_crew_assignment_duplicates.sql`

- [ ] Add cleanup logic (keeps oldest row by `created_at`):
  ```sql
  -- Remove duplicate rows (keep oldest)
  DELETE FROM flex_crew_assignments
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY crew_call_id, technician_id
               ORDER BY created_at ASC, id ASC
             ) as rn
      FROM flex_crew_assignments
    ) t
    WHERE rn > 1
  );
  ```

- [ ] Add unique constraint:
  ```sql
  -- Add unique constraint to prevent future duplicates
  ALTER TABLE flex_crew_assignments
  ADD CONSTRAINT flex_crew_assignments_crew_call_technician_key
  UNIQUE (crew_call_id, technician_id);
  ```

- [ ] Add verification query in migration comments:
  ```sql
  -- Verify no duplicates remain:
  -- SELECT crew_call_id, technician_id, COUNT(*)
  -- FROM flex_crew_assignments
  -- GROUP BY crew_call_id, technician_id
  -- HAVING COUNT(*) > 1;
  -- Expected: 0 rows
  ```

### 1.3 Test Migration

- [ ] Test on local dev database
- [ ] Test on staging database
- [ ] Verify constraint blocks duplicate inserts:
  ```sql
  -- Should fail with constraint violation:
  INSERT INTO flex_crew_assignments (crew_call_id, technician_id)
  VALUES (
    (SELECT id FROM flex_crew_calls LIMIT 1),
    (SELECT id FROM profiles LIMIT 1)
  );
  -- Insert same row again (should fail)
  ```

### 1.4 Deploy Migration

- [ ] Apply migration to production
- [ ] Monitor error logs for constraint violations
- [ ] Run verification query to confirm no duplicates

---

## Phase 2: Code Fix - Upsert (Critical - 1 day)

### 2.1 Update Edge Function

- [ ] Open `supabase/functions/sync-flex-crew-for-job/index.ts`
- [ ] Locate line 226 (insert statement)
- [ ] Replace with upsert:
  ```typescript
  // OLD (line 226):
  // await supabase.from("flex_crew_assignments").insert({
  //   crew_call_id,
  //   technician_id: add.technician_id,
  //   flex_line_item_id: lineItemId
  // });

  // NEW:
  const { error: upsertError } = await supabase
    .from("flex_crew_assignments")
    .upsert(
      {
        crew_call_id,
        technician_id: add.technician_id,
        flex_line_item_id: lineItemId
      },
      {
        onConflict: "crew_call_id,technician_id",
        ignoreDuplicates: false
      }
    );

  if (upsertError) {
    failedAdds += 1;
    errors.push(`Upsert failed for tech ${add.technician_id}: ${upsertError.message}`);
    continue;
  }
  ```

- [ ] Update counter logic (line 227):
  ```typescript
  // OLD: added += 1;
  // NEW: Track as added (upsert may update existing row, but treat as add for summary)
  added += 1;
  ```

### 2.2 Test Locally

- [ ] Start local Supabase:
  ```bash
  supabase start
  ```

- [ ] Deploy function locally:
  ```bash
  supabase functions deploy sync-flex-crew-for-job --no-verify-jwt
  ```

- [ ] Test concurrent sync scenario:
  ```bash
  # Terminal 1
  curl -X POST http://localhost:54321/functions/v1/sync-flex-crew-for-job \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -d '{"job_id":"test-job-id","departments":["sound"]}' &

  # Terminal 2 (trigger immediately)
  curl -X POST http://localhost:54321/functions/v1/sync-flex-crew-for-job \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -d '{"job_id":"test-job-id","departments":["sound"]}' &
  ```

- [ ] Verify no duplicates created:
  ```sql
  SELECT crew_call_id, technician_id, COUNT(*)
  FROM flex_crew_assignments
  WHERE crew_call_id = 'test-crew-call-id'
  GROUP BY crew_call_id, technician_id
  HAVING COUNT(*) > 1;
  -- Expected: 0 rows
  ```

### 2.3 Deploy to Staging

- [ ] Deploy Edge Function:
  ```bash
  supabase functions deploy sync-flex-crew-for-job
  ```

- [ ] Test in staging UI:
  - [ ] Open JobAssignments component
  - [ ] Click "Sync Flex" button
  - [ ] Verify success toast
  - [ ] Check Flex crew call in Flex UI
  - [ ] Verify no duplicate DB rows

- [ ] Test concurrent trigger:
  - [ ] Open JobAssignmentDialog
  - [ ] Click "Sync Flex" in dialog
  - [ ] Immediately click "Sync Flex" in JobAssignments
  - [ ] Verify both complete successfully
  - [ ] Verify no duplicates

### 2.4 Deploy to Production

- [ ] Deploy Edge Function to production
- [ ] Monitor logs for first 1 hour
- [ ] Check for upsert errors or constraint violations
- [ ] Verify sync success rate in monitoring dashboard

---

## Phase 3: Recompute After Deletion (High - 2 days)

### 3.1 Add Re-Read Logic

- [ ] Open `supabase/functions/sync-flex-crew-for-job/index.ts`
- [ ] Locate lines 170-178 (stale deletion + diff computation)
- [ ] Refactor to add re-read:
  ```typescript
  // Lines 170-175: Delete stale rows (UNCHANGED)
  const staleRows = (currentRows ?? []).filter((r: any) =>
    r.flex_line_item_id && !presentLineItemIds.has(r.flex_line_item_id)
  );
  if (staleRows.length) {
    console.log(`Deleting ${staleRows.length} stale DB rows for ${dept}`);
    await supabase
      .from("flex_crew_assignments")
      .delete()
      .in("id", staleRows.map((s: any) => s.id));
  }

  // NEW: Re-read current state after deletions
  const { data: reloadedRows } = await supabase
    .from("flex_crew_assignments")
    .select("id, technician_id, flex_line_item_id")
    .eq("crew_call_id", crew_call_id);

  // Lines 177-178: Compute diff from FRESH state
  const currentIds = new Set((reloadedRows ?? []).map((r: any) => r.technician_id));
  const toAdd = desired.filter((d) => !currentIds.has(d.technician_id));
  const toRemove = (reloadedRows ?? []).filter((r: any) => !desiredIds.has(r.technician_id));
  ```

### 3.2 Test Stale Row Scenario

- [ ] Setup test case:
  1. Assign Tech A to Job X, Sound dept
  2. Run sync (verify Tech A in Flex and DB)
  3. Manually delete Tech A's contact in Flex UI
  4. DO NOT modify job_assignments in Supabase (Tech A still desired)

- [ ] Trigger sync
- [ ] Verify Tech A's DB row deleted (stale)
- [ ] Verify Tech A re-added to Flex in SAME sync run
- [ ] Verify new DB row created for Tech A

- [ ] Check logs for expected output:
  ```
  Deleting 1 stale DB rows for sound
  ... (re-read happens)
  Added: 1, Removed: 0, Kept: X
  ```

### 3.3 Deploy to Staging

- [ ] Deploy Edge Function
- [ ] Run full regression test:
  - [ ] Normal sync (no stale rows)
  - [ ] Sync with stale rows (manually delete Flex contact first)
  - [ ] Concurrent sync
  - [ ] Sync with business role updates (sound dept)

### 3.4 Deploy to Production

- [ ] Deploy Edge Function
- [ ] Monitor sync success rate (should increase)
- [ ] Check for reports of missing crew members (should decrease to 0)

---

## Phase 4: Reorder Orphan Pruning (Optional - 5-7 days)

### 4.1 Analyze Current Orphan Pruning

- [ ] Review lines 246-401 in `sync-flex-crew-for-job/index.ts`
- [ ] Document all Flex API endpoints called:
  - [ ] `/element/{id}/line-items`
  - [ ] `/line-item/{id}`
  - [ ] `/line-item/{id}/children`
  - [ ] `/line-item/{id}/row-data/`
  - [ ] `/line-item/{id}/row-data/findRowData`
- [ ] Measure time spent on orphan pruning (add timing logs)

### 4.2 Design Refactor

- [ ] Create separate function `pruneOrphanFlexContacts()`:
  ```typescript
  async function pruneOrphanFlexContacts(
    crew_call_id: string,
    flex_crew_call_id: string,
    desiredResourceIds: Set<string>,
    flexHeaders: Record<string, string>
  ): Promise<{ deleted: number; errors: string[] }> {
    // ... existing orphan pruning logic ...
  }
  ```

- [ ] Decide on ordering:
  - **Option A:** Call before loading current DB state (lines 148-151)
  - **Option B:** Call after loading desired state (line 143)
  - **Recommendation:** Option B (avoids extra DB read if crew call missing)

### 4.3 Implement Refactor

- [ ] Extract orphan pruning logic to separate function
- [ ] Move function call to chosen location
- [ ] Update summary to include orphan pruning stats
- [ ] Add error handling for orphan pruning failures (non-blocking)

### 4.4 Test Thoroughly

- [ ] Test scenarios:
  - [ ] Orphan contact with no matching resource_id
  - [ ] Orphan contact that should be re-added later
  - [ ] Bulk delete vs individual delete fallback
  - [ ] Orphan pruning fails but sync continues

### 4.5 Feature Flag (Optional)

- [ ] Add environment variable to control orphan pruning:
  ```typescript
  const shouldPruneOrphans = Deno.env.get("FLEX_SYNC_PRUNE_ORPHANS") !== "false";
  if (shouldPruneOrphans) {
    const pruneResult = await pruneOrphanFlexContacts(...);
    summary[dept].orphans_pruned = pruneResult.deleted;
  }
  ```

### 4.6 Deploy

- [ ] Deploy to staging with feature flag ON
- [ ] Run tests for 1 week, monitor orphan deletion counts
- [ ] Deploy to production with feature flag ON
- [ ] Monitor for unintended contact deletions

---

## Phase 5: Monitoring & Documentation (Ongoing)

### 5.1 Add Metrics

- [ ] Create `flex_sync_log` table (optional):
  ```sql
  CREATE TABLE flex_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    department TEXT NOT NULL,
    added_count INT DEFAULT 0,
    removed_count INT DEFAULT 0,
    kept_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    duration_ms INT,
    triggered_by UUID REFERENCES profiles(id),
    summary JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```

- [ ] Add logging to Edge Function:
  ```typescript
  const startTime = Date.now();
  // ... sync logic ...
  const duration_ms = Date.now() - startTime;

  await supabase.from("flex_sync_log").insert({
    job_id,
    department: dept,
    added_count: added,
    removed_count: removed,
    kept_count: kept,
    failed_count: failedAdds,
    duration_ms,
    summary: summary[dept]
  });
  ```

### 5.2 Create Dashboard

- [ ] Add sync metrics to admin dashboard:
  - Total syncs per day
  - Average sync duration
  - Sync failure rate
  - Most synced jobs/departments

- [ ] Add alerts:
  - Sync failure rate > 5%
  - Sync duration > 10 seconds
  - Duplicate constraint violations

### 5.3 Update Documentation

- [ ] Update `docs/catalog-flex-backends-delta.md`:
  - Document new upsert behavior
  - Update "Synchronization Logic" section
  - Add note about unique constraint

- [ ] Update runbook:
  - How to manually fix duplicate assignments
  - How to handle Flex API outages during sync
  - How to recover from constraint violations

- [ ] Add troubleshooting guide:
  - "Sync failed" error messages
  - "Missing crew member" investigation steps
  - "Duplicate assignment" cleanup script

### 5.4 Create Monitoring Runbook

```markdown
## Flex Sync Monitoring Runbook

### Key Metrics
- **Sync Success Rate:** Target > 99%
- **Mean Sync Duration:** Target < 5 seconds
- **Duplicate Assignments:** Target = 0

### Alerts
1. **High Failure Rate Alert**
   - Threshold: > 5% failure rate in 1 hour
   - Action: Check Flex API status, review Edge Function logs

2. **Long Sync Duration Alert**
   - Threshold: Sync takes > 10 seconds
   - Action: Check Flex API latency, review orphan pruning performance

3. **Constraint Violation Alert**
   - Threshold: Any unique constraint error
   - Action: Review Edge Function logs, verify upsert logic

### Common Issues

**Issue:** "Sync failed" toast in UI
- **Cause:** Flex API timeout, invalid auth token, crew call not mapped
- **Fix:** Check Edge Function logs, verify `flex_crew_calls` mapping

**Issue:** Missing crew member after sync
- **Cause:** Technician missing `flex_resource_id`, Flex API add failed
- **Fix:** Check profile for `flex_resource_id`, test add-resource endpoint

**Issue:** Duplicate assignments in DB
- **Cause:** Migration not applied (should not happen after Phase 1)
- **Fix:** Run cleanup migration, verify unique constraint exists
```

---

## Verification Queries

### Check for Duplicates

```sql
SELECT crew_call_id, technician_id, COUNT(*) as count
FROM flex_crew_assignments
GROUP BY crew_call_id, technician_id
HAVING COUNT(*) > 1;
-- Expected after fix: 0 rows
```

### Check Unique Constraint Exists

```sql
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'flex_crew_assignments'::regclass
  AND conname = 'flex_crew_assignments_crew_call_technician_key';
-- Expected: 1 row with contype='u'
```

### Check Recent Syncs

```sql
SELECT 
  job_id,
  department,
  added_count,
  removed_count,
  failed_count,
  duration_ms,
  created_at
FROM flex_sync_log
ORDER BY created_at DESC
LIMIT 10;
-- Expected: Recent syncs with low/zero failure counts
```

### Check Stale Assignments

```sql
-- Assignments with line items not in Flex (simulate stale check)
SELECT fca.*, fcc.job_id, fcc.department
FROM flex_crew_assignments fca
JOIN flex_crew_calls fcc ON fca.crew_call_id = fcc.id
WHERE fca.flex_line_item_id IS NOT NULL
-- (Manual check in Flex UI required to verify line items exist)
ORDER BY fca.created_at DESC;
```

---

## Rollback Plan

### If Unique Constraint Causes Issues

```sql
-- Remove constraint (NOT RECOMMENDED)
ALTER TABLE flex_crew_assignments
DROP CONSTRAINT flex_crew_assignments_crew_call_technician_key;
```

### If Upsert Causes Issues

- Revert Edge Function to previous version:
  ```bash
  git revert <commit-hash>
  supabase functions deploy sync-flex-crew-for-job
  ```

### If Re-Read Causes Performance Issues

- Comment out re-read logic (lines added in Phase 3)
- Accept that stale row scenario requires manual re-sync
- Document as known limitation

---

## Success Criteria

### Phase 1-2 (Critical Fixes)
- [x] Unique constraint added to `flex_crew_assignments`
- [x] All existing duplicates removed
- [x] Edge Function uses upsert instead of insert
- [x] Concurrent syncs do not create duplicates
- [x] Zero constraint violation errors in production

### Phase 3 (High Priority)
- [x] Stale rows immediately re-added in same sync run
- [x] No reports of missing crew members after sync
- [x] Sync success rate > 99%

### Phase 4 (Optional)
- [x] Orphan pruning moved before DB diffing
- [x] Fewer delete-before-add cycles observed
- [x] No unintended contact deletions

### Phase 5 (Ongoing)
- [x] Sync metrics tracked in dashboard
- [x] Alerts configured for failures
- [x] Documentation updated
- [x] Runbook created for on-call engineers

---

## Sign-off

| Phase | Date Completed | Tested By | Deployed By | Notes |
|-------|----------------|-----------|-------------|-------|
| Phase 1 | _____________ | _________ | ___________ | _____ |
| Phase 2 | _____________ | _________ | ___________ | _____ |
| Phase 3 | _____________ | _________ | ___________ | _____ |
| Phase 4 | _____________ | _________ | ___________ | _____ |
| Phase 5 | _____________ | _________ | ___________ | _____ |

**Final Approval:** __________________ (Engineering Lead)  
**Date:** __________________
