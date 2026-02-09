import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Calendar, ExternalLink, Loader2, CheckCircle } from 'lucide-react';
import { usePendingTasks, GroupedPendingTask } from '@/hooks/usePendingTasks';
import { useCompleteTask, Department } from '@/hooks/useCompleteTask';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface PendingTasksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userRole: string | null;
}

const DEPARTMENT_COLORS: Record<string, string> = {
  sound: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400',
  lights: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  video: 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400',
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Sin empezar',
  in_progress: 'En progreso',
};

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-400',
  in_progress: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400',
};

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Alta',
  2: 'Media',
  3: 'Baja',
};

export const PendingTasksModal: React.FC<PendingTasksModalProps> = ({
  open,
  onOpenChange,
  userId,
  userRole,
}) => {
  const navigate = useNavigate();
  const { data: groupedTasks, isLoading, error } = usePendingTasks(userId, userRole);
  const { mutate: completeTask, isPending: isCompletingTask } = useCompleteTask();
  const [completingTaskId, setCompletingTaskId] = React.useState<string | null>(null);

  const handleViewDetails = (link: string) => {
    navigate(link);
    onOpenChange(false);
  };

  const handleCompleteTask = (taskId: string, department: Department) => {
    if (!userId) return;
    
    setCompletingTaskId(taskId);
    completeTask(
      { taskId, department, userId },
      {
        onSettled: () => {
          setCompletingTaskId(null);
        },
      }
    );
  };

  // Check if user can complete tasks (must be management, admin, or logistics)
  const canCompleteTask = userRole && ['management', 'admin', 'logistics'].includes(userRole);

  const totalTaskCount = groupedTasks?.reduce((sum, group) => sum + group.tasks.length, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Tareas Pendientes
            {totalTaskCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalTaskCount} {totalTaskCount === 1 ? 'tarea' : 'tareas'}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Tareas asignadas a ti que aún no están completadas
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando tareas pendientes...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>Error al cargar las tareas pendientes. Inténtalo de nuevo más tarde.</span>
            </div>
          )}

          {!isLoading && !error && (!groupedTasks || groupedTasks.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">Sin tareas pendientes</p>
              <p className="text-sm text-muted-foreground mt-1">
                ¡Estás al día! No tienes tareas incompletas asignadas.
              </p>
            </div>
          )}

          {!isLoading && !error && groupedTasks && groupedTasks.length > 0 && (
            <div className="space-y-6">
              {groupedTasks.map((group) => (
                <div key={group.id} className="rounded-lg border bg-card">
                  <div className="border-b bg-muted/40 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {group.type !== 'global' && (
                            <Badge variant="outline" className="text-xs font-mono">
                              {group.type.toUpperCase()}
                            </Badge>
                          )}
                          <h3 className="font-semibold">{group.name}</h3>
                        </div>
                        {group.client && (
                          <p className="text-sm text-muted-foreground mt-1">{group.client}</p>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {group.tasks.length} {group.tasks.length === 1 ? 'tarea' : 'tareas'}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Departamento</TableHead>
                          <TableHead>Tipo de Tarea</TableHead>
                          <TableHead className="w-[140px]">Estado</TableHead>
                          <TableHead className="w-[160px]">Progreso</TableHead>
                          <TableHead className="w-[140px]">Fecha Límite</TableHead>
                          <TableHead className="w-[200px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.tasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs font-medium',
                                  DEPARTMENT_COLORS[task.department] || ''
                                )}
                              >
                                {task.department}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <HoverCard openDelay={120}>
                                <HoverCardTrigger asChild>
                                  <button
                                    type="button"
                                    className="text-left min-w-0"
                                    aria-label={`Ver metadata de la tarea ${task.taskType}`}
                                  >
                                    <div className="font-medium">{task.taskType}</div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                      {task.description || 'Sin descripción'}
                                    </p>
                                  </button>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-[340px] space-y-2">
                                  <div className="space-y-1">
                                    <div className="text-sm font-semibold">{task.taskType}</div>
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                      {task.description || 'Sin descripción'}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                    <span className="text-muted-foreground">Estado</span>
                                    <span>{STATUS_LABELS[task.status] || task.status}</span>
                                    <span className="text-muted-foreground">Progreso</span>
                                    <span>{task.progress}%</span>
                                    <span className="text-muted-foreground">Prioridad</span>
                                    <span>{task.priority ? PRIORITY_LABELS[task.priority] || task.priority : '-'}</span>
                                    <span className="text-muted-foreground">Creada</span>
                                    <span>{task.createdAt ? format(new Date(task.createdAt), 'dd/MM/yyyy HH:mm') : '-'}</span>
                                    <span className="text-muted-foreground">Actualizada</span>
                                    <span>{task.updatedAt ? format(new Date(task.updatedAt), 'dd/MM/yyyy HH:mm') : '-'}</span>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs',
                                  STATUS_COLORS[task.status] || ''
                                )}
                              >
                                {STATUS_LABELS[task.status] || task.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={task.progress} className="h-2 flex-1" />
                                <span className="text-xs text-muted-foreground w-10 text-right">
                                  {task.progress}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {task.dueDate ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span
                                    className={cn(
                                      'text-xs',
                                      new Date(task.dueDate) < new Date()
                                        ? 'text-destructive font-medium'
                                        : 'text-muted-foreground'
                                    )}
                                  >
                                    {formatDistanceToNow(new Date(task.dueDate), {
                                      addSuffix: true,
                                      locale: es,
                                    })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {task.detailLink && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewDetails(task.detailLink)}
                                    className="h-8"
                                    aria-label={`Ver detalles de la tarea ${task.taskType}`}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Ver
                                  </Button>
                                )}
                                {canCompleteTask && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleCompleteTask(task.id, task.department)}
                                    disabled={completingTaskId === task.id}
                                    className="h-8"
                                    aria-label={`Marcar tarea ${task.taskType} como completada`}
                                  >
                                    {completingTaskId === task.id ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        Completando...
                                      </>
                                    ) : (
                                      <>
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Completar
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PendingTasksModal;
