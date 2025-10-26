# Task Completion Service

## Overview

The `taskCompletion.ts` service provides a centralized, reusable API for completing and reverting tasks across all departments (sound, lights, video). This service ensures consistent completion metadata tracking and push notification behavior.

## Key Features

- **Single Source of Truth**: All task completion logic is centralized in one place
- **Department Agnostic**: Automatically handles the correct table based on department
- **Metadata Tracking**: Records `completed_at`, `completed_by`, and `completion_source`
- **Push Notifications**: Automatically broadcasts `task.completed` events
- **Error Handling**: Gracefully handles errors without throwing
- **TypeScript Support**: Fully typed for compile-time safety

## API Reference

### `completeTask(params)`

Mark a single task as completed.

**Parameters:**
```typescript
{
  taskId: string;           // The task ID to complete
  department: Department;    // 'sound' | 'lights' | 'video'
  actorId?: string | null;  // User ID who completed the task (defaults to current user)
  source?: CompletionSource; // Completion source (defaults to 'manual')
  jobId?: string;           // Optional job ID for push notification context
  tourId?: string;          // Optional tour ID for push notification context
}
```

**Returns:**
```typescript
{
  success: boolean;
  error?: string;
}
```

**Example:**
```typescript
import { completeTask } from '@/services/taskCompletion';

const result = await completeTask({
  taskId: 'task-123',
  department: 'sound',
  source: 'manual',
  jobId: 'job-456',
});

if (result.success) {
  console.log('Task completed successfully');
} else {
  console.error('Failed to complete task:', result.error);
}
```

### `revertTask(params)`

Revert a task from completed status back to an active state.

**Parameters:**
```typescript
{
  taskId: string;           // The task ID to revert
  department: Department;    // 'sound' | 'lights' | 'video'
  newStatus: 'not_started' | 'in_progress'; // New active status
}
```

**Returns:**
```typescript
{
  success: boolean;
  error?: string;
}
```

**Example:**
```typescript
import { revertTask } from '@/services/taskCompletion';

const result = await revertTask({
  taskId: 'task-123',
  department: 'sound',
  newStatus: 'in_progress',
});
```

### `bulkCompleteTasks(params)`

Bulk complete tasks matching the given criteria.

**Parameters:**
```typescript
{
  jobId?: string;           // Job ID to match tasks against (one of jobId or tourId required)
  tourId?: string;          // Tour ID to match tasks against (one of jobId or tourId required)
  taskType: string;         // Task type to complete (e.g., "Pesos", "Consumos")
  department?: Department;  // Optional department filter (completes across all if not provided)
  actorId?: string | null;  // User ID who triggered the completion (defaults to current user)
  source?: CompletionSource; // Custom source identifier (defaults based on taskType)
}
```

**Returns:**
```typescript
{
  success: boolean;
  completedCount: number;
  error?: string;
}
```

**Example:**
```typescript
import { bulkCompleteTasks } from '@/services/taskCompletion';

// Complete all Pesos tasks for a job across all departments
const result = await bulkCompleteTasks({
  jobId: 'job-456',
  taskType: 'Pesos',
  source: 'auto_pesos_doc',
});

console.log(`Completed ${result.completedCount} tasks`);

// Complete Consumos tasks for a specific department only
const result2 = await bulkCompleteTasks({
  jobId: 'job-456',
  taskType: 'Consumos',
  department: 'sound',
  source: 'auto_consumos_sound_doc',
});
```

## Completion Sources

The `completion_source` field tracks how a task was completed:

- `'manual'` - Manually completed by a user via UI
- `'auto_pesos_doc'` - Auto-completed after Pesos PDF upload
- `'auto_consumos_sound_doc'` - Auto-completed after Sound Consumos PDF upload
- `'auto_consumos_lights_doc'` - Auto-completed after Lights Consumos PDF upload
- `'auto_consumos_video_doc'` - Auto-completed after Video Consumos PDF upload
- Custom strings - Can pass any string for custom automation scenarios

## Integration Points

### 1. Manual Completion (UI)

Used by `useTaskMutations.setStatus` when users manually change task status:

```typescript
// src/hooks/useTaskMutations.ts
import { completeTask, revertTask } from '@/services/taskCompletion';

const setStatus = async (id: string, status: 'not_started'|'in_progress'|'completed') => {
  if (status === 'completed') {
    await completeTask({
      taskId: id,
      department,
      source: 'manual',
      jobId,
      tourId,
    });
  } else {
    await revertTask({
      taskId: id,
      department,
      newStatus: status,
    });
  }
};
```

### 2. Pending Tasks Modal

Used by `useCompleteTask` hook for the pending tasks modal:

```typescript
// src/hooks/useCompleteTask.ts
import { completeTask } from '@/services/taskCompletion';

const result = await completeTask({
  taskId,
  department,
  actorId: userId,
  source: 'manual',
});
```

### 3. Auto-Completion (Document Uploads)

Used by `taskAutoCompletion.ts` utility after document uploads:

```typescript
// src/utils/taskAutoCompletion.ts
import { bulkCompleteTasks } from '@/services/taskCompletion';

export async function autoCompleteTasksAfterUpload(params) {
  return bulkCompleteTasks({
    jobId: params.jobId,
    taskType: params.taskType,
    department: params.department,
    source: params.completionSource,
  });
}
```

## Push Notifications

All task completions automatically trigger a `task.completed` push notification with the following payload:

```typescript
{
  action: 'broadcast',
  type: 'task.completed',
  job_id: string | undefined,
  tour_id: string | undefined,
  recipient_id: string | undefined,
  user_ids: string[],
  task_id: string,
  task_type: string,
  completion_source: string,
}
```

Notifications are fire-and-forget - failures are logged but do not affect the completion result.

## Error Handling

The service follows a non-throwing error pattern:

- All functions return a result object with `success: boolean`
- Errors are logged to console with descriptive prefixes
- Database errors are caught and returned in the `error` field
- Partial failures in bulk operations continue processing remaining items

## Testing

Unit tests are provided in `taskCompletion.test.ts`. Run tests with:

```bash
npm run test
```

## Migration Notes

This service replaces duplicated completion logic that previously existed in:

- `useTaskMutations.setStatus` - Now delegates to `completeTask` / `revertTask`
- `useCompleteTask` - Now delegates to `completeTask`
- `taskAutoCompletion.ts` - Now delegates to `bulkCompleteTasks`

All legacy completion code has been removed to prevent inconsistencies.
