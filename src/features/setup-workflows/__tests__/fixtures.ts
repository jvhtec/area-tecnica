import type { GeneratedTask, SetupWorkflow, SetupWorkflowTask } from '../types';

export const workflowFixture: SetupWorkflow = {
  id: 'workflow-1', type: 'job', entity_id: 'job-1', job_id: 'job-1', tour_id: null, tour_date_id: null,
  status: 'draft', current_step: 'basic', assigned_to: null, created_by: 'user-1',
  state: {}, created_at: '2026-09-04T08:00:00Z', updated_at: '2026-09-04T08:00:00Z', completed_at: null,
};

export function taskFixture(overrides: Partial<SetupWorkflowTask> = {}): SetupWorkflowTask {
  return {
    id: 'task-1', workflow_id: 'workflow-1', task_key: 'basic_information', category: 'basic',
    label: 'Información básica', required: true, responsible_role: 'assistant', metadata: {},
    status: 'pending', applicable: true, completed_by: null, completed_at: null,
    created_at: '2026-09-04T08:00:00Z', updated_at: '2026-09-04T08:00:00Z', ...overrides,
  };
}

export function persistTasks(tasks: readonly GeneratedTask[]): SetupWorkflowTask[] {
  return tasks.map(task => taskFixture({ ...task, id: task.task_key }));
}
