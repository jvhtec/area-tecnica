
import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'next-themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { createQueryKey } from '@/lib/optimized-react-query';
import { useRequiredRoleSummary } from '@/hooks/useJobRequiredRoles';
import { resolveJobDocLocation } from '@/utils/jobDocuments';

type UseOptimizedJobCardOptions = {
  enableRoleSummary?: boolean;
  enableSoundTasks?: boolean;
};

export const useJobCard = (
  job: any,
  department: string,
  userRole: string | null,
  onEditClick: (job: any) => void,
  onDeleteClick: (jobId: string) => void,
  onJobClick: (jobId: string) => void,
  options?: UseOptimizedJobCardOptions
) => {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const enableRoleSummary = options?.enableRoleSummary ?? true;
  const enableSoundTasks = options?.enableSoundTasks ?? true;
  
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
  const [assignments, setAssignments] = useState(job.job_assignments || []);
  const [documents, setDocuments] = useState(job.job_documents || []);
  const [soundTaskDialogOpen, setSoundTaskDialogOpen] = useState(false);
  const [lightsTaskDialogOpen, setLightsTaskDialogOpen] = useState(false);
  const [videoTaskDialogOpen, setVideoTaskDialogOpen] = useState(false);
  const [editJobDialogOpen, setEditJobDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);

  // Keep local state in sync with incoming job prop updates for instant UI


  useEffect(() => {
    setDocuments(job.job_documents || []);
  }, [job.job_documents]);

  const normalizeProfile = (p: any) => Array.isArray(p) ? p[0] : p;

  // Helper to fetch and update assignments for this job
  // job_assignments are the base; timesheets add per-day date info (with RLS-safe fallback)
  const refreshAssignments = useCallback(async () => {
    if (!job?.id) return;
    try {
      const baseAssignments: any[] = Array.isArray(job?.job_assignments) ? job.job_assignments : [];

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
      let visibleTimesheets: any[] = [];
      try {
        const { data: visible, error: visErr } = await supabase
          .rpc('get_timesheet_amounts_visible')
          .eq('job_id', job.id);
        if (!visErr && Array.isArray(visible)) {
          visibleTimesheets = visible;
        }
      } catch (err) {
        console.warn('Error fetching visible timesheets for job card:', err);
      }

      // Merge direct + visible and de-duplicate per technician
      const timesheetsByTech = new Map<string, string[]>();
      const timesheetProfileByTech = new Map<string, any>();
      const addTimesheetRow = (t: any) => {
        if (!t?.technician_id || !t?.date) return;
        const existing = timesheetsByTech.get(t.technician_id) || [];
        existing.push(t.date);
        timesheetsByTech.set(t.technician_id, existing);
        if (t.profiles) {
          timesheetProfileByTech.set(t.technician_id, normalizeProfile(t.profiles));
        }
      };

      (directTimesheets || []).forEach(addTimesheetRow);
      visibleTimesheets.forEach(addTimesheetRow);

      // Deduplicate and sort dates per technician
      const normalizedTimesheetsByTech = new Map<string, string[]>();
      timesheetsByTech.forEach((dates, techId) => {
        const uniqueSorted = Array.from(new Set(dates)).sort();
        normalizedTimesheetsByTech.set(techId, uniqueSorted);
      });

      const mergedAssignments: any[] = (baseAssignments || []).map((a: any) => ({
        ...a,
        profiles: normalizeProfile(a.profiles),
        _timesheet_dates: normalizedTimesheetsByTech.get(a.technician_id) || [],
      }));

      // If timesheets exist for technicians not in job_assignments (edge cases), include them so badges still appear
      const assignmentTechIds = new Set((baseAssignments || []).map((a: any) => a.technician_id));
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
        });
      });

      setAssignments(mergedAssignments);
    } catch (err) {
      console.warn('Error refreshing assignments', err);
    }
  }, [job?.id, job?.job_assignments]);

  // Keep local state in sync with incoming job prop updates for instant UI
  useEffect(() => {
    setAssignments(job.job_assignments || []);
  }, [job.job_assignments]);

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
    const canEditJobs = ['admin', 'management', 'logistics'].includes(userRole || '');
    const canManageArtists = ['admin', 'management', 'logistics', 'technician', 'house_tech'].includes(userRole || '');
    const canUploadDocuments = ['admin', 'management', 'logistics'].includes(userRole || '');
    const canCreateFlexFolders = ['admin', 'management', 'logistics'].includes(userRole || '');
    
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
    } as any;

    const countsByRole: Record<string, number> = {};
    Object.entries(roleSets).forEach(([role, set]) => countsByRole[role] = set.size);

    return { countsByDept, countsByRole };
  }, [assignments]);

  // Compute shortages per department/role
  const requiredVsAssigned = useMemo(() => {
    const byDept: Record<string, { required: number; assigned: number; roles: Array<{ role_code: string; required: number; assigned: number }> }> = {};
    for (const dept of ['sound', 'lights', 'video']) {
      const sum = reqByDept.get?.(dept as any) || (reqSummary.find(r => r.department === dept) ?? null);
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
    const file = e.target.files?.[0];
    if (!file || !department) return;

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
      if (dbError) throw dbError;

      // Update local documents state immediately
      if (inserted) {
        setDocuments(prev => Array.isArray(prev) ? [...prev, inserted] : [inserted]);
      }

      // Broadcast push: new document uploaded
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'document.uploaded', job_id: job.id, file_name: file.name }
        });
      } catch {}
    } catch (err: any) {
      console.error('Upload error:', err);
    }
  }, [job.id, department]);

  const handleDeleteDocument = useCallback(async (doc: any) => {
    if (doc?.read_only) {
      console.error('Attempted to delete read-only document', doc);
      return;
    }
    if (!window.confirm('Are you sure you want to delete this document?')) return;

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
      setDocuments(prev => Array.isArray(prev) ? prev.filter((d: any) => d.id !== doc.id) : prev);

      // Broadcast push: document deleted
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'document.deleted', job_id: job.id, file_name: doc.file_name }
        });
      } catch {}
    } catch (err: any) {
      console.error('Delete error:', err);
    }
  }, [job.id]);

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
        setDocuments(data || []);
      }

      void refreshAssignments();

      // Invalidate broader queries so the card and list re-fetch
      queryClient.invalidateQueries({ queryKey: ['optimized-jobs'] });
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
