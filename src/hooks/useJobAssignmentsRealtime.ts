
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Assignment } from "@/types/assignment";
import { toast } from "sonner";
import { useRealtimeQuery } from "./useRealtimeQuery";
import { useFlexCrewAssignments } from "@/hooks/useFlexCrewAssignments";

export interface AssignmentInsertOptions {
  singleDay?: boolean;
  singleDayDate?: string | null;
  addAsConfirmed?: boolean;
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
  const isConfirmed = !!options?.addAsConfirmed;

  return {
    job_id: jobId,
    technician_id: technicianId,
    sound_role: normalizedSound,
    lights_role: normalizedLights,
    assigned_by: assignedBy,
    assigned_at: new Date().toISOString(),
    status: isConfirmed ? 'confirmed' : 'invited',
    response_time: isConfirmed ? new Date().toISOString() : null,
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
  // Timesheets are the source of truth for display; join with job_assignments for role metadata
  const {
    data: assignments = [],
    isLoading,
    manualRefresh,
    isRefreshing: isQueryRefreshing
  } = useRealtimeQuery<Assignment[]>(
    ["job-assignments", jobId],
    async () => {
      console.log("Fetching assignments (from timesheets) for job:", jobId);

      // Add retry logic
      const fetchWithRetry = async (retries = 3): Promise<Assignment[]> => {
        try {
          // Query timesheets first (source of truth for display)
          const { data: timesheetData, error: tsError } = await supabase
            .from("timesheets")
            .select(`
              job_id,
              technician_id,
              date,
              profiles!fk_timesheets_technician_id (
                first_name,
                last_name,
                email,
                department
              )
            `)
            .eq("job_id", jobId);

          // RLS-safe fallback mirroring JobDetailsDialog to avoid gaps for non-manager roles
          let visibleTimesheets: any[] = [];
          if (tsError?.code === 'PGRST200' || tsError?.code === 'PGRST301' || tsError?.code === '42501') {
            try {
              const { data: vis, error: visErr } = await supabase
                .rpc('get_timesheet_amounts_visible')
                .eq('job_id', jobId);
              if (!visErr && Array.isArray(vis)) {
                visibleTimesheets = vis;
              }
            } catch (err) {
              console.warn('Visible timesheets fallback failed', err);
            }
          }

          const combinedTimesheets = [
            ...(timesheetData || []),
            ...visibleTimesheets
          ];

          if (tsError) {
            console.error("Error fetching timesheets:", tsError);
            // If we recovered via visibleTimesheets, continue; otherwise throw
            if (!visibleTimesheets.length) {
              throw tsError;
            }
          }

          // Get unique technician IDs from timesheets
          const techIds = [...new Set(combinedTimesheets.map((t: any) => t.technician_id))];

          if (techIds.length === 0) {
            console.log(`No timesheets found for job ${jobId}`);
            return [];
          }

          // Fetch job_assignments for role/status metadata
          const { data: assignmentData, error: assignError } = await supabase
            .from("job_assignments")
            .select(`
              *,
              profiles (
                first_name,
                last_name,
                email,
                department
              )
            `)
            .eq("job_id", jobId)
            .in("technician_id", techIds);

          if (assignError) {
            console.warn("Error fetching job_assignments metadata:", assignError);
          }

          // Merge: timesheets for presence, job_assignments for roles
          const assignmentMap = new Map((assignmentData || []).map((a: any) => [a.technician_id, a]));
          const mergedAssignments = techIds.map(techId => {
            const assignment = assignmentMap.get(techId);
            const tsRow = combinedTimesheets.find((t: any) => t.technician_id === techId);
            const tsDates = combinedTimesheets
              .filter((t: any) => t.technician_id === techId)
              .map((t: any) => t.date);
            return {
              job_id: jobId,
              technician_id: techId,
              profiles: assignment?.profiles || tsRow?.profiles,
              sound_role: assignment?.sound_role,
              lights_role: assignment?.lights_role,
              video_role: assignment?.video_role,
              status: assignment?.status,
              single_day: assignment?.single_day,
              assignment_date: assignment?.assignment_date,
              assigned_at: assignment?.assigned_at,
              assigned_by: assignment?.assigned_by,
              // Include dates from timesheets for per-day info
              _timesheet_dates: Array.from(new Set(tsDates)).sort(),
            } as unknown as Assignment;
          });

          console.log(`Successfully fetched ${mergedAssignments.length} assignments for job ${jobId}`);
          return mergedAssignments;
        } catch (error) {
          if (retries > 0) {
            console.log(`Retrying assignments fetch... ${retries} attempts remaining`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            return fetchWithRetry(retries - 1);
          }
          throw error;
        }
      };

      return fetchWithRetry();
    },
    "timesheets", // Subscribe to timesheets (source of truth)
    {
      staleTime: 1000 * 60 * 2, // Consider data fresh for 2 minutes
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: false, // Rely on real-time updates instead of polling
    }
  );

  // Additional real-time subscription specifically for this job
  // Listen to both timesheets (source of truth) and job_assignments (for role/status updates)
  useEffect(() => {
    if (!jobId) return;

    console.log(`Setting up job-specific timesheet/assignment subscription for job ${jobId}`);

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
          // Force immediate refresh
          manualRefresh();
          // Also invalidate jobs to update JobCard lists that depend on job relations
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
          // Force immediate refresh (for role/status updates)
          manualRefresh();
          queryClient.invalidateQueries({ queryKey: ["jobs"] });
        }
      )
      .subscribe();

    return () => {
      console.log(`Cleaning up job timesheet/assignment subscription for job ${jobId}`);
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

      // Send push notification for direct assignment
      try {
        // Fetch technician name for notification
        const { data: techProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', technicianId)
          .single();

        const recipientName = techProfile
          ? `${techProfile.first_name ?? ''} ${techProfile.last_name ?? ''}`.trim()
          : undefined;

        void supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'job.assignment.direct',
            job_id: jobId,
            recipient_id: technicianId,
            recipient_name: recipientName || undefined,
            assignment_status: options?.addAsConfirmed ? 'confirmed' : 'invited',
            target_date: options?.singleDayDate ? `${options.singleDayDate}T00:00:00Z` : undefined,
            single_day: options?.singleDay || false
          }
        });
      } catch (pushError) {
        // Non-blocking: if push fails, assignment still succeeded
        console.warn('Push notification failed:', pushError);
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
          return {
            ...j,
            job_assignments: current.filter((a: any) => a.technician_id !== technicianId),
          };
        });
      });

      // Get the assignment details before removal for Flex cleanup
      const assignmentToRemove = assignments.find(a => a.technician_id === technicianId);
      
      // Remove from database
      const { error } = await supabase
        .from('job_assignments')
        .delete()
        .eq('job_id', jobId)
        .eq('technician_id', technicianId);

      if (error) {
        console.error('Error removing assignment:', error);
        toast.error("Failed to remove assignment");
        return;
      }

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
