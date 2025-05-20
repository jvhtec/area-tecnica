
import React from "react";
import { format } from "date-fns";
import { DateTypeContextMenu } from "../DateTypeContextMenu";
import { TooltipProvider, TooltipContent, TooltipTrigger, Tooltip } from "@/components/ui/tooltip";
import { Plane, Wrench, Star, Moon, Mic, Clock, MapPin, Users, Music2, Lightbulb, Video } from "lucide-react";
import { useDateTypesContext } from "./DateTypesContext";
import { supabase } from "@/lib/supabase";

interface CalendarJobCardProps {
  job: any;
  date: Date;
}

export const CalendarJobCard: React.FC<CalendarJobCardProps> = ({ job, date }) => {
  const { dateTypes, setDateTypes } = useDateTypesContext();

  const getDateTypeIcon = (jobId: string, date: Date) => {
    const key = `${jobId}-${format(date, "yyyy-MM-dd")}`;
    const dateType = dateTypes[key]?.type;
    switch (dateType) {
      case "travel":
        return <Plane className="h-3 w-3 text-blue-500" />;
      case "setup":
        return <Wrench className="h-3 w-3 text-yellow-500" />;
      case "show":
        return <Star className="h-3 w-3 text-green-500" />;
      case "off":
        return <Moon className="h-3 w-3 text-gray-500" />;
      case "rehearsal":
        return <Mic className="h-3 w-3 text-violet-500" />;
      default:
        return null;
    }
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
  const dateTypeIcon = getDateTypeIcon(job.id, date);

  return (
    <DateTypeContextMenu
      key={job.id}
      jobId={job.id}
      date={date}
      onTypeChange={async () => {
        const { data } = await supabase.from("job_date_types").select("*").eq("job_id", job.id);
        setDateTypes((prev) => ({
          ...prev,
          ...data?.reduce((acc: Record<string, any>, curr) => ({
            ...acc,
            [`${curr.job_id}-${curr.date}`]: curr,
          }), {}),
        }));
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
                  {format(new Date(job.start_time), "MMM d, HH:mm")} -{" "}
                  {format(new Date(job.end_time), "MMM d, HH:mm")}
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
                  {job.job_departments.map((dept: any) => (
                    <div key={dept.department} className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-full text-xs">
                      {getDepartmentIcon(dept.department)}
                      <span className="capitalize">{dept.department}</span>
                    </div>
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
