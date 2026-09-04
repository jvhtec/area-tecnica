import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SetupWorkflowProgress } from '../components/SetupWorkflowProgress';
import { getWorkflowSteps, stepLabels } from '../definitions';
import { departmentSetupRequirements } from '../departmentRequirements';
import { generateWorkflowTasks } from '../taskGeneration';
import { reconcileWorkflowTasks } from '../reconciliation';
import { calculateWorkflowProgress } from '../progress';
import { canTransitionTaskStatus } from '../transitions';
import type { GeneratedTask, SetupDepartment, SetupWorkflow, SetupWorkflowTask, TaskStatus, WorkflowType } from '../types';

const taskLabels: Record<TaskStatus, string> = {
  pending: 'Reabrir', completed: 'Completar', skipped: 'Omitir', blocked: 'Bloquear',
};
const timestamp = new Date().toISOString();
function makeTask(task: GeneratedTask): SetupWorkflowTask {
  return { ...task, id: task.task_key, workflow_id: 'demo', status: 'pending', applicable: true,
    completed_at: null, completed_by: null, created_at: timestamp, updated_at: timestamp };
}
function makeWorkflow(type: WorkflowType): SetupWorkflow {
  return { id: 'demo', type, entity_id: 'demo', job_id: null, tour_id: null, tour_date_id: null,
    status: 'in_progress', current_step: getWorkflowSteps(type)[0], assigned_to: null, created_by: null,
    state: {}, created_at: timestamp, updated_at: timestamp, completed_at: null };
}

export function WorkflowDemo() {
  const [workflow, setWorkflow] = useState(() => makeWorkflow('job'));
  const [departments, setDepartments] = useState<SetupDepartment[]>(['sound']);
  const [tasks, setTasks] = useState(() => generateWorkflowTasks({ workflowType: 'job', departments: ['sound'] }).map(makeTask));
  const [compact, setCompact] = useState(false);
  const progress = calculateWorkflowProgress(tasks);

  function sync(type: WorkflowType, nextDepartments: SetupDepartment[]) {
    const definitions = generateWorkflowTasks({ workflowType: type, departments: nextDepartments });
    setTasks(current => {
      const result = reconcileWorkflowTasks(current, definitions);
      return [...result.retain, ...result.create.map(makeTask)];
    });
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Preparación · Demostración local</h1>
        <p className="text-sm text-muted-foreground">Prueba los estados, los departamentos y el progreso. Los cambios de esta demostración solo viven en memoria y no se guardan en Supabase.</p>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-4" aria-label="Opciones de demostración">
          <label className="block space-y-1 text-sm">Tipo
            <select className="block w-full rounded-md border bg-background p-2" value={workflow.type} onChange={event => {
              const type = event.target.value as WorkflowType;
              setWorkflow(makeWorkflow(type));
              setTasks(generateWorkflowTasks({ workflowType: type, departments }).map(makeTask));
            }}>
              <option value="job">Trabajo</option><option value="tour">Gira</option><option value="tour_date">Fecha de gira</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">Paso actual
            <select className="block w-full rounded-md border bg-background p-2" value={workflow.current_step}
              onChange={event => setWorkflow({ ...workflow, current_step: event.target.value })}>
              {getWorkflowSteps(workflow.type).map(step => <option key={step} value={step}>{stepLabels[step]}</option>)}
            </select>
          </label>
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-2 text-sm font-medium">Departamentos</legend>
            {(Object.keys(departmentSetupRequirements) as SetupDepartment[]).map(department => (
              <label key={department} className="flex items-center gap-2 text-sm">
                <Checkbox checked={departments.includes(department)} onCheckedChange={checked => {
                  const next = checked ? [...departments, department] : departments.filter(value => value !== department);
                  setDepartments(next);
                  sync(workflow.type, next);
                }} />{({ sound: 'Sonido', lights: 'Iluminación', video: 'Vídeo', production: 'Producción', personnel: 'Personal', estructura: 'Estructura' })[department]}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={compact} onCheckedChange={value => setCompact(value === true)} />Vista compacta</label>
          <p className="text-sm">{progress.isAdministrativelyComplete ? 'Preparación administrativa resuelta' : 'Hay requisitos pendientes'}</p>
          <p className="text-sm text-muted-foreground">{tasks.filter(task => !task.applicable).length} tareas conservadas como histórico</p>
        </section>
        <SetupWorkflowProgress workflow={workflow} tasks={tasks} compact={compact} />
      </div>
      <section className="space-y-3" aria-label="Cambiar estados de prueba">
        <h2 className="text-lg font-semibold">Estados de prueba</h2>
        {tasks.filter(task => task.applicable).map(task => (
          <div key={task.task_key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
            <span className="text-sm">{task.label}</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(taskLabels) as TaskStatus[]).filter(status => canTransitionTaskStatus(task.status, status)).map(status => (
                <Button key={status} size="sm" variant="outline" onClick={() => setTasks(current => current.map(row =>
                  row.id === task.id ? { ...row, status, completed_at: status === 'completed' ? new Date().toISOString() : null } : row
                ))}>{taskLabels[status]}</Button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
