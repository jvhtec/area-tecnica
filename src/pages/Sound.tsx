import { useState, useEffect } from "react";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";

import { useJobs } from "@/hooks/useJobs";
import { isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { LightsHeader } from "@/components/lights/LightsHeader";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { Calculator, PieChart, FileText, Zap, FileStack, Tent, AlertTriangle, Plus, Database, Lock } from 'lucide-react';
import type { JobType } from "@/types/job";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ReportGenerator } from "../components/sound/ReportGenerator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AmplifierTool } from "@/components/sound/AmplifierTool";
import { useNavigate } from "react-router-dom";
import { MemoriaTecnica } from "@/components/sound/MemoriaTecnica";
import { IncidentReport } from "@/components/sound/tools/IncidentReport";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { SoundVisionAccessRequestDialog } from "@/components/soundvision/SoundVisionAccessRequestDialog";

const Sound = () => {
  const navigate = useNavigate();
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [presetJobType, setPresetJobType] = useState<JobType | undefined>(undefined);
  
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [showAmplifierTool, setShowAmplifierTool] = useState(false);
  const [showMemoriaTecnica, setShowMemoriaTecnica] = useState(false);
  const [showIncidentReport, setShowIncidentReport] = useState(false);
  const [showAccessRequestDialog, setShowAccessRequestDialog] = useState(false);
  // SoundVision now routes to a dedicated page
  const currentDepartment = "sound";
  
  const { data: jobs } = useJobs();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { userRole, hasSoundVisionAccess } = useOptimizedAuth();

  // Ensure legacy state not used; navigation used instead

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
      // Filter out tour jobs (but keep tourdate jobs)
      if (job.job_type === 'tour') return false;
      
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
    const selectedDate = startOfDay(date);
    return getDepartmentJobs().filter(job => {
      const jobStartDate = startOfDay(new Date(job.start_time));
      const jobEndDate = endOfDay(new Date(job.end_time));
      
      return isWithinInterval(selectedDate, {
        start: jobStartDate,
        end: jobEndDate
      });
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

    if (!window.confirm("Are you sure you want to delete this job? This action cannot be undone and will remove all related data.")) return;

    try {
      console.log("Sound page: Starting optimistic job deletion for:", jobId);
      
      // Call optimistic deletion service
      const result = await deleteJobOptimistically(jobId);
      
      if (result.success) {
        toast({
          title: "Job deleted",
          description: result.details || "The job has been removed and cleanup is running in background."
        });
        
        // Invalidate queries to refresh the list
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("Sound page: Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 w-full max-w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <LightsHeader 
          onCreateJob={(preset) => { setPresetJobType(preset); setIsJobDialogOpen(true); }}
          department="Sound"
          canCreate={userRole ? ["admin","management"].includes(userRole) : true}
        />
      </div>

      <div className="space-y-4 md:space-y-8">
        <div className="w-full">
          <CalendarSection 
            date={date} 
            onDateSelect={setDate}
            jobs={getDepartmentJobs()}
            department={currentDepartment}
            onDateTypeChange={() => {}}
          />
        </div>
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <TodaySchedule
            jobs={getSelectedDateJobs()}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            onJobClick={handleJobClick}
            userRole={userRole}
            selectedDate={date}
            detailsOnlyMode={userRole ? ["admin","management","house_tech"].includes(userRole) : false}
          />
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="mt-4 sm:mt-8">
          <div className="p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Tools</h2>
            <Separator className="mb-4 sm:mb-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              onClick={() => navigate('/pesos-tool')}
            >
              <Calculator className="h-4 w-4 sm:h-6 sm:w-6" />
              <span className="text-center leading-tight">Weight Calculator</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              onClick={() => navigate('/consumos-tool')}
            >
              <PieChart className="h-4 w-4 sm:h-6 sm:w-6" />
              <span className="text-center leading-tight">Power Calculator</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              onClick={() => setShowReportGenerator(true)}
            >
              <FileText className="h-4 w-4 sm:h-6 sm:w-6" />
              <span className="text-center leading-tight">SV Report Generator</span>
            </Button>


            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              onClick={() => setShowAmplifierTool(true)}
            >
              <Zap className="h-4 w-4 sm:h-6 sm:w-6" />
              <span className="text-center leading-tight">Amplifier Calculator</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              onClick={() => setShowMemoriaTecnica(true)}
            >
              <FileStack className="h-4 w-4 sm:h-6 sm:w-6" />
              <span className="text-center leading-tight">Memoria Técnica</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              onClick={() => setShowIncidentReport(true)}
            >
              <AlertTriangle className="h-4 w-4 sm:h-6 sm:w-6" />
              <span className="text-center leading-tight">Incident Report</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm"
              onClick={() => navigate('/festivals')}
            >
              <Tent className="h-4 w-4 sm:h-6 sm:w-6" />
              <span className="text-center leading-tight">Festivals</span>
            </Button>

            {hasSoundVisionAccess ? (
              <Button
                variant="outline"
                size="lg"
                className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                onClick={() => navigate('/soundvision-files')}
              >
                <Database className="h-4 w-4 sm:h-6 sm:w-6" />
                <span className="text-center leading-tight">Archivos SoundVision</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                className="w-full h-auto py-3 sm:py-4 flex flex-col items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                onClick={() => setShowAccessRequestDialog(true)}
              >
                <Lock className="h-4 w-4 sm:h-6 sm:w-6" />
                <span className="text-center leading-tight">Request SoundVision Access</span>
              </Button>
            )}
           </div>
         </div>
       </Card>

       {isJobDialogOpen && (
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
       )}
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
       
       <Dialog open={showReportGenerator} onOpenChange={setShowReportGenerator}>
         <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Generador de Reportes</DialogTitle>
           </DialogHeader>
           <ReportGenerator />
         </DialogContent>
       </Dialog>

       <Dialog open={showAmplifierTool} onOpenChange={setShowAmplifierTool}>
         <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Calculadora de Amplificadores</DialogTitle>
           </DialogHeader>
           <AmplifierTool />
         </DialogContent>
       </Dialog>

       <Dialog open={showMemoriaTecnica} onOpenChange={setShowMemoriaTecnica}>
         <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Memoria Técnica</DialogTitle>
           </DialogHeader>
           <MemoriaTecnica />
         </DialogContent>
       </Dialog>

        <Dialog open={showIncidentReport} onOpenChange={setShowIncidentReport}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Reporte de Incidencia</DialogTitle>
            </DialogHeader>
            <IncidentReport />
          </DialogContent>
        </Dialog>

        {/* SoundVision Access Request Dialog */}
        <SoundVisionAccessRequestDialog
          open={showAccessRequestDialog}
          onOpenChange={setShowAccessRequestDialog}
        />

        {/* SoundVision dialog removed in favor of dedicated route */}
      </div>
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

export default Sound;
