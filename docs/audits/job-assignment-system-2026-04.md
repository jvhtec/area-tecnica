# Job Assignment System Audit (Deep Dive)

- **System:** Area Tecnica job assignment subsystem
- **Audit date:** 2026-04-16
- **Scope:** Database schema/triggers/RPC, staffing edge functions, Flex/email integrations, assignment matrix hooks/components, realtime/state coordination, tests
- **Method:** Static audit only (no code changes)

---

## 1. Executive Summary

The job assignment subsystem is a highly-coupled chain across `job_assignments`, `timesheets`, staffing links, matrix workflows, and third-party sync. The architecture uses both direct table CRUD and lifecycle RPC patterns at the same time, which introduces policy bypass opportunities, race windows, and non-atomic side-effects. The largest systemic risk is a **critical authorization gap**: authenticated users can currently CRUD `job_assignments` without role-based restrictions, and anonymous users can select those rows for realtime. The second major risk class is **consistency drift**: assignment creation/removal happens through multiple paths (RPC, direct SQL, edge functions), each with different transactional guarantees and rollback behavior. This is aggravated by duplicate delete triggers and fire-and-forget integration calls.

### Top 5 Critical/High Findings

1. **CRITICAL — Wide-open `job_assignments` RLS for authenticated CRUD** (`USING/WITH CHECK (true)`). (supabase/migrations/00000000000000_production_schema.sql:9031-9034)
2. **CRITICAL — Anonymous select policy on `job_assignments`** enables unauthenticated table visibility for realtime streams. (supabase/migrations/00000000000000_production_schema.sql:8958)
3. **HIGH — Duplicate timesheet-delete trigger wiring** executes the same delete function on both `BEFORE DELETE` and `AFTER DELETE` for `job_assignments`, causing duplicate side-effects and noisy failure paths. (supabase/migrations/00000000000000_production_schema.sql:8280-8283)
4. **HIGH — Staffing confirm path bypasses `manage_assignment_lifecycle`** and writes directly to `job_assignments`/`timesheets`, reducing consistency with lock/audit semantics implemented in RPC. (supabase/functions/staffing-click/index.ts:429-557, supabase/migrations/00000000000000_production_schema.sql:2770-2979)
5. **HIGH — Matrix assignment flow is non-atomic across assignment row, timesheet toggles, and Flex sync**; partial failures can leave divergent DB + external state. (src/components/matrix/AssignJobDialog.tsx:320-609)

### Severity-ranked Risk Register (Condensed)

| Severity | Area | Finding | Effort to Fix |
|---|---|---|---|
| Critical | Permissions | Authenticated users can insert/update/delete any `job_assignments` row (`true` policies). | M |
| Critical | Permissions | Anonymous policy allows `SELECT` on `job_assignments` for realtime. | S-M |
| High | DB triggers | `delete_timesheets_on_assignment_removal` bound to both BEFORE and AFTER delete. | S |
| High | Staffing flow | `staffing-click` does direct upsert/delete behavior outside lifecycle RPC. | M-L |
| High | UI/Transactions | Assign dialog sequence is non-atomic; DB and Flex can diverge. | M-L |
| High | Concurrency | Check-then-act in dialog before DB lock path; lock protection not consistently used. | M |
| Medium | Policy behavior | `soft_conflict_policy` is modeled/escalated but not actually enforced in tick assignment execution path. | M |
| Medium | Realtime | Duplicate/overlapping subscriptions and query-key invalidation fan-out increase race/churn. | S-M |
| Medium | Notifications | Assignment events catalog exists, but some flows rely on `window.dispatchEvent` local escape hatch. | M |
| Medium | Integrations | Flex sync called from UI and staffing as best-effort; limited retry and rollback strategy. | M-L |
| Medium | Testing | Minimal unit coverage for realtime hook and no explicit negative RLS tests in audited set. | M |

---

## 2. System Overview & Data Flow

### 2.1 End-to-end staffing assignment path

```text
staffing_campaign
  -> staffing_request(s) [phase=availability/offer]
    -> email/WhatsApp link
      -> staffing-click edge function
        -> (current) direct update staffing_requests + direct upsert job_assignments + direct upsert timesheets
        -> (expected) manage_assignment_lifecycle RPC bridge (not primary path today)
          -> job_assignments row
            -> trigger create_timesheets_for_assignment (legacy path)
            -> trigger activity logs
```

Evidence:
- staffing request click processing and status mutation. (supabase/functions/staffing-click/index.ts:63-213)
- direct assignment upsert in click handler. (supabase/functions/staffing-click/index.ts:429-457)
- direct timesheet upsert in click handler. (supabase/functions/staffing-click/index.ts:473-563)
- lifecycle RPC exists with lock/audit semantics. (supabase/migrations/00000000000000_production_schema.sql:2770-2979)

### 2.2 Tour cascade path

```text
tour_assignments
  -> trigger sync_tour_assignments_to_jobs
    -> job_assignments (per job in tour)
      -> trigger create_timesheets_for_assignment
        -> timesheets
```

Evidence:
- tour sync function definitions. (supabase/migrations/00000000000000_production_schema.sql:4046-4253)
- trigger wiring. (supabase/migrations/00000000000000_production_schema.sql:8258-8260)
- timesheet create trigger function. (supabase/migrations/00000000000000_production_schema.sql:1551-1615)

### 2.3 Matrix AssignJobDialog (current non-atomic flow)

```text
AssignJobDialog
  -> conflict pre-check (RPC check_technician_conflicts)
  -> upsert/update job_assignments row (direct table write)
  -> toggle/delete/create timesheets per selected dates
  -> sync timesheet categories
  -> call manage-flex-crew-assignments (sound/lights)
  -> local window event dispatch 'assignment-updated'
```

Evidence:
- conflict pre-check call. (src/components/matrix/AssignJobDialog.tsx:178-249)
- direct assignment row write. (src/components/matrix/AssignJobDialog.tsx:320-387)
- timesheet mutation loop. (src/components/matrix/AssignJobDialog.tsx:438-547)
- Flex sync best-effort. (src/components/matrix/AssignJobDialog.tsx:575-609)
- custom event escape hatch. (src/components/matrix/AssignJobDialog.tsx:635-637)

### 2.4 Glossary

- **invited / confirmed / declined:** assignment lifecycle statuses used across `job_assignments` and staffing behaviors. (supabase/migrations/00000000000000_production_schema.sql:5935,6759-6761)
- **assignment_source:** `direct|tour|staffing` source tag. (supabase/migrations/00000000000000_production_schema.sql:5937,5944)
- **single-day vs full-job:** legacy assignment fields (`single_day`, `assignment_date`) versus per-day `timesheets` as source of truth. (supabase/migrations/00000000000000_production_schema.sql:5949-5950,6764-6799)
- **soft delete vs hard delete:** lifecycle RPC supports `p_delete_mode` soft/hard; timesheets also have `is_active` soft-delete semantics. (supabase/migrations/00000000000000_production_schema.sql:2805-2811,6794,6807)

---

## 3. Data Layer (Database)

### 3.1 `job_assignments`

#### Schema
- Core columns: job, technician, role columns, status, source, legacy day flags, uuid id. (supabase/migrations/00000000000000_production_schema.sql:5927-5944)
- Assignment source check allows only `direct/tour/staffing`. (supabase/migrations/00000000000000_production_schema.sql:5944)
- Legacy deprecation comments on `single_day` / `assignment_date`. (supabase/migrations/00000000000000_production_schema.sql:5949-5950)
- `REPLICA IDENTITY FULL` enabled (larger realtime payloads, clearer diff semantics). (supabase/migrations/00000000000000_production_schema.sql:5946)

#### Indexes
- Core indexes include job, tech, status, composite and date index. (supabase/migrations/00000000000000_production_schema.sql:8012-8019,8196)

#### RLS & access
- RLS enabled. (supabase/migrations/00000000000000_production_schema.sql:9030)
- Authenticated CRUD is unconditional `true` for select/insert/update/delete (**critical**). (supabase/migrations/00000000000000_production_schema.sql:9031-9034)
- Anonymous select policy exists for realtime use-cases. (supabase/migrations/00000000000000_production_schema.sql:8958)

#### Findings
- **CRITICAL:** No role/ownership boundaries for authenticated writes.
- **CRITICAL:** Anonymous visibility may exceed intended wallboard scope unless additional downstream filtering is guaranteed.

---

### 3.2 `tour_assignments`

#### Schema
- Supports either internal technician or external tech name with XOR-style check. (supabase/migrations/00000000000000_production_schema.sql:6939-6953)
- Replica identity full enabled. (supabase/migrations/00000000000000_production_schema.sql:6953)

#### RLS
- Policies are role-gated to admin/management (plus technician self-read). (supabase/migrations/00000000000000_production_schema.sql:9429-9432)

#### Trigger interplay
- Insert syncs to jobs, delete has cascade + cleanup triggers. (supabase/migrations/00000000000000_production_schema.sql:8258-8260)

#### Findings
- `tour_assignments` shows stricter access posture than `job_assignments`, creating a policy inconsistency across assignment domains.

---

### 3.3 `timesheets`

#### Schema highlights
- Per-day source-of-truth rows (`job_id`, `technician_id`, `date`) with lifecycle/status fields. (supabase/migrations/00000000000000_production_schema.sql:6764-6799)
- `version` supports optimistic concurrency style patterns. (supabase/migrations/00000000000000_production_schema.sql:6791)
- `is_active` soft-delete semantics with explicit comment guidance. (supabase/migrations/00000000000000_production_schema.sql:6794,6807)

#### Trigger behavior
- Version increment trigger exists. (supabase/migrations/00000000000000_production_schema.sql:8270)
- Category/status enforcement triggers also present. (supabase/migrations/00000000000000_production_schema.sql:8265,8278)

#### Findings
- `timesheets` has stronger data semantics than assignment legacy fields; however, many app paths still write assignment first then timesheet, creating transient inconsistency windows.

---

### 3.4 `assignment_audit_log`

- Stores assignment action transitions with `metadata` and deleted timesheet count. (supabase/migrations/00000000000000_production_schema.sql:5164-5176)
- Designed as compliance/debug trail by comment. (supabase/migrations/00000000000000_production_schema.sql:5178)

**Finding:** Good structural foundation, but not every assignment mutation path routes through RPCs that guarantee audit insertion.

---

### 3.5 `assignment_notifications`

- Minimal in-app message structure (`job_id`, `technician_id`, text, read flag). (supabase/migrations/00000000000000_production_schema.sql:5179-5186)

**Finding:** Table exists but observed runtime flows rely heavily on push/activity and toasts; usage consistency should be validated.

---

### 3.6 `staffing_requests`

- Table uses status phase fields plus token hash/expiry and idempotency support in edge functions. (supabase/functions/send-staffing-email/index.ts:178-209,497-714)
- Replica identity full enabled in schema. (supabase/migrations/00000000000000_production_schema.sql:6705)

**Finding:** Strong idempotency and token controls exist in send/click flow, but assignment creation bridge is direct-write (not lifecycle RPC).

---

### 3.7 `timesheet_audit_log`

- Captures old/new values and actor fields. (supabase/migrations/00000000000000_production_schema.sql:6895-6905)

**Finding:** Data exists for audit, but assignment-level removals through duplicate triggers can complicate event interpretation.

---

### 3.8 View `system_health_assignments`

- Aggregates assignment counts, active jobs/techs, 24h creation, missing assignment date, status buckets. (supabase/migrations/00000000000000_production_schema.sql:6753-6762)

**Finding:** Useful macro monitor but does not directly surface RLS exposure, trigger duplication, or cross-system divergence indicators.

---

## 4. RPC Functions & Triggers

### 4.1 `manage_assignment_lifecycle` (2770-2979)

**Purpose**
- Centralized assignment confirm/decline/cancel with authorization checks, row locking, conflict checks, and audit writes.

**Key mechanics**
- Validates caller/action/delete mode. (supabase/migrations/00000000000000_production_schema.sql:2788-2839)
- Uses `FOR UPDATE NOWAIT` lock on assignment row. (supabase/migrations/00000000000000_production_schema.sql:2842-2856)
- Writes to `assignment_audit_log` for transitions/deletions. (supabase/migrations/00000000000000_production_schema.sql:2895-2926)

**Failure modes**
- Lock contention returns controlled failure (`assignment_locked`).
- Conflict detection checks timesheet overlap; if other paths create timesheets outside this RPC, behavior may differ from UI expectations.

**Audit note**
- This function is robust, but many assignment writes do not call it.

---

### 4.2 `create_timesheets_for_assignment` (1551-1615)

**Purpose**
- Triggered timesheet auto-creation on assignment insert.

**Key mechanics**
- Skips `dryhire` and `tourdate`. (supabase/migrations/00000000000000_production_schema.sql:1567-1569)
- Single-day path uses `assignment_date`; otherwise full date-span loop.
- Uses `ON CONFLICT DO NOTHING` for idempotence. (supabase/migrations/00000000000000_production_schema.sql:1586,1606)

**Failure modes**
- Depends on assignment row data and job span; inconsistent assignment field usage can create unexpected date coverage.

---

### 4.3 `delete_timesheets_on_assignment_removal` (1687-1717)

**Purpose**
- Trigger function deleting timesheets for assignment pair.

**Key mechanics**
- Deletes by `(job_id, technician_id)`. (supabase/migrations/00000000000000_production_schema.sql:1694-1698)
- Raises exception on any failure. (supabase/migrations/00000000000000_production_schema.sql:1710-1713)

**Critical bug**
- Bound to both `AFTER DELETE` and `BEFORE DELETE` triggers, so function runs twice. (supabase/migrations/00000000000000_production_schema.sql:8280-8283)

**Failure modes**
- Double execution can raise redundant logs/errors and complicate root-cause analysis for deletion failures.

---

### 4.4 `sync_tour_assignments_to_jobs` (4157+)

- Syncs tour assignments to job assignments and timesheets. (supabase/migrations/00000000000000_production_schema.sql:4157-4253)
- Triggered `AFTER INSERT` on `tour_assignments`. (supabase/migrations/00000000000000_production_schema.sql:8260)

**Failure modes:** multi-entity cascade complexity can amplify partial failures during high churn.

---

### 4.5 `sync_existing_tour_assignments_to_new_job` (4046+)

- Adds tour assignment coverage to newly inserted jobs. (supabase/migrations/00000000000000_production_schema.sql:4046-4117)
- Wired on job insert trigger. (supabase/migrations/00000000000000_production_schema.sql:8227)

---

### 4.6 `sync_preset_assignments_for_tour` (4118+)

- Preset-to-tour sync helper for assignment propagation. (supabase/migrations/00000000000000_production_schema.sql:4118-4156)

---

### 4.7 `cascade_delete_tour_assignment` (797+) and `cleanup_tour_assignments_from_jobs` (970+)

- `BEFORE DELETE` + `AFTER DELETE` duo for tour assignment cleanup. (supabase/migrations/00000000000000_production_schema.sql:797-994,8258-8259)

**Failure modes:** ordering between before/after cleanup can hide failures unless logged with correlation IDs.

---

### 4.8 Assignment activity triggers (`trg_log_assignment_insert/update/delete`)

- Trigger functions defined for insert/update/delete activity rows. (supabase/migrations/00000000000000_production_schema.sql:4453-4502)
- Bound to `job_assignments` changes. (supabase/migrations/00000000000000_production_schema.sql:8242,8245,8251)

**Finding:** Strong DB-level logging baseline; UI local events should align with this source-of-truth.

---

### 4.9 Diagnostics helpers

- `find_declined_with_active_timesheets`. (supabase/migrations/00000000000000_production_schema.sql:1793-1813)
- `find_double_bookings`. (supabase/migrations/00000000000000_production_schema.sql:1814-1833)

**Finding:** Good anomaly detection primitives; should be scheduled and surfaced in ops dashboards.

---

## 5. Edge Functions

### 5.1 `staffing-orchestrator`

- Campaign policy model includes weights and `soft_conflict_policy`. (supabase/functions/staffing-orchestrator/index.ts:14-30)
- Tick loop mainly recomputes counts/stages and schedules next run. (supabase/functions/staffing-orchestrator/index.ts:624-730)
- Escalation can mutate policy to `allow_soft_conflicts`. (supabase/functions/staffing-orchestrator/index.ts:772-794)

**Finding:** `soft_conflict_policy` is represented and escalated, but no direct enforcement path is evident in tick execution; policy may be mostly declarative in this function.

---

### 5.2 `staffing-click`

- Validates signed link/token and updates staffing request status. (supabase/functions/staffing-click/index.ts:52-177,186-213)
- On offer confirmation, performs direct assignment upsert + direct timesheet upsert. (supabase/functions/staffing-click/index.ts:294-557)
- Calls Flex add as best-effort, non-blocking behavior around failures. (supabase/functions/staffing-click/index.ts:579-594)

**Gap:** No direct call to `manage_assignment_lifecycle` in the main confirm path.

---

### 5.3 `staffing-sweeper`

- Cron-oriented service-role POST endpoint; fetches campaigns to tick and invokes orchestrator `action=tick`. (supabase/functions/staffing-sweeper/index.ts:26-71,131-153)
- Tick interval defaults to policy value (often 300s/5m from orchestrator logic). (supabase/functions/staffing-orchestrator/index.ts:701-703)

---

### 5.4 `notify-staffing-cancellation`

- Resolves original channel, sends cancellation via WhatsApp or Brevo email, logs staffing event. (supabase/functions/notify-staffing-cancellation/index.ts:63-76,119-169,170-258)

---

### 5.5 `send-staffing-email`

- Includes idempotency key checks for 24h replay protection. (supabase/functions/send-staffing-email/index.ts:178-209)
- Enforces daily cap from staffing events. (supabase/functions/send-staffing-email/index.ts:239-268)
- Conflict check is warning-mode for job conflicts but hard-block for exact date timesheet collisions. (supabase/functions/send-staffing-email/index.ts:367-427,430-490)
- Brevo integration used for email channel. (supabase/functions/send-staffing-email/index.ts:1128-1172)

---

### 5.6 `sync-flex-crew-for-job`

- Batch reconciliation between desired assignments and Flex state with multiple fallback discovery endpoints. (supabase/functions/sync-flex-crew-for-job/index.ts:117-260,296-355)

**Finding:** Powerful reconciliation but operationally complex; error handling favors completion over strict transactionality.

---

### 5.7 `manage-flex-crew-assignments`

- Single add/remove API with fallback clear-and-repopulate remove strategy when line item is unknown. (supabase/functions/manage-flex-crew-assignments/index.ts:237-260,393-601)
- Emits 500 on divergence-protection failures (good), but call sites often suppress/ignore failures.

---

### 5.8 `auto-send-timesheet-reminders`

- Auth-gates service_role/management and paginates large candidate sets. (supabase/functions/auto-send-timesheet-reminders/index.ts:57-83,121-158)
- Uses per-department settings and age guardrails. (supabase/functions/auto-send-timesheet-reminders/index.ts:85-119,191-213)

---

## 6. Frontend Hooks

### 6.1 `useJobAssignmentsRealtime.ts` (44-447)

- Merges active `timesheets` with `job_assignments` metadata for display model. (src/hooks/useJobAssignmentsRealtime.ts:50-190)
- Establishes realtime subscription for both tables. (src/hooks/useJobAssignmentsRealtime.ts:212-249)
- Performs optimistic updates and direct table writes for add/remove actions. (src/hooks/useJobAssignmentsRealtime.ts:277-417)

**Finding:** Mixed source model is pragmatic but risks partial visibility (timesheet present without assignment metadata, and vice versa).

---

### 6.2 `useTourAssignments.ts`

- CRUD with invalidate-on-success; no optimistic rollback pattern. (src/hooks/useTourAssignments.ts:49-116)

**Finding:** Assumes cascade/trigger consistency; failures in tour sync may surface late.

---

### 6.3 `useFlexCrewAssignments.ts`

- Wrapper around edge invoke with local toast handling. (src/hooks/useFlexCrewAssignments.ts:9-66)

**Finding:** Returns boolean but upstream callers sometimes treat errors as non-blocking; no shared retry queue.

---

### 6.4 Optimistic mutation pattern reference

- `onMutate/onError` rollback pattern exists elsewhere as stronger baseline approach in codebase (`useEntityQueries`). (src/hooks/useEntityQueries.ts:73-107)

---

### 6.5 Query key inventory / duplication

- Matrix invalidates `optimized-matrix-assignments`, `matrix-assignments`, and `job-assignments` together. (src/hooks/useOptimizedMatrixData.ts:510-513)
- Additional invalidations of `optimized-jobs` and `jobs` increase fan-out. (src/hooks/useOptimizedMatrixData.ts:513-515)

**Finding:** Three assignment query families suggest historical layering; consolidation would reduce cache churn.

---

## 7. UI Components

### 7.1 Job dialogs in scope

- `JobAssignmentDialog`. (src/components/jobs/JobAssignmentDialog.tsx:1)
- `JobAssignments`. (src/components/jobs/JobAssignments.tsx:1)
- `CreateJobDialog`. (src/components/jobs/CreateJobDialog.tsx:1)
- `GlobalCreateJobDialog`. (src/components/jobs/GlobalCreateJobDialog.tsx:1)
- `JobDetailsDialog`. (src/components/jobs/JobDetailsDialog.tsx:1)

### 7.2 Matrix components in scope

- `AssignmentMatrix` (legacy). (src/components/matrix/AssignmentMatrix.tsx:1)
- `OptimizedAssignmentMatrix` (current path). (src/components/matrix/OptimizedAssignmentMatrix.tsx:1)
- `AssignJobDialog`, `AssignmentStatusDialog`, `MarkUnavailableDialog`. (src/components/matrix/AssignJobDialog.tsx:1, src/components/matrix/AssignmentStatusDialog.tsx:1, src/components/matrix/MarkUnavailableDialog.tsx:1)

### 7.3 Tour dialog

- `TourAssignmentDialog`. (src/components/tours/TourAssignmentDialog.tsx:1)

### 7.4 Duplicate realtime subscription observation

- `useJobAssignmentsRealtime` subscribes to `timesheets` and `job_assignments`. (src/hooks/useJobAssignmentsRealtime.ts:212-249)
- `JobAssignments.tsx` adds another `job_assignments` subscription for same job. (src/components/jobs/JobAssignments.tsx:26-56)

**Finding:** Duplicate subscriptions can trigger redundant invalidations and refresh storms.

---

## 8. State & Realtime

### 8.1 Zustand stores

- `useSelectedJobStore` tracks selected job and emits custom window events. (src/stores/useSelectedJobStore.ts:35-79)
- `useSelectedCellStore` tracks focused/multi-selected matrix cell state. (src/stores/useSelectedCellStore.ts:43-113)
- `useCreateJobDialogStore` opens global create dialog and emits open event. (src/stores/useCreateJobDialogStore.ts:26-54)

### 8.2 Subscription patterns

- Matrix subscribes to `job_assignments` and `timesheets`. (src/hooks/useOptimizedMatrixData.ts:519-573)
- Availability subscriptions cover `availability_schedules`, `technician_availability`, `vacation_requests`. (src/hooks/useOptimizedMatrixData.ts:397-423)

### 8.3 Multi-tab coordinator

- BroadcastChannel-based leader/follower model with lock/localStorage fallback. (src/lib/multitab-coordinator.ts:20-47,116-179)
- Handles cross-tab invalidation/cache update messages. (src/lib/multitab-coordinator.ts:67-113)

### 8.4 Gaps

- No explicit `tour_assignments` subscription in matrix data hook (assignment realtime is job/timesheet centric).
- Availability subscriptions exist in matrix hook, but other assignment views may not share identical coverage.

---

## 9. Business Logic

### 9.1 Status transitions

- Status enum exists in DB usage; lifecycle controls are RPC-specific and not globally enforced when writing table directly. (supabase/migrations/00000000000000_production_schema.sql:5935,2770-2979)

### 9.2 Conflict detection

- Frontend conflict checks via `check_technician_conflicts` RPC wrapper (`checkTimeConflictEnhanced`). (src/utils/technicianAvailability.ts:360-399)

### 9.3 Race window

- Assign dialog performs conflict check and then later writes assignment row directly; lifecycle lock (`FOR UPDATE NOWAIT`) is not used in this path. (src/components/matrix/AssignJobDialog.tsx:178-387, supabase/migrations/00000000000000_production_schema.sql:2842-2856)

### 9.4 Cascade semantics and failure modes

- Tour and assignment triggers create/delete downstream rows, but direct UI deletions may also delete timesheets manually before deleting assignment, duplicating concerns. (src/hooks/useJobAssignmentsRealtime.ts:377-395, supabase/migrations/00000000000000_production_schema.sql:1687-1717,8280-8283)

---

## 10. Integrations

### 10.1 Flex Rental Solutions

- Sync points:
  - Direct assignment dialog add/remove. (src/components/matrix/AssignJobDialog.tsx:575-609,679-699)
  - Job-level sync button via `sync-flex-crew-for-job`. (src/components/jobs/JobAssignments.tsx:85-122)
  - Staffing-click auto add on confirm. (supabase/functions/staffing-click/index.ts:579-590)
- Failure patterns:
  - Many paths are best-effort and non-blocking, allowing DB success with external failure.
  - `manage-flex-crew-assignments` has defensive aborts in clear-and-repopulate path, but callers may not surface remediation context. (supabase/functions/manage-flex-crew-assignments/index.ts:453-463)

### 10.2 WhatsApp

- Staffing offer/cancel flows support WhatsApp transport. (supabase/functions/send-staffing-email/index.ts:1124-1127, supabase/functions/notify-staffing-cancellation/index.ts:119-169)
- Assignment-removal flows in matrix/job hooks do not show explicit WhatsApp group membership synchronization calls.

### 10.3 Brevo email

- Daily caps and idempotency in staffing send pipeline. (supabase/functions/send-staffing-email/index.ts:178-209,239-268)
- Cancellation notices also routed via Brevo when channel=email. (supabase/functions/notify-staffing-cancellation/index.ts:170-258)

---

## 11. Notifications & Activity

### 11.1 Activity event wiring

- DB triggers log assignment insert/update/delete activity. (supabase/migrations/00000000000000_production_schema.sql:4453-4502,8242,8245,8251)
- Staffing flows write explicit staffing events + `log_activity_as` calls. (supabase/functions/staffing-click/index.ts:239-269)

### 11.2 Inconsistent UI pathways

- `AssignJobDialog` emits `window.dispatchEvent('assignment-updated')` local event as integration mechanism. (src/components/matrix/AssignJobDialog.tsx:635-637)

**Finding:** Local events are not durable/auditable compared with DB/activity-log based notifications.

### 11.3 In-app `assignment_notifications`

- Table exists structurally but no dominant usage path observed in inspected frontend files. (supabase/migrations/00000000000000_production_schema.sql:5179-5186)

---

## 12. Permissions & RLS

### 12.1 Critical: `job_assignments` open policies

- All authenticated CRUD policies are `true`. (supabase/migrations/00000000000000_production_schema.sql:9031-9034)

### 12.2 Contrast with `tour_assignments`

- Tour assignment policies are scoped to admin/management (+ technician self-read). (supabase/migrations/00000000000000_production_schema.sql:9429-9432)

### 12.3 Anonymous realtime select

- Anonymous select policy on `job_assignments`. (supabase/migrations/00000000000000_production_schema.sql:8958)

### 12.4 Frontend role-guard posture

- UI checks are sparse/route-local (e.g., some button disables), but primary enforcement is expected at RLS layer.
- Given open RLS on core table, frontend assumptions are currently unsafe.

---

## 13. Test Coverage

### 13.1 Existing assignment-centric tests

- `tests/assignments/critical-paths.test.ts` (458 lines). (tests/assignments/critical-paths.test.ts:1)
- `src/hooks/__tests__/useJobAssignmentsRealtime.test.ts` (61 lines; focused on payload builder). (src/hooks/__tests__/useJobAssignmentsRealtime.test.ts:1-61)

### 13.2 Gaps (observed)

- No explicit negative RLS policy tests for `job_assignments` vs role matrix in inspected suite.
- No targeted tests for duplicate delete-trigger behavior.
- No end-to-end test proving staffing-click uses lifecycle RPC semantics (it currently appears direct-write).
- Limited failure-mode tests for Flex divergence or WhatsApp membership synchronization on technician removal paths.

---

## 14. Risk Register (Detailed)

### CRITICAL

1. **Open authenticated CRUD on `job_assignments`**
   - **Impact:** Unauthorized assignment creation/deletion/status changes by any authenticated principal.
   - **Likelihood:** High (policy is unconditional).
   - **Evidence:** (supabase/migrations/00000000000000_production_schema.sql:9031-9034)
   - **Remediation sketch:** Replace with role- and ownership-scoped policies; add explicit negative tests by role.

2. **Anonymous select on `job_assignments`**
   - **Impact:** Data visibility beyond intended internal audience if tokens/channels are exposed.
   - **Likelihood:** Medium-high.
   - **Evidence:** (supabase/migrations/00000000000000_production_schema.sql:8958)
   - **Remediation sketch:** Narrow to a dedicated sanitized publication path or constrained view.

### HIGH

3. **Duplicate delete trigger execution**
   - **Impact:** Double invocation, noisy failures, harder debugging, potential side-effect duplication.
   - **Evidence:** function and dual trigger wiring. (supabase/migrations/00000000000000_production_schema.sql:1687-1717,8280-8283)
   - **Remediation sketch:** Keep one trigger (prefer BEFORE or AFTER by design) and instrument rowcount assertions.

4. **Staffing bridge bypass of lifecycle RPC**
   - **Impact:** Inconsistent authorization/audit/locking semantics between staffing and matrix/manual paths.
   - **Evidence:** direct upsert in click function; lifecycle RPC exists but not invoked. (supabase/functions/staffing-click/index.ts:429-557, supabase/migrations/00000000000000_production_schema.sql:2770-2979)
   - **Remediation sketch:** Move confirm path to lifecycle RPC wrapper that includes timesheet creation contract.

5. **Non-atomic matrix assignment transaction**
   - **Impact:** Partial write scenarios (assignment persisted, timesheets partial, Flex unsynced).
   - **Evidence:** ordered multi-step async flow in dialog. (src/components/matrix/AssignJobDialog.tsx:320-609)
   - **Remediation sketch:** Introduce server-side transaction boundary API and outbox/retry for external sync.

6. **Check-then-act race before lock path**
   - **Impact:** Conflict outcome stale by write time under concurrent assignments.
   - **Evidence:** conflict check then direct writes in dialog, no lifecycle lock. (src/components/matrix/AssignJobDialog.tsx:178-387)
   - **Remediation sketch:** Move conflict check + write into one RPC transaction with row lock.

### MEDIUM

7. **Policy fields not clearly enforced (`soft_conflict_policy`)**
   - **Impact:** Operational expectation mismatch in staffing escalation.
   - **Evidence:** policy modeled/escalated, no direct tick enforcement branch. (supabase/functions/staffing-orchestrator/index.ts:14-30,772-794)

8. **Realtime subscription duplication and query fan-out**
   - **Impact:** unnecessary invalidations, racey UI refresh behavior.
   - **Evidence:** duplicate job assignment subscriptions and broad invalidation sets. (src/hooks/useJobAssignmentsRealtime.ts:212-249, src/components/jobs/JobAssignments.tsx:26-56, src/hooks/useOptimizedMatrixData.ts:510-573)

9. **Integration best-effort semantics**
   - **Impact:** DB/Flex divergence under transient network/API failures.
   - **Evidence:** non-blocking Flex calls in staffing/dialog and complex fallback path in Flex edge function. (supabase/functions/staffing-click/index.ts:579-594, src/components/matrix/AssignJobDialog.tsx:575-609, supabase/functions/manage-flex-crew-assignments/index.ts:393-601)

10. **Coverage gaps in tests**
   - **Impact:** regressions in trigger/RLS/integration failure modes.
   - **Evidence:** currently small targeted hook test and broader but UI-centric critical-path file. (src/hooks/__tests__/useJobAssignmentsRealtime.test.ts:1-61, tests/assignments/critical-paths.test.ts:1)

---

## Remediation Backlog (Actionable Order)

1. **Lock down `job_assignments` RLS immediately**
   - Replace open policies with least-privilege matrix (admin/management full, technician constrained self-actions if required).
   - Add deny-by-default, then allowlist.
   - Add policy tests for every role.

2. **Remove duplicate delete trigger**
   - Keep single trigger for timesheet cascade.
   - Add migration test to assert one trigger binding only.

3. **Unify assignment write path behind server RPC/API**
   - Route `AssignJobDialog` and `staffing-click` through one transactional endpoint.
   - Ensure lock + conflict check + audit + timesheet update are atomic.

4. **Outbox pattern for Flex sync**
   - Move from inline best-effort to durable queue + retry + dead-letter ops visibility.

5. **Realtime/query-key consolidation**
   - Define canonical assignment key namespace and dedupe subscriptions.

6. **Improve observability**
   - Add correlation IDs across staffing request, assignment mutation, timesheet mutation, and Flex sync attempts.

---

## Appendix A — Key File Inventory Audited

- DB schema/triggers/RLS: `supabase/migrations/00000000000000_production_schema.sql`
- Edge:
  - `supabase/functions/staffing-orchestrator/index.ts`
  - `supabase/functions/staffing-click/index.ts`
  - `supabase/functions/staffing-sweeper/index.ts`
  - `supabase/functions/send-staffing-email/index.ts`
  - `supabase/functions/notify-staffing-cancellation/index.ts`
  - `supabase/functions/sync-flex-crew-for-job/index.ts`
  - `supabase/functions/manage-flex-crew-assignments/index.ts`
  - `supabase/functions/auto-send-timesheet-reminders/index.ts`
- Hooks/UI/state:
  - `src/hooks/useJobAssignmentsRealtime.ts`
  - `src/hooks/useTourAssignments.ts`
  - `src/hooks/useFlexCrewAssignments.ts`
  - `src/hooks/useOptimizedMatrixData.ts`
  - `src/components/matrix/AssignJobDialog.tsx`
  - `src/components/jobs/JobAssignments.tsx`
  - `src/utils/technicianAvailability.ts`
  - `src/stores/useSelectedJobStore.ts`
  - `src/stores/useSelectedCellStore.ts`
  - `src/stores/useCreateJobDialogStore.ts`
  - `src/lib/multitab-coordinator.ts`
- Tests:
  - `tests/assignments/critical-paths.test.ts`
  - `src/hooks/__tests__/useJobAssignmentsRealtime.test.ts`

