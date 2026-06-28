
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'next-themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { createQueryKey } from '@/lib/optimized-react-query';
import { useRequiredRoleSummary } from '@/hooks/useJobRequiredRoles';
import { resolveJobDocLocation } from '@/utils/jobDocuments';
import { getScheduledWorkDateKeys } from '@/utils/assignmentWorkDates';
import {
  canCreateFolders,
  canEditJobs as canEditJobsForRole,
  canManageFestivalArtists,
  canUploadDocuments as canUploadDocumentsForRole,
} from '@/utils/permissions';
import { getDocumentUploadValidationError } from '@/utils/documentUploadValidation';


import { queryKeys } from "@/lib/react-query";
type UseOptimizedJobCardOptions = {
  enableRoleSummary?: boolean;
  enableSoundTasks?: boolean;
  refreshAssignmentsOnMount?: boolean;
};

type JobDocumentRow = {
  id: string;
  file_name?: string | null;
  file_path: string;
  read_only?: boolean | null;
  [key: string]: unknown;
};

type JobProfileRef = {
  first_name?: string | null;
  nickname?: string | null;
  last_name?: string | null;
  department?: string | null;
  [key: string]: unknown;
};

type JobAssignmentForCard = {
  job_id?: string | null;
  technician_id: string;
  profiles?: JobProfileRef | JobProfileRef[] | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  status?: string | null;
  single_day?: boolean | null;
  assignment_date?: string | null;
  assigned_at?: string | null;
  _timesheet_dates?: string[];
  _scheduled_work_dates?: string[];
  [key: string]: unknown;
};

type TimesheetForCard = {
  technician_id?: string | null;
  date?: string | null;
  profiles?: JobProfileRef | JobProfileRef[] | null;
};

type JobDateTypeForCard = {
  date?: string | null;
  type?: string | null;
};

type OptimizedJobCardJob = {
  id: string;
  color?: string | null;
  darkColor?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  job_type?: string | null;
  tour_date?: unknown;
  job_assignments?: JobAssignmentForCard[] | null;
  job_documents?: JobDocumentRow[] | null;
  job_date_types?: JobDateTypeForCard[] | null;
  [key: string]: unknown;
};

const normalizeProfile = (profile: JobProfileRef | JobProfileRef[] | null | undefined): JobProfileRef | null =>
  Array.isArray(profile) ? (profile[0] ?? null) : (profile ?? null);

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const useOptimizedJobCard = (
  job: OptimizedJobCardJob,
  department: string,
  userRole: string | null,
  onEditClick: (job: OptimizedJobCardJob) => void,
  onDeleteClick: (jobId: string) => void,
  onJobClick: (jobId: string) => void,
  options?: UseOptimizedJobCardOptions
) => {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirm = useConfirm();
  const enableRoleSummary = options?.enableRoleSummary ?? true;
  const enableSoundTasks = options?.enableSoundTasks ?? true;
  const refreshAssignmentsOnMount = options?.refreshAssignmentsOnMount ?? false;
  
  // Memoized styling calculations
  const { appliedBorderColor, appliedBgColor } = useMemo(() => {
    const isDark = theme === 'dark';
    const borderColor = job.color || '#7E69AB';
    const appliedBorderColor = isDark ? (job.darkColor || borderColor) : borderColor;
    const bgColor = job.color ? `${job.color}05` : '#7E69AB05';
    const appliedBgColor = isDark ? (job.darkColor ? `${job.darkColor}15` : bgColor) : bgColor;
    
    return { appliedBorderColor, appliedBgColor };
  }, [job.color, job.darkColor, theme]);

  // Local state
  const [collapsed, setCollapsed] = useState(true);
  const [assignments, setAssignments] = useState<JobAssignmentForCard[]>(job.job_assignments || []);
  const [documents, setDocuments] = useState<JobDocumentRow[]>((job.job_documents || []) as JobDocumentRow[]);
  const [soundTaskDialogOpen, setSoundTaskDialogOpen] = useState(false);
  const [lightsTaskDialogOpen, setLightsTaskDialogOpen] = useState(false);
  const [videoTaskDialogOpen, setVideoTaskDialogOpen] = useState(false);
  const [editJobDialogOpen, setEditJobDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const initialAssignmentRefreshJobIdRef = useRef<string | null>(null);

  // Keep local state in sync with incoming job prop updates for instant UI


  useEffect(() => {
    setDocuments((job.job_documents || []) as JobDocumentRow[]);
  }, [job.job_documents]);

  const jobScheduledWorkDates = useMemo(() => getScheduledWorkDateKeys({
    job_date_types: job?.job_date_types,
    start_time: job?.start_time,
    end_time: job?.end_time,
    tour_date: job?.tour_date,
  }), [job?.job_date_types, job?.start_time, job?.end_time, job?.tour_date]);

  // Helper to fetch and update assignments for this job
  // job_assignments are the base; timesheets add per-day date info (with RLS-safe fallback)
  const refreshAssignments = useCallback(async () => {
    if (!job?.id) return;
    try {
      const baseAssignments: JobAssignmentForCard[] = Array.isArray(job?.job_assignments) ? job.job_assignments : [];

      const { data: directTimesheets, error: tsError } = await supabase
        .from('timesheets')
        .select(`
          technician_id,
          date,
          profiles!fk_timesheets_technician_id (first_name, nickname, last_name, department)
        `)
        .eq('job_id', job.id)
        .eq('is_active', true);

      if (tsError) {
        console.warn('Error fetching timesheets for job card:', tsError);
      }

      // Fallback to visibility function to avoid RLS gaps (mirrors JobDetailsDialog)
      let visibleTimesheets: TimesheetForCard[] = [];
      try {
        const { data: visible, error: visErr } = await supabase
          .rpc('get_timesheet_amounts_visible')
          .eq('job_id', job.id);
        if (!visErr && Array.isArray(visible)) {
          visibleTimesheets = visible as TimesheetForCard[];
        }
      } catch (err) {
        console.warn('Error fetching visible timesheets for job card:', err);
      }

      // Merge direct + visible and de-duplicate per technician
      const timesheetsByTech = new Map<string, string[]>();
      const timesheetProfileByTech = new Map<string, JobProfileRef | null>();
      const addTimesheetRow = (t: TimesheetForCard) => {
        if (!t?.technician_id || !t?.date) return;
        const existing = timesheetsByTech.get(t.technician_id) || [];
        existing.push(t.date);
        timesheetsByTech.set(t.technician_id, existing);
        if (t.profiles) {
          timesheetProfileByTech.set(t.technician_id, normalizeProfile(t.profiles));
        }
      };

      ((directTimesheets || []) as TimesheetForCard[]).forEach(addTimesheetRow);
      visibleTimesheets.forEach(addTimesheetRow);

      // Deduplicate and sort dates per technician
      const normalizedTimesheetsByTech = new Map<string, string[]>();
      timesheetsByTech.forEach((dates, techId) => {
        const uniqueSorted = Array.from(new Set(dates)).sort();
        normalizedTimesheetsByTech.set(techId, uniqueSorted);
      });

      const { data: jobDateTypes, error: dateTypesError } = await supabase
        .from('job_date_types')
        .select('date, type')
        .eq('job_id', job.id);

      if (dateTypesError) {
        console.warn('Error fetching job date types for job card:', dateTypesError);
      }

      const computedScheduledWorkDates = getScheduledWorkDateKeys({
        job_date_types: jobDateTypes || job?.job_date_types || [],
        start_time: job?.start_time,
        end_time: job?.end_time,
        tour_date: job?.tour_date,
      });
      const scheduledWorkDates = computedScheduledWorkDates.length > 0
        ? computedScheduledWorkDates
        : jobScheduledWorkDates;

      const mergedAssignments: JobAssignmentForCard[] = (baseAssignments || []).map((a) => ({
        ...a,
        profiles: normalizeProfile(a.profiles),
        _timesheet_dates: normalizedTimesheetsByTech.get(a.technician_id) || [],
        _scheduled_work_dates: scheduledWorkDates,
      }));

      // If timesheets exist for technicians not in job_assignments (edge cases), include them so badges still appear
      const assignmentTechIds = new Set((baseAssignments || []).map((a) => a.technician_id));
      normalizedTimesheetsByTech.forEach((dates, techId) => {
        if (assignmentTechIds.has(techId)) return;
        mergedAssignments.push({
          job_id: job.id,
          technician_id: techId,
          profiles: timesheetProfileByTech.get(techId) || null,
          sound_role: null,
          lights_role: null,
          video_role: null,
          status: null,
          single_day: null,
          assignment_date: null,
          assigned_at: null,
          _timesheet_dates: dates,
          _scheduled_work_dates: scheduledWorkDates,
        });
      });

      setAssignments(mergedAssignments);
    } catch (err) {
      console.warn('Error refreshing assignments', err);
    }
  }, [job?.id, job?.job_assignments, job?.job_date_types, job?.start_time, job?.end_time, job?.tour_date, jobScheduledWorkDates]);

  // Keep local state in sync with incoming job prop updates for instant UI
  useEffect(() => {
    const nextAssignments = Array.isArray(job.job_assignments)
      ? job.job_assignments.map((assignment) => ({
        ...assignment,
        _scheduled_work_dates: jobScheduledWorkDates,
      }))
      : [];
    setAssignments(nextAssignments);
  }, [job.job_assignments, jobScheduledWorkDates]);

  // One-time load refresh for contexts that must show current assignment badges immediately
  useEffect(() => {
    if (!refreshAssignmentsOnMount) return;
    if (!job?.id) return;
    if (job.job_type === 'dryhire') return;
    if (initialAssignmentRefreshJobIdRef.current === job.id) return;

    initialAssignmentRefreshJobIdRef.current = job.id;
    void refreshAssignments();
  }, [job?.id, job?.job_type, refreshAssignments, refreshAssignmentsOnMount]);

  const shouldEnrichAssignments = assignmentDialogOpen || !collapsed;
  useEffect(() => {
    if (!shouldEnrichAssignments) return;
    void refreshAssignments();
  }, [refreshAssignments, shouldEnrichAssignments]);

  // Realtime: subscribe to timesheet changes for this job (source of truth) and refresh local state instantly
  useEffect(() => {
    if (!job?.id) return;
    if (!shouldEnrichAssignments) return;
    const channel = supabase
      .channel(`job-card-timesheets-${job.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'timesheets',
        filter: `job_id=eq.${job.id}`,
      }, async () => { await refreshAssignments(); })
      .subscribe();

    // Also listen to global assignment-updated events as a safety net (manual actions)
    const handler = () => { void refreshAssignments(); };
    window.addEventListener('assignment-updated', handler);

    return () => {
      window.removeEventListener('assignment-updated', handler);
      supabase.removeChannel(channel);
    };
  }, [job?.id, refreshAssignments, shouldEnrichAssignments]);

  // Memoized permission checks
  const permissions = useMemo(() => {
    const isHouseTech = userRole === 'house_tech';
    const canEditJobs = canEditJobsForRole(userRole);
    const canManageArtists = canManageFestivalArtists(userRole);
    const canUploadDocuments = canUploadDocumentsForRole(userRole);
    const canCreateFlexFolders = canCreateFolders(userRole);
    
    return {
      isHouseTech,
      canEditJobs,
      canManageArtists,
      canUploadDocuments,
      canCreateFlexFolders
    };
  }, [userRole]);

  // Required roles summary for this job
  const { data: reqSummary = [], byDepartment: reqByDept } = useRequiredRoleSummary(job?.id, enableRoleSummary);

  // Compute assigned counts per department and per role code (for comparisons)
  const assignedMetrics = useMemo(() => {
    // De-duplicate by technician per department/role so multi-day rows count once
    const soundSet = new Set<string>();
    const lightsSet = new Set<string>();
    const videoSet = new Set<string>();
    const roleSets: Record<string, Set<string>> = {};

    const rows = Array.isArray(assignments) ? assignments : [];
    for (const a of rows) {
      const techId = a.technician_id;
      if (a.sound_role) {
        soundSet.add(techId);
        roleSets[a.sound_role] = roleSets[a.sound_role] || new Set<string>();
        roleSets[a.sound_role].add(techId);
      }
      if (a.lights_role) {
        lightsSet.add(techId);
        roleSets[a.lights_role] = roleSets[a.lights_role] || new Set<string>();
        roleSets[a.lights_role].add(techId);
      }
      if (a.video_role) {
        videoSet.add(techId);
        roleSets[a.video_role] = roleSets[a.video_role] || new Set<string>();
        roleSets[a.video_role].add(techId);
      }
    }

    const countsByDept: Record<string, number> = {
      sound: soundSet.size,
      lights: lightsSet.size,
      video: videoSet.size
    };

    const countsByRole: Record<string, number> = {};
    Object.entries(roleSets).forEach(([role, set]) => countsByRole[role] = set.size);

    return { countsByDept, countsByRole };
  }, [assignments]);

  // Compute shortages per department/role
  const requiredVsAssigned = useMemo(() => {
    const byDept: Record<string, { required: number; assigned: number; roles: Array<{ role_code: string; required: number; assigned: number }> }> = {};
    for (const dept of ['sound', 'lights', 'video']) {
      const sum = reqByDept.get?.(dept) || (reqSummary.find(r => r.department === dept) ?? null);
      const required = sum?.total_required ?? 0;
      const roles = (sum?.roles || []).map((r) => ({
        role_code: r.role_code,
        required: r.quantity,
        assigned: assignedMetrics.countsByRole[r.role_code] || 0,
      }));
      const assigned = assignedMetrics.countsByDept[dept] || 0;
      byDept[dept] = { required, assigned, roles };
    }
    return byDept;
  }, [reqSummary, reqByDept, assignedMetrics]);

  // Optimized sound tasks query with proper key
  const { data: soundTasks } = useQuery({
    queryKey: createQueryKey.tasks.byDepartment('sound', job.id),
    queryFn: async () => {
      if (department !== 'sound') return null;
      const { data, error } = await supabase
        .from('sound_job_tasks')
        .select(`
          *,
          assigned_to (first_name, last_name),
          task_documents(*)
        `)
        .eq('job_id', job.id);
      if (error) throw error;
      return data;
    },
    enabled: enableSoundTasks && department === 'sound' && (soundTaskDialogOpen || !collapsed),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Memoized event handlers
  const toggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(prev => !prev);
  }, []);

  const handleEditButtonClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditJobDialogOpen(true);
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || !department) return;

    const validationError = getDocumentUploadValidationError(files);
    if (validationError) {
      toast({ title: 'Archivo no permitido', description: validationError, variant: 'destructive' });
      return;
    }

    const insertedDocuments: JobDocumentRow[] = [];
    const failedMessages: string[] = [];

    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop();
        const filePath = `${department}/${job.id}/${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('job_documents')
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: inserted, error: dbError } = await supabase
          .from('job_documents')
          .insert({
            job_id: job.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            original_type: null
          })
          .select('*')
          .single();
        if (dbError) {
          const { error: cleanupError } = await supabase.storage.from('job_documents').remove([filePath]);
          if (cleanupError) {
            console.error('Storage cleanup after failed job document insert failed:', cleanupError);
          }
          throw dbError;
        }

        if (inserted) {
          insertedDocuments.push(inserted as JobDocumentRow);
        }

        // Broadcast push: new document uploaded
        try {
          void supabase.functions.invoke('push', {
            body: { action: 'broadcast', type: 'document.uploaded', job_id: job.id, file_name: file.name }
          });
        } catch { /* best-effort push notification; ignore delivery failures */ }
      } catch (err: unknown) {
        failedMessages.push(`${file.name}: ${getErrorMessage(err)}`);
      }
    }

    // Update local documents state immediately
    if (insertedDocuments.length > 0) {
      setDocuments((prev) => Array.isArray(prev) ? [...prev, ...insertedDocuments] : insertedDocuments);
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.scope("optimized-jobs") });
    queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobs") });

    if (failedMessages.length === 0) {
      return;
    }

    toast({
      title: insertedDocuments.length > 0 ? 'Subida parcial' : 'Error al subir',
      description:
        insertedDocuments.length > 0
          ? `${insertedDocuments.length} de ${files.length} documento(s) se subieron. ${failedMessages[0]}`
          : failedMessages[0],
      variant: 'destructive',
    });
  }, [job.id, department, queryClient, toast]);

  const handleDeleteDocument = useCallback(async (doc: JobDocumentRow) => {
    if (doc?.read_only) {
      console.error('Attempted to delete read-only document', doc);
      return;
    }
    const confirmed = await confirm({
      title: 'Eliminar documento',
      description: '¿Seguro que quieres eliminar este documento?',
      confirmText: 'Eliminar',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      const { bucket, path } = resolveJobDocLocation(doc.file_path);
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([path]);
      
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('job_documents')
        .delete()
        .eq('id', doc.id);
      
      if (dbError) throw dbError;

      // Update local documents state immediately
      setDocuments((prev) => Array.isArray(prev) ? prev.filter((d) => d.id !== doc.id) : prev);

      // Broadcast push: document deleted
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'document.deleted', job_id: job.id, file_name: doc.file_name }
        });
      } catch { /* best-effort push notification; ignore delivery failures */ }
    } catch (err: unknown) {
      console.error('Delete error:', err);
    }
  }, [job.id, confirm]);

  const refreshData = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Refresh job documents directly for instant UI
      const { data, error } = await supabase
        .from('job_documents')
        .select('*')
        .eq('job_id', job.id)
        .order('uploaded_at', { ascending: false });
      if (!error) {
        setDocuments((data || []) as JobDocumentRow[]);
      }

      void refreshAssignments();

      // Invalidate broader queries so the card and list re-fetch
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('optimized-jobs') });
    } catch (err) {
      console.error('Refresh error:', err);
    }
  }, [job.id, queryClient, refreshAssignments]);

  return {
    // Styling
    appliedBorderColor,
    appliedBgColor,
    
    // State
    collapsed,
    assignments,
    documents,
    reqSummary,
    requiredVsAssigned,
    soundTaskDialogOpen,
    lightsTaskDialogOpen,
    videoTaskDialogOpen,
    editJobDialogOpen,
    assignmentDialogOpen,
    
    // Data
    soundTasks,
    
    // Permissions
    ...permissions,
    
    // Event handlers
    toggleCollapse,
    handleEditButtonClick,
    handleFileUpload,
    handleDeleteDocument,
    refreshData,
    
    // Dialog handlers
    setSoundTaskDialogOpen,
    setLightsTaskDialogOpen,
    setVideoTaskDialogOpen,
    setEditJobDialogOpen,
    setAssignmentDialogOpen
  };
};
