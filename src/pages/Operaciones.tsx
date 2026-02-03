import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";

import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { addDays, endOfMonth, format, startOfMonth, subDays } from "date-fns";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { LightsHeader } from "@/components/lights/LightsHeader";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { Link } from "react-router-dom";
import { Scale, Zap, File, Plus } from "lucide-react";
import type { JobType } from "@/types/job";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";

const Operaciones = () => {
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [presetJobType, setPresetJobType] = useState<JobType | undefined>(undefined);

  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const currentDepartment = "video";
  const { userRole } = useAuth();

  const queryClient = useQueryClient();
  const { toast } = useToast();

  useTabVisibility(['optimized-jobs']);
  const monthAnchor = date ?? new Date();
  const jobsRangeStart = subDays(startOfMonth(monthAnchor), 7);
  const jobsRangeEnd = addDays(endOfMonth(monthAnchor), 14);
  const { data: jobs = [], isLoading } = useOptimizedJobs(currentDepartment as any, jobsRangeStart, jobsRangeEnd);

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
    return jobs.filter((job) =>
      job.job_departments?.some((dept: any) => dept.department === currentDepartment)
    );
  }, [jobs, currentDepartment]);

  const selectedDateJobs = useMemo(() => {
    if (!date) return [];
    const selectedDate = format(date, 'yyyy-MM-dd');
    return departmentJobs.filter((job) => {
      const jobDate = format(new Date(job.start_time), 'yyyy-MM-dd');
      return jobDate === selectedDate;
    });
  }, [date, departmentJobs]);

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

    if (!window.confirm("Are you sure you want to delete this job?")) return;

    try {
      console.log("Operaciones page: Starting optimistic job deletion for:", jobId);

      // Call optimistic deletion service
      const result = await deleteJobOptimistically(jobId);

      if (result.success) {
        toast({
          title: "Job deleted",
          description: result.details || "The job has been removed and cleanup completed"
        });

        // Invalidate queries to refresh the list
        await queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("Operaciones page: Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [queryClient, toast, userRole]);

  const handleCreateJob = useCallback((preset?: JobType) => {
    setPresetJobType(preset);
    setIsJobDialogOpen(true);
  }, []);

  const handleDateTypeChange = useCallback(() => { }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <LightsHeader
        onCreateJob={handleCreateJob}
        department="Video"
        canCreate={userRole ? ["admin", "management"].includes(userRole) : true}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <Card>
            <CardContent className="p-0">
              <CalendarSection
                date={date}
                onDateSelect={setDate}
                jobs={departmentJobs}
                department={currentDepartment}
                onDateTypeChange={handleDateTypeChange}
              />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-4 hidden md:block">
          <TodaySchedule
            jobs={selectedDateJobs}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            onJobClick={handleJobClick}
            userRole={userRole}
            selectedDate={date}
            isLoading={isLoading}
          />
        </div>
      </div>

      <div className="flex gap-4 justify-end mt-4">
        <Link to="/hoja-de-ruta">
          <Button variant="outline" className="gap-2">
            <Scale className="h-4 w-4" />
            Hojas de Ruta
          </Button>
        </Link>
        <Link to="/video-consumos-tool">
          <Button variant="outline" className="gap-2">
            <Zap className="h-4 w-4" />
            Power Calculator
          </Button>
        </Link>
        <Link to="/memoria-tecnica-total">
          <Button variant="outline" className="gap-2">
            <File className="h-4 w-4" />
            Memoria Técnica
          </Button>
        </Link>
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


      {selectedJob && isEditDialogOpen ? (
        <EditJobDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          job={selectedJob}
        />
      ) : null}
      {selectedJobId && isAssignmentDialogOpen ? (
        <JobAssignmentDialog
          isOpen={isAssignmentDialogOpen}
          onClose={() => setIsAssignmentDialogOpen(false)}
          onAssignmentChange={() => { }}
          jobId={selectedJobId}
          department={currentDepartment}
        />
      ) : null}

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

export default Operaciones;
