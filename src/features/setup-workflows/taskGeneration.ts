import { getDepartmentLabel } from '@/types/department';
import { getWorkflowDefinition } from './definitions';
import { departmentSetupRequirements, setupRequirements } from './departmentRequirements';
import { SetupWorkflowError } from './errors';
import type { GeneratedTask, GenerateTasksInput, WorkflowType } from './types';

const baseRequirements: Record<WorkflowType, readonly [string, string, string][]> = {
  job: [['basic_information', 'Información básica', 'basic'], ['departments', 'Departamentos', 'departments']],
  tour: [['basic_information', 'Información básica', 'basic'], ['departments', 'Departamentos', 'departments'], ['packages', 'Paquetes', 'packages'], ['dates', 'Fechas', 'dates']],
  tour_date: [['defaults', 'Revisar valores predeterminados', 'defaults'], ['overrides', 'Revisar ajustes de la fecha', 'overrides']],
};

export function generateWorkflowTasks({ workflowType, departments }: GenerateTasksInput): GeneratedTask[] {
  getWorkflowDefinition(workflowType);
  const tasks = new Map<string, GeneratedTask>();
  for (const [task_key, label, category] of baseRequirements[workflowType]) {
    tasks.set(task_key, { task_key, label, category, required: true, responsible_role: 'assistant', metadata: {} });
  }
  for (const department of [...new Set(departments)].sort()) {
    if (!Object.prototype.hasOwnProperty.call(departmentSetupRequirements, department)) {
      throw new SetupWorkflowError('unknown_department', `Departamento no admitido: ${department}`);
    }
    for (const key of departmentSetupRequirements[department]) {
      const requirement = setupRequirements[key];
      const perDepartment = requirement.scope === 'department';
      const task_key = perDepartment ? `${key}:${department}` : key;
      const departmentLabel = department === 'estructura' ? 'Estructura' : getDepartmentLabel(department);
      tasks.set(task_key, {
        task_key,
        label: perDepartment ? `${requirement.label} · ${departmentLabel}` : requirement.label,
        category: requirement.category,
        required: true,
        responsible_role: requirement.role,
        metadata: perDepartment ? { department } : {},
      });
    }
  }
  tasks.set('review', { task_key: 'review', label: 'Revisión de la preparación', category: 'review', required: true, responsible_role: 'management', metadata: {} });
  return [...tasks.values()];
}
