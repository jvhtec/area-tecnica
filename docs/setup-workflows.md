# Setup workflow foundation (PR 1)

This is an optional orchestration layer. No existing route imports it and no job,
tour, date, Flex folder, personnel assignment, document or technical calculation
is created or changed by it. Historical entities need no backfill.

## Architecture and access

The feature lives in `src/features/setup-workflows`: pure definitions, generation,
reconciliation, progress and transition helpers; a Supabase service; TanStack Query
hooks; and the display-only `SetupWorkflowProgress` component (Spanish/shadcn).

`setup_workflows` references an existing entity through `type` + `entity_id`.
Generated, nullable foreign-key columns enforce references to jobs, tours and
tour_dates respectively. Deleting the canonical entity cascades to its workflow
history, like other entity-owned records. Wizard state is JSON, not canonical data.
User references use profiles and become null on profile deletion.

Reads use RLS and the existing `is_admin_or_management()` policy. Browser writes
are only allowed through `mutate_setup_workflow`, which verifies that same policy
and the authenticated actor. Responsibility and assignment are metadata; assigning
a technician does not grant access. Broader delegation is a later PR.

The generated database file is deliberately untouched (repository convention).
`database.ts` adds manually maintained types using the existing typed-client
extension pattern from consumos components. Regeneration can replace this extension
once these migrations are applied to a development schema.

## Lifecycle and concurrency

- draft → in_progress or cancelled
- in_progress → review, complete or cancelled
- review → in_progress, complete or cancelled
- complete/cancelled are immutable history

Same-status transitions are rejected; they are not transitions. `resumeWorkflow`
loads persisted data without changing status, including completed/cancelled history.
Task states are pending/completed/skipped/blocked. Completed or skipped tasks must
be reopened to pending before another result. Blocked tasks may return to pending,
complete or skip. Reopening clears the current completion actor/timestamp.

Creation and initial task insertion are one transaction. A partial unique index
allows one active workflow per type/entity while retaining terminal histories.
Concurrent/duplicate creation returns `duplicate_workflow`; callers should load
the active workflow with `getWorkflowForEntity`, not create another record.
Every mutation locks the parent workflow before touching state or tasks. This
serializes sync, completion and task updates across sessions. Completion validates
the current task rows under that lock. A failed operation rolls back fully.

State updates shallow-merge top-level keys inside PostgreSQL. Different step keys
are preserved; concurrent writes to the same key are last-writer-wins. Use separate
keys for independent drafts and send a complete subtree when editing that key.
JSON null is a stored value, not a delete operation. Persist each meaningful form
change; await mutations before navigation. Query hooks invalidate the entire feature
scope after writes (including uncertain failures); ordinary refetch-on-focus handles
other sessions. There is no new realtime infrastructure in PR 1.

## Definitions, keys and reconciliation

Sequences are centralized in `definitions.ts`; navigation uses `getNextStep` and
`getPreviousStep`. SQL checks mirror the allowed steps as a persistence invariant.
Keep both in sync and run the domain/database tests when changing definitions.

Department configuration covers sound, lights, video, production, legacy personnel
and the existing `ESTRUCTURA_DEPARTMENT`. It deliberately does not expand the
global Department union. Technical names match `constants/taskTypes.ts` (QT,
Rigging Plot, Prediccion, Memorias técnicas, Pesos, Consumos, PS), with personnel
and Flex setup checks added. Estructura covers preparation, weights, pull sheet
and motor certificates. These are initial setup requirements, not an automatic
assessment of whether a document is applicable to every production.

Keys use `requirement:department` for department tasks and `requirement` for
global tasks. The supported identifiers cannot contain a colon. Departments are
deduplicated and sorted before generation; global Flex is generated once. The
generation function is pure and deterministic. Persisted task queries sort by key.

Sync inserts new tasks, refreshes definition fields and merges definition metadata
into existing metadata. Definition keys win when metadata keys overlap. Unchanged
task statuses, IDs and completion evidence survive. Removed tasks retain their
status and metadata with `applicable=false`; no task is silently deleted or marked
completed. Reintroduction sets applicability true and restores the previous status,
including blockers. Repeated identical sync creates no duplicates and does not touch
task timestamps. The workflow timestamp records each successful operation.

## Progress policy

Only applicable tasks count. Completed tasks count toward progress; optional skipped
tasks count as resolved, but remain separate from the completed count. Required
skips are unresolved and prevent administrative completion. Any applicable blocker,
even optional, prevents completion. Pending optional tasks do not prevent
administrative completion, so completion need not mean 100% of optional work.
An empty active task list is 0% and cannot complete.

## Future wizard integration

1. Use `useSetupWorkflowForEntity(type, entityId)`; null is valid for historical data.
2. Explicitly create a workflow for an existing canonical entity using
   `useCreateSetupWorkflow` with its department identifiers. Creation does not
   perform any canonical entity or provisioning work.
3. Read via `useSetupWorkflow` and `useSetupWorkflowTasks`. Use central definitions
   for steps and `useUpdateSetupWorkflow` for state, step, lifecycle, task and sync
   changes. Render `SetupWorkflowProgress` with the fetched rows.
4. When canonical departments change, explicitly sync the new requirements.
   Mark tasks completed only after the canonical operation is confirmed.
5. Later PRs own technical review screens, applicability policy, provisioning,
   packages, inheritance/default resolution and wizard navigation.

## Verification and release

For a local, database-free component demo, run `npm run dev` and open
`/setup-workflow-demo.html`. It supports department reconciliation and task-state
changes in memory. Reloading resets this demonstration; it does not claim to test
server persistence. The standalone entry is not included in the production build.

Vitest covers definitions, deterministic generation, reconciliation, progress,
transitions, service failure/resume behavior and component rendering. pgTAP tests
exercise real RLS/RPC access, duplicate prevention, persistence, reconciliation,
completion rules and atomic rollback.

This is a database change: run migration ordering, local migration apply, DB lint
and pgTAP in addition to the normal TypeScript/lint/test/build gates. Production
requires a human-run `supabase db push --linked --dry-run` and migration apply.
Code rollback is a PR revert; keep the additive tables/history and forward-fix SQL
instead of dropping records. No existing production flow depends on these tables.
