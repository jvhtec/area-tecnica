
import { Music, CalendarDays, DollarSign } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Job } from "@/types/job";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { JobExtrasDialog } from "./JobExtrasDialog";

interface JobCardProps {
  job: Job;
  onEditClick: (job: Job) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  userRole: string | null;
  department: string;
  selectedDate?: Date;
  festivalLogo?: string;
  hideFestivalControls?: boolean;
}

export const JobCard = ({ 
  job, 
  onEditClick, 
  onDeleteClick, 
  onJobClick, 
  userRole, 
  department, 
  selectedDate, 
  festivalLogo, 
  hideFestivalControls = false 
}: JobCardProps) => {
  const navigate = useNavigate();
  const [showExtrasDialog, setShowExtrasDialog] = useState(false);

  const handleFestivalManage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/festival-management/${job.id}`);
  };
  
  // Define who can access festival management
  const canManageFestival = ['admin', 'management', 'logistics', 'technician'].includes(userRole || '');
  // Define who can edit and delete jobs
  const canEditJobs = ['admin', 'management'].includes(userRole || '');

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
            {canEditJobs && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setShowExtrasDialog(true);
                }}
                className="flex items-center gap-1"
              >
                <DollarSign className="h-3 w-3" />
                Extras
              </Button>
            )}
            {job.job_type === 'festival' && canManageFestival && (
              <Button 
                variant="outline" 
                onClick={handleFestivalManage}
              >
                {userRole === 'technician' ? 'View Festival' : 'Manage Festival'}
              </Button>
            )}
            {canEditJobs && !hideFestivalControls && (
              <>
                <Button 
                  variant="outline" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onEditClick(job); 
                  }}
                >
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onDeleteClick(job.id); 
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <div className="p-4">
        {festivalLogo && (
          <div className="mb-4 h-32 flex justify-center items-center">
            <img 
              src={festivalLogo} 
              alt={`${job.title} logo`} 
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
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

      <JobExtrasDialog
        open={showExtrasDialog}
        onOpenChange={setShowExtrasDialog}
        jobId={job.id}
        jobTitle={job.title}
        isManager={canEditJobs}
      />
    </Card>
  );
};
