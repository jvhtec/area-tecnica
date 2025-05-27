import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobCardNew } from "@/components/dashboard/JobCardNew";

interface LightsScheduleProps {
  date: Date | undefined;
  jobs: any[];
  isLoading: boolean;
  onJobClick: (jobId: string) => void;
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  userRole?: string | null;
  department?: "sound" | "lights" | "video";
}

export const LightsSchedule = ({
  date,
  jobs,
  isLoading,
  onJobClick,
  onEditClick,
  onDeleteClick,
  userRole,
  department = "lights",
}: LightsScheduleProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule for {date?.toLocaleDateString()}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Cargando agenda...</p>
          ) : jobs.length > 0 ? (
            jobs.map((job) => (
              <JobCardNew
                key={job.id}
                job={job}
                onEditClick={onEditClick}
                onDeleteClick={onDeleteClick}
                onJobClick={onJobClick}
                department={department}
                userRole={userRole}
              />
            ))
          ) : (
            <p className="text-muted-foreground">
              No hay eventos programados para esta fecha
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
