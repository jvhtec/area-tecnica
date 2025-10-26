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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Calendar, ExternalLink, Loader2 } from 'lucide-react';
import { usePendingTasks, GroupedPendingTask } from '@/hooks/usePendingTasks';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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
  not_started: 'Not Started',
  in_progress: 'In Progress',
};

const STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-slate-500/10 text-slate-700 border-slate-500/20 dark:text-slate-400',
  in_progress: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400',
};

export const PendingTasksModal: React.FC<PendingTasksModalProps> = ({
  open,
  onOpenChange,
  userId,
  userRole,
}) => {
  const navigate = useNavigate();
  const { data: groupedTasks, isLoading, error } = usePendingTasks(userId, userRole);

  const handleViewDetails = (link: string) => {
    navigate(link);
    onOpenChange(false);
  };

  const totalTaskCount = groupedTasks?.reduce((sum, group) => sum + group.tasks.length, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Pending Tasks
            {totalTaskCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalTaskCount} {totalTaskCount === 1 ? 'task' : 'tasks'}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Tasks assigned to you that are not yet completed
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading pending tasks...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>Failed to load pending tasks. Please try again later.</span>
            </div>
          )}

          {!isLoading && !error && (!groupedTasks || groupedTasks.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-3 mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium">No pending tasks</p>
              <p className="text-sm text-muted-foreground mt-1">
                You're all caught up! No incomplete tasks assigned to you.
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
                          <Badge variant="outline" className="text-xs font-mono">
                            {group.type.toUpperCase()}
                          </Badge>
                          <h3 className="font-semibold">{group.name}</h3>
                        </div>
                        {group.client && (
                          <p className="text-sm text-muted-foreground mt-1">{group.client}</p>
                        )}
                      </div>
                      <Badge variant="secondary">
                        {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Department</TableHead>
                          <TableHead>Task Type</TableHead>
                          <TableHead className="w-[140px]">Status</TableHead>
                          <TableHead className="w-[160px]">Progress</TableHead>
                          <TableHead className="w-[140px]">Due Date</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
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
                            <TableCell className="font-medium">{task.taskType}</TableCell>
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
                                    })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewDetails(task.detailLink)}
                                className="h-8"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View
                              </Button>
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
