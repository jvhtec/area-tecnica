import React from "react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import type { Department } from "@/types/department";

export interface JobCardNewDetailsOnlyProps {
  job: any;
  department: Department;
  appliedBorderColor: string;
  isJobBeingDeleted: boolean;
  cardOpacity: string;
  pointerEvents: string;
  jobDetailsDialogOpen: boolean;
  setJobDetailsDialogOpen: (open: boolean) => void;
}

export function JobCardNewDetailsOnly({
  job,
  department,
  appliedBorderColor,
  isJobBeingDeleted,
  cardOpacity,
  pointerEvents,
  jobDetailsDialogOpen,
  setJobDetailsDialogOpen,
}: JobCardNewDetailsOnlyProps) {
  const jobName = job.title || job.name || job.job_name || "Unnamed Job";
  const startDate = job.start_time ? format(new Date(job.start_time), "dd/MM/yyyy HH:mm") : "";
  const endDate = job.end_time ? format(new Date(job.end_time), "dd/MM/yyyy HH:mm") : "";

  let location = "No location";
  if (typeof job.location === "string") {
    location = job.location;
  } else if (job.location && typeof job.location === "object") {
    location = job.location.name || job.location.formatted_address || "No location";
  } else if (job.location_data) {
    location = job.location_data.name || job.location_data.formatted_address || "No location";
  } else if (job.venue_name) {
    location = job.venue_name;
  }

  return (
    <div className="p-2 bg-gray-50 dark:bg-gray-900">
      <Card
        className={cn("hover:shadow-md transition-all duration-200", cardOpacity, pointerEvents)}
        style={{
          borderLeftColor: appliedBorderColor,
          borderLeftWidth: "4px",
        }}
      >
        {isJobBeingDeleted && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10 rounded">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-md shadow-lg">
              <span className="text-sm font-medium">Deleting job...</span>
            </div>
          </div>
        )}

        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-lg truncate" title={jobName}>
            {jobName}
          </h3>

          <div className="text-sm text-muted-foreground">
            <div className="flex flex-col gap-1">
              {startDate && (
                <div>
                  <span className="font-medium">Start:</span> {startDate}
                </div>
              )}
              {endDate && (
                <div>
                  <span className="font-medium">End:</span> {endDate}
                </div>
              )}
            </div>
          </div>

          <div className="text-sm">
            <span className="font-medium">Location:</span>{" "}
            <span className="text-muted-foreground">{location}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              setJobDetailsDialogOpen(true);
            }}
          >
            View Details
          </Button>
        </div>
      </Card>

      <JobDetailsDialog job={job} open={jobDetailsDialogOpen} onOpenChange={setJobDetailsDialogOpen} department={department} />
    </div>
  );
}

