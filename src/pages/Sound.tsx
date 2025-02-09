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
import { Calculator, PieChart, FileText, Sparkles } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ReportGenerator } from "../components/sound/ReportGenerator";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PdfAnalysis } from "@/components/sound/PdfAnalysis";
import { useNavigate } from "react-router-dom";

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
    if (!window.confirm("Are you sure you want to delete this job?")) return;

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: "Job deleted",
        description: "The job has been successfully deleted.",
      });
      await queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error: any) {
      toast({
        title: "Error deleting job",
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
        department="Sound"
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

      <Card className="mt-8">
        <div className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Tools</h2>
          <Separator className="mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      
      <Dialog open={showReportGenerator} onOpenChange={setShowReportGenerator}>
        <DialogContent className="max-w-4xl">
          <ReportGenerator />
        </DialogContent>
      </Dialog>

      <Dialog open={showAnalysisForm} onOpenChange={setShowAnalysisForm}>
        <DialogContent className="max-w-4xl">
          <PdfAnalysis />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sound;