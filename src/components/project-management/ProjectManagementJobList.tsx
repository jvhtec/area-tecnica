import React, { useMemo } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ToolResponsiveTable, type ToolResponsiveColumn } from "@/components/shared/tooling";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";

interface ProjectManagementJobListProps {
  jobs: any[];
  jobsLoading: boolean;
  highlightToday?: boolean;
}

const isJobToday = (job: any) => {
  if (!job?.start_time || !job?.end_time) return false;

  const now = new Date();
  const start = startOfDay(new Date(job.start_time));
  const end = endOfDay(new Date(job.end_time));

  return isWithinInterval(now, { start, end });
};

export const ProjectManagementJobList: React.FC<ProjectManagementJobListProps> = ({
  jobs,
  jobsLoading,
  highlightToday = false,
}) => {
  const columns = useMemo<ToolResponsiveColumn<any>[]>(
    () => [
      {
        key: "project",
        header: "Project",
        render: (job) => (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{job.title || "Untitled job"}</span>
              {job.job_type && (
                <Badge variant="outline" className="capitalize">
                  {job.job_type}
                </Badge>
              )}
              {highlightToday && isJobToday(job) && (
                <Badge className="bg-primary text-primary-foreground">Today</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              {job.client && <span>{job.client}</span>}
              {job.location?.name && <span>• {job.location.name}</span>}
            </div>
          </div>
        ),
      },
      {
        key: "schedule",
        header: "Schedule",
        render: (job) => {
          const start = job.start_time ? format(new Date(job.start_time), "dd MMM yyyy HH:mm") : "TBD";
          const end = job.end_time ? format(new Date(job.end_time), "dd MMM yyyy HH:mm") : "TBD";

          return (
            <div className="space-y-1 text-sm">
              <div>{start}</div>
              <div className="text-xs text-muted-foreground">to {end}</div>
            </div>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        render: (job) => <JobStatusBadge status={job.status} />,
      },
    ],
    [highlightToday]
  );

  if (jobsLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!jobs?.length) {
    return <p className="text-center text-sm text-muted-foreground">No jobs found</p>;
  }

  return (
    <ToolResponsiveTable
      columns={columns}
      data={jobs}
      getRowKey={(job) => job.id}
      gridColumnsMobile={1}
    />
  );
};

export default ProjectManagementJobList;
