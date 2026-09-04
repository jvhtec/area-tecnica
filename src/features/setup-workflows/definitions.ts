import { SetupWorkflowError } from './errors';
import type { WorkflowType } from './types';

export const workflowDefinitions = {
  job: { title: 'Preparación del trabajo', steps: ['basic', 'departments', 'personnel', 'technical', 'resources', 'review'] },
  tour: { title: 'Preparación de la gira', steps: ['basic', 'departments', 'personnel', 'packages', 'dates', 'resources', 'review'] },
  tour_date: { title: 'Preparación de la fecha', steps: ['defaults', 'overrides', 'resources', 'review'] },
} as const;

export const stepLabels: Record<string, string> = {
  basic: 'Información básica', departments: 'Departamentos', personnel: 'Personal',
  technical: 'Preparación técnica', resources: 'Recursos', review: 'Revisión',
  packages: 'Paquetes', dates: 'Fechas', defaults: 'Valores predeterminados', overrides: 'Ajustes de la fecha',
};

export function getWorkflowDefinition(type: WorkflowType | string) {
  if (!Object.prototype.hasOwnProperty.call(workflowDefinitions, type)) {
    throw new SetupWorkflowError('unknown_type', `Tipo de preparación desconocido: ${type}`);
  }
  return workflowDefinitions[type as WorkflowType];
}

export function getWorkflowSteps(type: WorkflowType): readonly string[] {
  return getWorkflowDefinition(type).steps;
}

export function assertWorkflowStep(type: WorkflowType, step: string) {
  if (!getWorkflowSteps(type).includes(step)) {
    throw new SetupWorkflowError('invalid_step', `Paso no válido: ${step}`);
  }
}

export function getNextStep(type: WorkflowType, step: string): string | null {
  assertWorkflowStep(type, step);
  const steps = getWorkflowSteps(type);
  return steps[steps.indexOf(step) + 1] ?? null;
}

export function getPreviousStep(type: WorkflowType, step: string): string | null {
  assertWorkflowStep(type, step);
  const steps = getWorkflowSteps(type);
  return steps[steps.indexOf(step) - 1] ?? null;
}
