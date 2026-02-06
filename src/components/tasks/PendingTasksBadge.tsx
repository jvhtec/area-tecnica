import React, { useMemo } from 'react';
import { ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePendingTasks } from '@/hooks/usePendingTasks';
import { cn } from '@/lib/utils';

interface PendingTasksBadgeProps {
  userId: string | null;
  userRole: string | null;
  onClick: () => void;
  className?: string;
}

export const PendingTasksBadge: React.FC<PendingTasksBadgeProps> = ({
  userId,
  userRole,
  onClick,
  className,
}) => {
  const { data: groupedTasks, isLoading } = usePendingTasks(userId, userRole);

  const totalTaskCount = useMemo(() => {
    return groupedTasks?.reduce((sum, group) => sum + group.tasks.length, 0) || 0;
  }, [groupedTasks]);

  const readableCount = totalTaskCount > 9 ? '9+' : totalTaskCount.toString();
  const hasPendingTasks = totalTaskCount > 0;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        'relative h-9 w-9 rounded-full border border-border/60 bg-background/70 text-muted-foreground shadow-sm transition-colors hover:bg-accent/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        hasPendingTasks && 'text-blue-500',
        className
      )}
      aria-label={
        hasPendingTasks
          ? `${totalTaskCount} ${totalTaskCount === 1 ? 'tarea pendiente' : 'tareas pendientes'}`
          : 'Sin tareas pendientes'
      }
    >
      <ListTodo className="h-5 w-5" aria-hidden="true" />
      {hasPendingTasks && (
        <span className="pointer-events-none absolute -top-1 -right-1 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[0.7rem] font-semibold text-white shadow">
          {readableCount}
        </span>
      )}
    </Button>
  );
};

export default PendingTasksBadge;
