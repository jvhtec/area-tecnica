import { useMemo } from 'react';
import { usePendingTasks, GroupedPendingTask } from './usePendingTasks';

export interface FlatPendingTask {
  id: string;
  department: 'sound' | 'lights' | 'video' | 'production' | 'administrative';
  taskType: string;
  status: 'not_started' | 'in_progress';
  progress: number;
  dueDate: string | null;
  priority: number | null;
  detailLink: string;
  // Context from parent group
  jobOrTourName: string;
  jobOrTourType: 'job' | 'tour' | 'global';
  client?: string;
}

/**
 * Hook to get a flat list of pending tasks with their job/tour context
 * Useful for displaying tasks individually rather than grouped
 */
export function useFlatPendingTasks(userId: string | null, userRole: string | null, userDepartment?: string | null) {
  const { data: groupedTasks, isLoading, error } = usePendingTasks(userId, userRole, userDepartment);

  const flatTasks = useMemo<FlatPendingTask[]>(() => {
    if (!groupedTasks) return [];

    const tasks: FlatPendingTask[] = [];

    groupedTasks.forEach((group: GroupedPendingTask) => {
      group.tasks.forEach((task) => {
        tasks.push({
          ...task,
          jobOrTourName: group.name,
          jobOrTourType: group.type,
          client: group.client,
        });
      });
    });

    return tasks;
  }, [groupedTasks]);

  return {
    data: flatTasks,
    isLoading,
    error,
  };
}
