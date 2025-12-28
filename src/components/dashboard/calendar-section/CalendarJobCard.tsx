import React from "react";
import { format } from "date-fns";
import { Clock, Lightbulb, MapPin, Music2, Users, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getDateTypeIcon } from "@/pages/wallboard/utils";
import { formatInJobTimezone } from "@/utils/timezoneUtils";

import { DateTypeContextMenu } from "../DateTypeContextMenu";

export interface CalendarJobCardProps {
  job: any;
  date: Date;
  dateTypes: Record<string, any>;
}

export const CalendarJobCard: React.FC<CalendarJobCardProps> = ({ job, date, dateTypes }) => {
  const getDateTypeIconForJob = (jobId: string, date: Date) => {
    const key = `${jobId}-${format(date, "yyyy-MM-dd")}`;
    const dateType = dateTypes[key]?.type;
    const icon = getDateTypeIcon(dateType ?? null);
    if (!icon) return null;

    const colorClass =
      dateType === "travel"
        ? "text-blue-500"
        : dateType === "setup"
          ? "text-yellow-500"
          : dateType === "show"
            ? "text-green-500"
            : dateType === "off"
              ? "text-gray-500"
              : dateType === "rehearsal"
                ? "text-violet-500"
                : "";

    return React.cloneElement(icon, { className: `h-3 w-3 ${colorClass}`.trim() });
  };

  const getDepartmentIcon = (dept: string) => {
    switch (dept) {
      case "sound":
        return <Music2 className="h-3 w-3" />;
      case "lights":
        return <Lightbulb className="h-3 w-3" />;
      case "video":
        return <Video className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getTotalRequiredPersonnel = (job: any) => {
    let total = 0;
    if (job.sound_job_personnel?.length > 0) {
      total +=
        (job.sound_job_personnel[0].foh_engineers || 0) +
        (job.sound_job_personnel[0].mon_engineers || 0) +
        (job.sound_job_personnel[0].pa_techs || 0) +
        (job.sound_job_personnel[0].rf_techs || 0);
    }
    if (job.lights_job_personnel?.length > 0) {
      total +=
        (job.lights_job_personnel[0].lighting_designers || 0) +
        (job.lights_job_personnel[0].lighting_techs || 0) +
        (job.lights_job_personnel[0].spot_ops || 0) +
        (job.lights_job_personnel[0].riggers || 0);
    }
    if (job.video_job_personnel?.length > 0) {
      total +=
        (job.video_job_personnel[0].video_directors || 0) +
        (job.video_job_personnel[0].camera_ops || 0) +
        (job.video_job_personnel[0].playback_techs || 0) +
        (job.video_job_personnel[0].video_techs || 0);
    }
    return total;
  };

  const totalRequired = getTotalRequiredPersonnel(job);
  const currentlyAssigned = job.job_assignments?.length || 0;
  const jobTimezone = job.timezone || "Europe/Madrid";
  const dateTypeIcon = getDateTypeIconForJob(job.id, date);

  return (
    <DateTypeContextMenu
      key={job.id}
      jobId={job.id}
      date={date}
      onTypeChange={() => {
        // The useOptimizedDateTypes hook will automatically refresh via React Query
        // No manual state updates needed
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="px-1.5 py-0.5 rounded text-xs truncate hover:bg-accent/50 transition-colors flex items-center gap-1 cursor-pointer"
              style={{
                backgroundColor: `${job.color}20`,
                color: job.color,
              }}
            >
              {dateTypeIcon}
              <span>{job.title}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="w-64 p-2">
            <div className="space-y-2">
              <h4 className="font-semibold">{job.title}</h4>
              {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span>
                  {formatInJobTimezone(job.start_time, "MMM d, HH:mm", jobTimezone)} -{" "}
                  {formatInJobTimezone(job.end_time, "MMM d, HH:mm", jobTimezone)}
                </span>
              </div>
              {job.location?.name && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>{job.location.name}</span>
                </div>
              )}
              <div className="space-y-1">
                <div className="text-sm font-medium">Departments:</div>
                <div className="flex flex-wrap gap-1">
                  {job.job_departments?.map((dept: any) => (
                    <Badge key={dept.department} variant="secondary" className="flex items-center gap-1">
                      {getDepartmentIcon(dept.department)}
                      <span className="capitalize">{dept.department}</span>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                <span>
                  {currentlyAssigned}/{totalRequired} assigned
                </span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </DateTypeContextMenu>
  );
};
