import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";

import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { addDays, endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { LightsHeader } from "@/components/lights/LightsHeader";
import { Scale, Zap, Calendar, FileText, Plus, Calculator, Lightbulb } from "lucide-react";
import type { JobType } from "@/types/job";
import { Button } from "@/components/ui/button";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { DepartmentMobileHub } from "@/components/department/DepartmentMobileHub";
import { useIsMobile } from "@/hooks/use-mobile";

const Lights = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [presetJobType, setPresetJobType] = useState<JobType | undefined>(undefined);
  
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const currentDepartment = "lights";
  const { userRole } = useAuth();

  const mobileTools = useMemo(
    () => [
      { label: "Pesos", to: "/lights-pesos-tool", icon: Scale },
      { label: "Consumos", to: "/lights-consumos-tool", icon: Calculator },
      { label: "Memoria técnica", to: "/lights-memoria-tecnica", icon: FileText },
    ],
    [],
  );
  
  const monthAnchor = date ?? new Date();
  const jobsRangeStart = subDays(startOfMonth(monthAnchor), 7);
  const jobsRangeEnd = addDays(endOfMonth(monthAnchor), 14);
  const { data: jobs, isLoading } = useOptimizedJobs(currentDepartment as any, jobsRangeStart, jobsRangeEnd);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const departmentJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs.filter((job) => {
      const isInDepartment = job.job_departments?.some(dept => 
        dept.department === currentDepartment
      );
      return isInDepartment;
    });
  }, [jobs, currentDepartment]);

  const selectedDateJobs = useMemo(() => {
    if (!date) return [];
    const selectedDate = format(date, "yyyy-MM-dd");
    return departmentJobs.filter((job) => {
      const jobDate = format(new Date(job.start_time), "yyyy-MM-dd");
      return jobDate === selectedDate;
    });
  }, [date, departmentJobs]);

  const handleDateTypeChange = useCallback(() => {}, []);

  const handleJobClick = useCallback((jobId: string) => {
    setSelectedJobId(jobId);
    setIsAssignmentDialogOpen(true);
  }, []);

  const handleEditClick = useCallback((job: any) => {
    setSelectedJob(job);
    setIsEditDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback(async (jobId: string) => {
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
          await queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });
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
  }, [queryClient, toast, userRole]);

  const handleAssignmentDialogClose = useCallback(() => {
    setIsAssignmentDialogOpen(false);
  }, []);

  const handleAssignmentChange = useCallback(() => {}, []);

  const handleEditDialogOpenChange = useCallback((open: boolean) => {
    setIsEditDialogOpen(open);
    if (!open) {
      setSelectedJob(null);
    }
  }, []);

  const handleCreateJob = useCallback((preset?: JobType) => {
    setPresetJobType(preset);
    setIsJobDialogOpen(true);
  }, []);

  const goToDisponibilidad = useCallback(() => navigate("/lights-disponibilidad"), [navigate]);
  const goToPesosTool = useCallback(() => navigate("/lights-pesos-tool"), [navigate]);
  const goToConsumosTool = useCallback(() => navigate("/lights-consumos-tool"), [navigate]);
  const goToMemoriaTecnica = useCallback(() => navigate("/lights-memoria-tecnica"), [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto w-full max-w-full space-y-6">
        {isMobile && (
          <DepartmentMobileHub
            department={currentDepartment}
            title="Departamento de iluminación"
            icon={Lightbulb}
            tools={mobileTools}
            jobs={departmentJobs}
            date={date ?? new Date()}
            onDateSelect={(nextDate) => setDate(nextDate)}
            canCreateJob={userRole ? ["admin", "management"].includes(userRole) : false}
            onCreateJob={() => handleCreateJob(undefined)}
            userRole={userRole}
            onEditJob={handleEditClick}
            onDeleteJob={handleDeleteClick}
            onJobClick={handleJobClick}
          />
        )}
        {!isMobile && (
          <>
            <LightsHeader
              onCreateJob={handleCreateJob}
              department="Luces"
              canCreate={userRole ? ["admin","management"].includes(userRole) : true}
            />

            <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm">
              <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-end">
                <Button
                  variant="outline"
                  onClick={goToDisponibilidad}
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Disponibilidad
                </Button>
                <Button
                  variant="outline"
                  onClick={goToPesosTool}
                  className="flex items-center gap-2"
                >
                  <Scale className="h-4 w-4" />
                  Calculadora de Peso
                </Button>
                <Button
                  variant="outline"
                  onClick={goToConsumosTool}
                  className="flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Calculadora de Potencia
                </Button>
                <Button
                  variant="outline"
                  onClick={goToMemoriaTecnica}
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  Memoria Técnica
                </Button>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 2xl:col-span-9">
            <div className="bg-card rounded-xl border border-border shadow-sm">
              <CalendarSection 
                date={date} 
                onDateSelect={setDate}
                jobs={departmentJobs}
                department={currentDepartment}
                onDateTypeChange={handleDateTypeChange}
              />
            </div>
          </div>
          <div className="xl:col-span-4 2xl:col-span-3 hidden md:block">
            <div className="bg-card rounded-xl border border-border shadow-sm">
              <TodaySchedule
                jobs={selectedDateJobs}
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

      {isJobDialogOpen ? (
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
      ) : null}
      

      {selectedJobId && isAssignmentDialogOpen ? (
        <JobAssignmentDialog
          isOpen={isAssignmentDialogOpen}
          onClose={handleAssignmentDialogClose}
          onAssignmentChange={handleAssignmentChange}
          jobId={selectedJobId}
          department={currentDepartment}
        />
      ) : null}

      {selectedJob && isEditDialogOpen ? (
        <EditJobDialog
          open={isEditDialogOpen}
          onOpenChange={handleEditDialogOpenChange}
          job={selectedJob}
        />
      ) : null}

      {/* Mobile FAB */}
      <Button 
        className="sm:hidden fixed bottom-6 right-6 rounded-full h-12 w-12 p-0 shadow-lg"
        onClick={() => handleCreateJob(undefined)}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Lights;
