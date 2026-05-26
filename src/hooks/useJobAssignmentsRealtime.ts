
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Assignment } from "@/types/assignment";
import { toast } from "sonner";
import { useRealtimeQuery } from "./useRealtimeQuery";
import { useFlexCrewAssignments } from "@/hooks/useFlexCrewAssignments";
import { getAssignmentNotificationDepartments } from "@/utils/assignmentNotificationDepartments";
import {
  ASSIGNMENT_DEPARTMENTS,
  AssignmentRoleInput,
  normalizeAssignmentRole,
  normalizeAssignmentRoleInput,
} from "@/utils/assignmentRoles";


import { queryKeys } from "@/lib/react-query";
export interface AssignmentInsertOptions {
  singleDay?: boolean;
  singleDayDate?: string | null;
  addAsConfirmed?: boolean;
}

type AssignmentInsertPayload = {
  job_id: string;
  technician_id: string;
  sound_role: string | null;
  lights_role: string | null;
  video_role: string | null;
  production_role: string | null;
  assigned_by: string | null;
  assigned_at: string;
  status: "confirmed" | "invited";
  response_time: string | null;
  single_day: boolean;
  assignment_date: string | null;
};

type NormalizedAssignmentRoles = ReturnType<typeof normalizeAssignmentRoleInput>;

export function buildAssignmentInsertPayload(
  jobId: string,
  technicianId: string,
  soundRole: string,
  lightsRole: string,
  assignedBy: string | null,
  options?: AssignmentInsertOptions
): AssignmentInsertPayload;
export function buildAssignmentInsertPayload(
  jobId: string,
  technicianId: string,
  roles: AssignmentRoleInput,
  assignedBy: string | null,
  options?: AssignmentInsertOptions
): AssignmentInsertPayload;
export function buildAssignmentInsertPayload(
  jobId: string,
  technicianId: string,
  rolesOrSound: string | AssignmentRoleInput,
  lightsOrAssignedBy: string | null,
  assignedByOrOptions?: string | null | AssignmentInsertOptions,
  maybeOptions?: AssignmentInsertOptions
) {
  let normalizedRoles: NormalizedAssignmentRoles;
  let assignedBy: string | null;
  let options: AssignmentInsertOptions | undefined;

  if (typeof rolesOrSound === "string") {
    normalizedRoles = {
      sound_role: normalizeAssignmentRole(rolesOrSound as string),
      lights_role: normalizeAssignmentRole(
        (typeof lightsOrAssignedBy === "string" ? lightsOrAssignedBy : null) as string | null,
      ),
      video_role: null,
      production_role: null,
    };
    assignedBy =
      typeof assignedByOrOptions === "string" || assignedByOrOptions == null
        ? (assignedByOrOptions ?? null) as string | null
        : null;
    options = maybeOptions;
  } else {
    normalizedRoles = normalizeAssignmentRoleInput(rolesOrSound);
    assignedBy = lightsOrAssignedBy;
    options = assignedByOrOptions as AssignmentInsertOptions | undefined;
  }

  return buildAssignmentInsertPayloadImpl(
    jobId,
    technicianId,
    normalizedRoles,
    assignedBy,
    options,
  );
}

const buildAssignmentInsertPayloadImpl = (
  jobId: string,
  technicianId: string,
  normalizedRoles: NormalizedAssignmentRoles,
  assignedBy: string | null,
  options?: AssignmentInsertOptions
) => {
  const shouldFlagSingleDay = !!options?.singleDay && !!options?.singleDayDate;
  const isConfirmed = !!options?.addAsConfirmed;

  return {
    job_id: jobId,
    technician_id: technicianId,
    ...normalizedRoles,
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
      console.log("Fetching assignments for job:", jobId);

      // Add retry logic
      const fetchWithRetry = async (retries = 3): Promise<Assignment[]> => {
        try {
          const normalizeProfile = (p: any) => (Array.isArray(p) ? p[0] : p);

          const { data: assignmentData, error: assignError } = await supabase
            .from("job_assignments")
            .select(`
              id,
              job_id,
              technician_id,
              external_technician_name,
              sound_role,
              lights_role,
              video_role,
              production_role,
              status,
              single_day,
              assignment_date,
              assignment_source,
              assigned_at,
              assigned_by,
              profiles (
                first_name,
                last_name,
                email,
                department
              )
            `)
            .eq("job_id", jobId);

          if (assignError) {
            console.warn("Error fetching job_assignments metadata:", assignError);
            throw assignError;
          }

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
            .eq("job_id", jobId)
            .eq("is_active", true)
            // Include false/null, exclude true
            .not("is_schedule_only", "is", true);

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

          // Group timesheets by technician once (avoids O(n²) find/filter)
          const timesheetsByTech = new Map<string, { profile: any | null; dates: Set<string> }>();
          for (const row of combinedTimesheets) {
            const techId = row?.technician_id;
            if (!techId) continue;
            if (!timesheetsByTech.has(techId)) {
              timesheetsByTech.set(techId, { profile: normalizeProfile(row?.profiles) ?? null, dates: new Set() });
            }
            const entry = timesheetsByTech.get(techId)!;
            if (!entry.profile && row?.profiles) {
              entry.profile = normalizeProfile(row.profiles);
            }
            if (row?.date) {
              entry.dates.add(row.date);
            }
          }

          // Merge: job_assignments are the source of truth; timesheets add per-day date metadata.
          const mergedAssignments = (assignmentData || []).map((assignment: any) => {
            const techId = assignment.technician_id;
            const ts = techId ? timesheetsByTech.get(techId) : null;
            const tsDates = ts ? Array.from(ts.dates).sort() : [];
            return {
              job_id: jobId,
              ...assignment,
              technician_id: techId,
              profiles: normalizeProfile(assignment?.profiles) || ts?.profile,
              sound_role: assignment?.sound_role ?? null,
              lights_role: assignment?.lights_role ?? null,
              video_role: assignment?.video_role ?? null,
              production_role: assignment?.production_role ?? null,
              _timesheet_dates: tsDates,
            } as unknown as Assignment;
          });

          const assignmentTechIds = new Set(
            (assignmentData || [])
              .map((assignment: any) => assignment.technician_id)
              .filter(Boolean)
          );

          timesheetsByTech.forEach((ts, techId) => {
            if (assignmentTechIds.has(techId)) return;
            mergedAssignments.push({
              job_id: jobId,
              technician_id: techId,
              profiles: ts.profile,
              sound_role: null,
              lights_role: null,
              video_role: null,
              production_role: null,
              status: null,
              single_day: null,
              assignment_date: null,
              assigned_at: null,
              assigned_by: null,
              _timesheet_dates: Array.from(ts.dates).sort(),
            } as unknown as Assignment);
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
        }
      )
      .subscribe();

    return () => {
      console.log(`Cleaning up job timesheet/assignment subscription for job ${jobId}`);
      supabase.removeChannel(channel);
    };
  }, [jobId, manualRefresh, queryClient]);

  const { manageFlexCrewAssignment } = useFlexCrewAssignments();

  async function addAssignment(
    technicianId: string,
    soundRole: string,
    lightsRole: string,
    options?: AssignmentInsertOptions
  ): Promise<void>;
  async function addAssignment(
    technicianId: string,
    roles: AssignmentRoleInput,
    options?: AssignmentInsertOptions
  ): Promise<void>;
  async function addAssignment(
    technicianId: string,
    rolesOrSound: string | AssignmentRoleInput,
    lightsOrOptions?: string | AssignmentInsertOptions,
    maybeOptions?: AssignmentInsertOptions
  ) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const assignedBy = authData?.user?.id ?? null;
      const roles: AssignmentRoleInput = typeof rolesOrSound === "string"
        ? {
          soundRole: rolesOrSound,
          lightsRole: typeof lightsOrOptions === "string" ? lightsOrOptions : "none",
        }
        : rolesOrSound;
      const options = typeof rolesOrSound === "string"
        ? maybeOptions
        : lightsOrOptions as AssignmentInsertOptions | undefined;
      const payload = buildAssignmentInsertPayload(
        jobId,
        technicianId,
        roles,
        assignedBy,
        options
      );

      // Optimistic cache update for jobs list so cards update instantly
      queryClient.setQueryData(queryKeys.scope("jobs"), (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((j) => {
          if (j.id !== jobId) return j;
          const optimist = {
            job_id: jobId,
            technician_id: technicianId,
            sound_role: payload.sound_role,
            lights_role: payload.lights_role,
            video_role: payload.video_role,
            production_role: payload.production_role,
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
        const assignmentDepartments = getAssignmentNotificationDepartments(payload);

        void supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'job.assignment.direct',
            job_id: jobId,
            recipient_id: technicianId,
            recipient_name: recipientName || undefined,
            assignment_status: options?.addAsConfirmed ? 'confirmed' : 'invited',
            target_date: options?.singleDayDate ? `${options.singleDayDate}T00:00:00Z` : undefined,
            single_day: payload.single_day,
            department: assignmentDepartments[0],
            departments: assignmentDepartments,
          }
        });
      } catch (pushError) {
        // Non-blocking: if push fails, assignment still succeeded
        console.warn('Push notification failed:', pushError);
      }

      // Add to Flex crew calls if applicable
      for (const dept of ASSIGNMENT_DEPARTMENTS) {
        if (dept === "production") continue;
        const role = payload[`${dept}_role` as keyof typeof payload];
        if (role) {
          await manageFlexCrewAssignment(jobId, technicianId, dept, 'add');
        }
      }

      toast.success("Assignment added successfully");
      // Invalidate jobs so JobCard lists refresh assignments relation
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") });
    } catch (error: any) {
      console.error('Error in addAssignment:', error);
      toast.error("Failed to add assignment");
    }
  }

  const removeAssignment = async (technicianId: string) => {
    try {
      setIsRemoving(prev => ({ ...prev, [technicianId]: true }));

      // Optimistic cache update for jobs list
      queryClient.setQueryData(queryKeys.scope("jobs"), (old: any) => {
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

      // Remove from database - IMPORTANT: Delete timesheets first to avoid orphaned records
      const { error: timesheetError } = await supabase
        .from('timesheets')
        .delete()
        .eq('job_id', jobId)
        .eq('technician_id', technicianId);

      if (timesheetError) {
        console.error('Error removing timesheets:', timesheetError);
        toast.error("Failed to remove assignment timesheets");
        return;
      }

      const { error: assignmentError } = await supabase
        .from('job_assignments')
        .delete()
        .eq('job_id', jobId)
        .eq('technician_id', technicianId);

      if (assignmentError) {
        console.error('Error removing assignment:', assignmentError);
        toast.error("Failed to remove assignment");
        return;
      }

      // Remove from Flex crew calls if applicable
      if (assignmentToRemove) {
        for (const dept of ASSIGNMENT_DEPARTMENTS) {
          if (dept === "production") continue;
          const role = assignmentToRemove[`${dept}_role` as keyof Assignment];
          if (role) {
            await manageFlexCrewAssignment(jobId, technicianId, dept, 'remove');
          }
        }
      }

      toast.success("Assignment removed successfully");
      // Invalidate jobs so JobCard lists refresh assignments relation
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") });
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
