import React from "react";
import { format, isValid } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import type { Department } from "@/types/department";
import { getCalendarArtistNamesForDate } from "@/utils/calendarArtists";
import type { JobCardJob } from "@/features/jobs/job-card-new/jobCardNewTypes";

export interface JobCardNewDetailsOnlyProps {
  job: JobCardJob;
  department: Department;
  appliedBorderColor: string;
  isJobBeingDeleted: boolean;
  cardOpacity: string;
  pointerEvents: string;
  selectedDate?: Date;
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
  selectedDate,
  jobDetailsDialogOpen,
  setJobDetailsDialogOpen,
}: JobCardNewDetailsOnlyProps) {
  const jobName = job.title || job.name || job.job_name || "Trabajo sin nombre";
  const startDate = job.start_time ? format(new Date(job.start_time), "dd/MM/yyyy HH:mm") : "";
  const endDate = job.end_time ? format(new Date(job.end_time), "dd/MM/yyyy HH:mm") : "";
  const artistDate = selectedDate || (job.start_time ? new Date(job.start_time) : null);
  const artistNames = artistDate && isValid(artistDate) ? getCalendarArtistNamesForDate(job, artistDate) : [];
  const visibleArtistNames = artistNames.slice(0, 4);
  const hiddenArtistCount = artistNames.length - visibleArtistNames.length;

  let location = "Sin ubicación";
  if (typeof job.location === "string") {
    location = job.location;
  } else if (job.location && typeof job.location === "object") {
    location = job.location.name || job.location.formatted_address || "Sin ubicación";
  } else if (job.location_data) {
    location = job.location_data.name || job.location_data.formatted_address || "Sin ubicación";
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
              <span className="text-sm font-medium">Eliminando trabajo...</span>
            </div>
          </div>
        )}

        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-lg truncate" title={jobName}>
            {jobName}
          </h3>

          {visibleArtistNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Artistas programados para esta fecha">
              {visibleArtistNames.map((artistName) => (
                <Badge
                  key={artistName}
                  variant="secondary"
                  className="max-w-full truncate border border-primary/15 bg-primary/10 px-2 py-0 text-[11px] font-medium text-primary"
                  title={artistName}
                >
                  {artistName}
                </Badge>
              ))}
              {hiddenArtistCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-primary/20 px-2 py-0 text-[11px] font-medium text-primary"
                  title={artistNames.slice(visibleArtistNames.length).join(", ")}
                >
                  +{hiddenArtistCount}
                </Badge>
              )}
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <div className="flex flex-col gap-1">
              {startDate && (
                <div>
                  <span className="font-medium">Inicio:</span> {startDate}
                </div>
              )}
              {endDate && (
                <div>
                  <span className="font-medium">Fin:</span> {endDate}
                </div>
              )}
            </div>
          </div>

          <div className="text-sm">
            <span className="font-medium">Ubicación:</span>{" "}
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
            Ver detalles
          </Button>
        </div>
      </Card>

      <JobDetailsDialog job={job} open={jobDetailsDialogOpen} onOpenChange={setJobDetailsDialogOpen} department={department} />
    </div>
  );
}
