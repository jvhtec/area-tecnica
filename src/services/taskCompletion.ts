import { supabase } from '@/lib/supabase';

/**
 * Task completion service
 * 
 * Provides centralized task completion logic for both manual and automated flows.
 * Handles Supabase updates, completion metadata tracking, and push notifications.
 * 
 * This service is used by:
 * - useTaskMutations (manual status changes in UI)
 * - useCompleteTask hook (pending tasks modal)
 * - taskAutoCompletion utility (document upload flows)
 */

export type Department = 'sound' | 'lights' | 'video';

export type CompletionSource = 
  | 'manual'
  | 'auto_pesos_doc'
  | 'auto_consumos_sound_doc'
  | 'auto_consumos_lights_doc'
  | 'auto_consumos_video_doc'
  | string;

interface CompleteTaskParams {
  taskId: string;
  department: Department;
  actorId?: string | null;
  source?: CompletionSource;
  jobId?: string;
  tourId?: string;
}

interface CompleteTaskResult {
  success: boolean;
  error?: string;
}

interface BulkCompleteTasksParams {
  jobId?: string;
  tourId?: string;
  taskType: string;
  department?: Department;
  actorId?: string | null;
  source?: CompletionSource;
}

interface BulkCompleteTasksResult {
  success: boolean;
  completedCount: number;
  error?: string;
}

const TASK_TABLE: Record<Department, string> = {
  sound: 'sound_job_tasks',
  lights: 'lights_job_tasks',
  video: 'video_job_tasks',
};

/**
 * Mark a single task as completed.
 * 
 * This function:
 * 1. Updates task status to 'completed'
 * 2. Sets progress to 100%
 * 3. Records completion metadata (completed_at, completed_by, completion_source)
 * 4. Triggers push notification (fire-and-forget)
 * 
 * @param params - Task completion parameters
 * @param params.taskId - The task ID to complete
 * @param params.department - The department (sound/lights/video) to determine the correct table
 * @param params.actorId - Optional user ID who completed the task (defaults to current user)
 * @param params.source - Optional completion source (defaults to 'manual')
 * @param params.jobId - Optional job ID for push notification context
 * @param params.tourId - Optional tour ID for push notification context
 * @returns Promise<CompleteTaskResult> - Result containing success status and optional error
 */
export async function completeTask(
  params: CompleteTaskParams
): Promise<CompleteTaskResult> {
  const { taskId, department, actorId, source = 'manual', jobId, tourId } = params;

  try {
    const tableName = TASK_TABLE[department];

    // Get current user if actorId not provided
    let userId = actorId;
    if (!userId) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.warn('[completeTask] Could not get current user:', userError);
      }
      userId = userData?.user?.id || null;
    }

    // Fetch task details for push notification
    const { data: task, error: fetchError } = await supabase
      .from(tableName)
      .select('id, task_type, assigned_to, job_id, tour_id')
      .eq('id', taskId)
      .maybeSingle();

    if (fetchError) {
      console.error('[completeTask] Error fetching task:', fetchError);
      throw new Error(fetchError.message);
    }

    // Update the task to completed
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        completed_by: userId,
        completion_source: source,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateError) {
      console.error('[completeTask] Error updating task:', updateError);
      throw new Error(updateError.message);
    }

    // Trigger push notification (fire-and-forget)
    if (userId) {
      const recipients = new Set<string>();
      if (userId) recipients.add(userId);
      if (task?.assigned_to) recipients.add(task.assigned_to);

      try {
        void supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'task.completed',
            job_id: jobId || task?.job_id || undefined,
            tour_id: tourId || task?.tour_id || undefined,
            recipient_id: task?.assigned_to || undefined,
            user_ids: Array.from(recipients),
            task_id: taskId,
            task_type: task?.task_type,
            completion_source: source,
          },
        });
      } catch (pushError) {
        console.warn('[completeTask] Push notification failed:', pushError);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[completeTask] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Revert a task from completed status back to an active state.
 * 
 * This function:
 * 1. Updates task status to the specified active status
 * 2. Clears completion metadata (completed_at, completed_by, completion_source)
 * 3. Adjusts progress to match the new status
 * 
 * @param params - Task reversion parameters
 * @param params.taskId - The task ID to revert
 * @param params.department - The department (sound/lights/video) to determine the correct table
 * @param params.newStatus - The new active status ('not_started' or 'in_progress')
 * @returns Promise<CompleteTaskResult> - Result containing success status and optional error
 */
export async function revertTask(params: {
  taskId: string;
  department: Department;
  newStatus: 'not_started' | 'in_progress';
}): Promise<CompleteTaskResult> {
  const { taskId, department, newStatus } = params;

  try {
    const tableName = TASK_TABLE[department];
    const progress = newStatus === 'in_progress' ? 50 : 0;

    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        status: newStatus,
        progress,
        completed_at: null,
        completed_by: null,
        completion_source: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (updateError) {
      console.error('[revertTask] Error updating task:', updateError);
      throw new Error(updateError.message);
    }

    return { success: true };
  } catch (error) {
    console.error('[revertTask] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Bulk complete tasks matching the given criteria.
 * 
 * This function:
 * 1. Finds all matching tasks (by jobId/tourId, taskType, and optional department)
 * 2. Updates them to completed status with completion metadata
 * 3. Triggers push notifications for each completed task
 * 4. Returns a result object with success status and count of completed tasks
 * 5. Handles errors gracefully without throwing
 * 
 * Used primarily for automated completion flows (e.g., after document uploads).
 * 
 * @param params - Bulk completion parameters
 * @param params.jobId - Optional job ID to match tasks against (one of jobId or tourId required)
 * @param params.tourId - Optional tour ID to match tasks against (one of jobId or tourId required)
 * @param params.taskType - The task type to complete (e.g., "Pesos", "Consumos")
 * @param params.department - Optional department filter (sound/lights/video). If not provided, completes across all departments.
 * @param params.actorId - Optional user ID who triggered the completion (defaults to current user)
 * @param params.source - Optional custom source identifier (defaults based on taskType)
 * @returns Promise<BulkCompleteTasksResult> - Result containing success status and completion count
 */
export async function bulkCompleteTasks(
  params: BulkCompleteTasksParams
): Promise<BulkCompleteTasksResult> {
  const { jobId, tourId, taskType, department, actorId, source } = params;

  if (!jobId && !tourId) {
    console.error('[bulkCompleteTasks] Either jobId or tourId must be provided');
    return {
      success: false,
      completedCount: 0,
      error: 'Either jobId or tourId must be provided',
    };
  }

  try {
    // Get current user if actorId not provided
    let userId = actorId;
    if (userId === undefined) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.warn('[bulkCompleteTasks] Could not get user:', userError);
      }
      userId = userData?.user?.id || null;
    }

    const completionSource = source || `auto_${taskType.toLowerCase()}_doc`;

    // Determine which tables to update
    const departments: Department[] = department ? [department] : ['sound', 'lights', 'video'];

    let totalCompletedCount = 0;

    // Update tasks in each relevant department table
    for (const dept of departments) {
      const tableName = TASK_TABLE[dept];

      try {
        // Build the query based on whether we have jobId or tourId
        let query = supabase
          .from(tableName)
          .select('id, task_type, status, assigned_to, job_id, tour_id')
          .eq('task_type', taskType)
          .neq('status', 'completed');

        if (jobId) {
          query = query.eq('job_id', jobId);
        } else if (tourId) {
          query = query.eq('tour_id', tourId);
        }

        const { data: matchingTasks, error: fetchError } = await query;

        if (fetchError) {
          console.error(`[bulkCompleteTasks] Error fetching ${dept} tasks:`, fetchError);
          continue;
        }

        if (!matchingTasks || matchingTasks.length === 0) {
          console.log(
            `[bulkCompleteTasks] No matching ${dept} ${taskType} tasks found for ${jobId ? 'job' : 'tour'} ${jobId || tourId}`
          );
          continue;
        }

        // Update all matching tasks to completed
        const taskIds = matchingTasks.map((t) => t.id);
        const { error: updateError } = await supabase
          .from(tableName)
          .update({
            status: 'completed',
            progress: 100,
            completed_at: new Date().toISOString(),
            completed_by: userId,
            completion_source: completionSource,
            updated_at: new Date().toISOString(),
          })
          .in('id', taskIds);

        if (updateError) {
          console.error(`[bulkCompleteTasks] Error updating ${dept} tasks:`, updateError);
          continue;
        }

        console.log(
          `[bulkCompleteTasks] Completed ${matchingTasks.length} ${dept} ${taskType} task(s) for ${jobId ? 'job' : 'tour'} ${jobId || tourId}`
        );
        totalCompletedCount += matchingTasks.length;

        // Broadcast push notification for each completed task (fire-and-forget)
        for (const task of matchingTasks) {
          try {
            void supabase.functions.invoke('push', {
              body: {
                action: 'broadcast',
                type: 'task.completed',
                job_id: task.job_id || undefined,
                tour_id: task.tour_id || undefined,
                task_id: task.id,
                task_type: taskType,
                completion_source: completionSource,
              },
            });
          } catch (pushError) {
            console.warn('[bulkCompleteTasks] Push notification failed:', pushError);
          }
        }
      } catch (deptError) {
        console.error(`[bulkCompleteTasks] Error processing ${dept} department:`, deptError);
        // Continue with next department
      }
    }

    return {
      success: true,
      completedCount: totalCompletedCount,
    };
  } catch (error) {
    console.error('[bulkCompleteTasks] Unexpected error:', error);
    return {
      success: false,
      completedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
