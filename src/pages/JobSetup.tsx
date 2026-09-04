import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Ban, Check, ExternalLink, Loader2, Play, RefreshCw, RotateCcw, SkipForward } from 'lucide-react';

import { EditJobDialog } from '@/components/jobs/EditJobDialog';
import { JobDetailsDialog } from '@/components/jobs/JobDetailsDialog';
import { JobRequirementsEditor } from '@/components/jobs/JobRequirementsEditor';
import { MotorCertificateAction } from '@/components/jobs/cards/job-card-actions/MotorCertificateAction';
import { PrepareMotorsAction } from '@/components/jobs/cards/job-card-actions/PrepareMotorsAction';
import type { JobCardJob } from '@/components/jobs/cards/job-card-actions/types';
import { TaskManagerDialog } from '@/components/tasks/TaskManagerDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SetupWorkflowProgress } from '@/features/setup-workflows/components/SetupWorkflowProgress';
import { getSetupJobDepartments, useSetupJob } from '@/features/setup-workflows/jobContext';
import { getJobSetupTaskAction, type JobSetupDialog } from '@/features/setup-workflows/jobTaskActions';
import { calculateWorkflowProgress } from '@/features/setup-workflows/progress';
import {
  useCreateSetupWorkflow,
  useLatestSetupWorkflowForEntity,
  useSetupWorkflowForEntity,
  useSetupWorkflowStatusMutation,
  useSetupWorkflowTasks,
  useUpdateSetupWorkflow,
} from '@/features/setup-workflows/hooks';
import type { SetupWorkflowTask, TaskStatus } from '@/features/setup-workflows/types';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const taskStatusCopy: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  completed: 'Completada',
  skipped: 'Omitida',
  blocked: 'Bloqueada',
};

const responsibleRoleCopy = {
  assistant: 'Asistencia', technical: 'Equipo técnico',
  production: 'Producción', management: 'Dirección',
} as const;

const categoryStep: Record<string, string> = {
  basic: 'basic', departments: 'departments', personnel: 'personnel',
  technical: 'technical', resources: 'resources', review: 'review',
};

type OpenDialog = { name: JobSetupDialog; department?: string } | null;

export default function JobSetup() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { userRole } = useOptimizedAuth();
  const { toast } = useToast();
  const jobQuery = useSetupJob(jobId);
  const workflowQuery = useSetupWorkflowForEntity('job', jobId);
  const latestWorkflowQuery = useLatestSetupWorkflowForEntity('job', jobId);
  const createWorkflow = useCreateSetupWorkflow();
  const updateCreatedWorkflowStatus = useSetupWorkflowStatusMutation();
  const workflow = workflowQuery.data ?? latestWorkflowQuery.data;
  const tasksQuery = useSetupWorkflowTasks(workflow?.id);
  const updateWorkflow = useUpdateSetupWorkflow(workflow?.id ?? 'pending');
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);

  const job = jobQuery.data;
  const departments = useMemo(() => getSetupJobDepartments(job), [job]);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const isStartingWorkflow = createWorkflow.isPending || updateCreatedWorkflowStatus.isPending;
  const orderedTasks = useMemo(() => {
    const order = ['basic', 'departments', 'personnel', 'technical', 'resources', 'review'];
    return [...tasks].sort((left, right) => {
      const categoryOrder = order.indexOf(left.category) - order.indexOf(right.category);
      return categoryOrder || left.label.localeCompare(right.label, 'es');
    });
  }, [tasks]);
  const progress = calculateWorkflowProgress(tasks);

  const startWorkflow = async () => {
    let workflowCreated = false;
    try {
      const created = await createWorkflow.mutateAsync({
        workflowType: 'job', entityId: jobId!, departments,
        state: { source: 'job_setup_page' },
      });
      workflowCreated = true;
      await updateCreatedWorkflowStatus.mutateAsync({ workflowId: created.id, status: 'in_progress' });
    } catch (error) {
      if (workflowCreated) {
        toast({ title: 'Preparación creada en borrador', description: 'Pulsa Empezar para continuar.' });
      }
    } finally {
      await Promise.all([workflowQuery.refetch(), latestWorkflowQuery.refetch()]);
    }
  };

  const updateStatus = (task: SetupWorkflowTask, status: TaskStatus) =>
    updateWorkflow.mutateAsync({ action: 'task_status', taskKey: task.task_key, status });

  const rememberTaskStep = async (task: SetupWorkflowTask) => {
    const step = categoryStep[task.category];
    if (step && workflow && workflow.current_step !== step) {
      await updateWorkflow.mutateAsync({ action: 'step', step });
    }
  };

  const openTask = async (task: SetupWorkflowTask) => {
    await rememberTaskStep(task);
    const action = getJobSetupTaskAction(task, jobId!);
    if (action.kind === 'route' || action.kind === 'project') {
      navigate(action.href);
      return;
    }
    if (action.kind === 'dialog') {
      setOpenDialog({ name: action.dialog, department: action.department });
    }
  };

  if (jobQuery.isLoading || workflowQuery.isLoading || latestWorkflowQuery.isLoading) {
    return <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-56 w-full" /></div>;
  }

  if (jobQuery.isError || !job) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>No se pudo abrir la preparación</AlertTitle><AlertDescription>{jobQuery.error instanceof Error ? jobQuery.error.message : 'No se ha encontrado el trabajo.'}</AlertDescription></Alert>
      </div>
    );
  }

  if (workflowQuery.isError || latestWorkflowQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <Button variant="ghost" size="sm" className="-ml-3 gap-2" onClick={() => navigate('/project-management')}><ArrowLeft className="h-4 w-4" />Proyectos</Button>
        <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>No se pudo cargar la preparación</AlertTitle><AlertDescription>{workflowQuery.error instanceof Error ? workflowQuery.error.message : latestWorkflowQuery.error instanceof Error ? latestWorkflowQuery.error.message : 'La preparación no está disponible.'}</AlertDescription></Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-24 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-3 gap-2" onClick={() => navigate('/project-management')}><ArrowLeft className="h-4 w-4" />Proyectos</Button>
          <h1 className="text-2xl font-semibold tracking-tight">Preparación de {job.title}</h1>
          <p className="text-sm text-muted-foreground">El progreso queda guardado. Abre cada herramienta, realiza el trabajo y confirma la tarea al volver.</p>
        </div>
        {workflow && (
          <Button variant="outline" size="sm" className="gap-2" disabled={updateWorkflow.isPending} onClick={() => updateWorkflow.mutate({ action: 'sync', departments })}>
            <RefreshCw className={cn('h-4 w-4', updateWorkflow.isPending && 'animate-spin')} />Actualizar tareas
          </Button>
        )}
      </header>

      {!workflow ? (
        <Card>
          <CardHeader><CardTitle>Iniciar preparación guiada</CardTitle><CardDescription>Se generarán tareas para {departments.length ? departments.join(', ') : 'los departamentos del trabajo'} usando los datos actuales del trabajo.</CardDescription></CardHeader>
          <CardContent><Button className="gap-2" disabled={isStartingWorkflow || departments.length === 0} onClick={() => void startWorkflow()}>{isStartingWorkflow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Iniciar preparación</Button>{departments.length === 0 && <p className="mt-2 text-sm text-destructive">Añade al menos un departamento antes de iniciar.</p>}</CardContent>
        </Card>
      ) : (
        <>
          <SetupWorkflowProgress workflow={workflow} tasks={tasks} compact />

          {(workflow.status === 'complete' || workflow.status === 'cancelled') && (
            <Button variant="outline" className="gap-2" disabled={isStartingWorkflow} onClick={() => void startWorkflow()}>{isStartingWorkflow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Iniciar una nueva preparación</Button>
          )}

          {workflow.status === 'draft' && (
            <Button className="gap-2" disabled={updateWorkflow.isPending} onClick={() => updateWorkflow.mutate({ action: 'status', status: 'in_progress' })}><Play className="h-4 w-4" />Empezar</Button>
          )}

          <section aria-labelledby="setup-tasks-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="setup-tasks-title" className="text-lg font-semibold">Tareas operativas</h2>
              <span className="text-sm text-muted-foreground">{progress.completedTasks} de {progress.totalTasks} completadas</span>
            </div>
            {tasksQuery.isError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No se pudieron cargar las tareas</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{tasksQuery.error instanceof Error ? tasksQuery.error.message : 'Inténtalo de nuevo.'}</p>
                  <Button variant="outline" size="sm" onClick={() => void tasksQuery.refetch()}>Reintentar</Button>
                </AlertDescription>
              </Alert>
            ) : tasksQuery.isLoading ? <Skeleton className="h-40 w-full" /> : orderedTasks.filter(task => task.applicable).map(task => {
              const action = getJobSetupTaskAction(task, job.id);
              return (
                <Card key={task.id} className={cn(task.status === 'blocked' && 'border-destructive/60', task.status === 'completed' && 'border-emerald-500/40')}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{task.label}</h3><Badge variant={task.status === 'blocked' ? 'destructive' : 'outline'}>{taskStatusCopy[task.status]}</Badge>{!task.required && <Badge variant="secondary">Opcional</Badge>}</div>
                      <p className="mt-1 text-xs text-muted-foreground">Responsable: {responsibleRoleCopy[task.responsible_role]}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {action.kind === 'estructura' && action.tool === 'motors' && <span className="flex gap-2" onClickCapture={() => void rememberTaskStep(task)}><PrepareMotorsAction department="sound" jobId={job.id} /><PrepareMotorsAction department="lights" jobId={job.id} /></span>}
                      {action.kind === 'estructura' && action.tool === 'certificate' && <span onClickCapture={() => void rememberTaskStep(task)}><MotorCertificateAction job={job as unknown as JobCardJob} /></span>}
                      {(action.kind === 'dialog' || action.kind === 'route' || action.kind === 'project') && <Button variant="outline" size="sm" className="gap-2" disabled={updateWorkflow.isPending} onClick={() => void openTask(task)}>{action.kind === 'route' || action.kind === 'project' ? <ExternalLink className="h-4 w-4" /> : null}{action.label}</Button>}
                      {(task.status === 'pending' || task.status === 'blocked') && <Button size="sm" className="gap-2" disabled={updateWorkflow.isPending} onClick={() => void updateStatus(task, 'completed')}><Check className="h-4 w-4" />Completar</Button>}
                      {task.status === 'pending' && <Button variant="ghost" size="sm" disabled={updateWorkflow.isPending} onClick={() => void updateStatus(task, 'blocked')}><Ban className="mr-1 h-4 w-4" />Bloquear</Button>}
                      {task.status === 'pending' && <Button variant="ghost" size="sm" disabled={updateWorkflow.isPending} onClick={() => void updateStatus(task, 'skipped')}><SkipForward className="mr-1 h-4 w-4" />Omitir</Button>}
                      {task.status !== 'pending' && <Button variant="ghost" size="sm" disabled={updateWorkflow.isPending} onClick={() => void updateStatus(task, 'pending')}><RotateCcw className="mr-1 h-4 w-4" />Reabrir</Button>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <Card>
            <CardHeader><CardTitle className="text-base">Cerrar preparación</CardTitle><CardDescription>La revisión final solo puede completarse cuando todas las tareas obligatorias están terminadas y no hay bloqueos.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {workflow.status === 'in_progress' && <Button variant="outline" disabled={updateWorkflow.isPending} onClick={() => updateWorkflow.mutate({ action: 'status', status: 'review' })}>Enviar a revisión</Button>}
              {workflow.status === 'review' && <Button variant="outline" disabled={updateWorkflow.isPending} onClick={() => updateWorkflow.mutate({ action: 'status', status: 'in_progress' })}>Volver a preparación</Button>}
              {(workflow.status === 'in_progress' || workflow.status === 'review') && <Button disabled={!progress.isAdministrativelyComplete || updateWorkflow.isPending} onClick={() => updateWorkflow.mutate({ action: 'status', status: 'complete' })}>Completar preparación</Button>}
            </CardContent>
          </Card>
        </>
      )}

      <EditJobDialog open={openDialog?.name === 'edit'} onOpenChange={(open) => { if (!open) { setOpenDialog(null); void jobQuery.refetch(); } }} job={job} />
      <JobRequirementsEditor open={openDialog?.name === 'requirements'} onOpenChange={(open) => { if (!open) setOpenDialog(null); }} jobId={job.id} departments={departments} />
      <TaskManagerDialog open={openDialog?.name === 'tasks'} onOpenChange={(open) => { if (!open) setOpenDialog(null); }} jobId={job.id} userRole={userRole} initialDepartment={openDialog?.department === 'lights' || openDialog?.department === 'video' ? openDialog.department : 'sound'} />
      <JobDetailsDialog open={openDialog?.name === 'details'} onOpenChange={(open) => { if (!open) setOpenDialog(null); }} job={job} department={openDialog?.department} />
    </div>
  );
}
