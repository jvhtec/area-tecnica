import type { SetupWorkflowTask } from './types';

export type JobSetupDialog = 'edit' | 'requirements' | 'tasks' | 'details';

export type JobSetupTaskAction =
  | { kind: 'dialog'; dialog: JobSetupDialog; label: string; department?: string }
  | { kind: 'route'; href: string; label: string }
  | { kind: 'estructura'; tool: 'motors' | 'certificate'; label: string }
  | { kind: 'project'; href: string; label: string };

const routeFor = (tool: 'pesos' | 'consumos' | 'technical_report', department: string, jobId: string) => {
  const query = new URLSearchParams({ jobId }).toString();
  const routes = {
    sound: {
      pesos: `/sound/pesos?${query}`,
      consumos: `/sound/consumos?${query}`,
      technical_report: `/sound?${new URLSearchParams({ jobId, tool: 'memoria' }).toString()}`,
    },
    lights: {
      pesos: `/lights-pesos-tool?${query}`,
      consumos: `/lights-consumos-tool?${query}`,
      technical_report: `/lights-memoria-tecnica?${query}`,
    },
    video: {
      pesos: `/video-pesos-tool?${query}`,
      consumos: `/video-consumos-tool?${query}`,
      technical_report: `/video-memoria-tecnica?${query}`,
    },
  } as const;
  return routes[department as keyof typeof routes]?.[tool];
};

/** Maps orchestration tasks to the existing canonical job tools. */
export function getJobSetupTaskAction(
  task: Pick<SetupWorkflowTask, 'task_key' | 'category' | 'metadata'>,
  jobId: string,
): JobSetupTaskAction {
  const [requirement] = task.task_key.split(':');
  const department = typeof task.metadata.department === 'string'
    ? task.metadata.department
    : undefined;

  if (task.task_key === 'basic_information' || task.task_key === 'departments') {
    return { kind: 'dialog', dialog: 'edit', label: 'Editar trabajo' };
  }
  if (requirement === 'personnel') {
    return { kind: 'dialog', dialog: 'requirements', label: 'Configurar personal', department };
  }
  if (department === 'estructura' && requirement === 'motors') {
    return { kind: 'estructura', tool: 'motors', label: 'Preparar motores' };
  }
  if (department === 'estructura' && requirement === 'motor_certificate') {
    return { kind: 'estructura', tool: 'certificate', label: 'Generar certificados' };
  }
  if (requirement === 'pesos' || requirement === 'consumos' || requirement === 'technical_report') {
    const href = department ? routeFor(requirement, department, jobId) : undefined;
    if (href) return { kind: 'route', href, label: 'Abrir herramienta' };
  }
  if (task.task_key === 'flex_folders') {
    return {
      kind: 'project',
      href: `/project-management?setupJobId=${encodeURIComponent(jobId)}`,
      label: 'Abrir herramientas Flex',
    };
  }
  if (task.category === 'technical' || task.category === 'resources') {
    const supportedDepartment = department && ['sound', 'lights', 'video'].includes(department)
      ? department
      : undefined;
    return supportedDepartment
      ? { kind: 'dialog', dialog: 'tasks', label: 'Abrir tareas y documentos', department: supportedDepartment }
      : { kind: 'dialog', dialog: 'details', label: 'Abrir detalles y documentos', department };
  }
  if (task.task_key === 'review') {
    return { kind: 'dialog', dialog: 'details', label: 'Revisar trabajo' };
  }
  return { kind: 'dialog', dialog: 'details', label: 'Abrir trabajo' };
}
