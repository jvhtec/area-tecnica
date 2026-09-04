# Setup workflows

This is an optional orchestration layer for resumable preparation. Historical
entities need no backfill. Canonical job data, personnel requirements, documents,
Flex folders and technical calculations remain in their existing tables and tools.

## Architecture and access

The feature lives in `src/features/setup-workflows`: pure definitions, generation,
reconciliation, progress and transition helpers; a Supabase service; TanStack Query
hooks; and the reusable `SetupWorkflowProgress` component (Spanish/shadcn).
The operational Job flow is exposed at `/jobs/:jobId/setup`; `/jobs/setup/new`
creates a normal Job with the existing dialog and then hands it to that flow.

`setup_workflows` references an existing entity through `type` + `entity_id`.
Generated, nullable foreign-key columns enforce references to jobs, tours and
tour_dates respectively. Deleting the canonical entity cascades to its workflow
history, like other entity-owned records. Wizard state is JSON, not canonical data.
User references use profiles and become null on profile deletion.

Reads use RLS and the existing `is_admin_or_management()` policy. Browser writes
are only allowed through `mutate_setup_workflow`, which verifies that same policy
and the authenticated actor. Responsibility and assignment are metadata; assigning
a technician does not grant access.

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
other sessions. There is no new realtime infrastructure for this feature.

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

## Job preparation integration

Project Management exposes two opt-in entry points without changing the existing
creation flow: **Preparación guiada** for a new Job and **Preparar** on editable Job
cards. Starting preparation generates tasks from the Job's canonical departments.
The page persists the current step before navigation and requires the operator to
confirm completion after doing the work; opening a tool never completes a task.
Existing Job cards label this action **Preparación guiada**; the page-level **Nuevo
trabajo guiado** action creates a Job first.

`jobTaskActions.ts` is the central adapter from generated setup keys to existing
tools. Basic fields and departments open `EditJobDialog`; personnel opens
`JobRequirementsEditor`; Sound/Lights/Video document tasks open the existing task
manager; Pesos, Consumos and Memoria tasks use their existing job-aware routes;
Estructura reuses the motor preparation and certificate actions. Flex returns to
the exact Job card in Project Management, where the established Flex folder picker
and provisioning logic remains the only writer.
Routed tools receive a validated setup return target. The app shell keeps a visible
**Volver a preparación guiada** action on those screens, and existing tool back
buttons honor the same target where present.

When departments change, **Actualizar tareas** reconciles generated requirements.
The service preserves status and audit history for unchanged or retired tasks. A
Only an `in_progress` workflow can enter review; database completion rejects unresolved
required tasks or blockers under the same row lock.

Tour and Tour Date definitions remain ready for later route-level consumers. They
should use the same hooks and action-adapter pattern rather than putting Supabase
queries or task-key switches in React views.

## Verification and release

Run `npm run dev` and use `/jobs/setup/new` or the **Preparar** action on a Job card.
This is the real application flow and requires the setup workflow migrations on the
connected Supabase project. `/jobs/setup/new` first creates the canonical Job and
then writes workflow orchestration records. Tool actions continue through their
established canonical services, so their normal domain writes remain expected.

Vitest covers definitions, deterministic generation, reconciliation, progress,
transitions, service failure/resume behavior and component rendering. pgTAP tests
exercise real RLS/RPC access, duplicate prevention, persistence, reconciliation,
completion rules and atomic rollback.

This is a database change: run migration ordering, local migration apply, DB lint
and pgTAP in addition to the normal TypeScript/lint/test/build gates. Production
requires a human-run `supabase db push --linked --dry-run` and migration apply.
Code rollback is a PR revert; keep the additive tables/history and forward-fix SQL
instead of dropping records. No existing production flow depends on these tables.
