
import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface JobCardProgressProps {
  soundTasks: any[] | null;
  personnel: any;
}

export const JobCardProgress: React.FC<JobCardProgressProps> = ({
  soundTasks,
  personnel
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

  const getTotalPersonnel = () => {
    if (!personnel) return 0;
    return (
      (personnel.foh_engineers || 0) +
      (personnel.mon_engineers || 0) +
      (personnel.pa_techs || 0) +
      (personnel.rf_techs || 0)
    );
  };

  if (!soundTasks?.length && !personnel) {
    return null;
  }

  return (
    <div className="space-y-4 mt-4">
      {personnel && (
        <div className="mt-2 p-2 bg-accent/20 rounded-md">
          <div className="text-xs font-medium mb-1">
            Required Personnel: {getTotalPersonnel()}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>FOH Engineers: {personnel.foh_engineers || 0}</div>
            <div>MON Engineers: {personnel.mon_engineers || 0}</div>
            <div>PA Techs: {personnel.pa_techs || 0}</div>
            <div>RF Techs: {personnel.rf_techs || 0}</div>
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
