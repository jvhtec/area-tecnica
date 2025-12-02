# Flex Sync Audit Summary

**Date:** 2024-12-01  
**Scope:** `sync-flex-crew-for-job` Edge Function race condition analysis  
**Status:** ✅ Analysis Complete - Remediation Needed

---

## 🔴 Critical Issues Found

### 1. **Duplicate DB Rows from Concurrent Syncs**

**Problem:** Multiple sync requests can create duplicate `flex_crew_assignments` rows.

**Root Cause:**
- No unique constraint on `(crew_call_id, technician_id)`
- Uses blind `.insert()` instead of `.upsert()` (line 226)

**Example:**
```
User clicks "Sync Flex" in both JobAssignments + JobAssignmentDialog
→ Both read DB at same time, see no entry for Tech A
→ Both insert Tech A
→ Result: 2 duplicate rows
```

**Fix:** Add unique constraint + change to upsert

---

### 2. **Missing Crew Members After Stale Deletion**

**Problem:** Technicians deleted as "stale" aren't re-added in same sync run.

**Root Cause:**
- DB state read once at start (line 148)
- Stale rows deleted (line 174)
- `toAdd` computed from original snapshot (line 178)
- Never re-reads after deletion

**Example:**
```
Tech A has stale Flex line item (contact deleted in Flex)
→ Sync deletes DB row for Tech A
→ But toAdd already computed, Tech A not in list
→ Result: Tech A missing from crew call until next sync
```

**Fix:** Re-read DB state after deleting stale rows

---

### 3. **Orphan Pruning Timing Issue**

**Problem:** Orphan contact pruning happens after add/remove, can delete just-added contacts.

**Root Cause:**
- Order: delete stale → add missing → remove unwanted → prune orphans (lines 170-401)
- If Tech B just deleted as stale but not re-added yet, orphan pruning may delete them from Flex

**Fix:** Move orphan pruning before DB diffing (optional, lower priority)

---

## 📍 Affected Code Sections

| Line Range | Section | Issue |
|------------|---------|-------|
| 148-151 | Initial DB read | Only snapshot, never re-read |
| 170-175 | Stale deletion | Deletes rows but doesn't update `toAdd` |
| 177-178 | Diff computation | Uses stale snapshot |
| 226 | Insert statement | Blind insert, no upsert |
| 246-401 | Orphan pruning | Timing issue with add/remove |

---

## 🎯 Recommended Fix Priority

### ✅ **Priority 1: Database Unique Constraint** (Critical)

**Migration:**
```sql
-- Remove existing duplicates
DELETE FROM flex_crew_assignments a
USING flex_crew_assignments b
WHERE a.id < b.id
  AND a.crew_call_id = b.crew_call_id
  AND a.technician_id = b.technician_id;

-- Add constraint
ALTER TABLE flex_crew_assignments
ADD CONSTRAINT flex_crew_assignments_crew_call_technician_key
UNIQUE (crew_call_id, technician_id);
```

**Impact:**
- Blocks duplicate inserts at DB level
- Must be paired with code change to upsert

**Effort:** 1 day (includes duplicate cleanup)

---

### ✅ **Priority 2: Replace Insert with Upsert** (Critical)

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
    ignoreDuplicates: false
  }
);
```

**Impact:**
- Makes sync idempotent and concurrent-safe
- Updates `flex_line_item_id` if changed

**Effort:** 1 day (includes testing)

---

### ✅ **Priority 3: Recompute After Deletion** (High)

**Code Change:** `supabase/functions/sync-flex-crew-for-job/index.ts:170-178`

**Add re-read after stale deletion:**
```typescript
// Delete stale rows
if (staleRows.length) {
  await supabase.from("flex_crew_assignments").delete().in("id", staleRows.map(...));
}

// RE-READ current state after deletions
const { data: reloadedRows } = await supabase
  .from("flex_crew_assignments")
  .select("id, technician_id, flex_line_item_id")
  .eq("crew_call_id", crew_call_id);

// Compute diff from fresh state
const currentIds = new Set((reloadedRows ?? []).map((r: any) => r.technician_id));
const toAdd = desired.filter((d) => !currentIds.has(d.technician_id));
```

**Impact:**
- Fixes read-after-write gap
- Technicians with stale rows immediately re-added

**Effort:** 2 days (includes testing)

---

### 🔶 **Priority 4: Reorder Orphan Pruning** (Optional)

**Refactor:** Move orphan pruning before DB diffing

**Impact:**
- Cleaner separation of concerns
- Reduces delete-before-add timing issues

**Effort:** 5-7 days (complex refactor)

**Recommendation:** Defer until P1-P3 implemented and tested

---

### ⏸️ **Priority 5: Concurrency Control** (Unnecessary)

**Approach:** Advisory locks or queue-based sync

**Decision:** **Skip** - Upsert + unique constraint already make concurrent syncs safe

---

## 🔍 Dependencies & Side Effects

### UI Entry Points (Concurrent Triggers)
- `JobAssignments.tsx:92` - "Sync Flex" button per department
- `JobAssignmentDialog.tsx:383` - "Sync Flex" button in dialog
- **Risk:** User can trigger both simultaneously

### Database Tables
- `flex_crew_assignments` - Tracks crew assignments (has duplicates)
- `flex_crew_calls` - Maps job/dept to Flex crew call elements
- `job_assignments` - Source of truth for desired state

### Flex API Endpoints
- `POST /line-item/{id}/add-resource/{resourceId}` - Adds contact
- `GET /line-item/{id}/row-data/` - Lists contacts (multiple fallback attempts)
- `POST /line-item/{id}/row-data/` - Sets business role (sound only)
- `DELETE /line-item/{id}` - Removes contact
- **Rate Limits:** Unknown, may throttle concurrent requests

### Downstream Impact
- **Reporting:** Duplicate rows may inflate crew counts
- **UI:** Assignment lists may show duplicates
- **Flex:** Concurrent adds may create duplicate line items in Flex

---

## 📊 Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Duplicate assignments | X% (TBD) | **0%** |
| Missing crew members | Y/week (TBD) | **0** |
| Sync failure rate | Z% (TBD) | **< 1%** |
| Mean sync duration | Unknown | **< 5s** |

---

## 🚀 Implementation Timeline

| Phase | Tasks | Effort | Priority |
|-------|-------|--------|----------|
| **Phase 1** | Audit duplicates + Add unique constraint | 1 day | ✅ Critical |
| **Phase 2** | Replace insert with upsert | 1 day | ✅ Critical |
| **Phase 3** | Re-read after deletion | 2 days | ✅ High |
| **Phase 4** | Reorder orphan pruning | 5-7 days | 🔶 Optional |
| **Phase 5** | Monitoring & docs | Ongoing | ℹ️ Maintenance |

**Total (Critical Fixes):** 4 days  
**Total (All Phases):** 10-15 days

---

## ✅ Acceptance Criteria Met

- [x] **Written analysis pinpoints exact sections** → See "Affected Code Sections" above
- [x] **Recommended fix list covers DB constraints, algorithm ordering, and concurrency control** → See "Recommended Fix Priority" above
- [x] **Downstream impacts documented** → See "Dependencies & Side Effects" above

---

## 📚 Related Documents

- **Full ADR:** [docs/ADR-flex-sync-double-upsert-race-condition.md](./docs/ADR-flex-sync-double-upsert-race-condition.md)
- **Flex Backend Catalog:** [docs/catalog-flex-backends-delta.md](./docs/catalog-flex-backends-delta.md)
- **Edge Function Code:** [supabase/functions/sync-flex-crew-for-job/index.ts](./supabase/functions/sync-flex-crew-for-job/index.ts)

---

## 🎯 Next Steps

1. **Review this summary** with team to confirm priority
2. **Audit existing duplicates** (run query in Phase 1)
3. **Create migration** for unique constraint + cleanup
4. **Update Edge Function** with upsert + re-read logic
5. **Test on staging** with concurrent sync scenarios
6. **Deploy to production** with monitoring

**Owner:** TBD  
**Timeline:** 1-2 weeks for critical fixes  
**Risk:** Low (isolated changes, unique constraint prevents corruption)
