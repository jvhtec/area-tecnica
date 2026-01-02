
import React from 'react';
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Clock, MapPin, Plane, Wrench, Star, Moon, Mic } from "lucide-react";
import { Department } from "@/types/department";
import { JobStatusSelector } from "@/components/jobs/JobStatusSelector";
import { useIsMobile } from "@/hooks/use-mobile";

interface JobCardHeaderProps {
  job: any;
  collapsed: boolean;
  onToggleCollapse: (e: React.MouseEvent) => void;
  appliedBorderColor: string;
  appliedBgColor: string;
  dateTypes: Record<string, any>;
  department: Department;
  isProjectManagementPage?: boolean;
  userRole?: string | null;
}

export const JobCardHeader: React.FC<JobCardHeaderProps> = ({
  job,
  collapsed,
  onToggleCollapse,
  appliedBorderColor,
  appliedBgColor,
  dateTypes,
  department,
  isProjectManagementPage = false,
  userRole
}) => {
  const isMobile = useIsMobile();

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
        return <Badge variant="secondary" className={cn("ml-2", isMobile && "text-xs")}>Tour</Badge>;
      case "single":
        return <Badge variant="secondary" className={cn("ml-2", isMobile && "text-xs")}>Single</Badge>;
      case "festival":
        return <Badge variant="secondary" className={cn("ml-2", isMobile && "text-xs")}>Festival</Badge>;
      case "tourdate":
        return <Badge variant="secondary" className={cn("ml-2", isMobile && "text-xs")}>Tour Date</Badge>;
      case "dryhire":
        return <Badge variant="secondary" className={cn("ml-2", isMobile && "text-xs")}>Dry Hire</Badge>;
      case "evento":
        return <Badge variant="secondary" className={cn("ml-2", isMobile && "text-xs")}>Evento</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className={cn("pb-3", isMobile ? "p-4" : "p-6")}>
      <div className={cn("flex items-start justify-between", isMobile ? "gap-2" : "gap-4")}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {getDateTypeIcon(job.id, new Date(job.start_time), dateTypes)}
            <h3 className={cn("font-medium break-words leading-tight", isMobile ? "text-base" : "text-lg")}>{job.title}</h3>
            {getBadgeForJobType(job.job_type)}
            {job.invoicing_company && (
              <Badge variant="outline" className={cn("ml-2", isMobile && "text-xs")}>
                {job.invoicing_company}
              </Badge>
            )}
            {isProjectManagementPage && (
              <JobStatusSelector
                jobId={job.id}
                currentStatus={job.status}
                disabled={!['admin', 'management', 'logistics'].includes(userRole || '')}
              />
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          title="Toggle Details"
          className={cn("hover:bg-accent/50 shrink-0", isMobile && "h-8 w-8")}
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className={cn("space-y-2 text-sm", isMobile ? "mt-1.5" : "mt-2")}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col">
            <span className={cn(isMobile && "text-xs")}>
              {format(new Date(job.start_time), isMobile ? "MMM d, yy" : "MMM d, yyyy")} -{" "}
              {format(new Date(job.end_time), isMobile ? "MMM d, yy" : "MMM d, yyyy")}
            </span>
            <span className={cn("text-muted-foreground", isMobile && "text-xs")}>
              {format(new Date(job.start_time), "HH:mm")}
            </span>
          </div>
        </div>
        {job.location?.name && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className={cn("font-medium line-clamp-2", isMobile && "text-xs")}>{job.location.name}</span>
          </div>
        )}
      </div>
    </div>
  );
};
