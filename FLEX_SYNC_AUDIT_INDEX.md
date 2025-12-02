# Flex Sync Audit - Document Index

**Audit Date:** 2024-12-01  
**Issue:** Race condition and double-upsert bug in `sync-flex-crew-for-job` Edge Function  
**Status:** ✅ Analysis Complete - Awaiting Implementation  

---

## 📚 Document Overview

This audit consists of **5 comprehensive documents** covering different aspects and audiences:

### 1. 🎯 Executive Summary (Start Here)
**File:** [`FLEX_SYNC_EXECUTIVE_SUMMARY.md`](./FLEX_SYNC_EXECUTIVE_SUMMARY.md)  
**Audience:** Product managers, engineering leads, stakeholders  
**Length:** ~5 minutes read  
**Purpose:** High-level problem overview, business impact, recommended solution, timeline

**Key Sections:**
- Problem overview with business impact
- Root causes (non-technical explanation)
- Proposed solution with timeline
- Success metrics and approval section

---

### 2. 📋 Audit Summary (Quick Reference)
**File:** [`FLEX_SYNC_AUDIT_SUMMARY.md`](./FLEX_SYNC_AUDIT_SUMMARY.md)  
**Audience:** Engineers, technical leads  
**Length:** ~10 minutes read  
**Purpose:** Technical summary of issues, proposed fixes, code sections affected

**Key Sections:**
- Critical issues with code examples
- Affected code sections (line numbers)
- Recommended fix priority with code snippets
- Dependencies and side effects
- Success metrics

---

### 3. 📖 Full ADR (Technical Deep Dive)
**File:** [`docs/ADR-flex-sync-double-upsert-race-condition.md`](./docs/ADR-flex-sync-double-upsert-race-condition.md)  
**Audience:** Engineers implementing the fix  
**Length:** ~30 minutes read  
**Purpose:** Comprehensive technical analysis with detailed remediation plan

**Key Sections:**
- Context and problem statement
- Root causes with code flow analysis
- Affected components (database tables, UI components, Flex API)
- Proposed remediation (5 priority levels)
- Implementation plan with phases
- Alternatives considered
- Open questions and success metrics

---

### 4. 🔄 Control Flow Diagram (Visual Guide)
**File:** [`docs/flex-sync-control-flow-diagram.md`](./docs/flex-sync-control-flow-diagram.md)  
**Audience:** Engineers debugging or understanding the flow  
**Length:** ~15 minutes read  
**Purpose:** Visual representation of current problematic flow vs. proposed fixed flow

**Key Sections:**
- Current implementation flow with problem annotations
- Race condition scenario timeline
- Proposed fixed implementation flow
- Database schema comparison (before/after)

---

### 5. ✅ Implementation Checklist (Action Plan)
**File:** [`FLEX_SYNC_FIX_CHECKLIST.md`](./FLEX_SYNC_FIX_CHECKLIST.md)  
**Audience:** Engineers implementing the fix, QA team  
**Length:** Working document (checklist format)  
**Purpose:** Step-by-step implementation guide with checkboxes

**Key Sections:**
- Phase 1: Database constraint (queries, migrations, tests)
- Phase 2: Code fix - upsert (code changes, tests, deployment)
- Phase 3: Recompute after deletion (refactor, tests)
- Phase 4: Optional - reorder orphan pruning
- Phase 5: Monitoring and documentation
- Verification queries and rollback plan

---

## 🚀 Quick Start Guide

### For Product Managers / Stakeholders:
1. Read: [`FLEX_SYNC_EXECUTIVE_SUMMARY.md`](./FLEX_SYNC_EXECUTIVE_SUMMARY.md)
2. Approve or request changes
3. Monitor: Check "Success Metrics" after implementation

### For Engineering Leads:
1. Read: [`FLEX_SYNC_AUDIT_SUMMARY.md`](./FLEX_SYNC_AUDIT_SUMMARY.md)
2. Review: [`docs/ADR-flex-sync-double-upsert-race-condition.md`](./docs/ADR-flex-sync-double-upsert-race-condition.md) (Implementation Plan section)
3. Assign: Engineer to follow [`FLEX_SYNC_FIX_CHECKLIST.md`](./FLEX_SYNC_FIX_CHECKLIST.md)
4. Track: Phase completion and sign-off

### For Implementing Engineers:
1. Read: [`FLEX_SYNC_AUDIT_SUMMARY.md`](./FLEX_SYNC_AUDIT_SUMMARY.md) (understand the problem)
2. Study: [`docs/flex-sync-control-flow-diagram.md`](./docs/flex-sync-control-flow-diagram.md) (visual understanding)
3. Reference: [`docs/ADR-flex-sync-double-upsert-race-condition.md`](./docs/ADR-flex-sync-double-upsert-race-condition.md) (detailed technical specs)
4. Follow: [`FLEX_SYNC_FIX_CHECKLIST.md`](./FLEX_SYNC_FIX_CHECKLIST.md) (step-by-step implementation)
5. Test: Use verification queries in checklist

### For QA Team:
1. Read: [`FLEX_SYNC_AUDIT_SUMMARY.md`](./FLEX_SYNC_AUDIT_SUMMARY.md) (understand what to test)
2. Reference: [`FLEX_SYNC_FIX_CHECKLIST.md`](./FLEX_SYNC_FIX_CHECKLIST.md) (test cases in Phases 1-3)
3. Verify: Success criteria in each phase

---

## 🎯 Acceptance Criteria (From Ticket)

✅ **All acceptance criteria met:**

1. ✅ **Written analysis pinpoints exact sections responsible for double-upsert/read-after-write**
   - See: [Audit Summary - Affected Code Sections](./FLEX_SYNC_AUDIT_SUMMARY.md#-affected-code-sections)
   - See: [ADR - Root Causes](./docs/ADR-flex-sync-double-upsert-race-condition.md#root-causes)
   - See: [Control Flow Diagram](./docs/flex-sync-control-flow-diagram.md)

2. ✅ **Recommended fix list covers DB constraints, algorithm ordering, and concurrency control**
   - See: [Audit Summary - Recommended Fix Priority](./FLEX_SYNC_AUDIT_SUMMARY.md#-recommended-fix-priority)
   - See: [ADR - Proposed Remediation](./docs/ADR-flex-sync-double-upsert-race-condition.md#proposed-remediation)
   - See: [Implementation Checklist](./FLEX_SYNC_FIX_CHECKLIST.md)

3. ✅ **Downstream impacts documented (JobAssignments UI, reporting, triggers)**
   - See: [ADR - Affected Components](./docs/ADR-flex-sync-double-upsert-race-condition.md#affected-components)
   - See: [ADR - Downstream Impacts](./docs/ADR-flex-sync-double-upsert-race-condition.md#downstream-impacts)
   - See: [Audit Summary - Dependencies & Side Effects](./FLEX_SYNC_AUDIT_SUMMARY.md#-dependencies--side-effects)

---

## 🔍 Key Findings Summary

### Critical Issues Found:

1. **🔴 Duplicate DB Rows from Concurrent Syncs**
   - **Cause:** No unique constraint + blind insert instead of upsert
   - **Impact:** Data corruption, inflated crew counts
   - **Fix:** Add unique constraint + change to upsert
   - **Priority:** P1 (Critical)

2. **🔴 Missing Crew Members After Stale Deletion**
   - **Cause:** Single snapshot, no re-read after deletion
   - **Impact:** Users must manually trigger multiple syncs
   - **Fix:** Re-read DB state after deleting stale rows
   - **Priority:** P1 (Critical)

3. **🟡 Orphan Pruning Timing Issue**
   - **Cause:** Pruning happens after add/remove operations
   - **Impact:** Delete-before-add timing problems
   - **Fix:** Move orphan pruning before DB diffing
   - **Priority:** P4 (Optional)

### Recommended Implementation:

- **Phase 1-2 (Critical):** 4 days
  - Add unique constraint
  - Change insert to upsert
  - Test and deploy

- **Phase 3 (High):** 2 days
  - Add re-read after deletion
  - Test stale row scenarios
  - Deploy

- **Phase 4 (Optional):** 5-7 days
  - Reorder orphan pruning
  - Can defer to later sprint

**Total Timeline:** 4-6 days for critical fixes

---

## 📊 Success Metrics

After implementation, expect:

- ✅ **Zero duplicate assignments** (blocked by unique constraint)
- ✅ **Zero missing crew members** (fixed by re-read logic)
- ✅ **Sync success rate > 99%** (improved error handling)
- ✅ **Concurrent syncs work correctly** (upsert is idempotent)

---

## 📁 Related Files

### Source Code:
- [`supabase/functions/sync-flex-crew-for-job/index.ts`](./supabase/functions/sync-flex-crew-for-job/index.ts) - Main sync function (432 lines)
- [`supabase/functions/sync-flex-crew-for-job/flexBusinessRoles.ts`](./supabase/functions/sync-flex-crew-for-job/flexBusinessRoles.ts) - Business role mapping

### UI Components:
- [`src/components/jobs/JobAssignments.tsx`](./src/components/jobs/JobAssignments.tsx) - Crew list with "Sync Flex" button
- [`src/components/jobs/JobAssignmentDialog.tsx`](./src/components/jobs/JobAssignmentDialog.tsx) - Assignment dialog with "Sync Flex" button
- [`src/hooks/useFlexCrewAssignments.ts`](./src/hooks/useFlexCrewAssignments.ts) - Flex crew management hook

### Existing Documentation:
- [`docs/catalog-flex-backends-delta.md`](./docs/catalog-flex-backends-delta.md) - Flex backend functions catalog
- [`docs/flex-folder-workflows.md`](./docs/flex-folder-workflows.md) - Flex folder workflows
- [`docs/flex-frontend-architecture.md`](./docs/flex-frontend-architecture.md) - Flex frontend architecture

---

## ❓ FAQ

### Q: Why wasn't this caught earlier?
**A:** The race condition only manifests with concurrent syncs or specific timing (manual Flex deletions). Both are edge cases that may not appear in typical testing.

### Q: Will this affect existing crew assignments?
**A:** No. The fix preserves all existing assignments. The unique constraint cleanup will remove duplicates (keeping oldest), but all unique assignments remain intact.

### Q: How long will the fix take to deploy?
**A:** Critical fixes: 4 days development + testing. Production deployment: ~1 hour with monitoring.

### Q: What if the fix causes issues?
**A:** Low risk, but we have rollback plans:
- Unique constraint can be dropped (not recommended)
- Edge Function can be reverted via git
- Changes are isolated to sync function

### Q: Do we need to stop syncing during deployment?
**A:** No. Edge Functions deploy with zero downtime. Existing syncs complete on old version, new syncs use new version.

### Q: Will this improve sync performance?
**A:** Slightly. Re-read adds one extra DB query (~50ms), but eliminates need for multiple manual syncs (saves user time).

---

## 📞 Contact

**For Questions About:**
- **Implementation:** Assigned backend engineer (TBD)
- **Technical Decisions:** Engineering lead (TBD)
- **Business Impact:** Product manager (TBD)
- **Testing:** QA lead (TBD)

---

## 📝 Document Maintenance

**Last Updated:** 2024-12-01  
**Next Review:** After Phase 3 deployment  

**Update Trigger Events:**
- Implementation plan changes
- New issues discovered during implementation
- Success metrics measured after deployment

**Document Owner:** Engineering Team
