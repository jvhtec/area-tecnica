# Staffing Phase 0 — Current Behaviour Map

**Date:** 2026-09-30  
**Repository:** `jvhtec/area-tecnica`  
**Snapshot audited:** `main@972034a3435504acd02643cd8883c5c12b0d6e8f`  
**Status:** Behaviour freeze / documentation only  
**Runtime changes in this work:** **none**

> This document describes what the staffing and assignment system does at the pinned commit. It is deliberately descriptive, not prescriptive. Historical assignment/staffing audits remain useful context, but they are not authoritative for current behaviour because the workflow has changed materially since they were written.

**Later reviewed deltas:** PR989 restored ranking exclusions and froze date consent; PR990 changes the offer assignment/schedule boundary below. These updates describe the reviewed implementation, not proof of production deployment. The original audit date and snapshot remain above for provenance.

## 1. Safety boundary

Phase 0 exists to make later work safer.

For this phase:

- do not change application code;
- do not change Edge Functions;
- do not add or alter migrations;
- do not change status meanings;
- do not reorder side effects;
- do not consolidate writers;
- do not “fix” odd behaviour merely because it looks wrong.

The objective is to freeze the current contract well enough that Phase 1 can write characterization tests around it.

## 2. Executive model

Staffing is not one state machine. Current production behaviour is the composition of several overlapping models:

| Model | Primary store | What it means | Current authority |
| --- | --- | --- | --- |
| Staffing request | `staffing_requests` | A technician was asked about availability or received an offer | Request/response state |
| Job assignment | `job_assignments` | Technician belongs to a job, with role and assignment status | Job-level crew membership |
| Per-day work schedule | `timesheets` with `is_active=true` | The actual dates on which the technician is scheduled | **Canonical date-level schedule** |
| Staffing campaign | `staffing_campaigns` | Lifecycle of an assisted/automatic staffing run | Campaign controller |
| Campaign role | `staffing_campaign_roles` | Progress for one required role inside a campaign | Derived operational snapshot |
| Required crew | `job_required_roles` | Quantity required for each job/department/role | Staffing demand |

Two consequences matter before any refactor:

1. `job_assignments.single_day` and `assignment_date` still exist and are read by the matrix, but are explicitly deprecated. Multi-day truth lives in active timesheets.
2. A staffing response and the resulting job assignment are separate writes. They can legitimately be observed in different states after partial failure.

## 3. State machines

### 3.1 Staffing request state

Schema:

- `phase`: `availability | offer`
- `status`: `pending | confirmed | declined | expired`

Observed transitions:

```text
(no row)
   |
   | send-staffing-email persists request
   v
 pending
   | \
   |  \ technician declines
   |   v
   | declined
   |
   | technician confirms
   v
 confirmed

pending / confirmed / declined
   |
   | manager cancellation
   v
 expired
```

Important current semantics:

- `expired` also represents manager cancellation. There is no separate `cancelled` request status.
- Availability is **job-scoped**, not role-scoped. Current migrations intentionally keep `staffing_requests.role_code` null for availability. The role that motivated an availability request is recovered from the latest send event metadata.
- Offers are role-specific and may persist `role_code`.
- Batch requests create one pending request per selected date with a shared `batch_id`.
- Clicking one batch link updates matching **pending** rows in that batch for the same job/profile/phase.
- A second click on a non-pending request does not mutate it. The public endpoint returns an “already responded” or expired result.
- Manager cancellation via `useCancelStaffingRequest` changes **all non-expired rows** for the job/profile/phase to `expired`, including previously confirmed or declined rows.

Primary implementation:

- send/persist: `supabase/functions/send-staffing-email/index.ts`
- public response: `supabase/functions/staffing-click/index.ts`
- manager cancellation: `src/features/staffing/hooks/useStaffing.ts`
- cancellation notification: `supabase/functions/notify-staffing-cancellation/index.ts`

### 3.2 Job assignment state

Relevant statuses in current application behaviour:

```text
(no row)
   | direct assignment                    staffing offer acceptance
   | -> invited or confirmed              -> confirmed
   v                                      v
 invited -----------------------------> confirmed
   |                                       |
   | decline                               | manager may edit role/coverage
   v                                       |
 declined                                  |
   \______________________________________/
                    |
                    | hard removal
                    v
                 (no row)
```

Observed rules:

- Direct matrix assignment creates or updates one `job_assignments` row for `job_id + technician_id`.
- Direct assignment can be created as `invited` or `confirmed`.
- Updating an existing confirmed assignment from the matrix does not downgrade it to invited.
- The sanctioned technician self-response path is `manage_assignment_lifecycle`.
- Non-privileged technicians are guarded at DB level so they can self-update only `status` and `response_time`.
- Soft decline sets the assignment to `declined` and voids active timesheets.
- Hard removal deletes timesheets and then the assignment.
- A tour-sourced assignment is hard-deleted when declined through `AssignmentStatusDialog`.
- Removing one date from a multi-date assignment can delete only that date’s timesheet while retaining the base assignment row.

Primary implementation:

- direct creation/update: `src/components/matrix/AssignJobDialog.tsx`
- confirm/decline: `src/components/matrix/AssignmentStatusDialog.tsx` -> `manage_assignment_lifecycle`
- full/date removal: `src/components/matrix/optimized-matrix-cell/useMatrixCellAssignmentRemoval.ts`
- staffing auto-assignment: `supabase/functions/staffing-click/index.ts`
- role editing: `src/components/jobs/JobAssignmentDialog.tsx`

There are additional assignment writers outside the core staffing flow, including legacy/realtime and job-deletion paths. Any Phase 2 consolidation must inventory them again before changing write authority.

### 3.3 Campaign state

`staffing_campaigns.status` permits:

`active | paused | stopped | completed | failed`

Observed orchestrator transitions:

```text
(no campaign) -> active
active -> paused
active -> stopped
active -> completed
paused -> active        (resume)
stopped -> active       (resume)
completed -> active     (resume)
```

Notes:

- Auto campaigns run an initial tick immediately after creation.
- Assisted campaigns do not automatically send on creation.
- `nudge` on an active campaign ticks immediately.
- `nudge` on a paused campaign only moves `next_run_at`; it does not tick while paused.
- The audited orchestrator schema permits `failed`, but no transition to `failed` was found in the current orchestrator path.
- A run lock is acquired with compare-and-swap semantics. A lock older than 15 minutes is treated as stale and may be recovered.
- `staffing-sweeper` is service-role only and ticks due campaigns sequentially.

### 3.4 Campaign-role stage

`staffing_campaign_roles.stage` permits:

`idle | availability | offer | filled | escalating`

During a tick the operative stage is recomputed:

```text
if required <= 0 or assigned >= required
    -> filled
else if pending offer OR accepted-but-not-assigned offer OR confirmed availability
    -> offer
else
    -> availability
```

The role counters are operational snapshots, not an independent source of truth.

**Current semantic that must be preserved until explicitly changed:** campaign assigned counts exclude only `declined` assignments. Therefore an `invited` assignment currently counts toward `assigned` / role fill.

## 4. End-to-end workflow traces

### 4.1 Manual availability request

```text
Manager UI
  -> send-staffing-email
     -> auth / validation
     -> optional idempotency lookup
     -> conflict / eligibility checks
     -> INSERT or refresh staffing_requests(status=pending)
     -> build signed response links
     -> external Email or WhatsApp delivery
     -> staffing_events send event
     -> on successful delivery: push + activity event
```

The request row is persisted **before external delivery**.

If delivery fails, the request is not rolled back in the audited path. A pending request may therefore exist for a message the technician never received.

### 4.2 Availability response

```text
Technician link
  -> staffing-click
     -> rate limit
     -> load request
     -> expiry + HMAC validation
     -> pending -> confirmed | declined
     -> clicked event
     -> activity log
     -> best-effort push
     -> result page
```

Availability confirmation does **not** assign the technician. User-facing copy explicitly states that availability is only a consultation and a later offer follows.

### 4.3 Manual offer

The send path is the same as availability with these differences:

- offer may persist `role_code`;
- offer content includes job details and role;
- successful confirmation enters the auto-assignment path described below.

### 4.4 Offer confirmation and auto-assignment

Current ordering in `staffing-click`:

```text
1. staffing_requests: pending -> confirmed
2. staffing_events: clicked_confirm
3. activity + best-effort push
4. resolve role from latest send event
5. query conflicts using active timesheets
6. if clean: call assign_staffing_offer
7. one DB transaction writes membership + all accepted timesheet dates
8. best-effort assignment push
9. best-effort Flex add for sound/lights
10. staffing event: auto_assigned_on_confirm
11. response page remains successful
```

**PR990 update (2026-10-02):** membership and accepted timesheets are atomic. The response still commits before that transaction. This deliberately supersedes the original Phase 0 partial-write observation and P0 case 9; see [the Phase 2A review](STAFFING_PHASE2A_ATOMIC_ACCEPTANCE_REVIEW_2026-10-02.md).

Observed reachable outcomes include:

| Request | Assignment | Timesheets | Flex | How |
| --- | --- | --- | --- | --- |
| confirmed | confirmed | complete | synced | happy path |
| confirmed | absent | absent | absent | conflict detected after response, assignment skipped |
| confirmed | unchanged | unchanged | absent | assignment or timesheet write fails; internal writes roll back |
| confirmed | confirmed | complete | unsynced | Flex call fails |

Those are descriptions of current behaviour, not recommendations.

### 4.5 Direct matrix assignment

Current ordering in `AssignJobDialog`:

```text
1. client-side/RPC conflict check
2. INSERT or UPDATE one job_assignments row
3. mutate per-date timesheets
4. verify base assignment exists
5. sync timesheet categories
6. best-effort Flex add/remove
7. best-effort push
8. local assignment-updated event
```

Coverage behaviour:

- `full`: creates timesheet dates across the complete job span;
- `single`: one active timesheet date;
- `multi`: explicit selected date set;
- modifying an existing assignment supports add and replace semantics.

The base assignment and date-level timesheets are separate operations, so a later failure can leave the earlier assignment write committed.

### 4.6 Assignment response

`AssignmentStatusDialog` calls `manage_assignment_lifecycle`.

Confirm:

1. lock assignment `FOR UPDATE NOWAIT`;
2. compare target active timesheet dates with other active timesheets;
3. on no conflict, set `status=confirmed`, `response_time=now()`;
4. write assignment audit log.

Decline:

- normal assignment: set `declined`, void active timesheets, audit;
- tour assignment: hard-delete timesheets and assignment, audit.

### 4.7 Removal

Whole assignment removal from the matrix:

1. `manage_assignment_lifecycle(... cancel, hard)`;
2. DB removes timesheets + assignment atomically inside the RPC;
3. Flex removal is best effort;
4. push is best effort.

Single-date removal:

- deletes the selected timesheet;
- leaves the job-level assignment if other coverage remains / base relation is still needed.

### 4.8 Assisted campaign

```text
start active campaign
  -> manager views ranked candidates
  -> manager selects candidates
  -> availability sends through send-staffing-email
  -> confirmed availability appears in offer list
  -> manager selects available candidates
  -> offer sends through send-staffing-email
  -> first accepted offer can auto-assign through staffing-click
  -> campaign counters/stages refresh
```

### 4.9 Auto campaign

```text
start campaign
  -> immediate tick
  -> rank candidates
  -> send availability waves with require_no_conflicts=true
  -> later tick sees confirmed availability
  -> automatically send offers up to role capacity
  -> accepted offer follows normal staffing-click auto-assignment
  -> ticks continue via sweeper
  -> all roles filled -> campaign completed + best-effort push
```

Auto sends use deterministic campaign idempotency keys and `request_origin=auto_staffing`.

## 5. Conflict model

There are multiple safeguards. They are not interchangeable.

### Recommendation / automatic send guard

With `require_no_conflicts=true`, `send-staffing-email` rechecks eligibility at send time and blocks stale recommendations for conditions including:

- an active assignment on the target job;
- overlapping active assignments;
- configured adjacent-job constraints;
- an existing same-role request;
- existing job-scoped availability;
- relevant prior declines;
- same-date declines from other jobs;
- hard conflict or explicit unavailability returned by `check_technician_conflicts`.

Same-date decline behaviour at **send time**:

- declined availability on overlapping dates is a hard exclusion for another job;
- declined offers are role-prefix sensitive, unless role context is absent.

### Ranking replay finding

The replayed final database definition of `rank_staffing_candidates` does **not** currently preserve two exclusion filters introduced earlier in the migration chain:

- active job-scoped availability on the target job;
- same-date declined staffing requests from another job.

The May/June migrations add those filters, but the later `20260730120000_add_seasonal_house_tech_finance.sql` migration performs a full `CREATE OR REPLACE FUNCTION rank_staffing_candidates` using a definition that omits them.

This does not remove the downstream send guard described above: `send-staffing-email` rechecks candidate eligibility with `require_no_conflicts=true` and can reject the send. The current practical failure mode is therefore a false-positive recommendation / wasted automatic staffing attempt rather than the guarded message being sent anyway.

Phase 1 keeps the intended ranking assertions executable as pgTAP TODO tests. Do not treat the missing ranking filters as an intentional contract.

### Exact timesheet collision

The send function separately checks active timesheets on exact target dates. A discovered collision is described in code as non-overridable and returns 409.

However, if the timesheet collision query itself errors, the current code logs a warning and continues. Preserve this fail-open behaviour during characterization. Decide later whether it is acceptable.

### Offer acceptance conflict check

`staffing-click` uses active timesheets for other jobs as its schedule source of truth.

If a conflict is found after the offer request has already been marked confirmed, assignment is skipped and the confirmed request is retained.

If the timesheet lookup itself errors, the current function warns and proceeds with an empty conflict set.

## 6. Sources of truth and derived representations

Treat these distinctions as invariants during Phase 1:

### Date-level work

**Source:** active `timesheets`.

Do not infer multi-day coverage solely from `job_assignments.single_day` / `assignment_date`. Those fields are deprecated and cannot fully encode arbitrary multi-date coverage.

### Job-level membership

**Source:** `job_assignments`.

One row represents technician membership in the job and carries status, source and role.

### Availability/offer response

**Source:** `staffing_requests`.

Do not infer availability acceptance from assignment existence.

### Availability role intent

**Source:** latest `staffing_events` send metadata for that request.

Availability rows are intentionally job-scoped and normally have no persisted role code.

### Offer role

**Source:** `staffing_requests.role_code` when present, with send-event metadata still used by current paths.

### Campaign demand

**Source:** `job_required_roles`.

### Campaign progress

`staffing_campaign_roles` is a recalculated operational snapshot based on assignments + requests.

## 7. Side-effect ordering and failure semantics

| Operation | Durable write first | Later side effects | Failure behaviour observed |
| --- | --- | --- | --- |
| Send availability/offer | pending `staffing_requests` | Email/WA, send event, push, activity | delivery failure can leave pending request |
| Technician response | request confirmed/declined | activity, push, possible assignment | response is retained if later assignment work fails |
| Staffing auto-assign | confirmed request already exists | assignment, timesheets, Flex | later failures do not revert response |
| Direct assignment | assignment row | timesheets, category sync, Flex, push | not one transaction |
| Full assignment removal | lifecycle RPC | Flex, push | DB removal succeeds independently of external sync |
| Campaign completion | campaign set completed | completion push | push is best effort |

## 8. Idempotency behaviour

`send-staffing-email` accepts an idempotency key.

Current behaviour:

1. look for a `staffing_requests` row with that key created within 24 hours;
2. if found, return `success: true, cached: true` without delivering again;
3. otherwise persist request and attempt delivery.

Because persistence precedes delivery, a failed external delivery can still leave the idempotency row behind. A retry with the same key within the window can therefore return cached success even though the original external delivery failed.

This is a high-value Phase 1 characterization case. Do not silently change it in Phase 0.

## 9. Driver assignments are intentionally outside this workflow

The current driver-assignment migration explicitly separates employee drivers from staffing campaigns:

- drivers do not go through `staffing_requests`;
- there is no availability/offer phase;
- management assigns directly;
- known leave/unavailability is an overrideable scheduling conflict;
- driver assignment has its own `assigned -> confirmed/declined` lifecycle and delivery audit.

Do not fold driver assignment into staffing while stabilizing this module.

## 10. Writer inventory

### `staffing_requests`

Known current writers in the core flow:

- `supabase/functions/send-staffing-email/index.ts`: create/refresh pending requests;
- `supabase/functions/staffing-click/index.ts`: confirm/decline pending requests;
- `src/features/staffing/hooks/useStaffing.ts`: expire/cancel non-expired requests.

Readers/derived views include:

- `useStaffingStatus`;
- `useStaffingMatrixStatuses`;
- `StaffingCandidateList`;
- `StaffingOfferList`;
- `staffing-orchestrator`;
- cancellation notifier;
- realtime invalidation hooks.

### `job_assignments`

Core staffing/matrix writers include:

- `AssignJobDialog.tsx`: direct insert/update and fallback delete;
- `staffing-click/index.ts`: staffing-source confirmed upsert;
- `manage_assignment_lifecycle`: confirm/decline/cancel;
- `JobAssignmentDialog.tsx`: role changes;
- assignment removal services/hooks;
- legacy/realtime assignment paths and job cleanup code.

This table has more writers than `staffing_requests`. Any later attempt to establish a single command layer must begin by re-running this inventory.

### `timesheets`

Staffing touches timesheets through:

- `toggleTimesheetDay` from direct assignment;
- direct delete/recreate paths in the assignment dialog;
- `staffing-click` upserts after accepted offers;
- assignment lifecycle soft/hard removal;
- one-date matrix removal.

## 11. Behavioural contracts to preserve during characterization

Until a product/engineering decision explicitly changes one, treat these as current contracts:

1. Active timesheets are the canonical per-day schedule.
2. One job assignment row represents job-level technician membership.
3. Availability is job-scoped.
4. Offer is role-specific.
5. Availability confirmation does not itself assign work.
6. Offer confirmation records the response before attempting assignment.
7. Direct assignment can create invited or confirmed rows.
8. Existing confirmed direct assignments are not downgraded to invited by normal matrix editing.
9. Declined assignments are excluded from campaign assigned counts.
10. Invited assignments currently count as assigned for campaign fill.
11. Expired means cleared/cancelled in staffing-request UI.
12. Batch response affects only still-pending rows in the matching batch tuple.
13. Hard assignment removal removes its timesheets.
14. One-date removal may retain the base assignment.
15. Dry-hire staffing acceptance skips timesheet creation.
16. Tour-date staffing timesheets are schedule-only.
17. Flex synchronization is not part of the DB transaction.
18. Push/activity notification failures do not roll back staffing state.
19. Drivers remain outside the availability/offer staffing workflow.

## 12. Known brittle seams, documented but intentionally unfixed

These are not Phase 0 change requests.

### B1. Confirmed offer can exist without assignment

The request is confirmed before conflict checking and assignment. Conflict or assignment failure does not revert it.

### B2. Offer assignment/schedule partial commit — superseded by PR990

PR990 makes membership and accepted-date timesheets one transaction. A failing accepted-date write rolls back both, including changes to existing membership. Direct matrix assignment still has this partial-commit risk (B3); confirmed response without assignment still exists (B1).

### B3. Direct assignment is multi-write

The base assignment and selected timesheet dates are written separately from the browser.

### B4. Delivery failure can leave a pending request

Request persistence occurs before Email/WhatsApp delivery.

### B5. Retry after failed delivery can be swallowed by idempotency

A persisted request row can cause a same-key retry to return cached success.

### B6. Flex can drift from Área Técnica

Flex adds/removals are best effort in several paths.

### B7. Campaign “filled” currently treats invited as assigned

Only declined assignments are excluded from assigned counts.

### B8. Availability role association depends on event metadata

This is intentional under job-scoped availability, but creates a cross-table dependency for role-specific campaign views.

### B9. Cancellation overwrites response visibility

Manager cancellation turns pending, confirmed or declined requests into expired, so the current request row no longer exposes its prior response status.

### B10. Some conflict-check infrastructure fails open on query errors

Both send-time exact-timesheet checking and click-time existing-timesheet lookup have paths that continue after a query error.

### B11. Candidate ranking lost two exclusion filters in migration order

The final replayed `rank_staffing_candidates` definition omits the earlier job-scoped availability and cross-job same-date-decline exclusions. The send-time recommendation guard still enforces them, so the immediate effect is false-positive candidate recommendations rather than an unguarded send.

This was a regression, not a behavior to preserve. PR989 restored the filters in `20261001080000_restore_staffing_candidate_exclusions.sql`; database characterization now asserts them. Click-time query-error handling in B10 remains open.

### B12. Failed accepted offer retains a campaign pipeline slot

`acceptedOffersNotAssigned` counts confirmed, role-attributed offer requests without a non-declined assignment. It contributes to pipeline coverage and reduces new offer capacity. PR990's atomic rollback can now put a timesheet-write failure into this state, where the old partial commit left membership. Failure events do not release the reservation, and an answered link does not retry assignment. Management must reconcile the request and assignment; automatic recovery/alerting is a separate roadmap boundary. See the Phase 2A recovery query.

### B13. Public GET links mutate responses (CARLOS A1)

HEAD is inert, but a valid GET confirm/decline link currently records the response. Email scanners can therefore respond before the technician. Preserve the observed behavior in characterization first; changing to a confirmation page plus POST requires a product decision about the additional interaction. [CARLOS A1](CARLOS_SYSTEM_REVIEW.md) tracks the defect.

## 13. Current safety net

There is already useful coverage. Relevant tests include:

- matrix/direct assignment component tests;
- `tests/assignments/critical-paths.test.ts`;
- staffing ranking/recommendation contract tests;
- staffing candidate/offer UI tests;
- assignment matrix Playwright tests;
- staffing recommendation Playwright tests;
- DB test for technician self-update protection;
- helper tests for staffing-click conflict/request/follow-up utilities;
- helper tests for orchestrator policy/orchestration utilities.

The current suite is strongest around UI behaviour, conflict helpers, candidate recommendation rules and DB guards.

PR989/PR990 added actual handler tests against isolated PostgREST and pgTAP tests for offer acceptance, rollback, conflicts, date consent and races. External delivery/authentication are stubbed in those HTTP tests; database caller-role tests run separately. Source assertions remain useful guards but are not behavioral proof. The remaining campaign, direct matrix and cancellation gaps are listed in the tracker below; the full Phase 1 exit gate is not complete.

## 14. Phase 1 characterization plan

No refactor should begin until these behaviours are executable tests against an isolated/staging environment.

### P0 — state-integrity characterization

1. availability send success -> pending row + successful delivery event;
2. external delivery failure after pending-row persistence;
3. retry same idempotency key after delivery failure;
4. availability confirm -> confirmed request, no assignment;
5. availability decline -> declined request, no assignment;
6. offer confirm happy path -> confirmed request + confirmed assignment + correct active timesheets;
7. offer confirm with post-response conflict -> confirmed request + no assignment;
8. assignment upsert failure after offer confirmation;
9. accepted-date timesheet failure: confirmed response retained, membership and schedule writes rolled back (PR990 intentionally replaces the old partial commit);
10. Flex failure after successful DB assignment;
11. batch confirmation updates only matching pending batch rows;
12. duplicate click does not transition a non-pending request;
13. manager cancellation maps pending/confirmed/declined to expired;
14. full direct assignment creates all intended Madrid calendar dates;
15. multi-date direct assignment preserves exact selected dates;
16. direct assignment timesheet failure demonstrates current partial-commit semantics;
17. single-date removal leaves expected base assignment state;
18. full removal deletes assignment + timesheets atomically;
19. technician cannot modify payroll-sensitive assignment columns;
20. invited assignment currently contributes to campaign filled count.
21. public link methods (CARLOS A1): characterize today's GET mutation and inert HEAD first; a future confirmation-page/POST change must prove GET/HEAD are inert and a valid POST records one response.

### P1 — campaign characterization

1. auto campaign initial tick;
2. assisted campaign creation without auto send;
3. active pause / paused resume;
4. stopped and completed campaign resume;
5. paused nudge does not tick;
6. active nudge ticks;
7. concurrent tick lock rejection;
8. stale lock recovery;
9. confirmed job-scoped availability is handed to the correct role via send-event metadata;
10. same-date declined availability blocks a new recommendation;
11. role-sensitive declined offer behaviour;
12. auto availability wave respects capacity and deterministic idempotency key;
13. auto offer handoff respects role capacity;
14. all roles filled transitions campaign to completed exactly once.
15. failed accepted offer reserves pipeline capacity; characterize manager recovery before changing reservation or retry policy.

### Coverage tracker (PR990, 2026-10-02)

Keep this tracker current when changing a boundary. **DB-backed** means actual PostgreSQL/PostgREST behavior; **mocked** means an executable handler/hook against a fake data layer; **source/helper** cannot establish a full workflow. Remove or rewrite a source assertion only after a behavioral replacement covers the same contract.

| Cases | Test files | Evidence / remaining work |
| --- | --- | --- |
| P0 1–5 | `send-staffing-email/__tests__/preservedMutationContracts.test.ts`, `dateCoverageHandlers.test.ts` | Mocked handler behavior; real external delivery not tested |
| P0 6–10 | `tests/assignments/staffing-postgrest.integration.test.ts`, `supabase/tests/database/staffing_offer_atomic.sql` | DB-backed handler/SQL behavior; external services stubbed |
| P0 11–12 | `staffing-postgrest.integration.test.ts`, `preservedMutationContracts.test.ts` | DB-backed batch/CAS races and mocked sequential replay |
| P0 13 | `tests/assignments/staffing-cancellation.local.integration.test.tsx`, `src/features/staffing/hooks/__tests__/useStaffing.phase1.test.tsx` | Eight opt-in real hook/Auth/RLS/Edge cases; phase/status/date/tuple scope, replay, notification channel, cache/event and membership preservation |
| P0 14–15, 17 | `tests/assignments/matrix-dialog.local.integration.test.tsx`, `tests/assignments/critical-paths.test.ts` | Eight opt-in real dialog/services/Auth/RLS/SQL cases; exact full/single/sparse/add/replace coverage and single/last-date removal |
| P0 16 | `tests/assignments/matrix-failure.disposable.integration.test.tsx` | Three opt-in real dialog/Auth/RLS/RPC cases on a labelled disposable clone: success, partial write with retained dialog/no success effects, exact technician denial |
| P0 18–19 | `supabase/tests/database/staffing_assignment_lifecycle_characterization.sql`, `staffing_rls_characterization.sql`, `staffing_offer_atomic.sql`, `tests/assignments/staffing-removal-locks.integration.test.ts` | DB-backed lifecycle, caller authorization and deletion ordering; not every direct writer |
| P0 20 | `staffing-campaigns.edge.integration.test.ts` | Opt-in real-runtime invited-without-schedule and declined controls |
| P0 21 / CARLOS A1 | `tests/assignments/staffing-public-methods.disposable.integration.test.ts` | Fifteen real availability capability-link cases: legacy/path HEAD, GET/POST URL response/replay, invalid/expired tokens and ignored POST body. Offer/browser-navigation coverage and A1 product fix remain pending |
| P1 1–9, 11–15 | `staffing-phase1-characterization.test.ts`, `staffing-orchestrator/__tests__/*` | Source/helper evidence; real orchestrator tick, role attribution and recovery gaps |
| P1 10 / B11 | `supabase/tests/database/staffing_candidate_ranking_characterization.sql` | DB-backed ranking exclusions; not a full campaign tick |

Future writer consolidation must inventory every direct matrix, lifecycle and tour writer in section 10 and define their common locking protocol. PR990's pair lock covers only acceptance and the timesheet-removal RPC.

### Historical local campaign evidence (2026-10-03)

[`staffing-campaigns.edge.integration.test.ts`](../../tests/assignments/staffing-campaigns.edge.integration.test.ts) adds 27 opt-in cases against real local Auth, Edge Runtime and PostgreSQL, with provider delivery captured. It supplies actual behavior for P0.20 and campaign controls, role attribution/handoff, held-lock rejection, stale direct recovery, offer capacity and accepted-unassigned reservations in P1.2–9/11/13/15. Auto creation is tested with availability waves disabled; it does not close P1.1/12's automatic wave behavior. The stale-lock case includes an unlocked positive control and preserves the observed A3 sweeper-selector defect.

Two further suites add eight real cancellation-hook cases and eight real direct-matrix cases; a fourth suite adds two actual deferred-task cleanup-fence cases, bringing the combined local run to 45 cases. All four compare eight historical tables before/after owned-fixture cleanup, including notification inbox and push attempts. The source gate follows the actual local import closure of every invoked handler. A labelled disposable clone adds three actual partial-write/dialog cases and fifteen availability public-method cases, bringing actual local evidence to 63 cases. Disposable suites also preserve the original historical eight-table baseline. See the [reproduction and remaining gaps](STAFFING_CAMPAIGN_CHARACTERIZATION_2026-10-03.md).

Ordinary CI runs sixty-seven safety/source/cleanup/observation/calendar/fence/clone checks but skips the local runtime suites. Campaign requests block cleanup and new fixtures while pending or after transport failure; HTTP completion additionally requires a private runtime acknowledgment covering active execution and registered deferred work. The runtime admission lease stays held through SQL cleanup, with deadline checks before new mutations. Calendar navigation works before and after its fixture month. Initial simultaneous CAS contention, availability wave/ranking behavior, exact completion-push behavior, offer public-method behavior and browser result navigation remain gaps. Availability GET/POST behavior is now characterized; mutating GET remains an A1 product defect. This evidence does not complete the Phase 1 exit gate or authorize a counting/recovery redesign.

### Phase 1 exit gate

Before architectural work:

- all P0 cases above are automated and green;
- the test fixtures use the same relevant schema/RPC semantics as production;
- current “weird” outcomes are asserted rather than silently normalized;
- every proposed Phase 2 change names which characterization test intentionally changes.

## 15. Do-not-touch list before Phase 1

Do not casually alter:

- `staffing-click` response-before-assignment ordering;
- `send-staffing-email` persistence-before-delivery ordering;
- request status vocabulary;
- campaign count semantics;
- availability job scoping;
- offer role scoping;
- deprecated `single_day` / `assignment_date` reads;
- `manage_assignment_lifecycle`;
- the meaning of active timesheets;
- Flex best-effort semantics;
- idempotency semantics.

Any of those may ultimately deserve change. None should change without a characterization test proving what production does first.

## 16. Product decisions to defer until after characterization

These are questions, not findings to “fix” during stabilization:

- Should an accepted offer be considered successful if assignment creation fails?
- Should invited assignments count as filled capacity?
- Should manager cancellation preserve a distinct historical confirmed/declined response?
- Should a failed external delivery leave the request pending?
- Should idempotency represent “request persisted” or “message successfully delivered”?
- Should Flex synchronization failure affect assignment success?
- Should conflict-check infrastructure fail closed when its own query fails?
- PR990 resolves the transaction question narrowly for accepted offers; direct writers remain a later decision.

Those decisions belong after Phase 1 has made the current behaviour reproducible.

---

## Phase 0 conclusion

The system’s reliability is not accidental, but it is **distributed**. Several layers compensate for one another: request guards, active-timesheet conflict checks, lifecycle RPC locking, client safeguards, realtime invalidation and best-effort external synchronization.

The safe next move is not to simplify those layers. It is to turn this document into executable characterization coverage, then change one boundary at a time.
