import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";
import CreateTourDialog from "@/components/tours/CreateTourDialog";
import { useJobs } from "@/hooks/useJobs";
import { format } from "date-fns";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { LightsHeader } from "@/components/lights/LightsHeader";
import { Scale, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";

const Lights = () => {
  const navigate = useNavigate();
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [isTourDialogOpen, setIsTourDialogOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const currentDepartment = "lights";
  
  const { data: jobs, isLoading } = useJobs();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        return;
      }

      if (data) {
        setUserRole(data.role);
      }
    };

    fetchUserRole();
  }, []);

  const getDepartmentJobs = () => {
    if (!jobs) return [];
    return jobs.filter(job => {
      const isInDepartment = job.job_departments?.some(dept => 
        dept.department === currentDepartment
      );
      if (job.tour_date_id) {
        return isInDepartment && job.tour_date;
      }
      return isInDepartment;
    });
  };

  const getSelectedDateJobs = () => {
    if (!date || !jobs) return [];
    const selectedDate = format(date, 'yyyy-MM-dd');
    return getDepartmentJobs().filter(job => {
      const jobDate = format(new Date(job.start_time), 'yyyy-MM-dd');
      return jobDate === selectedDate;
    });
  };

  const handleJobClick = (jobId: string) => {
    setSelectedJobId(jobId);
    setIsAssignmentDialogOpen(true);
  };

  const handleEditClick = (job: any) => {
    setSelectedJob(job);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = async (jobId: string) => {
    if (!window.confirm("¿Está seguro de que desea eliminar este trabajo?")) return;

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: "Trabajo eliminado",
        description: "El trabajo se ha eliminado con éxito.",
      });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error: any) {
      toast({
        title: "Error al eliminar el trabajo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <LightsHeader 
        onCreateJob={() => setIsJobDialogOpen(true)}
        onCreateTour={() => setIsTourDialogOpen(true)}
        department="Luces"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <CalendarSection 
            date={date} 
            onDateSelect={setDate}
            jobs={getDepartmentJobs()}
            department={currentDepartment}
          />
        </div>
        <div className="lg:col-span-4">
          <TodaySchedule
            jobs={getSelectedDateJobs()}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            onJobClick={handleJobClick}
            userRole={userRole}
            selectedDate={date}
          />
        </div>
      </div>

      <div className="flex gap-4 justify-end mt-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/lights-pesos-tool')}
          className="flex items-center gap-2"
        >
          <Scale className="h-4 w-4" />
          Calculadora de Peso
        </Button>
        <Button 
          variant="outline" 
          onClick={() => navigate('/lights-consumos-tool')}
          className="flex items-center gap-2"
        >
          <Zap className="h-4 w-4" />
          Calculadora de Potencia
        </Button>
      </div>

      <CreateJobDialog
        open={isJobDialogOpen}
        onOpenChange={setIsJobDialogOpen}
        currentDepartment={currentDepartment}
      />
      
      <CreateTourDialog
        open={isTourDialogOpen}
        onOpenChange={setIsTourDialogOpen}
        currentDepartment={currentDepartment}
      />

      {selectedJobId && (
        <JobAssignmentDialog
          open={isAssignmentDialogOpen}
          onOpenChange={setIsAssignmentDialogOpen}
          jobId={selectedJobId}
          department={currentDepartment}
        />
      )}

      {selectedJob && (
        <EditJobDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          job={selectedJob}
        />
      )}
    </div>
  );
};

export default Lights;
