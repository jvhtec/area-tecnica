# Assignment commands (Matrix hardening)

**Status:** implemented on `feat/matrix-hardening-commands` (2026-10-03)
**Roadmap:** `docs/staffing/MATRIX_HARDENING_ROADMAP_2026-10-03.md` (PR #993)

Manual Matrix operations and direct assignment persist through one database
command boundary. The browser no longer runs multi-step assignment
transactions; it sends one command and treats the result as authoritative.

## 1. Commands

| RPC | Purpose | Callers |
| --- | --- | --- |
| `apply_direct_assignment` | Create, modify (add/replace days, role, status) or **move** (`p_from_job_id`) a job/technician assignment | `AssignJobDialog` |
| `remove_direct_assignment` | Remove membership + every day (+ non-final Hoja staff/contacts) | Matrix cell removal, `AssignJobDialog`, job-card removal |
| `remove_assignment_date` | Remove one active day; refuses the last day of a membership (`last_date`) | Matrix cell removal |
| `change_assignment_role` | Set or clear one department role column; recategorizes/reprices unapproved active days | Job-card role selectors (`JobAssignmentDialog`) |
| `set_assignment_status` | Manager confirm/decline; wraps `manage_assignment_lifecycle` after the shared locks (tour memberships hard-deleted on decline, decided server-side) | `AssignmentStatusDialog` |
| `get_assignment_command_state` | Membership, active days and the **state token** for a pair | dialogs, before a command |

All are `SECURITY DEFINER`, executable by `authenticated` but authorized
inside for `admin`/`management` (or `service_role`, which may pass
`p_actor_id`). Actor attribution comes from `auth.uid()`.

TypeScript wrappers live in `src/features/assignments/commands/` — use them,
never call the RPCs or write `job_assignments`/`timesheets` from a Matrix
surface (`tests/assignments/matrix-direct-write-guard.test.ts` enforces it).

### Result shape

```jsonc
{
  "ok": true,                 // false => rejected, nothing written
  "outcome": "committed",     // committed | noop | rejected
  "code": "stale_state",      // only when rejected
  "command_id": "…", "job_id": "…", "technician_id": "…",
  "assignment": { … } | null, "dates": ["2026-12-01"],
  "state_token": "…", "prior_state_token": "…",
  "added_dates": [], "removed_dates": [], "moved_from": { … }, "removed": { … },
  "conflict_override": false,
  "side_effects": [ { "kind": "flex", "action": "add", "department": "sound", "job_id": "…", "status": "pending" } ],
  "warnings": [ { "kind": "timesheet_repricing_failed", … } ],
  "replayed": false,
  "details": { … }            // rejection payload (e.g. conflicts)
}
```

### Rejections (decided before any write)

| Code | Meaning | UI |
| --- | --- | --- |
| `stale_state` | The pair changed after the dialog loaded its token | Toast + refetch; the user re-decides |
| `conflict` | Active schedule on another job on a newly added day (checked under the technician lock). `details.conflicts` has the `check_technician_conflicts` shape | Existing conflict warning; "Forzar" resends with `p_conflict_policy = 'allow'` (recorded as `conflict_override`) |
| `last_date` | Date removal of the last day | Matrix falls back to whole removal using the returned token |
| `assignment_not_found` | Role/status change on a pair without membership | Toast |
| `dryhire_job` | Dry-hire jobs have no crew by definition | Toast |
| `job_not_found`, `technician_not_found`, `role_department_mismatch`, `invalid_job_span` | Entity/role validation | Toast |

Malformed calls raise `22023`; unauthorized calls raise `42501`. Anything
after the first write raises and rolls the whole command back.

## 2. Invariants the commands guarantee

**Dry hire is out of scope everywhere.** Dry-hire jobs have no crew by
definition: the commands refuse them (`dryhire_job`), their schedule rows are
never a conflict for other jobs (commands and offer acceptance), and the
consistency diagnostics skip them. Removal commands still accept a dry-hire
pair so legacy rows can be cleaned up.

- One membership per job/technician; membership and the requested active
  schedule commit together or not at all (including category sync).
- Hard removal leaves no schedule; a date removal never removes another day
  or the membership while days remain.
- Two managers racing the same technician cannot both commit incompatible
  outcomes (technician advisory lock + under-lock conflict check + state token).
- A confirmed membership is never downgraded by an invited retry.
- `single_day`/`assignment_date` are derived deterministically from the
  coverage; active timesheets stay the date truth.
- Full coverage is every Europe/Madrid calendar day of the job span, computed
  by the database.
- Flex, email/push and repricing never decide whether core state commits.

## 3. Lock order (all assignment writers)

1. `pg_advisory_xact_lock('assignment-technician:<technician>')` — commands
   that enforce cross-job conflicts;
2. `pg_advisory_xact_lock('staffing-offer:<job>:<technician>')` for each
   touched job, **sorted by job id** (moves take two);
3. `jobs` `FOR KEY SHARE` (sorted);
4. `job_assignments` rows `FOR UPDATE` (sorted by job id);
5. technician profile `FOR KEY SHARE NOWAIT`, then timesheet rows in date order.

`assign_staffing_offer` takes step 1 too (since `20261003214000`): offer
acceptance re-checks cross-job conflicts under the technician key and raises
`P0409 assignment_conflict` before any write, which `staffing-click` records
as `auto_assign_skipped_conflict` — the same outcome as its own pre-check, so
an acceptance and a direct booking on another job for the same day can never
both commit. `remove_assignment_with_timesheets` and `toggle_timesheet_day`
start at step 2 and never take step 1 after it, so no cycle exists. `manage_assignment_lifecycle` locks membership with
`NOWAIT` and fails fast (`assignment_locked`) instead of waiting.

## 4. Idempotency and stale writes

- **Transport retry:** every command carries `p_command_id`. The ledger
  (`assignment_commands`) is checked under the pair locks: the same id and
  request replays the stored result (`replayed: true`) without repeating
  writes or side effects; the same id with a different request raises
  `command_id_reused`. The TS client retries network failures with the same
  id; dialogs keep the id while the outcome is unknown and mint a new one
  after any definitive outcome or a changed decision.
- **Stale human intent:** `p_expected_state_token` (from
  `get_assignment_command_state`) is an md5 of the membership decision
  fields and active days. A mismatch is `stale_state`. `NULL` skips the check
  (job-card removal, which is an explicit "remove this person").
- There is no `insert → catch 23505 → update` path anywhere.

## 5. Side effects and reconciliation

Committed commands return a `side_effects` plan (Flex add/remove per
department; `job.assignment.direct`, `job.assignment.confirmed` or
`assignment.removed` notification). A role change plans a Flex add/remove only
when a sound/lights role appears or is cleared.
`runAssignmentSideEffects` executes it after commit and reports each outcome
with `record_assignment_side_effects`. Failures and plans that never reported
back (5-minute grace) appear in `get_assignment_side_effect_backlog` and in
**Ajustes → Reconciliación de asignaciones** (admin/management) with a retry.
Flex add/remove are idempotent; a notification retry may notify again.

Repricing (`compute_timesheet_amount_2025`) runs inside the command per row
in a subtransaction; a failure (e.g. missing rate card) is returned in
`warnings` and never blocks the assignment. Manager-approved rows are not
recategorized.

## 6. Observability

- `assignment_commands`: command id, type, pair, actor, source, request,
  prior/result token, outcome/error code, side-effect state — readable by
  admin/management.
- `assignment_audit_log` gets `direct_assigned`, `direct_updated`,
  `date_removed` and `hard_deleted` rows carrying `command_id`.
- `get_assignment_command_metrics(p_since)`: outcome/error counts for rollout.
- `get_assignment_consistency_issues(p_from, p_limit)`: read-only
  diagnostics — `membership_without_schedule`, `schedule_without_membership`,
  `scoped_date_not_scheduled`, `declined_with_active_schedule`. No repair
  command exists; add a targeted one only if production evidence needs it.

## 7. Writer inventory (M0)

Every client path that changes assignment membership, role, status or
schedule for a job/technician pair now goes through a command:

| Writer | Path | Status |
| --- | --- | --- |
| Assign/modify/move dialog | `AssignJobDialog` → `apply_direct_assignment` / `remove_direct_assignment` | **Converged** |
| Matrix confirm/decline | `AssignmentStatusDialog` → `set_assignment_status` | **Converged** |
| Matrix cell removal (day / whole) | `useMatrixCellAssignmentRemoval` → `remove_assignment_date` / `remove_direct_assignment` | **Converged** |
| Job card: whole removal | `JobAssignmentDialog` → `useJobAssignmentsRealtime.removeAssignment` → `remove_direct_assignment` | **Converged** |
| Job card: role change | `JobAssignmentDialog` → `change_assignment_role` | **Converged** |
| Department mobile add | `MobileAssignmentsDialog` → `useJobAssignmentsRealtime.addAssignment` → `apply_direct_assignment` (add mode; membership **and** days) | **Converged** |
| Offer acceptance | `staffing-click` → `assign_staffing_offer` | Same lock contract including the technician key; cross-job conflicts enforced under it (`P0409`). Campaign UX deferred per roadmap §10 |
| Day toggle RPC | `toggle_timesheet_day` | Takes the pair key; no app caller left |

`tests/assignments/matrix-direct-write-guard.test.ts` pins every converged
surface: no chained `insert/update/delete/upsert` on `job_assignments` or
`timesheets`, no per-date toggles, legacy removal, lifecycle RPC, browser
category sync or direct Flex crew calls.

Outside assignment state (deliberately not commands):

| Writer | Why |
| --- | --- |
| Timesheet page (`useTimesheets`: create/delete rows, hours, signatures), hourly-rate overrides (`useTechnicianRateModeDates`), payout approval | Payroll records of an existing assignment; a drift they cause shows up in `get_assignment_consistency_issues` |
| Job date type off/travel (`DateTypeContextMenu`) | Job-calendar operation that voids/restores a whole date for every technician |
| Job deletion (`deleteJobAssignments`, `background-job-deletion`) | The job itself goes away; foreign keys cascade |
| Invoice receipt (`PayoutsDueFortnights`), reminder stamps | Non-assignment columns |
| Tour cascade, festival shifts, staffing campaigns | DB triggers / edge functions; deferred per roadmap §10 |

## 8. Rollout

1. `supabase db push --dry-run` against linked production; check the five
   migrations (`20261003210000`, `20261003211000`, `20261003212000`,
   `20261003213000`, `20261003214000`), their grants and the new table.
2. Deploy `staffing-click` first (it handles `P0409`; the old database never
   raises it), then apply the migrations, then deploy the client. The old
   client keeps working (existing RPCs keep their signatures and results).
3. Verify with `get_assignment_command_metrics()` and
   `get_assignment_consistency_issues()`; watch the reconciliation backlog.
4. Run the PR #992 synthetic runtime as the controlled preflight
   (`tests/assignments/matrix-failure.disposable.integration.test.tsx` now
   expects a faulted date to roll back the whole command).

## 9. Tests

- pgTAP: `direct_assignment_command.sql`, `assignment_removal_commands.sql`,
  `assignment_command_reconciliation.sql`, `assignment_role_status_commands.sql`,
  `staffing_offer_conflict_under_lock.sql`.
- Real concurrency (two psql backends, CI `rls_rpc_security_tests` job):
  `tests/assignments/direct-assignment-commands.integration.test.ts` — stale
  managers, same-day cross-job race, concurrent retry, offer acceptance, move
  vs removal, confirmation vs same-day booking, offer acceptance vs a direct
  booking elsewhere on the same day. Run locally with
  `STAFFING_TEST_DB_CONTAINER=<container> ASSIGNMENT_COMMAND_TEST_ALLOW_LOCAL=<container>`.
- Unit/component: `src/features/assignments/commands/__tests__`,
  `AssignJobDialog.test.tsx`, `useMatrixCellAssignmentRemoval.phase1.test.tsx`,
  `matrix-direct-write-guard.test.ts`.
