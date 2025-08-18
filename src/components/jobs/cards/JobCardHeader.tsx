
import React from 'react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Clock, MapPin, Plane, Wrench, Star, Moon, Mic } from "lucide-react";
import { Department } from "@/types/department";

interface JobCardHeaderProps {
  job: any;
  collapsed: boolean;
  onToggleCollapse: (e: React.MouseEvent) => void;
  appliedBorderColor: string;
  appliedBgColor: string;
  dateTypes: Record<string, any>;
  department: Department;
}

export const JobCardHeader: React.FC<JobCardHeaderProps> = ({
  job,
  collapsed,
  onToggleCollapse,
  appliedBorderColor,
  appliedBgColor,
  dateTypes,
  department
}) => {
  const getDateTypeIcon = (jobId: string, date: Date, dateTypes: Record<string, any>) => {
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

  const getBadgeForJobType = (jobType: string) => {
    switch (jobType) {
      case "tour":
        return <Badge variant="secondary" className="ml-2">Tour</Badge>;
      case "single":
        return <Badge variant="secondary" className="ml-2">Single</Badge>;
      case "festival":
        return <Badge variant="secondary" className="ml-2">Festival</Badge>;
      case "tourdate":
        return <Badge variant="secondary" className="ml-2">Tour Date</Badge>;
      case "dryhire":
        return <Badge variant="secondary" className="ml-2">Dry Hire</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 pb-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {getDateTypeIcon(job.id, new Date(job.start_time), dateTypes)}
            <h3 className="font-medium text-lg break-words leading-tight">{job.title}</h3>
            {getBadgeForJobType(job.job_type)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          title="Toggle Details"
          className="hover:bg-accent/50 shrink-0"
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="space-y-2 text-sm mt-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span>
              {format(new Date(job.start_time), "MMM d, yyyy")} -{" "}
              {format(new Date(job.end_time), "MMM d, yyyy")}
            </span>
            <span className="text-muted-foreground">
              {format(new Date(job.start_time), "HH:mm")}
            </span>
          </div>
        </div>
        {job.location?.name && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{job.location.name}</span>
          </div>
        )}
      </div>
    </div>
  );
};
