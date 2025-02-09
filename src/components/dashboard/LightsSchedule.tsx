import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { JobCard } from "@/components/jobs/JobCard";

interface LightsScheduleProps {
  date: Date | undefined;
  jobs: any[];
  isLoading: boolean;
  onJobClick: (jobId: string) => void;
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  userRole?: string | null;
}

export const LightsSchedule = ({
  date,
  jobs,
  isLoading,
  onJobClick,
  onEditClick,
  onDeleteClick,
  userRole,
}: LightsScheduleProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule for {date?.toLocaleDateString()}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Loading schedule...</p>
          ) : jobs.length > 0 ? (
            jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onEditClick={onEditClick}
                onDeleteClick={onDeleteClick}
                onJobClick={onJobClick}
                department="lights"
                userRole={userRole}
              />
            ))
          ) : (
            <p className="text-muted-foreground">
              No events scheduled for this date
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};