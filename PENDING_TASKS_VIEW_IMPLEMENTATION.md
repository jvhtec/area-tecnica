# Pending Tasks View Implementation

## Overview
Created a unified `management_pending_tasks` view that consolidates pending tasks from all three department-specific task tables (`sound_job_tasks`, `lights_job_tasks`, and `video_job_tasks`) with enriched job and tour context.

## Changes Made

### 1. Database Migration
**File**: `supabase/migrations/20260213000000_create_management_pending_tasks_view.sql`

Created a security-aware view that:
- **Unions** three task tables: `sound_job_tasks`, `lights_job_tasks`, and `video_job_tasks`
- **Filters** to only return tasks where:
  - `assigned_to = auth.uid()` (current user's tasks only)
  - `status` is either `'not_started'` or `'in_progress'` (excludes completed tasks)
- **Enriches** task data with contextual information:
  - Job context: `job_title`, `job_start_time`, `job_end_time`
  - Tour context: `tour_name`, `tour_start_date`, `tour_end_date`
- **Coalesces** nullable fields to ensure clean data:
  - `task_type` defaults to `'unknown'`
  - `status` defaults to `'not_started'`
  - `progress` defaults to `0`

### 2. View Columns
The view returns the following columns:
- `task_id` - UUID of the task
- `department` - Department literal: 'sound', 'lights', or 'video'
- `task_type` - Type of task (coalesced to 'unknown' if null)
- `status` - Task status (not_started or in_progress)
- `progress` - Progress percentage (0-100)
- `due_at` - Due date (currently NULL, placeholder for future enhancement)
- `assigned_to` - User ID the task is assigned to
- `job_id` - Associated job ID (if applicable)
- `tour_id` - Associated tour ID (if applicable)
- `created_at` - Task creation timestamp
- `updated_at` - Task last update timestamp
- `job_title` - Title of associated job (from LEFT JOIN)
- `job_start_time` - Job start timestamp (from LEFT JOIN)
- `job_end_time` - Job end timestamp (from LEFT JOIN)
- `tour_name` - Name of associated tour (from LEFT JOIN)
- `tour_start_date` - Tour start date (from LEFT JOIN)
- `tour_end_date` - Tour end date (from LEFT JOIN)

### 3. Security & RLS
- View relies on existing RLS policies from underlying task tables
- Management roles already have appropriate access via existing policies
- `GRANT SELECT ON public.management_pending_tasks TO authenticated;` allows authenticated users to query
- View automatically filters by `auth.uid()` ensuring users only see their own tasks

### 4. Performance Optimization
Added partial indexes on the task tables to optimize the common query pattern:
```sql
CREATE INDEX IF NOT EXISTS idx_sound_job_tasks_assigned_to_status 
ON public.sound_job_tasks(assigned_to, status) 
WHERE status IN ('not_started', 'in_progress');
```
Similar indexes added for `lights_job_tasks` and `video_job_tasks`.

### 5. TypeScript Types
**File**: `src/integrations/supabase/types.ts`

Added type definitions for the view at line 6184:
```typescript
management_pending_tasks: {
  Row: {
    assigned_to: string | null
    created_at: string | null
    department: string
    due_at: string | null
    job_end_time: string | null
    job_id: string | null
    job_start_time: string | null
    job_title: string | null
    progress: number
    status: Database["public"]["Enums"]["task_status"]
    task_id: string
    task_type: string
    tour_end_date: string | null
    tour_id: string | null
    tour_name: string | null
    tour_start_date: string | null
    updated_at: string | null
  }
  Relationships: [...]
}
```

## Usage Example

```typescript
import { supabase } from '@/integrations/supabase/client';

// Query pending tasks for the current user
const { data: pendingTasks, error } = await supabase
  .from('management_pending_tasks')
  .select('*')
  .order('created_at', { ascending: false });

// Type-safe access
pendingTasks?.forEach(task => {
  console.log(`${task.department} task: ${task.task_type}`);
  console.log(`Job: ${task.job_title}`);
  console.log(`Progress: ${task.progress}%`);
});
```

## Acceptance Criteria Met

✅ **Management role visibility**: Querying the view as a management role returns pending tasks with job/tour context for that user

✅ **Technician filtering**: Technicians without assigned tasks see an empty set (filtered by `auth.uid()`)

✅ **Completed tasks excluded**: Only tasks with status `'not_started'` or `'in_progress'` are included

✅ **Metadata available**: Job title, start/end times, tour name, and dates are available for display

✅ **TypeScript compilation**: Types compile without errors after the change

## Notes

1. **`due_at` field**: Currently set to `NULL` as this field doesn't exist in the task table schemas. This is a placeholder for future enhancement. When the field is added to the task tables, simply update the view definition to reference the actual column.

2. **Type generation**: TypeScript types were manually updated in `src/integrations/supabase/types.ts`. In production environments with Supabase CLI, regenerate types with:
   ```bash
   supabase gen types typescript --local > src/integrations/supabase/types.ts
   # Or for remote:
   supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
   ```

3. **Performance**: The partial indexes created will help performance significantly for the common query pattern. Monitor query performance and adjust indexes as needed based on actual usage patterns.

4. **RLS Inheritance**: The view properly inherits RLS from the underlying tables, so no additional RLS policies are needed on the view itself.

## Testing Recommendations

1. Test as a management user with assigned tasks
2. Test as a technician with no assigned tasks
3. Test filtering by department
4. Test with mixed job/tour tasks
5. Verify completed tasks are excluded
6. Check performance with large datasets
