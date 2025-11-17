
import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RequiredRoleSummaryItem } from "@/hooks/useJobRequiredRoles";
import { labelForCode } from "@/utils/roles";

interface JobCardProgressProps {
  soundTasks: any[] | null;
  roleSummary?: RequiredRoleSummaryItem[];
}

export const JobCardProgress: React.FC<JobCardProgressProps> = ({
  soundTasks,
  roleSummary = []
}) => {
  const calculateTotalProgress = () => {
    if (!soundTasks?.length) return 0;
    const totalProgress = soundTasks.reduce((acc, task) => acc + (task.progress || 0), 0);
    return Math.round(totalProgress / soundTasks.length);
  };

  const getCompletedTasks = () => {
    if (!soundTasks?.length) return 0;
    return soundTasks.filter((task: any) => task.status === "completed").length;
  };

  const hasRequirements = roleSummary.length > 0;

  if (!soundTasks?.length && !hasRequirements) {
    return null;
  }

  return (
    <div className="space-y-4 mt-4">
      {hasRequirements && (
        <div className="mt-2 p-2 bg-accent/20 rounded-md">
          <div className="text-xs font-medium mb-1">
            Required Personnel
          </div>
          <div className="space-y-2 text-xs">
            {roleSummary.map((item) => (
              <div key={item.department} className="space-y-1">
                <div className="font-medium">
                  {item.department} — {item.total_required || 0}
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.roles.map((role, idx) => (
                    <Badge key={`${role.role_code}-${idx}`} variant="outline" className="text-[11px]">
                      {labelForCode(role.role_code)} × {role.quantity}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {soundTasks?.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Task Progress ({getCompletedTasks()}/{soundTasks.length} completed)
            </span>
            <span>{calculateTotalProgress()}%</span>
          </div>
          <Progress value={calculateTotalProgress()} className="h-1" />
          <div className="space-y-1">
            {soundTasks.map((task: any) => (
              <div key={task.id} className="flex items-center justify-between text-xs">
                <span>{task.task_type}</span>
                <div className="flex items-center gap-2">
                  {task.assigned_to && (
                    <span className="text-muted-foreground">
                      {task.assigned_to.first_name} {task.assigned_to.last_name}
                    </span>
                  )}
                  <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                    {task.status === "not_started"
                      ? "Not Started"
                      : task.status === "in_progress"
                      ? "In Progress"
                      : "Completed"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
