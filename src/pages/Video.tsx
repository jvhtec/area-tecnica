import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { Link } from "react-router-dom";
import { Scale, Zap } from "lucide-react";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";

const Video = () => {
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [isTourDialogOpen, setIsTourDialogOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const currentDepartment = "video";
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  useTabVisibility(['jobs']);

  const { data: jobs, isLoading } = useJobs();

  useEffect(() => {
    console.log("Video page: Fetching user role");
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("Video page: No user found");
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Video page: Error fetching user role:', error);
        return;
      }

      if (data) {
        console.log("Video page: User role fetched:", data.role);
        setUserRole(data.role);
      }
    };

    fetchUserRole();
  }, []);

  const getDepartmentJobs = () => {
    if (!jobs) {
      console.log("Video page: No jobs data available");
      return [];
    }
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
    const filteredJobs = getDepartmentJobs().filter(job => {
      const jobDate = format(new Date(job.start_time), 'yyyy-MM-dd');
      return jobDate === selectedDate;
    });
    console.log("Video page: Filtered jobs for selected date:", filteredJobs.length);
    return filteredJobs;
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
        department="Video"
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
        <Link to="/video-pesos-tool">
          <Button variant="outline" className="gap-2">
            <Scale className="h-4 w-4" />
            Weight Calculator
          </Button>
        </Link>
        <Link to="/video-consumos-tool">
          <Button variant="outline" className="gap-2">
            <Zap className="h-4 w-4" />
            Power Calculator
          </Button>
        </Link>
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

export default Video;
