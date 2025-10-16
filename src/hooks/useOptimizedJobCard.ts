
import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'next-themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { createQueryKey } from '@/lib/optimized-react-query';
import { useRequiredRoleSummary } from '@/hooks/useJobRequiredRoles';

export const useOptimizedJobCard = (
  job: any,
  department: string,
  userRole: string | null,
  onEditClick: (job: any) => void,
  onDeleteClick: (jobId: string) => void,
  onJobClick: (jobId: string) => void
) => {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  
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
    setAssignments(job.job_assignments || []);
  }, [job.job_assignments]);

  useEffect(() => {
    setDocuments(job.job_documents || []);
  }, [job.job_documents]);

  // Realtime: subscribe to assignment changes for this job and refresh local state instantly
  useEffect(() => {
    if (!job?.id) return;
    const channel = supabase
      .channel(`job-card-assignments-${job.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_assignments',
        filter: `job_id=eq.${job.id}`,
      }, async () => {
        try {
          const { data, error } = await supabase
            .from('job_assignments')
            .select(`*, profiles(first_name, nickname, last_name)`) 
            .eq('job_id', job.id);
          if (!error) {
            setAssignments(data || []);
          }
        } catch {}
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_documents',
        filter: `job_id=eq.${job.id}`,
      }, async () => {
        try {
          const { data, error } = await supabase
            .from('job_documents')
            .select('*')
            .eq('job_id', job.id)
            .order('uploaded_at', { ascending: false });
          if (!error) {
            setDocuments(data || []);
          }
        } catch {}
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [job?.id]);

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
  const { data: reqSummary = [], byDepartment: reqByDept } = useRequiredRoleSummary(job?.id);

  // Compute assigned counts per department and per role code (for comparisons)
  const assignedMetrics = useMemo(() => {
    const countsByDept: Record<string, number> = { sound: 0, lights: 0, video: 0 } as any;
    const countsByRole: Record<string, number> = {};
    const rows = Array.isArray(assignments) ? assignments : [];
    for (const a of rows) {
      if (a.sound_role) {
        countsByDept.sound = (countsByDept.sound || 0) + 1;
        countsByRole[a.sound_role] = (countsByRole[a.sound_role] || 0) + 1;
      }
      if (a.lights_role) {
        countsByDept.lights = (countsByDept.lights || 0) + 1;
        countsByRole[a.lights_role] = (countsByRole[a.lights_role] || 0) + 1;
      }
      if (a.video_role) {
        countsByDept.video = (countsByDept.video || 0) + 1;
        countsByRole[a.video_role] = (countsByRole[a.video_role] || 0) + 1;
      }
    }
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
    enabled: department === 'sound',
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Optimized personnel query - get actual personnel/profiles data
  const { data: personnel } = useQuery({
    queryKey: ['personnel', job.id, department],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });
      
      if (error) throw error;
      // Add a computed display_name to keep existing consumers working
      const withDisplay = (profiles || []).map((p: any) => ({
        ...p,
        display_name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
      }));
      return withDisplay;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for personnel data
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
          file_size: file.size
        })
        .select('*')
        .single();
      if (dbError) throw dbError;

      // Update local documents state immediately
      if (inserted) {
        setDocuments(prev => Array.isArray(prev) ? [...prev, inserted] : [inserted]);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
    }
  }, [job.id, department]);

  const handleDeleteDocument = useCallback(async (doc: any) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const { error: storageError } = await supabase.storage
        .from('job_documents')
        .remove([doc.file_path]);
      
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('job_documents')
        .delete()
        .eq('id', doc.id);
      
      if (dbError) throw dbError;

      // Update local documents state immediately
      setDocuments(prev => Array.isArray(prev) ? prev.filter((d: any) => d.id !== doc.id) : prev);
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

      // Invalidate broader queries so the card and list re-fetch
      queryClient.invalidateQueries({ queryKey: ['optimized-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['personnel', job.id, department] });
    } catch (err) {
      console.error('Refresh error:', err);
    }
  }, [job.id, department, queryClient]);

  // Memoized deletion state check
  const isJobBeingDeleted = useMemo(() => {
    // This would connect to deletion state context
    return false;
  }, [job.id]);

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
    isJobBeingDeleted,
    
    // Data
    soundTasks,
    personnel,
    
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
