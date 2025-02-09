import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JobCardNew } from "./JobCardNew";

interface TodayScheduleProps {
  jobs: any[];
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  userRole: string | null;
  selectedDate?: Date;
}

export const TodaySchedule = ({
  jobs,
  onEditClick,
  onDeleteClick,
  onJobClick,
  userRole,
  selectedDate,
}: TodayScheduleProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda del Dia </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          {jobs.map(job => (
            <JobCardNew
              key={job.id}
              job={job}
              onEditClick={onEditClick}
              onDeleteClick={onDeleteClick}
              onJobClick={onJobClick}
              userRole={userRole}
              department="sound"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
