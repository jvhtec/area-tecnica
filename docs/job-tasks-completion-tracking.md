# Job Tasks Completion Tracking

## Date: 2025
## Feature: Task Completion Metadata

## Overview

This document describes the addition of completion tracking metadata to the unified `job_tasks` table and its associated views.

## Schema Changes

### Added Columns to `public.job_tasks`

Three new columns have been added to track task completion:

1. **`completed_at`** (`timestamptz`)
   - Timestamp when the task was marked as complete
   - Can be set manually by users or automatically by the system
   - NULL for tasks that are not yet completed

2. **`completed_by`** (`uuid`)
   - References `public.profiles(id)`
   - The user who completed the task (manual completion) or triggered the automation
   - NULL for tasks that are not yet completed

3. **`completion_source`** (`text`)
   - Describes how the task was completed
   - Example values: `'manual'`, `'auto_pesos_doc'`, `'auto_consumos_doc'`, `'backfill'`
   - Allows tracking of automated vs manual completions
   - NULL for tasks that are not yet completed

### Indexes Added

To support efficient queries on completion status:

1. **`idx_job_tasks_status_completed_at`**
   - Indexes: `status, completed_at DESC`
   - Partial index: `WHERE status = 'completed'`
   - Purpose: Fast retrieval of completed tasks sorted by completion time

2. **`idx_job_tasks_completed_by`**
   - Indexes: `completed_by`
   - Partial index: `WHERE completed_by IS NOT NULL`
   - Purpose: Fast lookups of tasks completed by specific users

3. **`idx_job_tasks_status_pending`**
   - Indexes: `status, due_at`
   - Partial index: `WHERE status IN ('not_started', 'in_progress')`
   - Purpose: Efficient retrieval of pending tasks ordered by due date

### Data Backfill

Existing tasks with `status = 'completed'` have been backfilled:
- `completed_at` set to `updated_at` (or `created_at` or `now()` as fallback)
- `completion_source` set to `'backfill'`
- `completed_by` remains NULL (historical data unavailable)

## View Updates

### Department-Specific Views

The following views now include completion metadata:
- `public.sound_job_tasks_v`
- `public.lights_job_tasks_v`
- `public.video_job_tasks_v`

These views filter the unified `job_tasks` table by department and automatically include the new completion columns.

### `public.pending_tasks_view`

Updated to include the three completion columns:
- `completed_at`
- `completed_by`
- `completion_source`

Note: Since this view filters for pending tasks (`status != 'completed'`), these fields will typically be NULL. They are included for consistency and future extensibility.

## RLS Policies

New Row-Level Security policies have been added to `public.job_tasks`:

1. **"Management can manage all job tasks"**
   - Scope: ALL operations
   - Users: admin, management, logistics
   - Allows: Full CRUD on all tasks including completion fields

2. **"Job participants can view job tasks"**
   - Scope: SELECT
   - Users: Technicians assigned to the job, task assignees, task creators
   - Allows: View all fields including completion metadata

3. **"Job participants can update job tasks"**
   - Scope: UPDATE
   - Users: Technicians assigned to the job or task
   - Allows: Update task fields including marking as complete and setting completion metadata

4. **"Authenticated users can create job tasks"**
   - Scope: INSERT
   - Users: Management roles or technicians assigned to the job
   - Allows: Create new tasks

These policies ensure that:
- Only authorized users can mark tasks as complete
- Completion metadata is protected from unauthorized modification
- Task assignees and job participants can update their own tasks

## TypeScript Types

The TypeScript types in `src/integrations/supabase/types.ts` have been updated to include:

1. **`Database.public.Tables.job_tasks`**
   - Added the unified `job_tasks` table with all completion fields
   - Includes Row, Insert, and Update types
   - Full relationship definitions for foreign keys

2. **`Database.public.Views.sound_job_tasks_v`**
3. **`Database.public.Views.lights_job_tasks_v`**
4. **`Database.public.Views.video_job_tasks_v`**
   - Added view type definitions with completion fields
   - Match the structure of the underlying `job_tasks` table

5. **`Database.public.Views.pending_tasks_view`**
   - Updated to include completion metadata fields

## Migration Files

- **`20260215000000_add_job_tasks_completion_columns.sql`**
  - Adds columns to `job_tasks` table
  - Creates indexes
  - Backfills existing data
  - Updates views
  - Adds RLS policies

## Usage Example

### Marking a Task Complete (Manual)

```typescript
const { error } = await supabase
  .from('job_tasks')
  .update({
    status: 'completed',
    progress: 100,
    completed_at: new Date().toISOString(),
    completed_by: userId,
    completion_source: 'manual'
  })
  .eq('id', taskId);
```

### Auto-Completion from Document Upload

```typescript
const { error } = await supabase
  .from('job_tasks')
  .update({
    status: 'completed',
    progress: 100,
    completed_at: new Date().toISOString(),
    completed_by: userId,
    completion_source: 'auto_pesos_doc'
  })
  .eq('id', taskId);
```

### Querying Completed Tasks

```typescript
const { data, error } = await supabase
  .from('job_tasks')
  .select('*, completed_by(first_name, last_name)')
  .eq('status', 'completed')
  .order('completed_at', { ascending: false })
  .limit(10);
```

## Notes

- The old department-specific tables (`sound_job_tasks`, `lights_job_tasks`, `video_job_tasks`) already have completion columns from migration `20260214000000_add_task_completion_tracking.sql`
- The unified `job_tasks` table represents the future architecture
- Both systems coexist during the migration period
- The completion metadata enables better tracking of automated task completion workflows
- The `completion_source` field can be extended with new values as automation features are added

## Related Files

- Migration: `/supabase/migrations/20260215000000_add_job_tasks_completion_columns.sql`
- Types: `/src/integrations/supabase/types.ts`
- Table definition: `/supabase/migrations/20250926120000_unified_tasks.sql`
