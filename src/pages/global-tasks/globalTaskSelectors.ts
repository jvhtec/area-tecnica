import type { GlobalTask } from '@/hooks/useGlobalTasks';

export function filterGlobalTasks(
  tasks: GlobalTask[],
  statusFilter: string,
  assigneeFilter: string,
): GlobalTask[] {
  let result = tasks;
  if (statusFilter === 'active') {
    result = result.filter((task) => task.status !== 'completed');
  } else if (statusFilter && statusFilter !== 'all') {
    result = result.filter((task) => task.status === statusFilter);
  }

  if (assigneeFilter === 'unassigned') {
    result = result.filter((task) => !task.assigned_to);
  } else if (assigneeFilter && assigneeFilter !== 'all' && assigneeFilter !== 'me') {
    result = result.filter((task) => task.assigned_to === assigneeFilter);
  }

  return result;
}

export function getGlobalTaskTypeOptions(tasks: GlobalTask[]): string[] {
  return Array.from(
    new Set(tasks.map((task) => task.task_type).filter((value): value is string => Boolean(value))),
  ).sort();
}

export function getGlobalTaskStats(tasks: GlobalTask[]) {
  return {
    total: tasks.length,
    notStarted: tasks.filter((task) => task.status === 'not_started').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
  };
}
