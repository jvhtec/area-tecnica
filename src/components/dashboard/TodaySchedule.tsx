import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobCardNew } from "@/components/jobs/cards/JobCardNew";
import { isFestivalLikeJobType } from "@/utils/jobType";

interface TodayScheduleProps {
  jobs: any[];
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  userRole: string | null;
  selectedDate?: Date;
  isLoading?: boolean;
  hideTasks?: boolean;
  detailsOnlyMode?: boolean;
  department?: string;
  viewMode?: "grid" | "sidebar";
}

export const TodaySchedule = ({
  jobs,
  onEditClick,
  onDeleteClick,
  onJobClick,
  userRole,
  selectedDate,
  isLoading = false,
  hideTasks = false,
  detailsOnlyMode = false,
  department,
  viewMode = "grid"
}: TodayScheduleProps) => {
  if (import.meta.env.DEV) {
    console.log("TodaySchedule received jobs:", jobs);
  }

  if (isLoading) {
    if (viewMode === "sidebar") {
      return (
        <div className="flex items-center justify-center p-8 text-slate-500">
          <p className="text-sm">Cargando asignaciones...</p>
        </div>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agenda del Dia</CardTitle>
        </CardHeader>
        <CardContent className="p-1">
          <div className="flex items-center justify-center p-4">
            <p className="text-muted-foreground">Cargando asignaciones...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!jobs || jobs.length === 0) {
    if (viewMode === "sidebar") {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-slate-500 gap-2">
          <p className="text-sm">No hay asignaciones para hoy</p>
        </div>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agenda del Dia</CardTitle>
        </CardHeader>
        <CardContent className="p-1">
          <div className="flex items-center justify-center p-4">
            <p className="text-muted-foreground">No hay asignaciones para mostrar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (viewMode === "sidebar") {
    return (
      <div className="flex flex-col gap-3">
        {jobs.map(job => {
          const jobData = job.jobs || job;
          const jobId = job.id || job.job_id || (jobData && (jobData.id || job.job_id));

          if (!jobId) return null;

          let isFestivalJob = false;
          if (typeof jobData === 'object' && 'job_type' in jobData) {
            isFestivalJob = isFestivalLikeJobType(jobData.job_type);
          }

          return (
            <JobCardNew
              key={jobId}
              job={jobData}
              onEditClick={onEditClick}
              onDeleteClick={onDeleteClick}
              onJobClick={onJobClick}
              userRole={userRole}
              department={department || job.department || jobData.department || "sound"}
              hideTasks={hideTasks}
              showManageArtists={isFestivalJob}
              detailsOnlyMode={detailsOnlyMode}
            />
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda del Dia</CardTitle>
      </CardHeader>
      <CardContent className="p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map(job => {
            if (import.meta.env.DEV) {
              console.log("Rendering job in TodaySchedule:", job);
            }
            const jobData = job.jobs || job;
            const jobId = job.id || job.job_id || (jobData && (jobData.id || job.job_id));

            if (!jobId) {
              if (import.meta.env.DEV) {
                console.warn("Job is missing ID:", job);
              }
              return null;
            }

            // Check if this is a festival job
            let isFestivalJob = false;

            if (typeof jobData === 'object') {
              if ('job_type' in jobData) {
                isFestivalJob = isFestivalLikeJobType(jobData.job_type);
              }
            }

            if (import.meta.env.DEV) {
              console.log("Is festival job check for:", {
                jobId,
                isFestivalJob,
                jobType: jobData?.job_type
              });
            }

            return (
              <JobCardNew
                key={jobId}
                job={jobData}
                onEditClick={onEditClick}
                onDeleteClick={onDeleteClick}
                onJobClick={onJobClick}
                userRole={userRole}
                department={department || job.department || jobData.department || "sound"}
                hideTasks={hideTasks}
                showManageArtists={isFestivalJob}
                detailsOnlyMode={detailsOnlyMode}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
