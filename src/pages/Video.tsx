
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";

import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { addDays, endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
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
  const currentDepartment = "video";
  const { userRole } = useOptimizedAuth();

  const mobileTools = useMemo(
    () => [
      { label: "Pesos", to: "/video-pesos-tool", icon: Scale },
      { label: "Consumos", to: "/video-consumos-tool", icon: Zap },
      { label: "Memoria técnica", to: "/video-memoria-tecnica", icon: File },
    ],
    [],
  );
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  useTabVisibility(['optimized-jobs']);

  const monthAnchor = date ?? new Date();
  const jobsRangeStart = subDays(startOfMonth(monthAnchor), 7);
  const jobsRangeEnd = addDays(endOfMonth(monthAnchor), 14);
  const { data: jobs, isLoading } = useOptimizedJobs(currentDepartment as any, jobsRangeStart, jobsRangeEnd);

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
      await queryClient.invalidateQueries({ queryKey: ['optimized-jobs'] });
    } catch (error: any) {
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [queryClient, toast]);

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

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto w-full max-w-full space-y-6">
        {isMobile && (
          <DepartmentMobileHub
            department={currentDepartment}
            title="Departamento de vídeo"
            icon={VideoIcon}
            tools={mobileTools}
            jobs={departmentJobs}
            date={date ?? new Date()}
            onDateSelect={(nextDate) => setDate(nextDate)}
          />
        )}
        {!isMobile && (
          <>
            <LightsHeader
              onCreateJob={handleCreateJob}
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

export default Video;
