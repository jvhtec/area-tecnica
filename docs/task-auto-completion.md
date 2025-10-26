# Task Auto-Completion System

## Overview

The task auto-completion system automatically marks relevant tasks as "completed" when calculator PDFs (Pesos, Consumos) are successfully uploaded to job documents. This automation reduces manual work and ensures task status stays synchronized with document availability.

## How It Works

### Flow Diagram

```
User exports PDF from calculator
         ↓
PDF upload to storage (uploadJobPdfWithCleanup)
         ↓
Upload successful?
         ↓ Yes
Auto-complete matching tasks (autoCompleteTasksAfterUpload)
         ↓
Update task status to "completed"
         ↓
Log completion metadata (timestamp, user, source)
         ↓
Show success toast with completion count
```

### Key Components

1. **Database Migration** (`20260214000000_add_task_completion_tracking.sql`)
   - Adds `completed_at`, `completed_by`, and `completion_source` columns to task tables
   - Enables audit trail for both manual and automated task completions

2. **Utility Module** (`src/utils/taskAutoCompletion.ts`)
   - Core logic for finding and completing matching tasks
   - Department-aware filtering
   - Graceful error handling
   - Push notifications for completed tasks

3. **Calculator Integrations**
   - `PesosTool.tsx` - Completes all "Pesos" tasks across departments
   - `ConsumosTool.tsx` - Completes "Consumos" tasks for sound department only
   - `LightsConsumosTool.tsx` - Completes "Consumos" tasks for lights department only
   - `VideoConsumosTool.tsx` - Completes "Consumos" tasks for video department only

## Task Matching Logic

Tasks are matched by:
- **Job ID** - Must match the job for which the PDF is uploaded
- **Task Type** - Must match the calculator type (e.g., "Pesos", "Consumos")
- **Department** (optional) - For department-specific tools (Consumos), only tasks in that department are completed
- **Status** - Only incomplete tasks (not already "completed") are updated

## Completion Metadata

When a task is auto-completed, the following fields are set:

| Field | Description | Example |
|-------|-------------|---------|
| `status` | Set to "completed" | `completed` |
| `progress` | Set to 100% | `100` |
| `completed_at` | Timestamp of completion | `2024-02-14T10:30:00Z` |
| `completed_by` | User who uploaded the PDF | `user-uuid-123` |
| `completion_source` | Identifier of automation | `auto_pesos_doc` |
| `updated_at` | Update timestamp | `2024-02-14T10:30:00Z` |

### Completion Sources

| Source | Description |
|--------|-------------|
| `auto_pesos_doc` | Auto-completed via Pesos tool PDF upload |
| `auto_consumos_sound_doc` | Auto-completed via sound Consumos tool |
| `auto_consumos_lights_doc` | Auto-completed via lights Consumos tool |
| `auto_consumos_video_doc` | Auto-completed via video Consumos tool |

## Error Handling

The auto-completion system is designed to be **non-fatal**:

1. **Upload Failure** → Tasks are NOT completed (correct behavior)
2. **Auto-Completion Failure** → Upload succeeds, but tasks aren't completed (logged as warning)
3. **No Matching Tasks** → Upload succeeds, no tasks completed (logged as info, no error shown)

This ensures that document uploads never fail due to task-related issues.

## User Feedback

Users receive feedback via toast notifications:

- **No tasks completed**: "PDF has been generated and uploaded successfully."
- **Tasks completed**: "PDF uploaded successfully. 3 Pesos task(s) auto-completed."

## Department Isolation

The Consumos auto-completion is **department-specific** to prevent cross-contamination:

- Sound Consumos PDF → Only completes sound department tasks
- Lights Consumos PDF → Only completes lights department tasks  
- Video Consumos PDF → Only completes video department tasks

This is important because each department has separate Consumos workflows.

In contrast, Pesos automation completes tasks across **all departments** since weight calculations are typically shared.

## API Reference

### `autoCompleteTasksAfterUpload(params)`

Main function for task auto-completion.

**Parameters:**
```typescript
{
  jobId: string;          // Required: Job ID
  taskType: string;       // Required: Task type (e.g., "Pesos")
  department?: 'sound' | 'lights' | 'video'; // Optional: Department filter
  completionSource?: string; // Optional: Custom source identifier
}
```

**Returns:**
```typescript
{
  success: boolean;       // Whether operation completed
  completedCount: number; // Number of tasks completed
  error?: string;         // Error message if failed
}
```

### `autoCompletePesosTasks(jobId)`

Helper for Pesos tool - completes all Pesos tasks.

### `autoCompleteConsumosTasks(jobId, department)`

Helper for Consumos tools - completes tasks for specific department.

## Testing Checklist

When testing auto-completion:

- [ ] Upload succeeds and tasks are marked completed
- [ ] Completion metadata is properly logged
- [ ] Task count in toast message is accurate
- [ ] Upload failure prevents auto-completion
- [ ] No matching tasks handled gracefully (no error shown)
- [ ] Department isolation works (sound PDF doesn't complete lights tasks)
- [ ] Replacing existing document triggers completion only once
- [ ] Push notifications sent for completed tasks
- [ ] Pending task count decreases after completion

## Future Enhancements

Potential improvements to consider:

1. **Undo Auto-Completion** - Allow reverting automated completions
2. **Partial Completion** - Support completing subset of tasks based on metadata
3. **Completion Rules** - Configurable rules for which tasks to auto-complete
4. **Activity Log Integration** - Log auto-completions in activity feed
5. **Batch Operations** - Auto-complete multiple task types from single upload

## Migration Notes

### Existing Installations

The migration adds new columns to task tables. Existing tasks will have `NULL` values for completion tracking fields, which is expected. Only newly completed tasks (manual or automated) will have these fields populated.

### Rollback

If needed, the migration can be rolled back with:

```sql
ALTER TABLE public.sound_job_tasks 
  DROP COLUMN IF EXISTS completed_at,
  DROP COLUMN IF EXISTS completed_by,
  DROP COLUMN IF EXISTS completion_source;

-- Repeat for lights_job_tasks and video_job_tasks
```

## Support

For issues or questions about task auto-completion:

1. Check browser console for detailed logs
2. Verify task_type matches exactly (case-sensitive)
3. Confirm user has permission to update tasks
4. Review Supabase logs for database errors
