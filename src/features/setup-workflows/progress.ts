import type { SetupWorkflowTask } from './types';

type ProgressTask = Pick<SetupWorkflowTask, 'status' | 'required' | 'applicable'>;

/** Required skips never satisfy completion. Optional skips count as resolved.
 * Retired tasks are historical only; any applicable blocker prevents completion.
 */
export function calculateWorkflowProgress(tasks: readonly ProgressTask[]) {
  const active = tasks.filter(task => task.applicable);
  const completedTasks = active.filter(task => task.status === 'completed').length;
  const required = active.filter(task => task.required);
  const requiredCompletedTasks = required.filter(task => task.status === 'completed').length;
  const blockedTasks = active.filter(task => task.status === 'blocked').length;
  const resolved = completedTasks + active.filter(task => !task.required && task.status === 'skipped').length;
  return {
    totalTasks: active.length, completedTasks, requiredTasks: required.length,
    requiredCompletedTasks, blockedTasks,
    percentage: active.length ? Math.round(resolved / active.length * 100) : 0,
    isAdministrativelyComplete: active.length > 0 && requiredCompletedTasks === required.length && blockedTasks === 0,
    hasBlockers: blockedTasks > 0,
  };
}
