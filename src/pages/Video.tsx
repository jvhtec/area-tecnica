
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";

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
import { Scale, Zap, File, Plus, Video as VideoIcon } from "lucide-react";
import type { JobType } from "@/types/job";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { DepartmentMobileHub } from "@/components/department/DepartmentMobileHub";
import { useIsMobile } from "@/hooks/use-mobile";

const Video = () => {
  const isMobile = useIsMobile();
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [presetJobType, setPresetJobType] = useState<JobType | undefined>(undefined);
  
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const currentDepartment = "video";

  const mobileTools = [
    { label: "Pesos", to: "/video-pesos-tool", icon: Scale },
    { label: "Consumos", to: "/video-consumos-tool", icon: Zap },
    { label: "Memoria técnica", to: "/video-memoria-tecnica", icon: File },
  ];
  
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
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto w-full max-w-full space-y-6">
        <DepartmentMobileHub
          department={currentDepartment}
          title="Departamento de vídeo"
          icon={VideoIcon}
          tools={mobileTools}
        />
        {!isMobile && (
          <>
            <LightsHeader
              onCreateJob={(preset) => { setPresetJobType(preset); setIsJobDialogOpen(true); }}
              department="Video"
              canCreate={userRole ? ["admin","management"].includes(userRole) : true}
            />

            <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm">
              <div className="flex flex-wrap gap-3 sm:gap-4 items-center justify-end">
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
                <Link to="/video-memoria-tecnica">
                  <Button variant="outline" className="gap-2">
                    <File className="h-4 w-4" />
                    Memoria Técnica
                  </Button>
                </Link>
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
                    viewMode="sidebar"
                  />
                </div>
              </div>
            </div>
          </>
        )}
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

export default Video;
