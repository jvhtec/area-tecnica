import type { GeneratedTask, SetupWorkflowTask } from './types';
import { SetupWorkflowError } from './errors';

/** Mirrors transactional SQL sync semantics without I/O. Retiring only changes
 * applicability; status, audit fields and user metadata survive removal/return.
 */
export function reconcileWorkflowTasks(existing: readonly SetupWorkflowTask[], generated: readonly GeneratedTask[]) {
  const desired = new Map(generated.map(task => [task.task_key, task]));
  if (desired.size !== generated.length) {
    throw new SetupWorkflowError('invalid_input', 'Las claves de las tareas deben ser únicas.');
  }
  const keys = new Set(existing.map(task => task.task_key));
  return {
    create: generated.filter(task => !keys.has(task.task_key)),
    retain: existing.map(task => {
      const definition = desired.get(task.task_key);
      return definition
        ? { ...task, ...definition, metadata: { ...task.metadata, ...definition.metadata }, applicable: true }
        : { ...task, applicable: false };
    }),
  };
}
