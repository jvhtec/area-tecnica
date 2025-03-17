
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw } from "lucide-react";

interface AssignmentsListProps {
  assignments: any[];
  loading: boolean;
  onRefresh: () => void;
}

export const AssignmentsList = ({ 
  assignments = [], 
  loading = false,
  onRefresh 
}: AssignmentsListProps) => {
  console.log("AssignmentsList rendered with:", { assignments, loading });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <RefreshCw className="h-12 w-12 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Cargando asignaciones...</p>
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <p className="text-muted-foreground">No se encontraron asignaciones.</p>
        <Button onClick={onRefresh} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refrescar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {assignments.map((assignment) => {
        // Handle both regular and festival assignments
        const jobData = assignment.jobs || assignment.festival_jobs;
        
        if (!jobData) {
          console.warn("Missing job data for assignment:", assignment);
          return null;
        }
        
        // Format date and time
        let formattedDate = "Fecha desconocida";
        try {
          if (jobData.start_time) {
            formattedDate = format(new Date(jobData.start_time), "PPP", { locale: es });
          } else if (jobData.day && jobData.festival?.start_date) {
            // For festival jobs, calculate the date based on the festival start date and day number
            const festivalStart = new Date(jobData.festival.start_date);
            const eventDate = new Date(festivalStart);
            eventDate.setDate(festivalStart.getDate() + (parseInt(jobData.day) - 1));
            formattedDate = format(eventDate, "PPP", { locale: es });
          }
        } catch (error) {
          console.error("Error formatting date:", error, jobData);
        }
        
        // Determine job type
        const isFestivalJob = !!assignment.festival_jobs;
        
        // Get location
        const location = isFestivalJob 
          ? `${jobData.festival?.name || 'Festival'} - ${jobData.festival_stage?.name || 'Escenario'}`
          : jobData.location?.name || 'Sin ubicación';
        
        // Get role
        let role = "Técnico";
        if (isFestivalJob) {
          role = assignment.role || "Técnico";
        } else {
          if (assignment.sound_role) role = assignment.sound_role;
          else if (assignment.lights_role) role = assignment.lights_role;
          else if (assignment.video_role) role = assignment.video_role;
        }
        
        // Determine card background color based on job color or department
        let bgColor = "bg-card";
        if (jobData.color) {
          bgColor = `bg-[${jobData.color}] bg-opacity-10`;
        }
        
        return (
          <div 
            key={assignment.id} 
            className={`border rounded-lg p-4 ${bgColor} hover:bg-secondary/10 transition-colors`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{jobData.title || "Sin título"}</h3>
                <p className="text-sm text-muted-foreground">{location}</p>
                <p className="text-sm text-muted-foreground">{formattedDate}</p>
                {jobData.start_time && jobData.end_time && (
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(jobData.start_time), "HH:mm")} - {format(new Date(jobData.end_time), "HH:mm")}
                  </p>
                )}
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {role}
                  </span>
                </div>
              </div>
              
              {jobData.job_documents && jobData.job_documents.length > 0 && (
                <div className="flex flex-col items-end">
                  <span className="text-xs text-muted-foreground">
                    {jobData.job_documents.length} documento{jobData.job_documents.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
