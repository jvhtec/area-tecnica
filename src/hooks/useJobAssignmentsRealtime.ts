
import { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Assignment } from "@/types/assignment";
import { toast } from "sonner";
import { useRealtimeQuery } from "./useRealtimeQuery";
import { useFlexCrewAssignments } from "@/hooks/useFlexCrewAssignments";
import { getAssignmentNotificationDepartments } from "@/utils/assignmentNotificationDepartments";
import { UnifiedSubscriptionManager } from "@/lib/unified-subscription-manager";
import type { Database } from "@/integrations/supabase/types";

import { queryKeys } from "@/lib/react-query";
export interface AssignmentInsertOptions {
  singleDay?: boolean;
  singleDayDate?: string | null;
  addAsConfirmed?: boolean;
}

type AssignmentRemovalContext = Pick<Assignment, 'technician_id' | 'sound_role' | 'lights_role' | 'video_role'>;
type JobAssignmentRow = Database["public"]["Tables"]["job_assignments"]["Row"];
type TimesheetRow = Database["public"]["Tables"]["timesheets"]["Row"];
type VisibleTimesheetRow = Database["public"]["Functions"]["get_timesheet_amounts_visible"]["Returns"][number];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AssignmentProfile = Assignment["profiles"];
type ProfileProjection = Pick<ProfileRow, "first_name" | "last_name" | "email" | "department" | "nickname">;
type JoinedProfile = Partial<ProfileProjection> | Array<Partial<ProfileProjection>> | null | undefined;
type TimesheetAssignmentRow = Pick<TimesheetRow, "technician_id" | "date"> & {
  profiles?: JoinedProfile;
};
type VisibleAssignmentTimesheetRow = Pick<VisibleTimesheetRow, "technician_id" | "date">;
type AssignmentTimesheetRow = TimesheetAssignmentRow | VisibleAssignmentTimesheetRow;
type AssignmentMetadataRow = Pick<
  JobAssignmentRow,
  | "id"
  | "technician_id"
  | "sound_role"
  | "lights_role"
  | "video_role"
  | "production_role"
  | "status"
  | "single_day"
  | "assignment_date"
  | "assigned_at"
  | "assigned_by"
> & {
  profiles?: JoinedProfile;
};
export type AssignmentWithTimesheetDates = Assignment & {
  status?: JobAssignmentRow["status"];
  _timesheet_dates: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeProfile = (profile: JoinedProfile): Partial<ProfileProjection> | null => {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile ?? null;
};

const buildAssignmentProfile = (profile: Partial<ProfileProjection> | null | undefined): AssignmentProfile => ({
  first_name: typeof profile?.first_name === "string" ? profile.first_name : "",
  nickname: typeof profile?.nickname === "string" ? profile.nickname : null,
  last_name: typeof profile?.last_name === "string" ? profile.last_name : "",
  email: typeof profile?.email === "string" ? profile.email : "",
  department: typeof profile?.department === "string" ? profile.department : "",
});

export const mergeTimesheetAssignmentsForDisplay = ({
  jobId,
  timesheets,
  assignmentRows,
}: {
  jobId: string;
  timesheets: AssignmentTimesheetRow[];
  assignmentRows: AssignmentMetadataRow[];
}): AssignmentWithTimesheetDates[] => {
  const timesheetsByTech = new Map<string, { profile: Partial<ProfileProjection> | null; dates: Set<string> }>();

  for (const row of timesheets) {
    const techId = row.technician_id;
    if (!techId) continue;
    if (!timesheetsByTech.has(techId)) {
      timesheetsByTech.set(techId, {
        profile: "profiles" in row ? normalizeProfile(row.profiles) : null,
        dates: new Set(),
      });
    }
    const entry = timesheetsByTech.get(techId)!;
    if (!entry.profile && "profiles" in row && row.profiles) {
      entry.profile = normalizeProfile(row.profiles);
    }
    if (row.date) {
      entry.dates.add(row.date);
    }
  }

  const assignmentMap = new Map(
    assignmentRows.map((assignment) => [
      assignment.technician_id,
      { ...assignment, profiles: normalizeProfile(assignment.profiles) },
    ]),
  );

  return Array.from(timesheetsByTech.keys()).map((techId) => {
    const assignment = assignmentMap.get(techId);
    const timesheet = timesheetsByTech.get(techId);
    const timesheetDates = timesheet ? Array.from(timesheet.dates).sort() : [];

    return {
      id: assignment?.id ?? `timesheet-${jobId}-${techId}`,
      job_id: jobId,
      technician_id: techId,
      profiles: buildAssignmentProfile(assignment?.profiles || timesheet?.profile),
      sound_role: assignment?.sound_role ?? null,
      lights_role: assignment?.lights_role ?? null,
      video_role: assignment?.video_role ?? null,
      production_role: assignment?.production_role ?? null,
      status: assignment?.status ?? null,
      single_day: assignment?.single_day ?? null,
      assignment_date: assignment?.assignment_date ?? null,
      assigned_at: assignment?.assigned_at ?? "",
      assigned_by: assignment?.assigned_by ?? null,
      _timesheet_dates: timesheetDates,
    };
  });
};

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
  } = useRealtimeQuery<AssignmentWithTimesheetDates[]>(
    ["job-assignments", jobId],
    async () => {
      console.log("Fetching assignments (from timesheets) for job:", jobId);

      // Add retry logic
      const fetchWithRetry = async (retries = 3): Promise<AssignmentWithTimesheetDates[]> => {
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
            .eq("job_id", jobId)
            .eq("is_active", true)
            // Include false/null, exclude true
            .not("is_schedule_only", "is", true);

          // RLS-safe fallback mirroring JobDetailsDialog to avoid gaps for non-manager roles
          let visibleTimesheets: VisibleAssignmentTimesheetRow[] = [];
          if (tsError?.code === 'PGRST200' || tsError?.code === 'PGRST301' || tsError?.code === '42501') {
            try {
              const { data: vis, error: visErr } = await supabase
                .rpc('get_timesheet_amounts_visible')
                .eq('job_id', jobId);
              if (!visErr && Array.isArray(vis)) {
                visibleTimesheets = vis as VisibleAssignmentTimesheetRow[];
              }
            } catch (err) {
              console.warn('Visible timesheets fallback failed', err);
            }
          }

          const combinedTimesheets: AssignmentTimesheetRow[] = [
            ...((timesheetData || []) as TimesheetAssignmentRow[]),
            ...visibleTimesheets
          ];

          if (tsError) {
            console.error("Error fetching timesheets:", tsError);
            // If we recovered via visibleTimesheets, continue; otherwise throw
            if (!visibleTimesheets.length) {
              throw tsError;
            }
          }

          const techIds = Array.from(new Set(combinedTimesheets
            .map((row) => row.technician_id)
            .filter((technicianId): technicianId is string => Boolean(technicianId))));

          if (techIds.length === 0) {
            console.log(`No timesheets found for job ${jobId}`);
            return [];
          }

          // Fetch job_assignments for role/status metadata
          const { data: assignmentData, error: assignError } = await supabase
            .from("job_assignments")
            .select(`
              technician_id,
              id,
              sound_role,
              lights_role,
              video_role,
              production_role,
              status,
              single_day,
              assignment_date,
              assigned_at,
              assigned_by,
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
          const mergedAssignments = mergeTimesheetAssignmentsForDisplay({
            jobId,
            timesheets: combinedTimesheets,
            assignmentRows: (assignmentData || []) as AssignmentMetadataRow[],
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

  const subscriptionManager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(queryClient),
    [queryClient]
  );
  const ownerIdRef = useRef(`job-assignments-realtime-${Math.random().toString(36).slice(2)}`);

  // Additional real-time subscription specifically for this job
  // Listen to both timesheets (source of truth) and job_assignments (for role/status updates)
  // via the unified subscription manager so this doesn't open its own untracked channel.
  useEffect(() => {
    if (!jobId) return;

    const ownerRoute = `job-assignments-${jobId}:${ownerIdRef.current}`;
    const handlePayload = () => {
      // Force immediate refresh
      manualRefresh();
    };

    subscriptionManager.subscribeToTable(
      'timesheets',
      ['job-assignments', jobId],
      { event: '*', schema: 'public', filter: `job_id=eq.${jobId}` },
      'high',
      { ownerRoute, invalidateOnPayload: false, onPayload: handlePayload }
    );

    subscriptionManager.subscribeToTable(
      'job_assignments',
      ['job-assignments', jobId],
      { event: '*', schema: 'public', filter: `job_id=eq.${jobId}` },
      'high',
      { ownerRoute, invalidateOnPayload: false, onPayload: handlePayload }
    );

    return () => {
      subscriptionManager.cleanupRouteDependentSubscriptions(ownerRoute);
    };
  }, [jobId, manualRefresh, subscriptionManager]);

  const { manageFlexCrewAssignment } = useFlexCrewAssignments();

  const addAssignment = async (
    technicianId: string,
    soundRole: string,
    lightsRole: string,
    options?: AssignmentInsertOptions
  ) => {
    const previousJobs = queryClient.getQueryData(['jobs']);
    let assignmentPersisted = false;

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
      queryClient.setQueryData(['jobs'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((job) => {
          if (!isRecord(job) || job.id !== jobId) return job;
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
          const current = Array.isArray(job.job_assignments) ? job.job_assignments : [];
          return { ...job, job_assignments: [...current, optimist] };
        });
      });

      const { error } = await supabase
        .from('job_assignments')
        .insert(payload);

      if (error) {
        console.error('Error adding assignment:', error);
        queryClient.setQueryData(['jobs'], previousJobs);
        toast.error("Failed to add assignment");
        return;
      }
      assignmentPersisted = true;

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
      if (soundRole && soundRole !== 'none') {
        await manageFlexCrewAssignment(jobId, technicianId, 'sound', 'add');
      }
      
      if (lightsRole && lightsRole !== 'none') {
        await manageFlexCrewAssignment(jobId, technicianId, 'lights', 'add');
      }

      toast.success("Assignment added successfully");
      // Invalidate jobs so JobCard lists refresh assignments relation
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") });
    } catch (error: unknown) {
      console.error('Error in addAssignment:', error);
      if (!assignmentPersisted) {
        queryClient.setQueryData(['jobs'], previousJobs);
      }
      toast.error("Failed to add assignment");
    }
  };

  const removeAssignment = async (technicianId: string, renderedAssignment?: AssignmentRemovalContext) => {
    const previousJobs = queryClient.getQueryData(['jobs']);
    let assignmentRemoved = false;

    try {
      setIsRemoving(prev => ({ ...prev, [technicianId]: true }));

      // Optimistic cache update for 'jobs'
      queryClient.setQueryData(['jobs'], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((job) => {
          if (!isRecord(job) || job.id !== jobId) return job;
          const current = Array.isArray(job.job_assignments) ? job.job_assignments : [];
          return {
            ...job,
            job_assignments: current.filter((assignment): boolean => {
              if (!isRecord(assignment)) return true;
              return assignment.technician_id !== technicianId;
            }),
          };
        });
      });

      // Get the assignment details before removal for Flex cleanup
      const assignmentToRemove =
        renderedAssignment?.technician_id === technicianId
          ? renderedAssignment
          : assignments.find(a => a.technician_id === technicianId);

      // Remove from database - IMPORTANT: Delete timesheets first to avoid orphaned records
      const { error: timesheetError } = await supabase
        .from('timesheets')
        .delete()
        .eq('job_id', jobId)
        .eq('technician_id', technicianId);

      if (timesheetError) {
        console.error('Error removing timesheets:', timesheetError);
        queryClient.setQueryData(['jobs'], previousJobs);
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
        queryClient.setQueryData(['jobs'], previousJobs);
        toast.error("Failed to remove assignment");
        return;
      }
      assignmentRemoved = true;

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
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") });
    } catch (error: unknown) {
      console.error('Error in removeAssignment:', error);
      if (!assignmentRemoved) {
        queryClient.setQueryData(['jobs'], previousJobs);
      }
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
