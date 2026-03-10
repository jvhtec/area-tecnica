# Conservative Improvement Roadmap
## Timesheets & Job Assignments Systems

**Philosophy:** Stability is paramount. Never break what works.
**Risk Tolerance:** 8/10 (Very Conservative)
**Timeline:** Flexible - Quality over speed
**Success Criteria:** Never fails, safe, reliable

---

## Guiding Principles

1. ✅ **Safety First:** Add tests and monitoring BEFORE making changes
2. ✅ **Incremental:** Small, reversible changes with clear rollback plans
3. ✅ **Validated:** Measure impact at each step, proceed only if successful
4. ✅ **Zero Downtime:** All changes must be deployable during business hours
5. ✅ **Preserve Functionality:** Never remove features, only improve reliability
6. ✅ **Data Safety:** Never risk data loss or corruption

---

## Phase 0: Foundation & Safety Nets (Week 1-2)

**Goal:** Build confidence and visibility BEFORE touching production code

### 0.1 Monitoring & Observability

**Add monitoring for current system (no code changes):**

```sql
-- Create monitoring views (read-only, zero risk)
CREATE VIEW system_health_timesheets AS
SELECT
  COUNT(*) FILTER (WHERE status = 'draft') as drafts,
  COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
  COUNT(*) FILTER (WHERE status = 'approved') as approved,
  COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') as created_24h,
  COUNT(*) FILTER (WHERE updated_at > now() - interval '1 hour') as updated_1h,
  AVG(EXTRACT(epoch FROM (approved_at - created_at))) as avg_approval_time_seconds
FROM timesheets;

CREATE VIEW system_health_assignments AS
SELECT
  COUNT(*) as total_assignments,
  COUNT(DISTINCT job_id) as active_jobs,
  COUNT(DISTINCT technician_id) as assigned_technicians,
  COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') as created_24h,
  COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
  COUNT(*) FILTER (WHERE status = 'invited') as invited
FROM job_assignments;

-- Create error logging table (for tracking issues)
CREATE TABLE system_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system TEXT NOT NULL, -- 'timesheets' or 'assignments'
  error_type TEXT NOT NULL,
  error_message TEXT,
  context JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_errors_created ON system_errors(created_at DESC);
CREATE INDEX idx_errors_system ON system_errors(system, error_type);
```

**Set up alerts:**
- Query performance degradation
- Error rate spikes
- Unusual data patterns

**Deliverable:** Dashboard showing current system health
**Risk:** Zero (read-only)
**Effort:** 2 days
**Go/No-Go:** Baseline metrics established ✅

---

### 0.2 Critical Path Testing

**Add tests for existing functionality (no code changes yet):**

#### Timesheets Tests
```typescript
// tests/timesheets/critical-paths.test.ts
describe('Timesheets Critical Paths (Current Behavior)', () => {
  describe('Creation Flow', () => {
    test('Management can create timesheet for technician');
    test('Auto-creation works for job assignments');
    test('Single-day vs whole-job coverage');
  });

  describe('Approval Flow', () => {
    test('Draft → Submit → Approve workflow');
    test('Rejection and re-editing');
    test('Rate calculation triggers on approval');
  });

  describe('Visibility Rules', () => {
    test('Technicians see amounts only after approval');
    test('Management always see amounts');
    test('House tech never see amounts');
  });

  describe('Data Integrity', () => {
    test('Cannot create duplicate timesheets');
    test('Status transitions are valid');
    test('Signature required for submission');
  });
});
```

#### Assignments Tests
```typescript
// tests/assignments/critical-paths.test.ts
describe('Assignments Critical Paths (Current Behavior)', () => {
  describe('Direct Assignment', () => {
    test('Can assign technician to job');
    test('Conflict detection prevents double-booking');
    test('Creates timesheets automatically');
    test('Single-day assignments work');
  });

  describe('Staffing Workflow', () => {
    test('Availability request sends email');
    test('Offer request sends email');
    test('Confirmation creates assignment');
    test('Expiry works correctly');
  });

  describe('Conflict Detection', () => {
    test('Detects hard conflicts (confirmed assignments)');
    test('Detects soft conflicts (pending assignments)');
    test('Detects unavailability conflicts');
    test('Handles overnight/multi-day jobs');
  });
});
```

**Coverage Target:** 80% of critical paths
**Deliverable:** Test suite documenting current behavior
**Risk:** Zero (tests don't change code)
**Effort:** 1 week
**Go/No-Go:** Tests pass consistently ✅

---

### 0.3 Data Audit & Cleanup Analysis

**Analyze current data WITHOUT making changes:**

```sql
-- Find orphaned timesheets (if FK constraints were added)
SELECT t.id, t.job_id, t.technician_id, t.created_at
FROM timesheets t
LEFT JOIN jobs j ON t.job_id = j.id
LEFT JOIN profiles p ON t.technician_id = p.id
WHERE j.id IS NULL OR p.id IS NULL;
-- Save results to: data_audit_orphaned_timesheets.csv

-- Find orphaned assignments
SELECT ja.id, ja.job_id, ja.technician_id, ja.assigned_at
FROM job_assignments ja
LEFT JOIN jobs j ON ja.job_id = j.id
LEFT JOIN profiles p ON ja.technician_id = p.id
WHERE j.id IS NULL OR p.id IS NULL;
-- Save results to: data_audit_orphaned_assignments.csv

-- Find orphaned staffing_requests
SELECT COUNT(*), status, phase
FROM staffing_requests sr
WHERE status = 'confirmed'
  AND phase = 'offer'
  AND NOT EXISTS (
    SELECT 1 FROM job_assignments ja
    WHERE ja.job_id = sr.job_id
    AND ja.technician_id = sr.profile_id
  )
GROUP BY status, phase;
-- Save results to: data_audit_orphaned_staffing_requests.csv

-- Find invalid role codes
SELECT DISTINCT sound_role FROM job_assignments WHERE sound_role IS NOT NULL
UNION
SELECT DISTINCT lights_role FROM job_assignments WHERE lights_role IS NOT NULL
UNION
SELECT DISTINCT video_role FROM job_assignments WHERE video_role IS NOT NULL;
-- Compare against: known_valid_role_codes.txt

-- Find assignment dates outside job ranges
SELECT ja.id, ja.assignment_date, j.start_time, j.end_time
FROM job_assignments ja
JOIN jobs j ON ja.job_id = j.id
WHERE ja.single_day = true
  AND ja.assignment_date IS NOT NULL
  AND (ja.assignment_date < j.start_time::date OR ja.assignment_date > j.end_time::date);
-- Save results to: data_audit_invalid_dates.csv
```

**Deliverable:**
- Report of all data quality issues
- Recommended fixes (manual or automated)
- No changes made yet

**Risk:** Zero (read-only analysis)
**Effort:** 2 days
**Go/No-Go:** Data quality baseline documented ✅

---

## Phase 1: Zero-Risk Database Improvements (Week 3)

**Goal:** Add performance and safety with ZERO risk of breaking existing functionality

### 1.1 Add Indexes (CONCURRENTLY)

**Why safe:**
- Indexes don't change behavior, only speed
- `CONCURRENTLY` means zero downtime
- Can be dropped instantly if issues arise

**Migration:**
```sql
-- migrations/YYYYMMDD_add_performance_indexes_safe.sql

-- Timesheets indexes (all CONCURRENTLY for zero downtime)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_job_id
  ON timesheets(job_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_technician_id
  ON timesheets(technician_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_status
  ON timesheets(status)
  WHERE status IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_date
  ON timesheets(date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_approved_by
  ON timesheets(approved_by)
  WHERE approved_by IS NOT NULL;

-- Assignments indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_assignments_technician_id
  ON job_assignments(technician_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_assignments_status
  ON job_assignments(status)
  WHERE status IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_assignments_assigned_at
  ON job_assignments(assigned_at DESC);

-- Conflict checking optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_availability_schedules_user_date
  ON availability_schedules(user_id, date);

-- Staffing workflow optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staffing_requests_batch_id
  ON staffing_requests(batch_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_staffing_requests_expires_at
  ON staffing_requests(token_expires_at);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timesheets_job_status
  ON timesheets(job_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignments_tech_date
  ON job_assignments(technician_id, assignment_date)
  WHERE single_day = true;

COMMENT ON INDEX idx_timesheets_job_id IS
  'Optimizes job timesheet fetching (Phase 1: Zero-risk improvement)';
```

**Rollback Plan:**
```sql
-- If any issues (unlikely), can drop instantly:
DROP INDEX CONCURRENTLY IF EXISTS idx_timesheets_job_id;
-- etc...
```

**Testing:**
```sql
-- Before migration: Measure query times
EXPLAIN ANALYZE
SELECT * FROM timesheets WHERE job_id = 'test-uuid';
-- Record: X ms

-- After migration: Should be 10-100x faster
EXPLAIN ANALYZE
SELECT * FROM timesheets WHERE job_id = 'test-uuid';
-- Verify: Uses index, < X/10 ms
```

**Deployment:**
- Deploy during business hours (CONCURRENTLY allows this)
- Monitor query performance for 48 hours
- If no issues, mark as permanent success

**Risk:** 1/10 (essentially zero)
**Impact:** High (10-100x faster queries)
**Effort:** 1 hour deployment + 2 days monitoring
**Rollback Time:** < 5 minutes
**Go/No-Go:** All queries faster, no errors ✅

---

### 1.2 Add Monitoring Views & Alerts

**Why safe:**
- Views don't change data
- Alerts are observability only
- Can be dropped without impact

**Migration:**
```sql
-- migrations/YYYYMMDD_add_monitoring_views_safe.sql

-- Slow query detection
CREATE VIEW slow_queries_timesheets AS
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%timesheets%'
  AND mean_exec_time > 100 -- queries taking > 100ms
ORDER BY mean_exec_time DESC;

-- Data anomaly detection
CREATE VIEW data_anomalies AS
SELECT
  'timesheets' as table_name,
  'missing_times' as anomaly,
  COUNT(*) as count
FROM timesheets
WHERE status != 'draft' AND (start_time IS NULL OR end_time IS NULL)
UNION ALL
SELECT
  'job_assignments' as table_name,
  'missing_roles' as anomaly,
  COUNT(*) as count
FROM job_assignments
WHERE sound_role IS NULL AND lights_role IS NULL AND video_role IS NULL;

-- Real-time activity monitoring
CREATE VIEW recent_activity AS
SELECT
  'timesheet' as type,
  status as action,
  COUNT(*) as count,
  MAX(updated_at) as last_activity
FROM timesheets
WHERE updated_at > now() - interval '1 hour'
GROUP BY status
UNION ALL
SELECT
  'assignment' as type,
  'created' as action,
  COUNT(*) as count,
  MAX(assigned_at) as last_activity
FROM job_assignments
WHERE assigned_at > now() - interval '1 hour';
```

**Risk:** 0/10 (pure observability)
**Impact:** Medium (visibility into issues)
**Effort:** 2 hours

---

### 1.3 Add Error Tracking (Frontend)

**Add structured error logging WITHOUT changing functionality:**

```typescript
// src/lib/errorTracking.ts (new file, doesn't change existing code)
export const trackError = (error: Error, context: {
  system: 'timesheets' | 'assignments';
  operation: string;
  userId?: string;
  [key: string]: any;
}) => {
  // Log to database
  supabase.from('system_errors').insert({
    system: context.system,
    error_type: error.name,
    error_message: error.message,
    context: context,
    user_id: context.userId
  });

  // Also log to console (existing behavior)
  console.error(`[${context.system}] ${context.operation}:`, error);

  // Optional: Send to external service (Sentry, etc.)
  // sentry.captureException(error, { tags: context });
};

// Example usage (add to existing catch blocks):
// BEFORE:
catch (error) {
  console.error('Failed to create timesheet:', error);
  toast.error('Failed to create timesheet');
}

// AFTER (doesn't change behavior, just adds tracking):
catch (error) {
  trackError(error, {
    system: 'timesheets',
    operation: 'create',
    userId: user?.id,
    jobId: jobId
  });
  console.error('Failed to create timesheet:', error);
  toast.error('Failed to create timesheet');
}
```

**Risk:** 1/10 (only adds logging)
**Impact:** High (understand failures)
**Effort:** 1 day to add to all critical paths

---

## Phase 2: Low-Risk Data Integrity (Week 4-5)

**Goal:** Prevent future data issues without touching existing data

### 2.1 Add Validation Constraints (Safe Subset)

**Only add constraints that existing data already satisfies:**

```sql
-- migrations/YYYYMMDD_add_safe_validation_constraints.sql

-- Step 1: Verify no existing data violates constraints
DO $$
BEGIN
  -- Check: break_minutes is positive
  IF EXISTS (SELECT 1 FROM timesheets WHERE break_minutes < 0) THEN
    RAISE EXCEPTION 'Found negative break_minutes - cannot add constraint';
  END IF;

  -- Check: overtime is positive
  IF EXISTS (SELECT 1 FROM timesheets WHERE overtime_hours < 0) THEN
    RAISE EXCEPTION 'Found negative overtime_hours - cannot add constraint';
  END IF;

  RAISE NOTICE 'All validation checks passed - safe to add constraints';
END $$;

-- Step 2: Add constraints (only if checks passed)
ALTER TABLE timesheets
  ADD CONSTRAINT chk_break_minutes_positive
    CHECK (break_minutes >= 0 AND break_minutes <= 1440),
  ADD CONSTRAINT chk_overtime_positive
    CHECK (overtime_hours >= 0 AND overtime_hours <= 24);

-- Step 3: Add helpful constraints
ALTER TABLE job_assignments
  ADD CONSTRAINT chk_has_at_least_one_role
    CHECK (
      sound_role IS NOT NULL OR
      lights_role IS NOT NULL OR
      video_role IS NOT NULL
    );

COMMENT ON CONSTRAINT chk_break_minutes_positive ON timesheets IS
  'Prevents negative breaks (Phase 2: Safe validation)';
```

**Rollback Plan:**
```sql
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS chk_break_minutes_positive;
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS chk_overtime_positive;
ALTER TABLE job_assignments DROP CONSTRAINT IF EXISTS chk_has_at_least_one_role;
```

**Risk:** 2/10 (constraints could reject valid edge cases we didn't anticipate)
**Mitigation:** Pre-check validates no existing data affected
**Effort:** 1 day (including thorough testing)
**Go/No-Go:** Pre-check passes + tests pass ✅

---

### 2.2 Add Foreign Keys (Conservative Approach)

**Use NOT VALID for safety, validate later:**

```sql
-- migrations/YYYYMMDD_add_foreign_keys_not_valid.sql

-- Step 1: Check for orphaned data
CREATE TEMP TABLE orphaned_timesheets AS
SELECT t.id, t.job_id, t.technician_id, t.created_at
FROM timesheets t
LEFT JOIN jobs j ON t.job_id = j.id
LEFT JOIN profiles p ON t.technician_id = p.id
WHERE j.id IS NULL OR p.id IS NULL;

-- If found, export for review
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM orphaned_timesheets;

  IF orphan_count > 0 THEN
    RAISE NOTICE 'Found % orphaned timesheets - review required before proceeding', orphan_count;
    -- Export to: /tmp/orphaned_timesheets.csv
    COPY orphaned_timesheets TO '/tmp/orphaned_timesheets.csv' CSV HEADER;
    RAISE EXCEPTION 'Orphaned data found - manual review required';
  END IF;
END $$;

-- Step 2: Add constraints as NOT VALID (doesn't check existing data)
ALTER TABLE timesheets
  ADD CONSTRAINT fk_timesheets_job_id
    FOREIGN KEY (job_id) REFERENCES jobs(id)
    ON DELETE CASCADE
    NOT VALID;

ALTER TABLE timesheets
  ADD CONSTRAINT fk_timesheets_technician_id
    FOREIGN KEY (technician_id) REFERENCES profiles(id)
    ON DELETE CASCADE
    NOT VALID;

-- Step 3: Later, after validation period, validate constraints
-- (This is a separate migration after 1 week of monitoring)
-- migrations/YYYYMMDD_validate_foreign_keys.sql
-- ALTER TABLE timesheets VALIDATE CONSTRAINT fk_timesheets_job_id;
-- ALTER TABLE timesheets VALIDATE CONSTRAINT fk_timesheets_technician_id;
```

**Why NOT VALID is safe:**
- Doesn't check existing data (can't fail on deployment)
- Does prevent NEW invalid data
- Can validate later when confident
- Can drop easily if issues found

**Deployment Plan:**
1. Deploy with NOT VALID
2. Monitor for 1 week
3. If no issues, run VALIDATE CONSTRAINT
4. If issues found, drop and investigate

**Risk:** 2/10 (NOT VALID approach is very safe)
**Effort:** 2 days (including monitoring period)
**Go/No-Go:** No new orphaned data created in 1 week ✅

---

### 2.3 Add Cleanup Triggers (Non-Destructive)

**Add triggers that mark data, don't delete:**

```sql
-- migrations/YYYYMMDD_add_cleanup_triggers_safe.sql

-- Add status to staffing_requests
ALTER TABLE staffing_requests
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fulfilling_assignment_id UUID;

-- Trigger to MARK requests as fulfilled (doesn't delete)
CREATE OR REPLACE FUNCTION mark_staffing_request_fulfilled()
RETURNS TRIGGER AS $$
BEGIN
  -- Only if assignment came from staffing workflow
  IF NEW.assignment_source = 'staffing_workflow' THEN
    UPDATE staffing_requests
    SET
      status = 'fulfilled',
      fulfilled_at = now(),
      fulfilling_assignment_id = NEW.id,
      updated_at = now()
    WHERE job_id = NEW.job_id
      AND profile_id = NEW.technician_id
      AND phase = 'offer'
      AND status = 'confirmed'
      AND fulfilled_at IS NULL; -- Don't re-mark
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mark_staffing_fulfilled
  AFTER INSERT ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION mark_staffing_request_fulfilled();

-- Separate cron job to mark expired (doesn't delete)
CREATE OR REPLACE FUNCTION mark_expired_staffing_requests()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE staffing_requests
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'pending'
    AND token_expires_at < now();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- NOTE: Actual deletion is manual/optional later, after review
```

**Why safe:**
- Only marks/updates status, never deletes
- Preserved data can be analyzed later
- Can reverse by updating status back
- Deletion is separate, manual step

**Risk:** 1/10 (status updates are very safe)
**Effort:** 1 day
**Go/No-Go:** Fulfilled/expired counts match expectations ✅

---

## Phase 3: Incremental Code Improvements (Week 6-8)

**Goal:** Improve code quality without changing user-facing behavior

### 3.1 Extract Shared Logic (No UI Changes)

**Create shared utilities WITHOUT touching existing components:**

```typescript
// src/lib/assignments/conflictChecking.ts (new file)
export const checkAssignmentConflicts = async (params: ConflictParams) => {
  // Extract shared logic from all 3 locations
  // But don't remove from existing locations yet!
  // Just add as alternative for NEW code
};

// Usage in NEW code:
import { checkAssignmentConflicts } from '@/lib/assignments/conflictChecking';

// Existing components keep using old method (unchanged)
// New components use new method
// After validation period, migrate old → new incrementally
```

**Why safe:**
- Old code keeps working exactly as before
- New utility is opt-in only
- Can test new utility thoroughly before migration
- Easy rollback (just don't use it)

**Risk:** 0/10 (additive only)
**Effort:** 1 week to extract and test

---

### 3.2 Add Component Tests (For Existing Code)

**Test current behavior before refactoring:**

```typescript
// tests/components/JobAssignmentDialog.test.tsx
describe('JobAssignmentDialog (Current Behavior)', () => {
  test('Matches snapshot (visual regression)');
  test('Allows selecting technician');
  test('Shows conflict warning');
  test('Creates assignment on submit');
  test('Syncs to Flex when enabled');
  // etc - document ALL current behavior
});
```

**Why important:**
- Proves nothing broke after refactoring
- Documents expected behavior
- Catches regressions early

**Risk:** 0/10 (tests don't change code)
**Effort:** 2 weeks (comprehensive coverage)
**Go/No-Go:** 80% coverage achieved ✅

---

### 3.3 Remove Duplicate Subscriptions (Careful)

**Consolidate subscriptions incrementally:**

```typescript
// Step 1: Add centralized subscription manager (NEW, doesn't change existing)
// src/providers/RealtimeProvider.tsx
export const RealtimeProvider = ({ children }) => {
  // Central subscription management
  // Existing components can opt-in gradually
};

// Step 2: Migrate ONE component at a time
// BEFORE (in useJobAssignmentsRealtime):
const channel = supabase.channel(`job-assignments-${jobId}`).subscribe();

// AFTER (opt-in to new provider):
const { assignments } = useRealtimeContext('job_assignments', { job_id: jobId });

// Step 3: Monitor for 1 week after each migration
// Step 4: Only proceed to next component if no issues
```

**Rollback Plan:**
- Revert component to old subscription method
- Keep both methods available during transition

**Risk:** 3/10 (real-time is tricky)
**Mitigation:** One component at a time, extensive testing
**Effort:** 2 weeks (slow and careful)
**Go/No-Go:** Real-time updates still work for all users ✅

---

## Phase 4: Controlled Refactoring (Week 9-12)

**Only proceed if Phases 0-3 successful**

### 4.1 Consolidate Dialogs (Very Carefully)

**Create new base dialog alongside old ones:**

```typescript
// src/components/assignments/BaseAssignmentDialog.tsx (NEW)
export const BaseAssignmentDialog = (props) => {
  // New implementation
};

// Keep all 4 old dialogs working:
// - JobAssignmentDialog (unchanged)
// - AssignJobDialog (unchanged)
// - TourAssignmentDialog (unchanged)
// - ManageAssignmentsDialog (unchanged)

// Add feature flag:
const USE_NEW_DIALOG = process.env.VITE_USE_NEW_ASSIGNMENT_DIALOG === 'true';

// In components, use flag:
{USE_NEW_DIALOG ? (
  <BaseAssignmentDialog {...props} />
) : (
  <JobAssignmentDialog {...props} />
)}
```

**Rollout Plan:**
1. Week 1: Build new dialog, test thoroughly
2. Week 2: Enable for internal users only (feature flag)
3. Week 3: Enable for 10% of users (A/B test)
4. Week 4: Monitor metrics, gather feedback
5. Week 5: If successful, roll out to 50%
6. Week 6: If successful, roll out to 100%
7. Week 7+: Remove old dialogs only after 2 weeks at 100%

**Success Metrics:**
- Error rate same or lower
- Assignment creation time same or faster
- User feedback neutral or positive
- No data integrity issues

**Risk:** 5/10 (UI refactoring always risky)
**Mitigation:** Feature flags, gradual rollout, keep old code
**Effort:** 4 weeks (very careful)
**Go/No-Go:** Metrics improved or neutral ✅

---

## Emergency Rollback Procedures

**For every change, have instant rollback ready:**

### Database Changes
```sql
-- Keep rollback script ready
-- Example: migrations/YYYYMMDD_add_indexes_ROLLBACK.sql
DROP INDEX CONCURRENTLY IF EXISTS idx_timesheets_job_id;
-- etc...
```

### Feature Flags
```typescript
// .env.production
VITE_USE_NEW_ASSIGNMENT_DIALOG=false  # Instant rollback
```

### Deployment Process
```bash
# 1. Deploy with monitoring
npm run deploy:staging
npm run monitor:staging -- --duration 2h

# 2. If issues detected:
npm run rollback:staging  # Instant

# 3. If staging stable:
npm run deploy:production:canary -- --percentage 10
npm run monitor:production -- --duration 24h

# 4. If production canary stable:
npm run deploy:production:full
```

---

## Decision Gates

**Must pass ALL criteria before proceeding to next phase:**

### Phase 0 → Phase 1
- ✅ Monitoring dashboard live
- ✅ Tests at 80% coverage, all passing
- ✅ Data audit complete, issues documented
- ✅ Baseline metrics established

### Phase 1 → Phase 2
- ✅ Indexes deployed, queries 10x+ faster
- ✅ No errors in monitoring
- ✅ 1 week stable operation

### Phase 2 → Phase 3
- ✅ Foreign keys validated
- ✅ No orphaned data created
- ✅ Constraints don't reject valid operations
- ✅ 1 week stable operation

### Phase 3 → Phase 4
- ✅ Shared utilities tested thoroughly
- ✅ Duplicate subscriptions removed, real-time working
- ✅ Component tests all passing
- ✅ 2 weeks stable operation

### Phase 4 → Complete
- ✅ New dialogs tested by 100% of users
- ✅ Metrics same or better
- ✅ 4 weeks stable operation
- ✅ Team confident in changes

---

## Risk Mitigation Summary

| Phase | Max Risk | Mitigation Strategy |
|-------|----------|---------------------|
| Phase 0 | 0/10 | Read-only, pure observability |
| Phase 1 | 1/10 | CONCURRENTLY indexes, instant rollback |
| Phase 2 | 2/10 | NOT VALID constraints, mark not delete |
| Phase 3 | 3/10 | Additive only, one component at a time |
| Phase 4 | 5/10 | Feature flags, gradual rollout, keep old code |

**Overall Philosophy:** At any point, we can stop and still have improvements. Never bet the farm.

---

## Success Criteria (Enterprise-Grade = Never Fails, Safe)

### Reliability Metrics
- ✅ Zero data loss incidents
- ✅ 99.9%+ uptime (< 8.76 hours downtime/year)
- ✅ All operations have rollback plans
- ✅ No unrecoverable errors

### Safety Metrics
- ✅ All data changes validated before deployment
- ✅ Foreign keys prevent orphaned data
- ✅ Constraints prevent invalid data
- ✅ Tests catch regressions

### Performance (Without Sacrificing Stability)
- ✅ Queries 10x+ faster (from indexes)
- ✅ No user-facing slowdowns
- ✅ Real-time updates still work

### Code Quality (Gradual Improvement)
- ✅ Test coverage 80%+
- ✅ Monitoring catches issues proactively
- ✅ Less duplicate code (where safe to remove)

---

## Timeline Summary (Flexible)

```
Week 1-2:  Phase 0 (Foundation)
Week 3:    Phase 1 (Zero-risk DB)
Week 4-5:  Phase 2 (Data integrity)
Week 6-8:  Phase 3 (Code improvements)
Week 9-12: Phase 4 (Refactoring) - OPTIONAL
```

**Total: 8-12 weeks** depending on how aggressive we want to be with Phase 4.

**Can stop after any phase** and still have meaningful improvements.

---

## Recommended Starting Point

**I recommend we begin with Phase 0:**

1. Set up monitoring (2 days)
2. Write critical path tests (1 week)
3. Run data audit (2 days)

**This gives us:**
- Confidence in current system
- Baseline metrics
- Safety net for future changes
- Zero risk to production

**After Phase 0, we review results and decide:**
- Proceed to Phase 1? (low risk, high reward)
- Skip straight to Phase 2? (if no data issues found)
- Pause and reassess? (if issues found)

**Shall I start with Phase 0 setup?**
