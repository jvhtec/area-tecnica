
import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { createQueryKey } from '@/lib/optimized-react-query';

export const useOptimizedJobCard = (
  job: any,
  department: string,
  userRole: string | null,
  onEditClick: (job: any) => void,
  onDeleteClick: (jobId: string) => void,
  onJobClick: (jobId: string) => void
) => {
  const { theme } = useTheme();
  
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
            .select(`*, profiles(first_name, last_name)`) 
            .eq('job_id', job.id);
          if (!error) {
            setAssignments(data || []);
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

  // Optimized personnel query
  const { data: personnel } = useQuery({
    queryKey: [...createQueryKey.tasks.byDepartment('sound', job.id), 'personnel'],
    queryFn: async () => {
      if (department !== 'sound') return null;
      const { data: existingData, error: fetchError } = await supabase
        .from('sound_job_personnel')
        .select('*')
        .eq('job_id', job.id)
        .maybeSingle();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      if (!existingData) {
        const { data: newData, error: insertError } = await supabase
          .from('sound_job_personnel')
          .insert({
            job_id: job.id,
            foh_engineers: 0,
            mon_engineers: 0,
            pa_techs: 0,
            rf_techs: 0
          })
          .select()
          .single();
        if (insertError) throw insertError;
        return newData;
      }
      return existingData;
    },
    enabled: department === 'sound',
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

      const { error: dbError } = await supabase
        .from('job_documents')
        .insert({
          job_id: job.id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size
        });
      if (dbError) throw dbError;

      // Optimized query invalidation
      // queryClient.invalidateQueries({ queryKey: createQueryKey.jobs.detail(job.id) });
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

      // Optimized query invalidation
      // queryClient.invalidateQueries({ queryKey: createQueryKey.jobs.detail(job.id) });
    } catch (err: any) {
      console.error('Delete error:', err);
    }
  }, [job.id]);

  const refreshData = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Implement optimized refresh logic here
  }, [job.id]);

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
