export type WorkflowErrorCode = 'unknown_type' | 'unknown_department' | 'invalid_step' |
  'invalid_transition' | 'invalid_task_transition' | 'missing_workflow' | 'missing_task' |
  'duplicate_workflow' | 'incomplete_workflow' | 'forbidden' | 'invalid_input' | 'persistence';

export const workflowErrorMessages: Record<WorkflowErrorCode, string> = {
  unknown_type: 'El tipo de preparación no es válido.',
  unknown_department: 'El departamento no está admitido.',
  invalid_step: 'El paso de preparación no es válido.',
  invalid_transition: 'No se permite este cambio de estado de la preparación.',
  invalid_task_transition: 'No se permite este cambio de estado de la tarea.',
  missing_workflow: 'No se ha encontrado la preparación.',
  missing_task: 'No se ha encontrado la tarea.',
  duplicate_workflow: 'Ya existe una preparación activa para este elemento.',
  incomplete_workflow: 'Quedan tareas obligatorias sin resolver o tareas bloqueadas.',
  forbidden: 'No tienes permisos para acceder a esta preparación.',
  invalid_input: 'Los datos de preparación no son válidos.',
  persistence: 'No se pudo guardar o cargar la preparación. Inténtalo de nuevo.',
};

export class SetupWorkflowError extends Error {
  constructor(public readonly code: WorkflowErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'SetupWorkflowError';
  }
}
