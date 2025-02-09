import { Music, CalendarDays } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Job } from "@/types/job";
import { cn } from "@/lib/utils";

interface JobCardProps {
  job: Job;
  onEditClick: (job: Job) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  userRole: string | null;
  department: string;
  selectedDate?: Date;
}

export const JobCard = ({ job, onEditClick, onDeleteClick, onJobClick, userRole, department, selectedDate }: JobCardProps) => {
  return (
    <Card 
      className={cn(
        "relative transition-all hover:shadow-lg cursor-pointer",
        job.color && `border-l-4 border-l-[${job.color}]`
      )}
      onClick={() => onJobClick(job.id)}
    >
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {job.title}
            {job.job_type === 'festival' && (
              <Music className="inline-block ml-2 h-4 w-4 text-primary" />
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={(e) => { e.stopPropagation(); onEditClick(job); }}>
              Edit
            </Button>
            <Button variant="destructive" onClick={(e) => { e.stopPropagation(); onDeleteClick(job.id); }}>
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          {job.description}
        </p>
        <div className="mt-2 flex items-center">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            {new Date(job.start_time).toLocaleDateString()} - {new Date(job.end_time).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Card>
  );
};