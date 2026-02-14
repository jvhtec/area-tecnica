import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, Calendar, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Task {
  id: string;
  department: 'sound' | 'lights' | 'video' | 'production' | 'administrative';
  taskType: string;
  status: 'not_started' | 'in_progress';
  progress: number;
  dueDate: string | null;
  priority: number | null;
  detailLink: string;
}

interface SingleTaskPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  jobOrTourName: string;
  jobOrTourType: 'job' | 'tour' | 'global';
  client?: string;
  onDismiss: () => void;
  onViewAll: () => void;
  totalPendingCount: number;
  currentIndex: number;
}

const DEPARTMENT_COLORS: Record<string, string> = {
  sound: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400',
  lights: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  video: 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400',
  production: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400',
  administrative: 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400',
};

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Sin empezar',
  in_progress: 'En progreso',
};

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-400',
  in_progress: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400',
};

export const SingleTaskPopup: React.FC<SingleTaskPopupProps> = ({
  open,
  onOpenChange,
  task,
  jobOrTourName,
  jobOrTourType,
  client,
  onDismiss,
  onViewAll,
  totalPendingCount,
  currentIndex,
}) => {
  const navigate = useNavigate();

  if (!task) return null;

  const handleViewTask = () => {
    if (task.detailLink) {
      navigate(task.detailLink);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Tarea Pendiente
            {totalPendingCount > 1 && (
              <Badge variant="secondary" className="ml-2">
                {currentIndex + 1} de {totalPendingCount}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Tienes una tarea asignada que requiere atención
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Job/Tour Context */}
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center gap-2">
              {jobOrTourType !== 'global' && (
                <Badge variant="outline" className="text-xs font-mono">
                  {jobOrTourType.toUpperCase()}
                </Badge>
              )}
              <h3 className="font-semibold">{jobOrTourName}</h3>
            </div>
            {client && (
              <p className="text-sm text-muted-foreground mt-1">{client}</p>
            )}
          </div>

          {/* Task Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Departamento</span>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-medium',
                  DEPARTMENT_COLORS[task.department] || ''
                )}
              >
                {task.department}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Tipo de Tarea</span>
              <span className="text-sm font-medium">{task.taskType}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Estado</span>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  STATUS_COLORS[task.status] || ''
                )}
              >
                {STATUS_LABELS[task.status] || task.status}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Progreso</span>
                <span className="text-xs text-muted-foreground">{task.progress}%</span>
              </div>
              <Progress value={task.progress} className="h-2" />
            </div>

            {task.dueDate && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Fecha Límite</span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span
                    className={cn(
                      'text-sm',
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
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onDismiss}
            className="w-full sm:w-auto"
          >
            Descartar por ahora
          </Button>
          {totalPendingCount > 1 && (
            <Button
              variant="outline"
              onClick={onViewAll}
              className="w-full sm:w-auto"
            >
              Ver Todas las Tareas ({totalPendingCount})
            </Button>
          )}
          {task.detailLink && (
            <Button
              onClick={handleViewTask}
              className="w-full sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Detalles
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SingleTaskPopup;
