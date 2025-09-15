
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RefreshCw, Clock, Eye, Download, FileText } from "lucide-react";
import { TechnicianIncidentReportDialog } from "@/components/incident-reports/TechnicianIncidentReportDialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AssignmentsListProps {
  assignments: any[];
  loading: boolean;
  onRefresh: () => void;
  techName?: string;
}

export const AssignmentsList = ({ 
  assignments = [], 
  loading = false,
  onRefresh,
  techName = ''
}: AssignmentsListProps) => {
  console.log("AssignmentsList rendered with:", { assignments, loading });
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleViewDocument = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('job-documents')
        .createSignedUrl(doc.file_path, 3600); // 1 hour expiry

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error("Error in handleViewDocument:", err);
      toast({
        title: "Error",
        description: "No se pudo abrir el documento.",
        variant: "destructive"
      });
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('job-documents')
        .createSignedUrl(doc.file_path, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = doc.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Error downloading document:", err);
      toast({
        title: "Error",
        description: "No se pudo descargar el documento.",
        variant: "destructive"
      });
    }
  };

  const handleTimesheetClick = (jobId: string) => {
    navigate(`/timesheets?jobId=${jobId}`);
  };

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
              <div className="flex-1">
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
              
              <div className="flex flex-col items-end gap-2">
                {/* Timesheet Button */}
                {jobData.job_type !== "dryhire" && (
                  <Button
                    onClick={() => handleTimesheetClick(jobData.id)}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Clock className="h-3 w-3" />
                    Tiempos
                  </Button>
                )}
                
                {/* Documents */}
                {jobData.job_documents && jobData.job_documents.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground text-right">
                      {jobData.job_documents.length} documento{jobData.job_documents.length !== 1 ? 's' : ''}
                    </span>
                    <div className="flex gap-1">
                      {jobData.job_documents.slice(0, 2).map((doc: any) => (
                        <div key={doc.id} className="flex gap-1">
                          <Button
                            onClick={() => handleViewDocument(doc)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title={`Ver ${doc.file_name}`}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            onClick={() => handleDownload(doc)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title={`Descargar ${doc.file_name}`}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {jobData.job_documents.length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{jobData.job_documents.length - 2} más
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Incident Report */}
                {jobData.job_type !== "dryhire" && (
                  <TechnicianIncidentReportDialog 
                    job={jobData} 
                    techName={techName}
                    className="h-8 w-8"
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
