
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobCardNew } from "./JobCardNew";
import { Skeleton } from "@/components/ui/skeleton";

interface TodayScheduleProps {
  jobs: any[];
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  userRole: string | null;
  selectedDate?: Date;
  isLoading?: boolean;
  hideTasks?: boolean;
  noWrapper?: boolean;
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
  noWrapper = false
}: TodayScheduleProps) => {
  console.log("TodaySchedule received jobs:", jobs);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (!jobs || jobs.length === 0) {
      return (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">No hay asignaciones para mostrar</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map(job => {
          console.log("Rendering job in TodaySchedule:", job);
          const jobData = job.jobs || job;
          const jobId = job.id || job.job_id || (jobData && (jobData.id || job.job_id));
          
          if (!jobId) {
            console.warn("Job is missing ID:", job);
            return null;
          }

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
    );
  };

  if (noWrapper) {
    return renderContent();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda del Dia</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {renderContent()}
      </CardContent>
    </Card>
  );
};
