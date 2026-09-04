export type WorkflowErrorCode = 'unknown_type' | 'unknown_department' | 'invalid_step' |
  'invalid_transition' | 'invalid_task_transition' | 'missing_workflow' | 'missing_task' |
  'duplicate_workflow' | 'incomplete_workflow' | 'forbidden' | 'invalid_input' | 'persistence';

export class SetupWorkflowError extends Error {
  constructor(public readonly code: WorkflowErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SetupWorkflowError';
  }
}
