import { supabase } from '@/lib/supabase';

/**
 * Auto-completion utility for tasks triggered by successful document uploads.
 * 
 * This module provides functionality to automatically mark relevant tasks as completed
 * when calculator PDFs (Pesos, Consumos) are successfully uploaded. The automation
 * creates an audit trail with completion metadata including timestamp, user, and source.
 * 
 * Usage:
 * - Call autoCompleteTasksAfterUpload after a successful PDF upload
 * - Provide jobId, taskType (e.g., "Pesos", "Consumos"), and optional department
 * - Function handles cases where no matching tasks exist gracefully
 * 
 * Examples:
 * - PesosTool: autoCompleteTasksAfterUpload(jobId, "Pesos") // Completes all Pesos tasks
 * - ConsumosTool (sound): autoCompleteTasksAfterUpload(jobId, "Consumos", "sound") // Only sound
 */

export type Department = 'sound' | 'lights' | 'video';

interface AutoCompleteTasksParams {
  jobId: string;
  taskType: string;
  department?: Department;
  completionSource?: string;
}

interface AutoCompleteResult {
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
 * Auto-completes tasks matching the given criteria after a successful document upload.
 * 
 * This function:
 * 1. Finds all matching tasks (by jobId, taskType, and optional department)
 * 2. Updates them to completed status with completion metadata
 * 3. Returns a result object with success status and count of completed tasks
 * 4. Handles errors gracefully without throwing
 * 
 * @param params - Configuration for task completion
 * @param params.jobId - The job ID to match tasks against
 * @param params.taskType - The task type to complete (e.g., "Pesos", "Consumos")
 * @param params.department - Optional department filter (sound/lights/video)
 * @param params.completionSource - Optional custom source identifier (defaults to auto_{taskType}_doc)
 * @returns Promise<AutoCompleteResult> - Result containing success status and completion count
 */
export async function autoCompleteTasksAfterUpload(
  params: AutoCompleteTasksParams
): Promise<AutoCompleteResult> {
  const { jobId, taskType, department, completionSource } = params;

  try {
    // Get current user for completion tracking
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.warn('[autoCompleteTasksAfterUpload] Could not get user:', userError);
      // Continue without user ID - completion will still work
    }

    const userId = userData?.user?.id || null;
    const source = completionSource || `auto_${taskType.toLowerCase()}_doc`;

    // Determine which tables to update
    const departments: Department[] = department ? [department] : ['sound', 'lights', 'video'];

    let totalCompletedCount = 0;

    // Update tasks in each relevant department table
    for (const dept of departments) {
      const tableName = TASK_TABLE[dept];

      try {
        // Find and update matching tasks that are not already completed
        const { data: matchingTasks, error: fetchError } = await supabase
          .from(tableName)
          .select('id, task_type, status')
          .eq('job_id', jobId)
          .eq('task_type', taskType)
          .neq('status', 'completed');

        if (fetchError) {
          console.error(`[autoCompleteTasksAfterUpload] Error fetching ${dept} tasks:`, fetchError);
          continue;
        }

        if (!matchingTasks || matchingTasks.length === 0) {
          console.log(`[autoCompleteTasksAfterUpload] No matching ${dept} ${taskType} tasks found for job ${jobId}`);
          continue;
        }

        // Update all matching tasks to completed
        const taskIds = matchingTasks.map(t => t.id);
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
          .in('id', taskIds);

        if (updateError) {
          console.error(`[autoCompleteTasksAfterUpload] Error updating ${dept} tasks:`, updateError);
          continue;
        }

        console.log(
          `[autoCompleteTasksAfterUpload] Auto-completed ${matchingTasks.length} ${dept} ${taskType} task(s) for job ${jobId}`
        );
        totalCompletedCount += matchingTasks.length;

        // Broadcast push notification for each completed task (fire-and-forget)
        for (const task of matchingTasks) {
          try {
            void supabase.functions.invoke('push', {
              body: {
                action: 'broadcast',
                type: 'task.completed',
                job_id: jobId,
                task_id: task.id,
                task_type: taskType,
                completion_source: source,
              },
            });
          } catch (pushError) {
            console.warn('[autoCompleteTasksAfterUpload] Push notification failed:', pushError);
          }
        }
      } catch (deptError) {
        console.error(`[autoCompleteTasksAfterUpload] Error processing ${dept} department:`, deptError);
        // Continue with next department
      }
    }

    return {
      success: true,
      completedCount: totalCompletedCount,
    };
  } catch (error) {
    console.error('[autoCompleteTasksAfterUpload] Unexpected error:', error);
    return {
      success: false,
      completedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper function specifically for Pesos tool uploads.
 * Auto-completes all "Pesos" tasks for the given job across all departments.
 * 
 * @param jobId - The job ID
 * @returns Promise<AutoCompleteResult> - Result containing success status and completion count
 */
export async function autoCompletePesosTasks(jobId: string): Promise<AutoCompleteResult> {
  return autoCompleteTasksAfterUpload({
    jobId,
    taskType: 'Pesos',
    completionSource: 'auto_pesos_doc',
  });
}

/**
 * Helper function specifically for Consumos tool uploads.
 * Auto-completes "Consumos" tasks for the specified department only.
 * 
 * @param jobId - The job ID
 * @param department - The department (sound/lights/video)
 * @returns Promise<AutoCompleteResult> - Result containing success status and completion count
 */
export async function autoCompleteConsumosTasks(
  jobId: string,
  department: Department
): Promise<AutoCompleteResult> {
  return autoCompleteTasksAfterUpload({
    jobId,
    taskType: 'Consumos',
    department,
    completionSource: `auto_consumos_${department}_doc`,
  });
}
