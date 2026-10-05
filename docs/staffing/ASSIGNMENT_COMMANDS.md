# Assignment commands (Matrix hardening)

**Status:** implemented on `feat/matrix-hardening-commands` (2026-10-03)
**Roadmap:** `docs/staffing/MATRIX_HARDENING_ROADMAP_2026-10-03.md` (PR #993)

Manual Matrix operations and direct assignment persist through one database
command boundary. The browser no longer runs multi-step assignment
transactions; it sends one command and treats the result as authoritative.

## 1. Commands

| RPC | Purpose | Callers |
| --- | --- | --- |
| `apply_direct_assignment` | Create, modify (add/replace days, role, status) or **move** (`p_from_job_id`) a job/technician assignment | Matrix command runner (`src/features/matrix-v2/commandRunner.ts`), `useJobAssignmentsRealtime` |
| `remove_direct_assignment` | Remove membership + every day (+ non-final Hoja staff/contacts) | Matrix command runner, job-card removal |
| `remove_assignment_date` | Remove one active day; refuses the last day of a membership (`last_date`) | Matrix command runner |
| `change_assignment_role` | Set or clear one department role column; recategorizes/reprices unapproved active days | Job-card role selectors (`JobAssignmentDialog`) |
| `set_assignment_status` | Manager confirm/decline; wraps `manage_assignment_lifecycle` after the shared locks (tour memberships hard-deleted on decline, decided server-side) | Matrix command runner |
| `get_assignment_command_state` | Membership, active days and the **state token** for a pair | the runner and job-card dialogs, before a command |
| `get_job_assignment_command_states` | Every member's token for one job plus the token of an absent pair (`absent_state_token`) | job-card dialogs (`useJobAssignmentsRealtime({ manageCommands })`) |

All are `SECURITY DEFINER`, executable by `authenticated` but authorized
inside for `admin`/`management` (or `service_role`, which may pass
`p_actor_id`). Actor attribution comes from `auth.uid()`.

TypeScript wrappers live in `src/features/assignments/commands/` — use them,
never call the RPCs or write `job_assignments`/`timesheets` from a Matrix
surface (`tests/assignments/matrix-direct-write-guard.test.ts` and the writer
inventory in §7 enforce it).

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
  "side_effects": [ { "effect_id": "<command_id>:0", "kind": "flex", "action": "add", "department": "sound", "job_id": "…", "status": "pending" } ],
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
| `approved_timesheet` | The command would delete or void an approved day (`details.dates`) | Toast; un-approve it in Timesheets first |
| `invalid_role` | Role code not in `assignment_role_codes` | Toast |
| `role_department_mismatch` | Role discipline differs from the column or the technician's department (logistics staff take production roles) | Toast |
| `job_not_found`, `technician_not_found`, `invalid_job_span` | Entity validation | Toast |

Malformed calls raise `22023`; unauthorized calls raise `42501`. Anything
after the first write raises and rolls the whole command back.

## 2. Invariants the commands guarantee

**Approved timesheets are financial records.** No command deletes or voids a
day whose timesheet is approved (`approved_by_manager` or `status =
'approved'`): replacing days, superseding leftovers, the source of a move,
whole removal, date removal and a manager decline all reject with
`approved_timesheet` before any write. Un-approve the day on the timesheet
page first. Role changes never recategorize approved rows either.

**Roles are validated by the database.** `assignment_role_codes` mirrors
`src/types/roles.ts` (pinned by `tests/assignments/assignment-role-registry.test.ts`).
Commands reject unknown codes, a code in the wrong column, and a code outside
the technician's discipline (`assignment_role_discipline`: logistics → production).
Clearing a role is always allowed.

**Production/logistics roles never select compensation.** `PROD-*` codes are
staffing/operational labels: they are validated, stored in `production_role`,
locked, ledgered and replayed like any other role, but they never choose the
Técnico/Especialista/Responsable category. `assignment_role_category` only
reads `SND`/`LGT`/`VID` codes (the same rule as `getCategoryFromAssignment` in
the client), so a production role change never recategorizes timesheets, and
`resolve_category_for_timesheet` and the `compute_timesheet_amount_2025` role
fallback read only sound/lights/video roles, unchanged from before these
commands. Production and logistics pay keeps coming from the existing
mechanism (last known category, `profiles.default_timesheet_category`, custom
rates). Sound/lights/video keep their R/E/T rate semantics. Pinned by
`assignment_command_hardening.sql`.

**Status no-ops write nothing.** Confirming a confirmed membership, or
declining an already declined one with no active days, returns `outcome:
noop` without touching the lifecycle, the audit log or side effects.

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
  `get_assignment_command_state` / `get_job_assignment_command_states`) is an
  md5 of the membership decision fields and active days. A mismatch is
  `stale_state`. **Every interactive command must send one** (a move also
  sends the source pair's token); a call without it raises `22023`. Only
  `service_role` may omit it. Surfaces **fail closed**: if the authoritative
  state cannot be loaded they disable the action and show "No se pudo cargar
  el estado actual de la asignación", never guess.
- There is no `insert → catch 23505 → update` path anywhere.

## 5. Side effects and reconciliation

Committed commands return a `side_effects` plan (Flex add/remove per
department; `job.assignment.direct`, `job.assignment.confirmed` or
`assignment.removed` notification). A role change plans a Flex add/remove only
when a sound/lights role appears or is cleared.
Each effect carries a stable identity, `effect_id = <command_id>:<index>`.

Execution is claimed: `runAssignmentSideEffects` (and the reconciliation
retry) first calls `claim_assignment_side_effects(command, lease)`, which
returns a `claim_token` and only the effects still pending/failed; a second
runner while the lease is held gets nothing. Outcomes are reported with
`record_assignment_side_effects(command, claim_token, results)`, which rejects
duplicate indexes and ignores reports from a runner that no longer holds the
claim (`ignored_indexes`). Failures and plans that never reported back appear
in `get_assignment_side_effect_backlog` and in **Ajustes → Reconciliación de
asignaciones** (admin/management) with a retry.

Flex add/remove are idempotent. Notifications send `idempotency_key =
effect_id` to the `push` function, which keys the event as
`<type>:idem:<key>` and claims it in the delivery inbox, so a retry of an
already delivered notification does not notify again.

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
| Matrix assign / modify / move / confirm / decline / remove (inspector, keyboard, job focus, batch) | `commandRunner` → `apply_direct_assignment` / `set_assignment_status` / `remove_assignment_date` / `remove_direct_assignment` / `unconfirm_assignment` | **Converged** |
| Job card: whole removal | `JobAssignmentDialog` → `useJobAssignmentsRealtime.removeAssignment` → `remove_direct_assignment` | **Converged** |
| Job card: role change | `JobAssignmentDialog` → `change_assignment_role` | **Converged** |
| Department mobile add | `MobileAssignmentsDialog` → `useJobAssignmentsRealtime.addAssignment` → `apply_direct_assignment` (add mode; membership **and** days) | **Converged** |
| Offer acceptance | `staffing-click` → `assign_staffing_offer` | Same lock contract including the technician key; cross-job conflicts enforced under it (`P0409`). Campaign UX deferred per roadmap §10 |
| Day toggle RPC | `toggle_timesheet_day` | Takes the pair key; no app caller left |

`tests/assignments/matrix-direct-write-guard.test.ts` pins every converged
surface: no `insert/update/delete/upsert` on `job_assignments` or
`timesheets` (backticks and intervening filters included), no per-date
toggles, legacy removal, lifecycle RPC, browser category sync or direct Flex
crew calls.

`tests/assignments/assignment-writer-inventory.test.ts` scans every app and
edge-function source for table writes (chained or through a stored builder)
and assignment RPC calls, and compares them with
`tests/assignments/assignment-writers.allowlist.json`. A new writer, a new
kind of write in a listed file, a stale entry or an entry without a reason
fails; only the command client may call the command RPCs.

Outside assignment state (deliberately not commands):

| Writer | Why |
| --- | --- |
| Timesheet page (`useTimesheets`: create/delete rows, hours, signatures), hourly-rate overrides (`useTechnicianRateModeDates`), payout approval | Payroll records of an existing assignment; a drift they cause shows up in `get_assignment_consistency_issues` |
| Job date type off/travel (`DateTypeContextMenu`) | Job-calendar operation that voids/restores a whole date for every technician |
| Job deletion (`deleteJobAssignments`, `background-job-deletion`) | The job itself goes away; foreign keys cascade |
| Invoice receipt (`PayoutsDueFortnights`), reminder stamps | Non-assignment columns |
| Tour cascade, festival shifts, staffing campaigns | DB triggers / edge functions; deferred per roadmap §10 |

## 8. Rollout

1. Human-run `supabase db push --linked --dry-run` against production; check the seven
   migrations (`20261003210000`, `20261003211000`, `20261003212000`,
   `20261003213000`, `20261003214000`, `20261004165712`,
   `20261004170928`), their grants and the new tables
   (`assignment_commands`, `assignment_role_codes`, `flex_crew_reconciliation_gates`).
   Before deploying, list legacy rows the stricter role validation would
   refuse to edit (unregistered codes, or a code outside the technician's
   discipline); removing them still works, but a role change or modify is
   rejected until the role is corrected:

   ```sql
   SELECT ja.job_id, ja.technician_id, p.department, r.col, r.code
   FROM job_assignments ja JOIN profiles p ON p.id = ja.technician_id
   CROSS JOIN LATERAL (VALUES ('sound', ja.sound_role), ('lights', ja.lights_role),
     ('video', ja.video_role), ('production', ja.production_role)) r(col, code)
   WHERE r.code IS NOT NULL AND r.code <> 'none'
     AND (r.code NOT IN (SELECT code FROM assignment_role_codes)
       OR r.col IS DISTINCT FROM CASE p.department WHEN 'logistics' THEN 'production' ELSE p.department END);
   ```
2. Deploy `staffing-click` first (it handles `P0409`; the old database never
   raises it) and `push` (it accepts `idempotency_key`). A human applies the
   migrations before deploying `manage-flex-crew-assignments`,
   `sync-flex-crew-for-job` and `secure-flex-api`, which require the new gate
   RPCs/table. Retire/drain old Flex handlers and outstanding requests before
   enabling retries; their writes cannot be fenced retroactively. Deploy the
   client last. The old client keeps working with legacy crew add/remove bodies;
   those bodies now request reconciliation rather than replaying historical intent.
3. Verify with `get_assignment_command_metrics()` and
   `get_assignment_consistency_issues()`; watch the reconciliation backlog.
4. Run the PR #992 synthetic runtime as the controlled preflight
   (`tests/assignments/matrix-failure.disposable.integration.test.tsx` calls the
   commands directly and expects a faulted date to roll back the whole command).

### Flex retry ordering and recovery

Single and bulk crew sync use the same non-expiring gate per physical Flex
element, including all local aliases. Current explicit sound/lights assignment
roles determine membership. Clearing a role does not recreate it from the
profile department; soft decline preserves direct membership and hard-deleted
tour membership is absent. Missing resources and unsupported lights dictionaries
remain diagnostic; unknown provider contacts are retained because ownership
cannot be proved. Inventory any legacy roleless memberships before rollout.
Departments without a mapped physical crew call return a successful skip rather
than an endlessly retryable effect. Lookup failures remain visible errors;
this skip never unlocks an existing physical gate or clears its contact journal.

Assignment transactions can commit while a worker talks to Flex. That worker
rereads current intent, reconciles again when it changes, and validates the final
state token before success. This is eventual reconciliation, not an atomic
transaction spanning PostgreSQL and Flex. A delayed historical retry cannot
reverse a newer completed reconciliation through either crew endpoint.

Every mutating request is durably admitted before dispatch. A verified add's
local mapping and settlement commit together. Network timeouts, HTTP 408/202/5xx,
unconsumed bodies, ambiguous RPC responses or crashes retain busy/uncertain
ownership. Neither the effect's 120-second claim lease nor elapsed gate age
permits another external writer. The generic proxy refuses crew mutation paths
and requires positive classification for permitted non-crew operations. The
finite crew header fields used by job date/name sync (name, document number,
planned start/end) remain supported; they cannot mutate contacts or business roles.

The gate also journals contact ownership when claimed, mapped or added, without
foreign keys to deletable source rows. Reconciliation reads this journal even
when a source cascade removes mappings before its first read. Only verified
successful reconciliation clears it. An error with journaled contacts retains
the busy owner, including a settled role refusal or failed projection; operator
recovery is required rather than forgetting the contact and admitting a retry.

For a blocked gate, inspect its state, owner, timestamp and operation descriptor
with service privileges. Do not force-unlock from the UI or based on age. Human
recovery must first retire the original worker and prove that its provider request
has completed or cannot execute later. Reconcile the provider's observed contact
identities with the local mappings before clearing ownership under a deliberate
operator transaction. If settlement cannot be proven, keep the gate blocked.
There is no automatic takeover or client recovery RPC. Job deletion can remove
local mappings; the physical gate and its outstanding descriptor survive it.

Rollback must preserve this ordering boundary: pause Flex retries, retire/drain
workers, then forward-fix guarded handlers/RPCs. Do not redeploy historical
unfenced crew handlers or drop busy/uncertain gates. Reverting the frontend alone
does not require deleting additive database state.

## 9. Tests

- pgTAP: `direct_assignment_command.sql`, `assignment_removal_commands.sql`,
  `assignment_command_reconciliation.sql`, `assignment_role_status_commands.sql`,
  `assignment_command_hardening.sql` (registry, production/logistics category
  and rate, approved protection, status no-ops, tour Flex, required tokens),
  `staffing_offer_conflict_under_lock.sql`.
- Fail-closed authorization and physical crew ownership:
  `assignment_command_missing_identity.sql`, `flex_crew_reconciliation.sql`;
  shared coordinator/proxy and HTTP adapter tests; opt-in
  `flex-reconciliation.integration.test.ts` runs historical retry paths against
  real PostgREST and tests independent claim/retarget backends. CI includes all
  seven cases in `scripts/ci/test-staffing-postgrest.sh`. Locally set
  `STAFFING_TEST_REST_URL` to a loopback HTTP endpoint with an explicit port,
  `STAFFING_TEST_DB_CONTAINER` to an owned disposable target, and repeat that
  container in `ASSIGNMENT_COMMAND_TEST_ALLOW_LOCAL` to opt in.
- Real concurrency (two psql backends, CI `rls_rpc_security_tests` job):
  `tests/assignments/direct-assignment-commands.integration.test.ts` — stale
  managers, same-day cross-job race, concurrent retry, offer acceptance, move
  vs removal, confirmation vs same-day booking, offer acceptance vs a direct
  booking elsewhere on the same day. Run locally with
  `STAFFING_TEST_DB_CONTAINER=<container> ASSIGNMENT_COMMAND_TEST_ALLOW_LOCAL=<container>`.
- Unit/component: `src/features/assignments/commands/__tests__`,
  `src/features/matrix-v2/__tests__/commandRunner.test.tsx` (runner, undo, deferred effects),
  `matrix-direct-write-guard.test.ts`, `assignment-writer-inventory.test.ts`,
  `assignment-role-registry.test.ts`.
