# Flex Sync Race Condition - Executive Summary

**Date:** 2024-12-01  
**Priority:** 🔴 Critical  
**Estimated Fix Time:** 4 days (critical fixes only)  
**Risk Level:** ✅ Low (isolated changes, well-tested solution)

---

## Problem Overview

The Flex crew synchronization feature has **two critical bugs** that cause data inconsistencies:

1. **Duplicate assignments** when users trigger sync from multiple UI locations simultaneously
2. **Missing crew members** when Flex contacts are manually deleted and then re-synced

### Business Impact

- **Data Quality:** Duplicate database entries inflate crew counts and create confusion
- **User Experience:** Users must manually fix missing crew members by triggering multiple syncs
- **Operational Overhead:** Support team receives tickets about "disappeared" crew members
- **Flex Integration:** Inconsistent state between Supabase and Flex Rental Solutions

---

## Root Causes (Technical)

### Issue #1: No Duplicate Prevention

**What happens:**
```
User clicks "Sync Flex" in crew assignment dialog
→ Sync reads DB: no entry for Tech A
→ User also clicks "Sync Flex" in crew list (same time)
→ Second sync reads DB: still no entry for Tech A
→ Both syncs insert Tech A
→ Result: 2 duplicate rows in database
```

**Why it happens:**
- Database lacks unique constraint to prevent duplicates
- Code uses blind `INSERT` instead of `INSERT ... ON CONFLICT` (upsert)
- No locking mechanism to serialize concurrent syncs

### Issue #2: Read-After-Write Gap

**What happens:**
```
Tech A assigned to Job X
→ Someone manually deletes Tech A's contact in Flex
→ Sync detects stale DB row, deletes it
→ Sync computes "who to add" from old snapshot (Tech A was already present)
→ Tech A not re-added because they weren't in "missing" list
→ Result: Tech A missing from crew call until next sync
```

**Why it happens:**
- Database state read once at start, never refreshed
- Deletion happens after diff computation, so deleted techs aren't in "add" list
- Orphan pruning runs after adds, can create delete-before-add timing issues

---

## Proposed Solution

### Phase 1-2: Critical Fixes (4 days)

**What we'll do:**

1. **Add Database Constraint** (1 day)
   - Clean up existing duplicates
   - Add unique constraint on `(crew_call_id, technician_id)`
   - Blocks duplicate inserts at database level

2. **Change INSERT to UPSERT** (1 day)
   - Modify Edge Function to use upsert instead of insert
   - Makes sync idempotent: running multiple times = same result
   - Concurrent syncs safely merge without duplicates

3. **Re-read After Deletion** (2 days)
   - Add database re-read after deleting stale rows
   - Ensures "add" list includes technicians whose rows were just deleted
   - Fixes missing crew member issue

**Benefits:**
- ✅ Zero duplicates (blocked at database level)
- ✅ Missing crew members fixed immediately (no manual re-sync)
- ✅ Concurrent syncs work correctly
- ✅ Idempotent: syncing multiple times doesn't break anything

**Risks:**
- ✅ Low - changes are isolated to sync function
- ✅ Unique constraint prevents data corruption
- ✅ Upsert is well-tested Supabase feature
- ✅ Can rollback if issues arise (not expected)

### Phase 3: Optional Optimization (5-7 days)

**What we'll do:**
- Reorder orphan contact pruning to happen before diff computation
- Cleaner separation of concerns, fewer edge cases

**Benefits:**
- More predictable state transitions
- Easier to debug

**Decision:** Defer until critical fixes deployed and tested

---

## Timeline & Resources

| Phase | Duration | Team | Dependencies |
|-------|----------|------|--------------|
| **Audit & Cleanup** | 1 day | Backend | None |
| **Add Unique Constraint** | 0.5 day | Backend | Audit complete |
| **Code Fix (Upsert)** | 1 day | Backend | Constraint deployed |
| **Re-read Logic** | 2 days | Backend | Upsert deployed |
| **Testing & Deploy** | 0.5 day | QA + Backend | All changes ready |
| **Total (Critical)** | **4 days** | 1 backend engineer | |

**Optional Phase 4:** 5-7 days (can be done later)

---

## Success Metrics

| Metric | Current | Target | How We'll Measure |
|--------|---------|--------|-------------------|
| Duplicate assignments | Unknown* | **0** | DB query (should return 0 rows) |
| Missing crew reports | ~X/week* | **0** | Support ticket count |
| Sync failure rate | Unknown* | **< 1%** | New logging added |
| Sync duration | ~Y sec* | **< 5 sec** | New logging added |

*To be measured during audit phase

---

## Alternatives Considered

### Alternative 1: Lock-Based Serialization
**Approach:** Use database locks to prevent concurrent syncs  
**Decision:** ❌ Rejected  
**Reason:** Doesn't fix read-after-write gap, adds complexity, can leak locks

### Alternative 2: Queue-Based Sync
**Approach:** Process sync requests serially via queue  
**Decision:** ❌ Rejected  
**Reason:** Overkill, adds infrastructure, higher latency; upsert+constraint is simpler

### Alternative 3: Client-Side Debouncing
**Approach:** Disable "Sync Flex" button for N seconds after click  
**Decision:** ✅ Complementary (not primary fix)  
**Reason:** Helps UX but doesn't prevent multi-tab or API-triggered races

---

## Rollback Plan

If issues arise (unlikely):

1. **Remove Unique Constraint** (if blocking legitimate operations)
   - Single SQL command to drop constraint
   - Not recommended; constraint prevents data corruption

2. **Revert Edge Function** (if upsert causes errors)
   - Deploy previous version via git revert
   - 5-minute rollback time

3. **Comment Out Re-read** (if performance issues)
   - Quick code change to restore old behavior
   - Accept that stale row scenario requires manual re-sync

**Monitoring:** First 24 hours after each phase deployment, watch logs for:
- Constraint violation errors (should be zero)
- Sync failure rate increase (should decrease)
- Performance degradation (not expected)

---

## Stakeholder Impact

### Development Team
- **Effort:** 4 days (critical fixes)
- **Complexity:** Low-medium (isolated changes)
- **Risk:** Low (unique constraint prevents corruption)

### Operations Team
- **Before Fix:** Handle "missing crew" support tickets
- **After Fix:** Zero duplicate/missing crew issues
- **Training:** None (transparent fix)

### End Users
- **Before Fix:** Must click "Sync Flex" multiple times to fix missing crew
- **After Fix:** One sync always works correctly
- **UX Impact:** Improved reliability, fewer clicks

### Product Management
- **Technical Debt:** Reduced (eliminates workaround for missing crew)
- **Data Quality:** Improved (no duplicates)
- **Customer Satisfaction:** Increased (fewer sync issues)

---

## Recommendation

**Proceed with Phase 1-2 (critical fixes) immediately.**

**Rationale:**
1. ✅ Fixes high-impact bugs affecting daily operations
2. ✅ Low risk, isolated changes, well-tested solution
3. ✅ Short timeline (4 days)
4. ✅ No infrastructure changes required
5. ✅ Improves data quality and user experience

**Next Steps:**
1. Approve implementation plan
2. Schedule 4-day sprint for backend engineer
3. Coordinate with QA for testing
4. Plan production deployment window (minimal downtime)

**Defer Phase 3 (optional optimization)** until after critical fixes validated in production.

---

## Approval

**Recommended By:** Engineering Team  
**Date:** 2024-12-01

**Approved By:** ________________________  
**Title:** ________________________  
**Date:** ________________________

---

## Questions?

**For Technical Details:**
- 📖 [Full Technical Analysis](./docs/ADR-flex-sync-double-upsert-race-condition.md)
- 🔄 [Control Flow Diagram](./docs/flex-sync-control-flow-diagram.md)
- 📋 [Audit Summary](./FLEX_SYNC_AUDIT_SUMMARY.md)
- ✅ [Implementation Checklist](./FLEX_SYNC_FIX_CHECKLIST.md)

**Contact:**
- Engineering Lead: ________________________
- Backend Engineer: ________________________
- QA Lead: ________________________
