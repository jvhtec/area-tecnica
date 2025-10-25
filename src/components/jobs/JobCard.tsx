
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-2">
          <CardTitle className="text-base md:text-lg font-semibold flex items-center gap-2">
            <span className="break-words">{job.title}</span>
            {job.job_type === 'festival' && (
              <Music className="inline-block h-4 w-4 text-primary flex-shrink-0" />
            )}
          </CardTitle>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
            {canEditJobs && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setShowExtrasDialog(true);
                }}
                className="flex items-center gap-1 h-8 md:h-9"
              >
                <DollarSign className="h-3 w-3" />
                <span className="hidden sm:inline">Extras</span>
              </Button>
            )}
            {job.job_type === 'festival' && canManageFestival && (
              <Button 
                variant="outline"
                size="sm"
                onClick={handleFestivalManage}
                className="h-8 md:h-9 text-xs md:text-sm"
              >
                <span className="hidden sm:inline">{userRole === 'technician' ? 'View Festival' : 'Manage Festival'}</span>
                <span className="sm:hidden">{userRole === 'technician' ? 'View' : 'Manage'}</span>
              </Button>
            )}
            {canEditJobs && !hideFestivalControls && (
              <>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onEditClick(job); 
                  }}
                  className="h-8 md:h-9"
                >
                  Edit
                </Button>
                <Button 
                  variant="destructive"
                  size="sm"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onDeleteClick(job.id); 
                  }}
                  className="h-8 md:h-9"
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <div className="p-3 md:p-4">
        {festivalLogo && (
          <div className="mb-4 h-24 md:h-32 flex justify-center items-center">
            <img 
              src={festivalLogo} 
              alt={`${job.title} logo`} 
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
        <p className="text-xs md:text-sm text-muted-foreground line-clamp-3 md:line-clamp-none break-words">
          {job.description}
        </p>
        <div className="mt-2 flex items-start md:items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 md:mt-0" />
          <span className="text-xs md:text-sm text-muted-foreground break-words">
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
