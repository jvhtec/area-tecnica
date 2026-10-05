# Assignment Matrix hardening roadmap

**Date:** 2026-10-03  
**Baseline:** `main@825e0c3a` after PR #992  
**Priority:** manual Matrix operations and direct assignment  
**Deferred:** Carlos / automatic campaign UX except where it shares an invariant with assignment truth

## 1. Objective

Make the Assignment Matrix boring under failure.

A manager must be able to assign, modify, remove, move or directly confirm a technician without creating an impossible combination of `job_assignments`, active `timesheets` and the Matrix read model. Retries, stale tabs, concurrent managers, duplicate clicks, realtime lag and downstream Flex/notification failures must have explicit outcomes.

PR #992 established characterization and a disposable synthetic runtime. That runtime is a controlled preflight tool, not the architecture. This roadmap now moves correctness into the database/application command boundary and keeps UI code as a consumer of authoritative results.

## 2. Current risk map

### 2.1 Direct assignment is a client-side transaction

`AssignJobDialog.tsx` currently performs a long sequence:

1. preflight conflict query;
2. optional removal of the previous assignment;
3. best-effort Flex removal;
4. read existing `job_assignments`;
5. insert/update, including a duplicate-key retry path;
6. read existing timesheets;
7. multiple per-date `toggle_timesheet_day` RPC calls or direct deletes;
8. verify that an assignment row exists;
9. category synchronization;
10. best-effort Flex additions and notifications.

The database protects individual operations, but the business command is not atomic. A browser/network failure between steps can leave membership and schedule disagreeing. The preflight conflict check is also necessarily stale by the time the writes occur.

### 2.2 Removal is stronger than creation

`remove_assignment_with_timesheets` already serializes against staffing offer acceptance with the `staffing-offer:<job>:<technician>` advisory lock, then locks membership before deleting timesheets and the assignment. PR #990 added real concurrency tests around this ordering.

Direct creation/update does not yet use the same authoritative command/lock boundary. This asymmetry is the first thing to remove.

### 2.3 Date truth has two representations

Active `timesheets` are the canonical per-day schedule. `job_assignments.single_day` and `assignment_date` remain compatibility/read-model fields. A hardening command must update both consistently while treating active timesheets as date truth.

### 2.4 UI reconciliation is fragmented

The Matrix uses multiple query-key families plus custom `assignment-updated` / `staffing-updated` events and realtime. Correctness must not depend on all of those invalidations arriving in a particular order. Optimistic UI is acceptable only when rollback and authoritative reconciliation are deterministic.

### 2.5 Side effects are mixed with state transitions

Flex crew synchronization, category synchronization and notifications are useful but must not determine whether core assignment state committed. The command result must distinguish:

- core state committed;
- no-op/idempotent replay;
- rejected conflict/stale expectation;
- core state failed;
- core state committed but a downstream side effect needs retry/reconciliation.

## 3. Target architecture

```text
Matrix / direct-assignment UI
          |
          v
typed assignment command service
          |
          v
atomic DB RPCs
  - authorization
  - advisory + row locks
  - expected-state/CAS checks
  - membership write
  - schedule write
  - audit/event fact
          |
          +----> authoritative command result
          |
          v
post-commit reconcilers
  - Flex
  - notifications
  - derived/category sync where it cannot live transactionally

Matrix reads <- canonical DB read model <- realtime/query refresh
```

Manual Matrix and direct assignment must call the same command layer. Carlos/staffing offer acceptance may later converge on the same primitives, but this roadmap does not require campaign UX work.

## 4. Non-negotiable invariants

1. At most one `job_assignments` row exists for a job/technician.
2. A successful assignment command leaves membership and requested active schedule mutually consistent in the same transaction.
3. A hard removal leaves no active schedule for that membership.
4. A date-only removal cannot accidentally delete another active date or the base membership while dates remain.
5. Two managers racing the same technician/date cannot both commit incompatible outcomes.
6. A retry of the same logical command is safe and deterministic.
7. A stale client cannot silently overwrite a newer manager decision.
8. Conflict checks used for enforcement happen under the write transaction/lock, not only in React.
9. Authorization is enforced by the database command, including actor attribution.
10. Direct assignment never requires availability/offer state to exist.
11. Confirmed membership is not silently downgraded by an invited direct-assignment retry.
12. Compatibility fields never override active-timesheet date truth.
13. Core assignment success does not depend on Flex/email/WhatsApp availability.
14. Every committed mutation is reconstructable from structured audit data.
15. Query/realtime lag may make the UI temporarily stale, but cannot change the committed outcome.

## 5. Delivery plan

### Phase A — Atomic direct-assignment command

Create one manager/service-role RPC for assignment upsert + schedule replacement/addition. Suggested contract:

`apply_direct_assignment(p_job_id, p_technician_id, p_role, p_status, p_dates, p_mode, p_expected_revision, p_command_id, p_actor_id, p_metadata)`.

The exact signature should follow schema conventions discovered during implementation; the semantics matter more than the name.

Inside one transaction it must:

- authorize management/service role;
- validate job/profile existence and role/department compatibility;
- acquire the existing staffing-offer advisory key before membership/timesheet locks;
- lock the current assignment and relevant schedule rows;
- enforce conflicts using current locked state;
- enforce optional expected revision/state;
- preserve confirmed status when appropriate;
- insert/update the membership;
- add/replace active dates as requested;
- update compatibility coverage fields deterministically;
- record actor/source/command identity;
- return the complete resulting assignment/schedule summary.

No Flex or external network call belongs inside this RPC.

**Exit gate:** disposable DB tests prove all-or-nothing behavior, authorization, idempotent replay and controlled concurrent writers.

### Phase B — Atomic remove / move / replace semantics

Build on `remove_assignment_with_timesheets` rather than inventing another delete path.

Define explicit commands for:

- remove one date;
- remove all membership;
- add dates;
- replace date coverage;
- move/reassign from job A to job B.

Cross-job reassignment is the dangerous case. Prefer a single transaction that locks both job/technician scopes in deterministic order. Never implement “delete old, then call create new” in the browser.

**Exit gate:** injected failures at every logical boundary leave either the old complete state or the new complete state, never a half-move.

### Phase C — Shared TypeScript command layer

Introduce a small typed module, e.g. `src/features/assignments/commands/`, wrapping the RPC result/error vocabulary. Both desktop/mobile Matrix surfaces and direct-assignment dialogs use it.

Responsibilities:

- request/result types;
- stable error codes mapped to Spanish UI messages;
- command/idempotency key generation and reuse across retries;
- query invalidation/reconciliation helpers;
- no embedded presentation state.

Remove direct `job_assignments` writes and multi-step timesheet mutation sequences from `AssignJobDialog`.

**Exit gate:** grep/test guard prevents Matrix mutation surfaces from writing `job_assignments` directly.

### Phase D — Manual Matrix path convergence

Route Matrix assignment, modification and removal through the shared commands. Preserve current gestures and workflow first; UX redesign is deliberately separate.

Harden:

- double click / repeated submit;
- dialog timeout while server later succeeds;
- stale tab;
- concurrent managers;
- realtime arriving during optimistic mutation;
- mutation success followed by refetch failure;
- mutation failure after optimistic paint;
- mobile and desktop parity.

Optimistic state may remain where useful, but the command result is authoritative and failed/stale operations roll back visibly.

### Phase E — Direct assignment reliability

Treat direct assignment as a first-class path, not a shortcut through staffing.

Cover:

- invited and confirmed direct assignment;
- single/multi/full-job coverage;
- add vs replace coverage;
- role change;
- same-job retry;
- cross-job move;
- remove/reassign;
- technician and employee-driver usage where they share assignment primitives;
- existing staffing requests present/absent without requiring them.

Direct assignment must remain independent of availability. A staffing request may be reconciled/expired by explicit policy later, but it cannot be a prerequisite.

### Phase F — Side-effect reconciliation

Move Flex and notification behavior behind the committed assignment fact. Give failures an observable retry/reconciliation path instead of treating `Promise.allSettled` plus console output as sufficient.

Classify side effects:

- required derived DB state: transactional if feasible;
- external Flex synchronization: post-commit, retryable, idempotent;
- human notifications: post-commit, idempotent/best effort according to product semantics.

Do not roll back a valid assignment because Flex is unavailable.

### Phase G — Observability and repair

For each mutation capture a bounded structured record containing:

- command ID;
- job/technician;
- actor;
- source surface;
- operation/mode;
- expected prior version;
- resulting version;
- outcome/error code;
- timestamp;
- downstream reconciliation state.

Add read-only diagnostics for inconsistent membership/schedule states and an explicit repair command if production evidence shows one is needed. Do not build a generic “fix everything” button.

### Phase H — UX simplification

Only after command semantics are stable:

- consolidate duplicate mutation surfaces;
- use one conflict presentation vocabulary;
- make pending/success/rejected states obvious;
- show stale/conflict outcomes as actionable refresh/retry states;
- reduce custom event/query invalidation sprawl.

This phase should reduce code, not invent a new Matrix.

## 6. Concurrency model

Use one lock namespace and deterministic ordering across all assignment writers.

For a single job/technician command:

1. advisory lock on assignment identity;
2. membership row `FOR UPDATE` if present;
3. relevant timesheet rows in date order;
4. dependent rows only after membership/schedule locks.

For a cross-job move, acquire advisory keys sorted by stable job ID before row locks. Offer acceptance, direct assignment, removal and lifecycle operations must eventually obey the same ordering.

The existing `staffing-offer:<job>:<technician>` lock is already deployed and tested. Prefer extending that established serialization contract rather than introducing a competing lock family without a migration plan.

## 7. Idempotency and stale-write protection

Two different problems need separate mechanisms:

- **transport retry:** same `command_id` returns/reconstructs the original committed outcome without repeating side effects;
- **stale human intent:** an `expected_revision` or equivalent expected-state token rejects a mutation if somebody changed the assignment after the dialog loaded.

A unique command ledger is preferable if audit requirements justify it. If a lighter revision column is sufficient, document why command retries cannot duplicate downstream work.

Never use “insert, catch 23505, then update whatever is there” as the concurrency policy.

## 8. Test strategy

### Required deterministic CI

- RPC authorization and RLS/grant tests;
- direct assign create/update/idempotent replay;
- add/replace/remove date coverage;
- confirmed-not-downgraded invariant;
- stale revision rejection;
- two-writer contention;
- assignment vs removal;
- assignment vs offer acceptance;
- move A→B vs competing mutation;
- transaction rollback via injected DB faults;
- UI command adapter/result mapping;
- optimistic rollback/reconciliation;
- direct-write guard for Matrix mutation files.

### Controlled dev preflight

Use the PR #992 synthetic runtime before high-risk Matrix releases to exercise real Auth/REST/Edge behavior and owned teardown. It remains manual/preflight by design. Hosted-runner failures must not be “fixed” by weakening its ownership or fail-closed checks.

### Production rollout checks

For migrations: dry-run against linked production, inspect planned functions/grants/indexes, apply migrations, then deploy client code. During rollout verify command outcome/error counts and inconsistent-state diagnostics.

## 9. Proposed PR sequence

Keep each implementation PR independently deployable:

| PR | Scope | Production behavior |
| --- | --- | --- |
| M0 | This roadmap + writer inventory | none |
| M1 | Atomic direct assignment RPC, revision/idempotency contract, DB concurrency tests | backend primitive only |
| M2 | Atomic coverage/remove/move primitives + lock-order tests | backend primitive only |
| M3 | Shared TS command layer; migrate `AssignJobDialog` direct path | direct Matrix writes converge |
| M4 | Migrate manual Matrix removal/modification + optimistic/realtime hardening | manual path converges |
| M5 | Side-effect reconciliation + observability/diagnostics | reliability/operations |
| M6 | Matrix UX consolidation and dead-path removal | UX/code reduction |

M1/M2 may be combined only if the resulting migration/review remains tractable. Do not combine M3+ with Carlos/campaign redesign.

## 10. Explicitly deferred

Carlos / campaign automation is not a current priority. Do not spend Matrix-hardening PR budget on ranking, wave construction, campaign UX or broader auto-mode redesign.

Shared invariants still apply: offer acceptance must serialize safely with direct assignment/removal, and later Carlos work should consume the same authoritative assignment primitives rather than creating another writer.

## 11. Definition of “extremely hardened”

This roadmap is complete when:

- manual and direct Matrix mutations share one authoritative command boundary;
- membership + schedule changes are transactional;
- all assignment writers have a documented lock order;
- duplicate/retried/stale/concurrent commands have deterministic tested outcomes;
- no Matrix component directly performs multi-step assignment persistence;
- removal and cross-job reassignment cannot expose partial state;
- external side-effect failure is observable and recoverable without corrupting core state;
- deterministic concurrency/fault tests run in required CI;
- the full synthetic runtime passes controlled-dev preflight for a release candidate;
- production diagnostics can identify any membership/schedule inconsistency without inspecting browser logs.

At that point Carlos can be hardened on top of a trustworthy assignment substrate instead of asking automation to compensate for a fragile one.
