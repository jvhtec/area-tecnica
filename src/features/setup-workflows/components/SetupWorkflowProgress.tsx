import { AlertCircle, CheckCircle2, Circle, SkipForward } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getWorkflowDefinition, stepLabels } from '../definitions';
import { calculateWorkflowProgress } from '../progress';
import type { SetupWorkflow, SetupWorkflowTask, TaskStatus, WorkflowStatus } from '../types';

const statusLabels: Record<WorkflowStatus, string> = {
  draft: 'Borrador', in_progress: 'En curso', review: 'En revisión', complete: 'Completada', cancelled: 'Cancelada',
};
const taskLabels: Record<TaskStatus, string> = {
  pending: 'Pendiente', completed: 'Completada', skipped: 'Omitida', blocked: 'Bloqueada',
};
const taskIcons = { pending: Circle, completed: CheckCircle2, skipped: SkipForward, blocked: AlertCircle };

type Props = {
  workflow: SetupWorkflow;
  tasks: readonly SetupWorkflowTask[];
  title?: string;
  compact?: boolean;
};

/** Display-only foundation; does not mount queries or initiate provisioning. */
export function SetupWorkflowProgress({ workflow, tasks, title, compact = false }: Props) {
  const progress = calculateWorkflowProgress(tasks);
  return (
    <Card aria-label={title ?? getWorkflowDefinition(workflow.type).title}>
      <CardHeader className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title ?? getWorkflowDefinition(workflow.type).title}</CardTitle>
          <Badge variant="outline">{statusLabels[workflow.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {stepLabels[workflow.current_step] ?? workflow.current_step} · {progress.completedTasks}/{progress.totalTasks} completadas
        </p>
        <Progress value={progress.percentage} aria-label="Progreso de preparación" aria-valuenow={progress.percentage} />
        <p className="text-sm text-muted-foreground">{progress.percentage}% resuelto</p>
        {progress.hasBlockers && (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {progress.blockedTasks} {progress.blockedTasks === 1 ? 'tarea bloqueada' : 'tareas bloqueadas'}
          </p>
        )}
      </CardHeader>
      {!compact && (
        <CardContent className="p-4 pt-0">
          <ul className="space-y-2">
            {tasks.filter(task => task.applicable).map(task => {
              const Icon = taskIcons[task.status];
              return (
                <li key={task.task_key} className="flex items-start gap-2 text-sm">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {task.label} <span className="text-muted-foreground">· {taskLabels[task.status]}</span>
                    {!task.required && <span className="text-muted-foreground"> · Opcional</span>}
                    {task.required && task.status === 'skipped' && <span className="text-destructive"> · Obligatoria sin resolver</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
