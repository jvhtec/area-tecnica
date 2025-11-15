# System Coverage Breakdown
## Conservative Roadmap Applied to Both Systems

**Document:** `/docs/CONSERVATIVE_IMPROVEMENT_ROADMAP.md`
**Scope:** Timesheets + Job Assignments (Combined Approach)

---

## How the Phases Apply to Each System

### Phase 0: Foundation & Safety Nets (Both Systems)

| Task | Timesheets | Job Assignments |
|------|-----------|-----------------|
| **Monitoring Views** | ✅ `system_health_timesheets` | ✅ `system_health_assignments` |
| **Error Tracking** | ✅ Shared `system_errors` table | ✅ Shared `system_errors` table |
| **Critical Path Tests** | ✅ Create/Approve/Calculate flow | ✅ Direct assign + Staffing workflow |
| **Data Audit** | ✅ Check orphaned timesheets | ✅ Check orphaned assignments + staffing_requests |

**Result:** One monitoring dashboard covering BOTH systems

---

### Phase 1: Zero-Risk Database Improvements (Both Systems)

#### Timesheets Indexes (5 indexes):
```sql
CREATE INDEX CONCURRENTLY idx_timesheets_job_id ON timesheets(job_id);
CREATE INDEX CONCURRENTLY idx_timesheets_technician_id ON timesheets(technician_id);
CREATE INDEX CONCURRENTLY idx_timesheets_status ON timesheets(status);
CREATE INDEX CONCURRENTLY idx_timesheets_date ON timesheets(date);
CREATE INDEX CONCURRENTLY idx_timesheets_approved_by ON timesheets(approved_by);
```

#### Job Assignments Indexes (8 indexes):
```sql
CREATE INDEX CONCURRENTLY idx_job_assignments_technician_id ON job_assignments(technician_id);
CREATE INDEX CONCURRENTLY idx_job_assignments_status ON job_assignments(status);
CREATE INDEX CONCURRENTLY idx_job_assignments_assigned_at ON job_assignments(assigned_at);
CREATE INDEX CONCURRENTLY idx_job_assignments_assignment_date ON job_assignments(assignment_date);
CREATE INDEX CONCURRENTLY idx_availability_schedules_user_date ON availability_schedules(user_id, date);
CREATE INDEX CONCURRENTLY idx_staffing_requests_batch_id ON staffing_requests(batch_id);
CREATE INDEX CONCURRENTLY idx_staffing_requests_expires_at ON staffing_requests(token_expires_at);
CREATE INDEX CONCURRENTLY idx_assignments_tech_date ON job_assignments(technician_id, assignment_date);
```

**Total: 13 indexes in single migration**

**Deployment:** One migration file, all indexes added together with `CONCURRENTLY`

---

### Phase 2: Data Integrity (Both Systems)

#### Timesheets Foreign Keys:
```sql
-- Add FK constraints
ALTER TABLE timesheets
  ADD CONSTRAINT fk_timesheets_job_id
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    NOT VALID;

ALTER TABLE timesheets
  ADD CONSTRAINT fk_timesheets_technician_id
    FOREIGN KEY (technician_id) REFERENCES profiles(id) ON DELETE CASCADE
    NOT VALID;
```

#### Job Assignments - Already has FKs! ✅
```sql
-- Job assignments already has proper FK constraints (added in previous migrations)
-- Only need to add missing ones:
ALTER TABLE job_assignments
  ADD CONSTRAINT fk_job_assignments_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL
    NOT VALID;
```

#### Timesheets Validation:
```sql
ALTER TABLE timesheets
  ADD CONSTRAINT chk_break_minutes_positive CHECK (break_minutes >= 0),
  ADD CONSTRAINT chk_overtime_positive CHECK (overtime_hours >= 0);
```

#### Assignments Validation:
```sql
ALTER TABLE job_assignments
  ADD CONSTRAINT chk_has_at_least_one_role CHECK (
    sound_role IS NOT NULL OR lights_role IS NOT NULL OR video_role IS NOT NULL
  );
```

#### Cleanup Triggers (Both):
```sql
-- Timesheets: Already has trigger for auto-creation ✅

-- Assignments: Add fulfillment marking
CREATE TRIGGER trg_mark_staffing_fulfilled
  AFTER INSERT ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION mark_staffing_request_fulfilled();
```

---

### Phase 3: Code Improvements (Both Systems)

#### Timesheets:
- ✅ Fix N+1 query (batch visibility checks)
- ✅ Remove duplicate subscription in `useTimesheets`
- ✅ Split `TimesheetView.tsx` (939 lines → smaller components)
- ✅ Extract shared error handling

#### Job Assignments:
- ✅ Extract conflict checking to shared utility
- ✅ Remove duplicate subscriptions (multiple channels for same data)
- ✅ Split `OptimizedAssignmentMatrix` (1200+ lines → smaller components)
- ✅ Extract shared assignment logic

**Shared:**
- ✅ Centralized `RealtimeProvider` for both systems
- ✅ Shared error tracking (`trackError` utility)
- ✅ Shared caching strategy (React Query optimization)

---

### Phase 4: Refactoring (Both Systems - OPTIONAL)

#### Timesheets:
- Split `TimesheetView` into smaller components
- Refactor `useTimesheets` into focused hooks
- Add audit logging

#### Job Assignments:
- **Consolidate 4 dialogs → 1 base component** (biggest win)
- Split matrix components
- Simplify staffing workflow (if validated)

---

## Combined Statistics

### Issues Fixed by Phase:

| Phase | Timesheets Issues | Assignments Issues | Total Fixed |
|-------|------------------|-------------------|-------------|
| **Phase 0** | Monitoring + Tests | Monitoring + Tests | Foundation |
| **Phase 1** | 5 missing indexes | 8 missing indexes | 13 indexes |
| **Phase 2** | 2 missing FKs, 2 constraints | 1 missing FK, 1 constraint, cleanup | 6 fixes |
| **Phase 3** | N+1 query, duplicates | Duplicate dialogs, subscriptions | 8 improvements |
| **Phase 4** | Component splits | Dialog consolidation | Major refactor |

### Effort Distribution:

| System | Critical Issues (P0) | High Priority (P1) | Medium Priority (P2) |
|--------|---------------------|-------------------|---------------------|
| **Timesheets** | 4 critical | 6 high | 8 medium |
| **Assignments** | 6 critical | 8 high | 12 medium |
| **Shared** | 2 critical | 4 high | 6 medium |

### ROI Analysis:

| System | Current Grade | After Phase 2 | After Phase 4 | Effort |
|--------|--------------|---------------|---------------|--------|
| **Timesheets** | 7/10 | 8.5/10 | 9/10 | 3 weeks |
| **Assignments** | 6.5/10 | 8/10 | 9/10 | 4 weeks |
| **Combined** | 6.75/10 | 8.25/10 | 9/10 | 5-6 weeks |

**Why combined is more efficient:**
- Shared monitoring infrastructure
- Single migration for all indexes
- Shared real-time provider
- Shared error tracking
- Single test infrastructure setup

---

## Migration Strategy

### Single Combined Migrations:

**Phase 1 Migration:**
```sql
-- migrations/20XX_add_all_performance_indexes.sql

-- Timesheets indexes (5)
CREATE INDEX CONCURRENTLY idx_timesheets_job_id ON timesheets(job_id);
-- ... 4 more

-- Job Assignments indexes (8)
CREATE INDEX CONCURRENTLY idx_job_assignments_technician_id ON job_assignments(technician_id);
-- ... 7 more

-- TOTAL: 13 indexes in ONE deployment
-- Time: ~2-3 minutes
-- Downtime: ZERO (CONCURRENTLY)
```

**Phase 2 Migration:**
```sql
-- migrations/20XX_add_data_integrity_constraints.sql

-- Timesheets
ALTER TABLE timesheets ADD CONSTRAINT fk_timesheets_job_id ...;
ALTER TABLE timesheets ADD CONSTRAINT chk_break_minutes_positive ...;

-- Job Assignments
ALTER TABLE job_assignments ADD CONSTRAINT fk_job_assignments_assigned_by ...;
ALTER TABLE job_assignments ADD CONSTRAINT chk_has_at_least_one_role ...;

-- Cleanup triggers (both)
CREATE TRIGGER trg_mark_staffing_fulfilled ...;
```

---

## Testing Strategy (Combined)

### Phase 0 Test Suite:

```typescript
// tests/timesheets/critical-paths.test.ts (Timesheets)
describe('Timesheets System', () => {
  test('Creation workflow');
  test('Approval workflow');
  test('Visibility rules');
  test('Rate calculation');
});

// tests/assignments/critical-paths.test.ts (Assignments)
describe('Assignments System', () => {
  test('Direct assignment');
  test('Staffing workflow');
  test('Conflict detection');
  test('Timesheet auto-creation');
});

// tests/integration/timesheets-assignments.test.ts (Integration)
describe('System Integration', () => {
  test('Assignment creates timesheets');
  test('Assignment deletion cascades to timesheets');
  test('Conflict detection considers both systems');
});
```

**Coverage Target:**
- Timesheets: 80%
- Assignments: 80%
- Integration: 60%

---

## Rollback Strategy (Combined)

### Single Rollback Per Phase:

```bash
# Phase 1 Rollback (if needed - unlikely)
psql -f migrations/rollback/phase1_drop_all_indexes.sql
# Drops all 13 indexes in 30 seconds

# Phase 2 Rollback (if needed)
psql -f migrations/rollback/phase2_drop_constraints.sql
# Drops all constraints and triggers

# Phase 3 Rollback (code changes)
git revert <commit-hash>
# Reverts shared utilities

# Phase 4 Rollback (feature flags)
# Set VITE_USE_NEW_DIALOGS=false
# Instant rollback to old code
```

---

## Timeline (Combined)

### Sequential Approach:
```
Week 1-2:  Phase 0 (Both systems) - Monitoring, tests, audit
Week 3:    Phase 1 (Both systems) - All 13 indexes
Week 4-5:  Phase 2 (Both systems) - All constraints
Week 6-8:  Phase 3 (Both systems) - Code improvements
Week 9-12: Phase 4 (Both systems) - Refactoring (OPTIONAL)
```

**Total: 8-12 weeks for BOTH systems**

### Parallel Approach (If more resources):
```
Week 1-2:  Phase 0 (Both systems in parallel)
Week 3:    Phase 1 (Single deployment, both systems)
Week 4-5:  Phase 2 (Single deployment, both systems)
Week 6-7:  Phase 3 Timesheets (Team A)
Week 6-7:  Phase 3 Assignments (Team B)
Week 8-9:  Phase 4 Timesheets (Team A)
Week 8-9:  Phase 4 Assignments (Team B)
```

**Total: 9 weeks with 2 developers**

---

## Benefits of Combined Approach

### Efficiency Gains:
1. ✅ **Single monitoring dashboard** (not two separate)
2. ✅ **Shared test infrastructure** (setup once)
3. ✅ **Single deployment pipeline** (one migration file)
4. ✅ **Shared utilities** (error tracking, real-time, caching)
5. ✅ **Knowledge transfer** (learn once, apply twice)

### Risk Reduction:
1. ✅ **Consistent approach** (same patterns both systems)
2. ✅ **Single rollback strategy** (one process to learn)
3. ✅ **Unified monitoring** (one dashboard to watch)
4. ✅ **Cross-system testing** (catch integration issues)

### Cost Savings:
- **Time:** 6 weeks combined vs 10 weeks separate
- **Effort:** 1 developer vs 2 developers
- **Testing:** Shared infrastructure
- **Monitoring:** Single setup

---

## Decision Point

**Question:** Should we tackle both systems together, or one at a time?

### Option A: Combined (Recommended)
- ✅ More efficient (6 weeks vs 10 weeks)
- ✅ Shared infrastructure
- ✅ Consistent patterns
- ⚠️ Higher cognitive load

### Option B: Sequential (Safer)
- ✅ Focus on one system at a time
- ✅ Learn from first, apply to second
- ⚠️ Slower (10 weeks total)
- ⚠️ Duplicate infrastructure setup

**My Recommendation:** **Option A (Combined)** because:
1. Phase 0-2 are database changes (apply to both easily)
2. Shared monitoring/testing infrastructure
3. Issues are similar (missing indexes, duplicates, etc.)
4. Faster time to value

---

## Next Steps - Your Choice:

### Choice 1: Start Phase 0 for BOTH systems
- Set up unified monitoring dashboard
- Write tests for both critical paths
- Run combined data audit
- **Timeline:** 2 weeks
- **Risk:** Zero

### Choice 2: Start Phase 0 for ONE system first
- Pick Timesheets (simpler) or Assignments (more critical)
- Complete Phase 0-2 for one system
- Learn lessons, apply to second system
- **Timeline:** 5 weeks for first, 3 weeks for second
- **Risk:** Zero

### Choice 3: Quick win - Just indexes for both
- Deploy all 13 indexes today
- Monitor for 1 week
- Then decide on full plan
- **Timeline:** 1 week
- **Risk:** ~1/10

**What feels right to you?**

---

**Summary:** The Conservative Roadmap covers BOTH systems with a unified approach. Each phase applies to both, using shared infrastructure where possible. This is more efficient than separate plans.
