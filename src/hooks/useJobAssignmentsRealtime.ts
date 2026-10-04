
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Assignment } from "@/types/assignment";
import { toast } from "sonner";
import { useRealtimeQuery } from "./useRealtimeQuery";
import {
  ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE,
  AssignmentCommandError,
  getJobAssignmentCommandStates,
  jobAssignmentCommandStatesKey,
  applyDirectAssignment,
  createAssignmentCommandId,
  reconcileAssignmentViews,
  removeDirectAssignment,
  requireCommitted,
  runAssignmentSideEffects,
} from "@/features/assignments/commands";
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

export interface UseJobAssignmentsRealtimeOptions {
  /**
   * Load the authoritative per-technician state tokens so this surface can run
   * assignment commands. Management dialogs pass true; read-only views (the
   * timesheet page) leave it off and never call the manager-only state RPC.
   * Without loaded tokens every mutation fails closed.
   */
  manageCommands?: boolean;
}

export const useJobAssignmentsRealtime = (jobId: string, { manageCommands = false }: UseJobAssignmentsRealtimeOptions = {}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();
  const { data: commandStates } = useQuery({
    queryKey: jobAssignmentCommandStatesKey(jobId),
    queryFn: () => getJobAssignmentCommandStates(jobId),
    enabled: manageCommands && !!jobId,
    staleTime: 10_000,
  });
  
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
  const manualRefreshRef = useRef(manualRefresh);
  const ownerIdRef = useRef(`job-assignments-realtime-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    manualRefreshRef.current = manualRefresh;
  }, [manualRefresh]);

  // Additional real-time subscription specifically for this job
  // Listen to both timesheets (source of truth) and job_assignments (for role/status updates)
  // via the unified subscription manager so this doesn't open its own untracked channel.
  useEffect(() => {
    if (!jobId) return;

    const ownerRoute = `job-assignments-${jobId}:${ownerIdRef.current}`;
    const handlePayload = () => {
      // Force immediate refresh. manualRefresh already logs and toasts on
      // failure internally before re-throwing; catch here only to avoid an
      // unhandled promise rejection.
      manualRefreshRef.current().catch(() => {});
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
  }, [jobId, subscriptionManager]);


  /**
   * Department direct assignment. One atomic command creates membership AND
   * schedule (these lists display timesheets), never removes existing days
   * ('add' mode), and rejects a conflict that appeared after the available
   * technician list was loaded. Flex/push run after commit.
   */
  const addAssignment = async (
    technicianId: string,
    soundRole: string,
    lightsRole: string,
    options?: AssignmentInsertOptions
  ) => {
    const role = [soundRole, lightsRole].find((value) => value && value !== 'none');
    if (!role) {
      toast.error("Selecciona un rol para la asignación");
      return;
    }
    const singleDayDate = options?.singleDay ? options.singleDayDate ?? null : null;
    // A single-day request without its day must never widen to the full job.
    if (options?.singleDay && !singleDayDate) {
      toast.error("Selecciona el día de la asignación");
      return;
    }
    if (!commandStates) {
      toast.error(ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE);
      return;
    }
    const expectedStateToken = commandStates.tokenFor(technicianId);
    const previousJobs = queryClient.getQueryData(['jobs']);

    // Optimistic cache update for 'jobs' list so cards update instantly
    queryClient.setQueryData(['jobs'], (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.map((job) => {
        if (!isRecord(job) || job.id !== jobId) return job;
        const optimist = {
          job_id: jobId,
          technician_id: technicianId,
          sound_role: soundRole !== 'none' ? soundRole : null,
          lights_role: lightsRole !== 'none' ? lightsRole : null,
          single_day: Boolean(singleDayDate),
          assignment_date: singleDayDate,
          assigned_at: new Date().toISOString(),
          assigned_by: null,
          profiles: { first_name: '', last_name: '' },
        };
        const current = Array.isArray(job.job_assignments) ? job.job_assignments : [];
        return { ...job, job_assignments: [...current, optimist] };
      });
    });

    try {
      const result = requireCommitted(await applyDirectAssignment({
        commandId: createAssignmentCommandId(),
        jobId,
        technicianId,
        role,
        status: options?.addAsConfirmed ? 'confirmed' : 'invited',
        coverage: singleDayDate ? 'single' : 'full',
        dates: singleDayDate ? [singleDayDate] : undefined,
        mode: 'add',
        expectedStateToken,
        conflictPolicy: 'reject',
        source: 'department-dialog',
      }));

      const { data: techProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, department')
        .eq('id', technicianId)
        .maybeSingle();
      void runAssignmentSideEffects(result.command_id, result, {
        technicianDepartment: techProfile?.department,
        recipientName: techProfile ? `${techProfile.first_name ?? ''} ${techProfile.last_name ?? ''}` : null,
      }).then((summary) => {
        if (summary.failed > 0) {
          toast.error("La asignación se guardó, pero falló la sincronización con Flex o la notificación. Queda registrado para reintentar.");
        }
      }, (error: unknown) => console.error('Assignment side effects could not run', error));

      toast.success(result.outcome === 'noop' ? "La asignación ya existía" : "Asignación añadida");
      reconcileAssignmentViews(queryClient, { technicianId, jobIds: [jobId] });
    } catch (error: unknown) {
      console.error('Error in addAssignment:', error);
      queryClient.setQueryData(['jobs'], previousJobs);
      toast.error(error instanceof AssignmentCommandError ? error.message : "No se pudo añadir la asignación");
    }
  };

  const removeAssignment = async (technicianId: string, _renderedAssignment?: AssignmentRemovalContext) => {
    if (!commandStates) {
      toast.error(ASSIGNMENT_STATE_UNAVAILABLE_MESSAGE);
      return;
    }
    const expectedStateToken = commandStates.tokenFor(technicianId);
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

      // Whole removal: membership and every day go together in one command,
      // and the database plans the Flex removal from the roles it deleted.
      const result = requireCommitted(await removeDirectAssignment({
        commandId: createAssignmentCommandId(),
        jobId,
        technicianId,
        expectedStateToken,
        source: 'job-card',
      }));
      assignmentRemoved = true;
      const renderedDepartment = assignments.find(a => a.technician_id === technicianId)?.profiles?.department ?? null;
      void runAssignmentSideEffects(result.command_id, result, { technicianDepartment: renderedDepartment })
        .then((summary) => {
          if (summary.failed > 0) {
            toast.error("La asignación se eliminó, pero falló la sincronización con Flex o la notificación. Queda registrado para reintentar.");
          }
        }, (error: unknown) => console.error('Assignment removal side effects could not run', error));

      toast.success("Asignación eliminada");
      reconcileAssignmentViews(queryClient, { technicianId, jobIds: [jobId] });
      // Invalidate jobs so JobCard lists refresh assignments relation
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") });
    } catch (error: unknown) {
      console.error('Error in removeAssignment:', error);
      if (!assignmentRemoved) {
        queryClient.setQueryData(['jobs'], previousJobs);
      }
      if (error instanceof AssignmentCommandError && error.code === 'stale_state') {
        reconcileAssignmentViews(queryClient, { technicianId, jobIds: [jobId] });
      }
      toast.error(error instanceof AssignmentCommandError ? error.message : "No se pudo eliminar la asignación");
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
    isRemoving,
    /** Expected-state token per technician, or null until the state loads. */
    expectedStateTokenFor: (technicianId: string): string | null => commandStates?.tokenFor(technicianId) ?? null,
  };
};
