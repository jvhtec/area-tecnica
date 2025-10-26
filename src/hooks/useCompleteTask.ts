import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { completeTask, Department } from '@/services/taskCompletion';

interface CompleteTaskParams {
  taskId: string;
  department: Department;
  userId: string;
}

interface CompleteTaskResult {
  success: boolean;
  error?: string;
}

/**
 * Hook for manually completing a task from the pending tasks modal.
 * 
 * This hook:
 * - Uses the centralized task completion service
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
      // Use the centralized task completion service
      const result = await completeTask({
        taskId,
        department,
        actorId: userId,
        source: 'manual',
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete task');
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
