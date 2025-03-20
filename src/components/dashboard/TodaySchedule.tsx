
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobCardNew } from "./JobCardNew";

interface TodayScheduleProps {
  jobs: any[];
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  userRole: string | null;
  selectedDate?: Date;
  isLoading?: boolean;
  hideTasks?: boolean;
}

export const TodaySchedule = ({
  jobs,
  onEditClick,
  onDeleteClick,
  onJobClick,
  userRole,
  selectedDate,
  isLoading = false,
  hideTasks = false
}: TodayScheduleProps) => {
  console.log("TodaySchedule received jobs:", jobs);

  if (isLoading) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda del Dia</CardTitle>
      </CardHeader>
      <CardContent className="p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map(job => {
            console.log("Rendering job in TodaySchedule:", job);
            const jobData = job.jobs || job;
            const jobId = job.id || job.job_id || (jobData && (jobData.id || job.job_id));
            
            if (!jobId) {
              console.warn("Job is missing ID:", job);
              return null;
            }

            // Check if this is a festival job
            let isFestivalJob = false;
            
            if (typeof jobData === 'object') {
              if ('job_type' in jobData) {
                isFestivalJob = jobData.job_type === 'festival';
              }
            }
            
            console.log("Is festival job check for:", { 
              jobId,
              isFestivalJob, 
              jobType: jobData?.job_type
            });
            
            return (
              <JobCardNew 
                key={jobId} 
                job={jobData} 
                onEditClick={onEditClick} 
                onDeleteClick={onDeleteClick} 
                onJobClick={onJobClick} 
                userRole={userRole} 
                department={job.department || jobData.department || "sound"} 
                hideTasks={hideTasks}
                showManageArtists={isFestivalJob}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
