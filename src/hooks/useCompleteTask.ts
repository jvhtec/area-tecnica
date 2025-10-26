import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export type Department = 'sound' | 'lights' | 'video';

interface CompleteTaskParams {
  taskId: string;
  department: Department;
  userId: string;
}

interface CompleteTaskResult {
  success: boolean;
  error?: string;
}

const TASK_TABLE: Record<Department, string> = {
  sound: 'sound_job_tasks',
  lights: 'lights_job_tasks',
  video: 'video_job_tasks',
};

/**
 * Hook for manually completing a task from the pending tasks modal.
 * 
 * This hook:
 * - Updates the task status to 'completed'
 * - Sets completion metadata (completed_at, completed_by, completion_source)
 * - Invalidates pending tasks query to refresh the list
 * - Shows success/error toasts
 * - Triggers push notifications
 * 
 * @returns Mutation object with mutate function and loading states
 */
export function useCompleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<CompleteTaskResult, Error, CompleteTaskParams>({
    mutationFn: async ({ taskId, department, userId }: CompleteTaskParams) => {
      const tableName = TASK_TABLE[department];

      // Update the task to completed
      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          completed_by: userId,
          completion_source: 'manual',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateError) {
        console.error('[useCompleteTask] Error updating task:', updateError);
        throw new Error(updateError.message);
      }

      // Trigger push notification (fire-and-forget)
      try {
        void supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'task.completed',
            task_id: taskId,
            completion_source: 'manual',
          },
        });
      } catch (pushError) {
        console.warn('[useCompleteTask] Push notification failed:', pushError);
      }

      return { success: true };
    },

    onSuccess: (_, variables) => {
      // Show success toast
      toast({
        title: 'Task completed',
        description: 'The task has been marked as complete.',
      });

      // Invalidate queries to refresh the pending tasks list
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] });
    },

    onError: (error) => {
      // Show error toast
      toast({
        title: 'Failed to complete task',
        description: error.message || 'An error occurred while completing the task.',
        variant: 'destructive',
      });
    },
  });
}
