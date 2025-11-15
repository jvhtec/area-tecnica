# Timesheets System - Enterprise Improvement Plan

**Generated:** 2025-11-15
**Status:** Ready for Implementation
**Estimated Effort:** 6 weeks

---

## Executive Summary

This document outlines the complete roadmap to transform the timesheets system from its current state (7/10) to enterprise-grade (9/10). Issues are prioritized by severity and business impact.

---

## Phase 1: Critical Security & Data Integrity (Sprint 1 - 2-3 days)

### 1.1 Add Authentication to Edge Function

**File:** `supabase/functions/recalc-timesheet-amount/index.ts`

**Issue:** No JWT validation or role checks

**Solution:**
```typescript
// Add after line 17
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: corsHeaders }
  );
}

const jwt = authHeader.replace('Bearer ', '');
let userId: string;
try {
  const payload = JSON.parse(atob(jwt.split('.')[1]));
  userId = payload.sub;
} catch {
  return new Response(
    JSON.stringify({ error: 'Invalid token' }),
    { status: 401, headers: corsHeaders }
  );
}

// Verify user is admin or management
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const { data: profile } = await admin
  .from('profiles')
  .select('role')
  .eq('id', userId)
  .single();

if (!profile || !['admin', 'management'].includes(profile.role)) {
  return new Response(
    JSON.stringify({ error: 'Forbidden' }),
    { status: 403, headers: corsHeaders }
  );
}
```

**Priority:** P0 - Critical
**Effort:** 1 hour

---

### 1.2 Add Foreign Key Constraints

**File:** New migration `supabase/migrations/YYYYMMDD_add_timesheet_foreign_keys.sql`

**Issue:** No referential integrity for job_id and technician_id

**Solution:**
```sql
-- Add foreign key constraints
ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS fk_timesheets_job_id,
  DROP CONSTRAINT IF EXISTS fk_timesheets_technician_id,
  ADD CONSTRAINT fk_timesheets_job_id
    FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_timesheets_technician_id
    FOREIGN KEY (technician_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add constraint for approved_by
ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS fk_timesheets_approved_by,
  ADD CONSTRAINT fk_timesheets_approved_by
    FOREIGN KEY (approved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add constraint for created_by
ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS fk_timesheets_created_by,
  ADD CONSTRAINT fk_timesheets_created_by
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT fk_timesheets_job_id ON public.timesheets IS
  'Ensures timesheet references valid job, cascade deletes orphaned timesheets';
COMMENT ON CONSTRAINT fk_timesheets_technician_id ON public.timesheets IS
  'Ensures timesheet references valid technician, cascade deletes on user removal';
```

**Priority:** P0 - Critical
**Effort:** 30 minutes

---

### 1.3 Create Missing Database Indexes

**File:** New migration `supabase/migrations/YYYYMMDD_add_timesheet_indexes.sql`

**Issue:** Poor query performance due to missing indexes

**Solution:**
```sql
-- Critical indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_timesheets_job_id
  ON public.timesheets(job_id);

CREATE INDEX IF NOT EXISTS idx_timesheets_technician_id
  ON public.timesheets(technician_id);

CREATE INDEX IF NOT EXISTS idx_timesheets_status
  ON public.timesheets(status);

CREATE INDEX IF NOT EXISTS idx_timesheets_date
  ON public.timesheets(date);

CREATE INDEX IF NOT EXISTS idx_timesheets_approved_by
  ON public.timesheets(approved_by) WHERE approved_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timesheets_created_by
  ON public.timesheets(created_by) WHERE created_by IS NOT NULL;

-- Composite index for common job + status queries
CREATE INDEX IF NOT EXISTS idx_timesheets_job_status
  ON public.timesheets(job_id, status);

-- Composite index for technician + date range queries
CREATE INDEX IF NOT EXISTS idx_timesheets_tech_date
  ON public.timesheets(technician_id, date);

-- Index for approval workflow queries
CREATE INDEX IF NOT EXISTS idx_timesheets_approval_status
  ON public.timesheets(approved_by_manager, status)
  WHERE status IN ('submitted', 'approved');

COMMENT ON INDEX idx_timesheets_job_id IS 'Optimizes job-based timesheet fetching';
COMMENT ON INDEX idx_timesheets_tech_date IS 'Optimizes technician timesheet queries by date range';

-- Analyze table to update statistics
ANALYZE public.timesheets;
```

**Priority:** P0 - Critical
**Effort:** 30 minutes

---

### 1.4 Add Time Validation Constraints

**File:** New migration `supabase/migrations/YYYYMMDD_add_timesheet_validation.sql`

**Issue:** No database-level validation for time fields

**Solution:**
```sql
-- Add CHECK constraints for data validation
ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS chk_break_minutes_positive,
  DROP CONSTRAINT IF EXISTS chk_overtime_positive,
  DROP CONSTRAINT IF EXISTS chk_valid_times,
  ADD CONSTRAINT chk_break_minutes_positive
    CHECK (break_minutes >= 0 AND break_minutes <= 1440), -- Max 24 hours
  ADD CONSTRAINT chk_overtime_positive
    CHECK (overtime_hours >= 0 AND overtime_hours <= 24),
  ADD CONSTRAINT chk_valid_times
    CHECK (
      (start_time IS NULL AND end_time IS NULL) OR
      (start_time IS NOT NULL AND end_time IS NOT NULL)
    );

-- Add constraint for signature requirement
ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS chk_signature_on_submit,
  ADD CONSTRAINT chk_signature_on_submit
    CHECK (
      status = 'draft' OR
      (status IN ('submitted', 'approved', 'rejected') AND signature_data IS NOT NULL)
    );

-- Add constraint for valid status transitions (state machine)
CREATE OR REPLACE FUNCTION validate_timesheet_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow any transition to draft (reset)
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;

  -- Validate transitions
  IF OLD.status = 'draft' AND NEW.status NOT IN ('submitted', 'draft') THEN
    RAISE EXCEPTION 'Invalid transition: draft can only move to submitted';
  END IF;

  IF OLD.status = 'submitted' AND NEW.status NOT IN ('approved', 'rejected', 'submitted', 'draft') THEN
    RAISE EXCEPTION 'Invalid transition: submitted can only move to approved, rejected, or draft';
  END IF;

  IF OLD.status = 'approved' AND NEW.status NOT IN ('submitted', 'approved') THEN
    RAISE EXCEPTION 'Invalid transition: approved can only be reverted to submitted';
  END IF;

  IF OLD.status = 'rejected' AND NEW.status NOT IN ('draft', 'submitted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid transition: rejected can only move to draft or submitted';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_status_transition ON public.timesheets;
CREATE TRIGGER trg_validate_status_transition
  BEFORE UPDATE OF status ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION validate_timesheet_status_transition();

COMMENT ON FUNCTION validate_timesheet_status_transition IS
  'Enforces valid state machine transitions for timesheet status';
```

**Priority:** P0 - Critical
**Effort:** 1 hour

---

### 1.5 Restrict CORS Configuration

**Files:** All edge functions

**Issue:** Overly permissive CORS policy

**Solution:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://area-tecnica.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};
```

**Priority:** P0 - Critical
**Effort:** 30 minutes

---

## Phase 2: Performance & Scalability (Sprint 2 - 1 week)

### 2.1 Fix N+1 Query Problem

**File:** `src/hooks/useTimesheets.ts`

**Issue:** Individual RPC calls for each timesheet

**Solution:**
Create new batched RPC function:

```sql
-- supabase/migrations/YYYYMMDD_batch_visibility_check.sql
CREATE OR REPLACE FUNCTION get_timesheets_with_visible_amounts(_timesheet_ids uuid[])
RETURNS TABLE (
  id uuid,
  amount_eur_visible numeric(10,2),
  amount_breakdown_visible jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_manager boolean := false;
  is_house_tech boolean := false;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'management')),
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'house_tech')
  INTO is_manager, is_house_tech;

  RETURN QUERY
  SELECT
    t.id,
    CASE
      WHEN is_manager THEN t.amount_eur
      WHEN is_house_tech THEN NULL
      WHEN t.approved_by_manager = true THEN t.amount_eur
      ELSE NULL
    END as amount_eur_visible,
    CASE
      WHEN is_manager THEN t.amount_breakdown
      WHEN is_house_tech THEN NULL
      WHEN t.approved_by_manager = true THEN t.amount_breakdown
      ELSE NULL
    END as amount_breakdown_visible
  FROM timesheets t
  WHERE t.id = ANY(_timesheet_ids);
END;
$$;
```

Update hook:
```typescript
// Replace lines 50-79 in useTimesheets.ts
const timesheetIds = data.map(t => t.id);
const { data: visibilityData } = await supabase.rpc(
  'get_timesheets_with_visible_amounts',
  { _timesheet_ids: timesheetIds }
);

const visibilityMap = new Map(
  visibilityData?.map(v => [v.id, v]) || []
);

const enriched = data.map((t) => {
  const visibility = visibilityMap.get(t.id);
  return {
    ...t,
    amount_eur_visible: visibility?.amount_eur_visible ?? null,
    amount_breakdown_visible: visibility?.amount_breakdown_visible ?? null,
    technician: profiles?.find(p => p.id === t.technician_id)
  } as unknown as Timesheet;
});
```

**Priority:** P1 - High
**Effort:** 2 hours

---

### 2.2 Implement Optimistic Locking

**File:** New migration `supabase/migrations/YYYYMMDD_add_version_control.sql`

**Issue:** Race conditions on concurrent modifications

**Solution:**
```sql
-- Add version column
ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create trigger to increment version
CREATE OR REPLACE FUNCTION increment_timesheet_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_version ON public.timesheets;
CREATE TRIGGER trg_increment_version
  BEFORE UPDATE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION increment_timesheet_version();

-- Create index on version for conflict detection
CREATE INDEX IF NOT EXISTS idx_timesheets_version
  ON public.timesheets(id, version);
```

Update hook:
```typescript
// Add to updateTimesheet function
const updateTimesheet = async (timesheetId: string, updates: Partial<Timesheet>, expectedVersion?: number) => {
  const query = supabase
    .from("timesheets")
    .update(updates as any)
    .eq("id", timesheetId);

  if (expectedVersion !== undefined) {
    query.eq("version", expectedVersion);
  }

  const { data, error, count } = await query
    .select()
    .single();

  if (error || count === 0) {
    toast.error("Timesheet was modified by another user. Please refresh.");
    throw new Error("Version conflict");
  }

  // ... rest of function
};
```

**Priority:** P1 - High
**Effort:** 3 hours

---

### 2.3 Add Pagination

**File:** `src/hooks/useTimesheets.ts` and `src/components/timesheet/TimesheetView.tsx`

**Issue:** Loading all timesheets at once

**Solution:**
```typescript
// Add to useTimesheets hook
const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);

const fetchTimesheets = useCallback(async () => {
  // ... existing code

  let query = supabase
    .from("timesheets")
    .select("*")
    .eq("job_id", jobId);

  if (dateRange) {
    query = query
      .gte("date", dateRange.start)
      .lte("date", dateRange.end);
  }

  const { data, error } = await query
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(100); // Limit results

  // ... rest of function
}, [jobId, dateRange]);

return {
  // ... existing returns
  setDateRange,
};
```

**Priority:** P1 - High
**Effort:** 4 hours

---

## Phase 3: Testing & Quality (Sprint 3 - 1 week)

### 3.1 Comprehensive Test Suite

**Files:** Create new test files

**Tests to implement:**

#### 3.1.1 Hook Tests
```typescript
// src/hooks/__tests__/useTimesheets.test.ts
describe('useTimesheets', () => {
  describe('fetchTimesheets', () => {
    it('should fetch timesheets for a job');
    it('should filter by technician for non-management users');
    it('should enrich with visibility data');
    it('should handle fetch errors gracefully');
  });

  describe('createTimesheet', () => {
    it('should create a new timesheet');
    it('should validate required fields');
    it('should handle duplicate creation errors');
  });

  describe('updateTimesheet', () => {
    it('should update timesheet fields');
    it('should trigger recalculation on time changes');
    it('should handle version conflicts');
  });

  describe('approveTimesheet', () => {
    it('should set approved status and metadata');
    it('should trigger amount calculation');
    it('should send notification');
    it('should prevent non-managers from approving');
  });

  describe('rejectTimesheet', () => {
    it('should set rejected status with reason');
    it('should send notification to technician');
    it('should allow re-editing after rejection');
  });

  describe('bulk operations', () => {
    it('should handle bulk updates atomically');
    it('should rollback on partial failure');
    it('should update all selected timesheets');
  });
});
```

#### 3.1.2 Component Tests
```typescript
// src/components/timesheet/__tests__/TimesheetView.test.tsx
describe('TimesheetView', () => {
  it('should render timesheets grouped by date');
  it('should show only own timesheets for technicians');
  it('should show all timesheets for management');
  it('should enable editing for draft/rejected timesheets');
  it('should disable editing for approved timesheets');
  it('should show bulk actions for management');
  it('should hide amounts for house_tech users');
  it('should show amounts after approval for technicians');
});
```

#### 3.1.3 Database Function Tests
```sql
-- supabase/tests/timesheets.test.sql
BEGIN;
SELECT plan(15);

-- Test rate calculation
SELECT is(
  (SELECT (compute_timesheet_amount_2025('test-uuid', false)->>'total_eur')::numeric),
  240.00,
  'Should calculate base rate for 8 hours'
);

-- Test visibility function
-- Test status transition validation
-- Test category derivation

SELECT * FROM finish();
ROLLBACK;
```

#### 3.1.4 Edge Function Tests
```typescript
// supabase/functions/recalc-timesheet-amount/test.ts
Deno.test('should require authentication', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ timesheet_id: 'test' })
  });

  const res = await handler(req);
  assertEquals(res.status, 401);
});

Deno.test('should require management role', async () => {
  // ... test with technician JWT
});

Deno.test('should calculate timesheet amount', async () => {
  // ... test with valid admin JWT
});
```

**Priority:** P1 - High
**Effort:** 1 week
**Target Coverage:** 80%+

---

## Phase 4: Error Handling & Monitoring (Sprint 4 - 3 days)

### 4.1 Structured Error Handling

**File:** Create `src/lib/errors.ts`

```typescript
export class TimesheetError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'TimesheetError';
  }
}

export const TimesheetErrorCodes = {
  FETCH_FAILED: 'FETCH_FAILED',
  CREATE_FAILED: 'CREATE_FAILED',
  UPDATE_FAILED: 'UPDATE_FAILED',
  DELETE_FAILED: 'DELETE_FAILED',
  APPROVAL_FAILED: 'APPROVAL_FAILED',
  CALCULATION_FAILED: 'CALCULATION_FAILED',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
} as const;

export function handleTimesheetError(error: unknown, context?: Record<string, any>) {
  if (error instanceof TimesheetError) {
    console.error(`[${error.code}]`, error.message, context);
    toast.error(error.userMessage);
    // Send to error tracking service
    captureException(error, { context });
  } else if (error instanceof Error) {
    console.error('Unexpected error:', error);
    toast.error('An unexpected error occurred. Please try again.');
    captureException(error, { context });
  }
}
```

**Priority:** P2 - Medium
**Effort:** 4 hours

---

### 4.2 Add Monitoring

**File:** Create `src/lib/analytics.ts`

```typescript
export const trackTimesheetEvent = (
  event: 'create' | 'update' | 'submit' | 'approve' | 'reject' | 'delete',
  properties?: Record<string, any>
) => {
  // PostHog, Mixpanel, or custom analytics
  analytics.track(`timesheet_${event}`, {
    timestamp: new Date().toISOString(),
    ...properties,
  });
};

export const trackTimesheetError = (
  errorCode: string,
  context?: Record<string, any>
) => {
  analytics.track('timesheet_error', {
    error_code: errorCode,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

export const trackTimesheetPerformance = (
  operation: string,
  duration: number,
  success: boolean
) => {
  analytics.track('timesheet_performance', {
    operation,
    duration_ms: duration,
    success,
    timestamp: new Date().toISOString(),
  });
};
```

**Priority:** P2 - Medium
**Effort:** 2 hours

---

## Phase 5: Code Quality & Refactoring (Sprint 5-6 - 2 weeks)

### 5.1 Split TimesheetView Component

**Current:** 939 lines, does everything

**Refactor into:**
- `TimesheetView.tsx` - Container (100 lines)
- `TimesheetList.tsx` - List rendering (150 lines)
- `TimesheetCard.tsx` - Individual timesheet (200 lines)
- `TimesheetEditForm.tsx` - Edit form (150 lines)
- `TimesheetBulkActions.tsx` - Bulk operations (100 lines)
- `TimesheetFilters.tsx` - Filtering UI (100 lines)

**Priority:** P2 - Medium
**Effort:** 1 week

---

### 5.2 Refactor useTimesheets Hook

**Current:** Single hook with 547 lines, 15+ responsibilities

**Refactor into:**
- `useTimesheetsFetch.ts` - Data fetching
- `useTimesheetsMutations.ts` - CRUD operations
- `useTimesheetsApproval.ts` - Approval workflow
- `useTimesheetsBulk.ts` - Bulk operations
- `useTimesheetsVisibility.ts` - Visibility logic

**Priority:** P2 - Medium
**Effort:** 1 week

---

### 5.3 Add Comprehensive Audit Logging

**File:** New migration `supabase/migrations/YYYYMMDD_audit_logging.sql`

```sql
-- Create audit log table
CREATE TABLE IF NOT EXISTS public.timesheet_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_timesheet ON public.timesheet_audit_log(timesheet_id);
CREATE INDEX idx_audit_user ON public.timesheet_audit_log(user_id);
CREATE INDEX idx_audit_created ON public.timesheet_audit_log(created_at);

-- Create audit trigger
CREATE OR REPLACE FUNCTION log_timesheet_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.timesheet_audit_log (
    timesheet_id,
    user_id,
    action,
    old_values,
    new_values
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_timesheets
  AFTER INSERT OR UPDATE OR DELETE ON public.timesheets
  FOR EACH ROW
  EXECUTE FUNCTION log_timesheet_changes();
```

**Priority:** P2 - Medium
**Effort:** 4 hours

---

## Phase 6: Enterprise Features (Backlog)

### 6.1 Multi-Stage Approval Workflows
- Configure approval chains
- Parallel vs sequential approvals
- Escalation rules

**Effort:** 2 weeks

### 6.2 Advanced Reporting
- Custom report builder
- Scheduled exports
- Dashboard with charts

**Effort:** 2 weeks

### 6.3 Bulk Import
- CSV/Excel import
- Validation and preview
- Error handling

**Effort:** 1 week

### 6.4 Mobile Optimization
- Responsive design improvements
- Touch-friendly UI
- Offline support

**Effort:** 2 weeks

---

## Success Metrics

### Performance
- [ ] Job timesheet load time < 500ms (95th percentile)
- [ ] Approval action response < 200ms
- [ ] Bulk operations complete < 2s for 50 items

### Quality
- [ ] Test coverage > 80%
- [ ] Zero critical security vulnerabilities
- [ ] Error rate < 0.1%

### User Experience
- [ ] System usability score > 80
- [ ] Average time to approve timesheet < 30s
- [ ] Support tickets related to timesheets < 5/month

---

## Rollback Plan

Each phase should include:
1. Database migration rollback scripts
2. Feature flags for gradual rollout
3. Monitoring dashboards to detect issues
4. Communication plan for users

---

## Risk Mitigation

### High-Risk Changes
1. Foreign key constraints - Test on staging with production data copy
2. Status transition validation - May break existing workflows
3. Version control - Requires client-side changes

### Testing Strategy
1. Unit tests for all new code
2. Integration tests for critical paths
3. Load testing with 10x expected data volume
4. User acceptance testing with key stakeholders

---

## Maintenance Plan

### Daily
- Monitor error rates and performance metrics
- Review audit logs for anomalies

### Weekly
- Review and triage new issues
- Update documentation

### Monthly
- Security audit
- Performance optimization review
- Backup and disaster recovery test

---

## Questions for Stakeholders

1. What is acceptable downtime for migrations?
2. Are there specific compliance requirements (SOC2, ISO27001)?
3. What is the maximum acceptable timesheet approval time?
4. How long should audit logs be retained?
5. Are there plans for multi-currency or multi-region support?

---

**Document Version:** 1.0
**Last Updated:** 2025-11-15
**Owner:** Engineering Team
**Approved By:** [Pending]
