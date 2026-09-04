import { SetupWorkflowError } from './errors';
import type { TaskStatus, WorkflowStatus } from './types';

const workflowTransitions: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  draft: ['in_progress', 'cancelled'],
  in_progress: ['review', 'complete', 'cancelled'],
  review: ['in_progress', 'complete', 'cancelled'],
  complete: [], cancelled: [],
};
const taskTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['completed', 'skipped', 'blocked'],
  blocked: ['pending', 'completed', 'skipped'],
  completed: ['pending'], skipped: ['pending'],
};

export function canTransitionWorkflowStatus(from: WorkflowStatus, to: WorkflowStatus) {
  return workflowTransitions[from]?.includes(to) ?? false;
}
export function assertWorkflowTransition(from: WorkflowStatus, to: WorkflowStatus) {
  if (!canTransitionWorkflowStatus(from, to)) {
    throw new SetupWorkflowError('invalid_transition', `Cambio de estado no válido: ${from} → ${to}`);
  }
}
export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus) {
  return taskTransitions[from]?.includes(to) ?? false;
}
export function assertTaskTransition(from: TaskStatus, to: TaskStatus) {
  if (!canTransitionTaskStatus(from, to)) {
    throw new SetupWorkflowError('invalid_task_transition', `Cambio de tarea no válido: ${from} → ${to}`);
  }
}
