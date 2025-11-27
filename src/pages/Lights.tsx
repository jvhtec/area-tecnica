import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";

import { useJobs } from "@/hooks/useJobs";
import { format } from "date-fns";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { LightsHeader } from "@/components/lights/LightsHeader";
import { Scale, Zap, Calendar, FileText, Plus, Calculator, Lightbulb } from "lucide-react";
import type { JobType } from "@/types/job";
import { Button } from "@/components/ui/button";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { DepartmentMobileHub } from "@/components/department/DepartmentMobileHub";

const Lights = () => {
  const navigate = useNavigate();
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [presetJobType, setPresetJobType] = useState<JobType | undefined>(undefined);
  
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const currentDepartment = "lights";

  const mobileTools = [
    { label: "Pesos", to: "/lights-pesos-tool", icon: Scale },
    { label: "Consumos", to: "/lights-consumos-tool", icon: Calculator },
    { label: "Memoria técnica", to: "/lights-memoria-tecnica", icon: FileText },
  ];
  
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

  // Keyboard shortcut: Cmd/Ctrl+N to open (disable plain 'c')
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isTyping = !!activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable
      );
      if (isTyping) return;

      const metaN = (e.key.toLowerCase() === 'n') && (e.metaKey || e.ctrlKey);
      if (metaN) {
        e.preventDefault();
        setPresetJobType(undefined);
        setIsJobDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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
    // Check permissions
    if (!["admin", "management"].includes(userRole || "")) {
      toast({
        title: "Permission denied",
        description: "Only admin and management users can delete jobs",
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm("¿Está seguro de que desea eliminar este trabajo?")) return;

    try {
      console.log("Lights page: Starting optimistic job deletion for:", jobId);
      
      // Call optimistic deletion service
      const result = await deleteJobOptimistically(jobId);
      
      if (result.success) {
        toast({
          title: "Trabajo eliminado",
          description: result.details || "El trabajo se ha eliminado con éxito."
        });
        
        // Invalidate queries to refresh the list
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("Lights page: Error in optimistic job deletion:", error);
      toast({
        title: "Error al eliminar el trabajo",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto w-full max-w-full space-y-6">
        <DepartmentMobileHub
          department={currentDepartment}
          title="Departamento de iluminación"
          icon={Lightbulb}
          tools={mobileTools}
        />
        <LightsHeader
          onCreateJob={(preset) => { setPresetJobType(preset); setIsJobDialogOpen(true); }}
          department="Luces"
          canCreate={userRole ? ["admin","management"].includes(userRole) : true}
        />

        <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm">
          <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-end">
            <Button
              variant="outline"
              onClick={() => navigate('/lights-disponibilidad')}
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Disponibilidad
            </Button>
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
            <Button
              variant="outline"
              onClick={() => navigate('/lights-memoria-tecnica')}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Memoria Técnica
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 2xl:col-span-9">
            <div className="bg-card rounded-xl border border-border shadow-sm">
              <CalendarSection 
                date={date} 
                onDateSelect={setDate}
                jobs={getDepartmentJobs()}
                department={currentDepartment}
                onDateTypeChange={() => {}} // Add empty handler as it's required
              />
            </div>
          </div>
          <div className="xl:col-span-4 2xl:col-span-3 hidden md:block">
            <div className="bg-card rounded-xl border border-border shadow-sm">
              <TodaySchedule
                jobs={getSelectedDateJobs()}
                onEditClick={handleEditClick}
                onDeleteClick={handleDeleteClick}
                onJobClick={handleJobClick}
                userRole={userRole}
                selectedDate={date}
                detailsOnlyMode
                department={currentDepartment}
                viewMode="sidebar"
              />
            </div>
          </div>
        </div>
      </div>

      <CreateJobDialog
        open={isJobDialogOpen}
        onOpenChange={setIsJobDialogOpen}
        currentDepartment={currentDepartment}
        initialDate={date}
        initialJobType={presetJobType}
        onCreated={(job) => {
          setSelectedJobId(job.id);
          setIsAssignmentDialogOpen(true);
        }}
      />
      

      {selectedJobId && (
        <JobAssignmentDialog
          isOpen={isAssignmentDialogOpen}
          onClose={() => setIsAssignmentDialogOpen(false)}
          onAssignmentChange={() => {}}
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

      {/* Mobile FAB */}
      <Button 
        className="sm:hidden fixed bottom-6 right-6 rounded-full h-12 w-12 p-0 shadow-lg"
        onClick={() => { setPresetJobType(undefined); setIsJobDialogOpen(true); }}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Lights;
