import { useCallback, useEffect, useState } from 'react';

const ACKNOWLEDGED_TASKS_KEY = 'acknowledged_pending_tasks';

interface AcknowledgedTasksData {
  [userId: string]: string[]; // userId -> array of acknowledged task IDs
}

/**
 * Hook to manage acknowledged pending tasks in localStorage
 * Tracks which tasks have been acknowledged/dismissed by the user
 * Persists across sessions until tasks are marked as completed
 */
export function useAcknowledgedTasks(userId: string | null) {
  const [acknowledgedTaskIds, setAcknowledgedTaskIds] = useState<Set<string>>(
    new Set()
  );

  // Load acknowledged tasks from localStorage on mount
  useEffect(() => {
    if (!userId) return;

    try {
      const stored = localStorage.getItem(ACKNOWLEDGED_TASKS_KEY);
      if (stored) {
        const data: AcknowledgedTasksData = JSON.parse(stored);
        const userTasks = data[userId] || [];
        setAcknowledgedTaskIds(new Set(userTasks));
      }
    } catch (error) {
      console.error('Error loading acknowledged tasks:', error);
    }
  }, [userId]);

  // Acknowledge a task
  const acknowledgeTask = useCallback(
    (taskId: string) => {
      if (!userId) return;

      setAcknowledgedTaskIds((prev) => {
        const updated = new Set(prev);
        updated.add(taskId);

        // Persist to localStorage
        try {
          const stored = localStorage.getItem(ACKNOWLEDGED_TASKS_KEY);
          const data: AcknowledgedTasksData = stored ? JSON.parse(stored) : {};
          data[userId] = Array.from(updated);
          localStorage.setItem(ACKNOWLEDGED_TASKS_KEY, JSON.stringify(data));
        } catch (error) {
          console.error('Error saving acknowledged task:', error);
        }

        return updated;
      });
    },
    [userId]
  );

  // Remove acknowledged tasks (when they're completed or no longer exist)
  const clearAcknowledgedTasks = useCallback(
    (taskIds: string[]) => {
      if (!userId) return;

      setAcknowledgedTaskIds((prev) => {
        const updated = new Set(prev);
        taskIds.forEach((id) => updated.delete(id));

        // Persist to localStorage
        try {
          const stored = localStorage.getItem(ACKNOWLEDGED_TASKS_KEY);
          const data: AcknowledgedTasksData = stored ? JSON.parse(stored) : {};
          data[userId] = Array.from(updated);
          localStorage.setItem(ACKNOWLEDGED_TASKS_KEY, JSON.stringify(data));
        } catch (error) {
          console.error('Error clearing acknowledged tasks:', error);
        }

        return updated;
      });
    },
    [userId]
  );

  // Check if a task has been acknowledged
  const isTaskAcknowledged = useCallback(
    (taskId: string) => {
      return acknowledgedTaskIds.has(taskId);
    },
    [acknowledgedTaskIds]
  );

  return {
    acknowledgedTaskIds,
    acknowledgeTask,
    clearAcknowledgedTasks,
    isTaskAcknowledged,
  };
}
