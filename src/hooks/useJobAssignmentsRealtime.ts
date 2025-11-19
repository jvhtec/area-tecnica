
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Assignment } from "@/types/assignment";
import { toast } from "sonner";
import { useRealtimeQuery } from "./useRealtimeQuery";
import { useFlexCrewAssignments } from "@/hooks/useFlexCrewAssignments";
import { aggregateTimesheetsForJob, TimesheetRowWithTechnician } from "@/utils/timesheetAssignments";
import { removeTimesheetAssignment } from "@/services/removeTimesheetAssignment";

export interface AssignmentInsertOptions {
  singleDay?: boolean;
  singleDayDate?: string | null;
}

export const buildAssignmentInsertPayload = (
  jobId: string,
  technicianId: string,
  soundRole: string,
  lightsRole: string,
  assignedBy: string | null,
  options?: AssignmentInsertOptions
) => {
  const normalizedSound = soundRole !== "none" ? soundRole : null;
  const normalizedLights = lightsRole !== "none" ? lightsRole : null;
  const shouldFlagSingleDay = !!options?.singleDay && !!options?.singleDayDate;

  return {
    job_id: jobId,
    technician_id: technicianId,
    sound_role: normalizedSound,
    lights_role: normalizedLights,
    assigned_by: assignedBy,
    assigned_at: new Date().toISOString(),
    single_day: shouldFlagSingleDay,
    // Standardized: use only assignment_date
    assignment_date: shouldFlagSingleDay ? options?.singleDayDate ?? null : null,
  };
};

export const useJobAssignmentsRealtime = (jobId: string) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  
  // Use our enhanced real-time query hook for better reliability
  const { 
    data: assignments = [], 
    isLoading, 
    manualRefresh,
    isRefreshing: isQueryRefreshing
  } = useRealtimeQuery<Assignment[]>(
    ["job-assignments", jobId],
    async () => {
      console.log("Fetching per-day assignments for job:", jobId);

      const fetchWithRetry = async (retries = 3): Promise<Assignment[]> => {
        try {
          const { data: timesheetRows, error: timesheetError } = await supabase
            .from('timesheets')
            .select(`
              job_id,
              technician_id,
              date,
              is_schedule_only,
              technician:profiles!fk_timesheets_technician_id (
                id,
                first_name,
                last_name,
                nickname,
                email,
                department
              )
            `)
            .eq('job_id', jobId)
            .eq('is_schedule_only', false)
            .order('date', { ascending: true });

          if (timesheetError) {
            console.error('Error fetching job timesheets:', timesheetError);
            throw timesheetError;
          }

          const { data: assignmentRows, error: assignmentError } = await supabase
            .from('job_assignments')
            .select(`
              id,
              job_id,
              technician_id,
              sound_role,
              lights_role,
              video_role,
              single_day,
              assignment_date,
              assignment_source,
              external_technician_name,
              profiles!job_assignments_technician_id_fkey (
                id,
                first_name,
                last_name,
                nickname,
                email,
                department
              )
            `)
            .eq('job_id', jobId);

          if (assignmentError) {
            console.error('Error fetching parent assignments:', assignmentError);
            throw assignmentError;
          }

          const aggregated = aggregateTimesheetsForJob(
            jobId,
            (timesheetRows || []) as TimesheetRowWithTechnician[],
            assignmentRows || []
          );

          return aggregated as Assignment[];
        } catch (error) {
          if (retries > 0) {
            console.log(`Retrying assignments fetch... ${retries} attempts remaining`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return fetchWithRetry(retries - 1);
          }
          throw error;
        }
      };

      return fetchWithRetry();
    },
    "timesheets",
    {
      staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: false, // Rely on real-time updates instead of polling
    }
  );

  // Additional real-time subscription specifically for this job
  useEffect(() => {
    if (!jobId) return;

    console.log(`Setting up job-specific assignment subscription for job ${jobId}`);

    const channel = supabase
      .channel(`assignments-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'timesheets',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          console.log(`Timesheet change detected for job ${jobId}:`, payload);
          manualRefresh();
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          console.log(`Assignment metadata change detected for job ${jobId}:`, payload);
          manualRefresh();
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
        }
      )
      .subscribe();

    return () => {
      console.log(`Cleaning up job assignment subscription for job ${jobId}`);
      supabase.removeChannel(channel);
    };
  }, [jobId, manualRefresh, queryClient]);

  const { manageFlexCrewAssignment } = useFlexCrewAssignments();

  const addAssignment = async (
    technicianId: string,
    soundRole: string,
    lightsRole: string,
    options?: AssignmentInsertOptions
  ) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const assignedBy = authData?.user?.id ?? null;
      const payload = buildAssignmentInsertPayload(
        jobId,
        technicianId,
        soundRole,
        lightsRole,
        assignedBy,
        options
      );

      // Optimistic cache update for 'jobs' list so cards update instantly
      queryClient.setQueryData(['jobs'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((j) => {
          if (j.id !== jobId) return j;
          const optimist = {
            job_id: jobId,
            technician_id: technicianId,
            sound_role: payload.sound_role,
            lights_role: payload.lights_role,
            single_day: payload.single_day,
            assignment_date: payload.assignment_date ?? null,
            assigned_at: payload.assigned_at,
            assigned_by: payload.assigned_by,
            profiles: { first_name: '', last_name: '' },
          };
          const current = Array.isArray(j.job_assignments) ? j.job_assignments : [];
          return { ...j, job_assignments: [...current, optimist] };
        });
      });

      const { error } = await supabase
        .from('job_assignments')
        .insert(payload);

      if (error) {
        console.error('Error adding assignment:', error);
        toast.error("Failed to add assignment");
        return;
      }

      // Add to Flex crew calls if applicable
      if (soundRole && soundRole !== 'none') {
        await manageFlexCrewAssignment(jobId, technicianId, 'sound', 'add');
      }
      
      if (lightsRole && lightsRole !== 'none') {
        await manageFlexCrewAssignment(jobId, technicianId, 'lights', 'add');
      }

      toast.success("Assignment added successfully");
      // Invalidate jobs so JobCard lists refresh assignments relation
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error: any) {
      console.error('Error in addAssignment:', error);
      toast.error("Failed to add assignment");
    }
  };

  const removeAssignment = async (technicianId: string) => {
    try {
      setIsRemoving(prev => ({ ...prev, [technicianId]: true }));

      // Optimistic cache update for 'jobs'
      queryClient.setQueryData(['jobs'], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((j) => {
          if (j.id !== jobId) return j;
          const current = Array.isArray(j.job_assignments) ? j.job_assignments : [];
          const currentTimesheets = Array.isArray(j.timesheet_assignments) ? j.timesheet_assignments : [];
          return {
            ...j,
            job_assignments: current.filter((a: any) => a.technician_id !== technicianId),
            timesheet_assignments: currentTimesheets.filter((a: any) => a.technician_id !== technicianId),
          };
        });
      });

      // Get the assignment details before removal for Flex cleanup
      const assignmentToRemove = assignments.find(a => a.technician_id === technicianId);

      await removeTimesheetAssignment(jobId, technicianId);

      // Remove from Flex crew calls if applicable
      if (assignmentToRemove) {
        if (assignmentToRemove.sound_role && assignmentToRemove.sound_role !== 'none') {
          await manageFlexCrewAssignment(jobId, technicianId, 'sound', 'remove');
        }
        
        if (assignmentToRemove.lights_role && assignmentToRemove.lights_role !== 'none') {
          await manageFlexCrewAssignment(jobId, technicianId, 'lights', 'remove');
        }
      }

      toast.success("Assignment removed successfully");
      // Invalidate jobs so JobCard lists refresh assignments relation
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-assignments", jobId] });
    } catch (error: any) {
      console.error('Error in removeAssignment:', error);
      toast.error("Failed to remove assignment");
    } finally {
      setIsRemoving(prev => ({ ...prev, [technicianId]: false }));
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await manualRefresh();
      toast.success("Assignments refreshed");
    } catch (error) {
      console.error("Error refreshing assignments:", error);
      toast.error("Failed to refresh assignments");
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    assignments,
    isLoading,
    isRefreshing: isRefreshing || isQueryRefreshing,
    refetch: handleRefresh,
    addAssignment,
    removeAssignment,
    isRemoving
  };
};
