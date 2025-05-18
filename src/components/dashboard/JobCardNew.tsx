
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Edit, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { Department } from "@/types/department";
import { JobDocument } from "@/types/job";

interface JobCardNewProps {
  job: any;
  onJobClick?: (jobId: string) => void;
  onEditClick?: (job: any) => void;
  onDeleteClick?: (jobId: string) => void;
  userRole?: string | null;
  className?: string;
  department?: Department;
  onDeleteDocument?: (jobId: string, document: JobDocument) => void;
  showUpload?: boolean;
  showManageArtists?: boolean;
  hideTasks?: boolean;
  isProjectManagementPage?: boolean;
}

export function JobCardNew({ 
  job, 
  onJobClick, 
  onEditClick, 
  onDeleteClick,
  userRole,
  className,
  department,
  onDeleteDocument,
  showUpload,
  showManageArtists,
  hideTasks,
  isProjectManagementPage
}: JobCardNewProps) {
  // Format date and time
  const startDate = parseISO(job.start_time);
  const formattedDate = format(startDate, "EEE, MMM d");
  const formattedTime = format(startDate, "h:mm aaa");
  
  const isEditable = userRole === "admin" || userRole === "management";
  
  // Determine if this is a tour
  const isTour = job.job_type === 'tour';
  
  // Parse assignments for display
  const soundTechs = job.job_assignments?.filter((a: any) => a.sound_role)?.map((a: any) => a.profiles?.first_name)?.join(", ") || "-";
  const lightsTechs = job.job_assignments?.filter((a: any) => a.lights_role)?.map((a: any) => a.profiles?.first_name)?.join(", ") || "-";
  const videoTechs = job.job_assignments?.filter((a: any) => a.video_role)?.map((a: any) => a.profiles?.first_name)?.join(", ") || "-";
  
  // Format job title with department indicators
  const departments = job.job_departments?.map((d: any) => d.department)?.join(", ");

  const handleJobClick = () => {
    if (onJobClick) {
      onJobClick(job.id);
    }
  };
  
  return (
    <div 
      className={cn(
        "border rounded-md p-3 transition-all hover:shadow-md cursor-pointer flex flex-col",
        onJobClick && "hover:border-primary",
        className
      )}
      onClick={handleJobClick}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium flex items-center gap-1.5">
            {job.client_name}
            {isTour && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded">
                Tour
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {departments}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium">{formattedDate}</div>
          <div className="text-xs text-muted-foreground">{formattedTime}</div>
        </div>
      </div>
      
      {job.location && (
        <div className="mt-2 text-xs text-muted-foreground">
          📍 {job.location.name}
        </div>
      )}
      
      {/* Only show assigned techs if we have any */}
      {(soundTechs !== "-" || lightsTechs !== "-" || videoTechs !== "-") && (
        <div className="grid grid-cols-3 gap-1 mt-2 text-xs">
          <div>
            <span className="text-blue-500 font-medium">Sound:</span> {soundTechs}
          </div>
          <div>
            <span className="text-yellow-500 font-medium">Lights:</span> {lightsTechs}
          </div>
          <div>
            <span className="text-green-500 font-medium">Video:</span> {videoTechs}
          </div>
        </div>
      )}
      
      {isEditable && (
        <div className="mt-3 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
          {onEditClick && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-7 px-2"
              onClick={() => onEditClick(job)}
            >
              <Edit className="h-3.5 w-3.5" />
              <span className="sr-only">Edit</span>
            </Button>
          )}
          {onDeleteClick && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDeleteClick(job.id)}
            >
              <Trash className="h-3.5 w-3.5" />
              <span className="sr-only">Delete</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
