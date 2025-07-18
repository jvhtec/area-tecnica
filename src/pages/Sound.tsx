import { useState, useEffect } from "react";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";
import CreateTourDialog from "@/components/tours/CreateTourDialog";
import { useJobs } from "@/hooks/useJobs";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { LightsHeader } from "@/components/lights/LightsHeader";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { Calculator, PieChart, FileText, Sparkles, Zap, FileStack, Tent } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ReportGenerator } from "../components/sound/ReportGenerator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PdfAnalysis } from "@/components/sound/PdfAnalysis";
import { AmplifierTool } from "@/components/sound/AmplifierTool";
import { useNavigate } from "react-router-dom";
import { MemoriaTecnica } from "@/components/sound/MemoriaTecnica";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";

const Sound = () => {
  const navigate = useNavigate();
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [isTourDialogOpen, setIsTourDialogOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showReportGenerator, setShowReportGenerator] = useState(false);
  const [showAnalysisForm, setShowAnalysisForm] = useState(false);
  const [showAmplifierTool, setShowAmplifierTool] = useState(false);
  const [showMemoriaTecnica, setShowMemoriaTecnica] = useState(false);
  const currentDepartment = "sound";
  
  const { data: jobs } = useJobs();
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
    <div className="max-w-7xl mx-auto space-y-6">
      <LightsHeader 
        onCreateJob={() => setIsJobDialogOpen(true)}
        onCreateTour={() => setIsTourDialogOpen(true)}
        department="Sound"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12">
          <CalendarSection 
            date={date} 
            onDateSelect={setDate}
            jobs={getDepartmentJobs()}
            department={currentDepartment}
            onDateTypeChange={() => {}}
          />
        </div>
        <div className="lg:col-span-12">
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

      <Card className="mt-8">
        <div className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Tools</h2>
          <Separator className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/pesos-tool')}
            >
              <Calculator className="h-6 w-6" />
              <span>Weight Calculator</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/consumos-tool')}
            >
              <PieChart className="h-6 w-6" />
              <span>Power Calculator</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setShowReportGenerator(true)}
            >
              <FileText className="h-6 w-6" />
              <span>SV Report Generator</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setShowAnalysisForm(true)}
            >
              <Sparkles className="h-6 w-6" />
              <span>AI Rider Analysis</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setShowAmplifierTool(true)}
            >
              <Zap className="h-6 w-6" />
              <span>Amplifier Calculator</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => setShowMemoriaTecnica(true)}
            >
              <FileStack className="h-6 w-6" />
              <span>Memoria Técnica</span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => navigate('/festivals')}
            >
              <Tent className="h-6 w-6" />
              <span>Festivals</span>
            </Button>
          </div>
        </div>
      </Card>

      {isJobDialogOpen && (
        <CreateJobDialog 
          open={isJobDialogOpen} 
          onOpenChange={setIsJobDialogOpen}
          currentDepartment={currentDepartment}
        />
      )}
      {isTourDialogOpen && (
        <CreateTourDialog 
          open={isTourDialogOpen} 
          onOpenChange={setIsTourDialogOpen}
          currentDepartment={currentDepartment}
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Generador de Reportes</DialogTitle>
          </DialogHeader>
          <ReportGenerator />
        </DialogContent>
      </Dialog>

      <Dialog open={showAnalysisForm} onOpenChange={setShowAnalysisForm}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Análisis de PDF</DialogTitle>
          </DialogHeader>
          <PdfAnalysis />
        </DialogContent>
      </Dialog>

      <Dialog open={showAmplifierTool} onOpenChange={setShowAmplifierTool}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Calculadora de Amplificadores</DialogTitle>
          </DialogHeader>
          <AmplifierTool />
        </DialogContent>
      </Dialog>

      <Dialog open={showMemoriaTecnica} onOpenChange={setShowMemoriaTecnica}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Memoria Técnica</DialogTitle>
          </DialogHeader>
          <MemoriaTecnica />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sound;
