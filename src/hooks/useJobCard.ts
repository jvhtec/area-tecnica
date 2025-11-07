import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { JobDocument } from '@/components/jobs/cards/JobCardDocuments';
import { Department } from '@/types/department';
import { useDeletionState } from './useDeletionState';
import { resolveJobDocLocation } from '@/utils/jobDocuments';

export const useJobCard = (job: any, department: Department, userRole: string | null, onEditClick?: (job: any) => void, onDeleteClick?: (jobId: string) => void, onJobClick?: (jobId: string) => void) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { isDeletingJob } = useDeletionState();

  // Card styling
  const borderColor = job.color ? job.color : "#7E69AB";
  const appliedBorderColor = isDark ? (job.darkColor ? job.darkColor : borderColor) : borderColor;
  const bgColor = job.color ? `${job.color}05` : "#7E69AB05";
  const appliedBgColor = isDark ? (job.darkColor ? `${job.darkColor}15` : bgColor) : bgColor;

  // State
  const [collapsed, setCollapsed] = useState(true);
  const [assignments, setAssignments] = useState(job.job_assignments || []);
  const [documents, setDocuments] = useState<JobDocument[]>(job.job_documents || []);
  const [dateTypes, setDateTypes] = useState<Record<string, any>>({});
  const [soundTaskDialogOpen, setSoundTaskDialogOpen] = useState(false);
  const [lightsTaskDialogOpen, setLightsTaskDialogOpen] = useState(false);
  const [videoTaskDialogOpen, setVideoTaskDialogOpen] = useState(false);
  const [editJobDialogOpen, setEditJobDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);

  // Role-based permissions
  const isHouseTech = userRole === 'house_tech';
  const canEditJobs = ['admin', 'management', 'logistics'].includes(userRole || '');
  const canManageArtists = ['admin', 'management', 'logistics', 'technician', 'house_tech'].includes(userRole || '');
  const canUploadDocuments = ['admin', 'management', 'logistics'].includes(userRole || '');
  const canCreateFlexFolders = ['admin', 'management', 'logistics'].includes(userRole || '');

  // Check if this job is being deleted to prevent queries
  const isJobBeingDeleted = isDeletingJob(job.id);

  // Optimized date types fetch - only if not already loaded
  useEffect(() => {
    if (!job.job_date_types && !isJobBeingDeleted) {
      async function fetchDateTypes() {
        const { data, error } = await supabase
          .from("job_date_types")
          .select("*")
          .eq("job_id", job.id);
        if (!error && data && data.length > 0) {
          const key = `${job.id}-${new Date(job.start_time).toISOString().split('T')[0]}`;
          setDateTypes({ [key]: data[0] });
        }
      }
      fetchDateTypes();
    } else if (job.job_date_types) {
      // Use pre-loaded data
      const processedDateTypes = job.job_date_types.reduce((acc: any, dt: any) => {
        const key = `${job.id}-${dt.date}`;
        acc[key] = dt;
        return acc;
      }, {});
      setDateTypes(processedDateTypes);
    }
  }, [job.id, job.start_time, job.job_date_types, isJobBeingDeleted]);

  // Use pre-loaded data when available
  const soundTasks = job.tasks?.sound || job.sound_job_tasks;
  const personnel = job.personnel?.sound || job.sound_job_personnel?.[0];

  // Fallback queries only when data not pre-loaded
  const shouldFetchSoundData = department === "sound" && !job.tasks?.sound && !isJobBeingDeleted;
  
  const { data: fallbackSoundTasks } = useQuery({
    queryKey: ["sound-tasks", job.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sound_job_tasks")
        .select(`
          *,
          assigned_to (
            first_name,
            last_name
          ),
          task_documents(*)
        `)
        .eq("job_id", job.id);
      if (error) throw error;
      return data;
    },
    enabled: shouldFetchSoundData,
    retry: 2,
    retryDelay: 1000,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  const { data: fallbackPersonnel } = useQuery({
    queryKey: ["sound-personnel", job.id],
    queryFn: async () => {
      const { data: existingData, error: fetchError } = await supabase
        .from("sound_job_personnel")
        .select("*")
        .eq("job_id", job.id)
        .maybeSingle();
      if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
      if (!existingData) {
        const { data: newData, error: insertError } = await supabase
          .from("sound_job_personnel")
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
    enabled: shouldFetchSoundData,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  // Update folder status mutation
  const updateFolderStatus = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("jobs")
        .update({ flex_folders_created: true })
        .eq("id", job.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
  });

  // Event handlers
  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(!collapsed);
  };

  const handleEditButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditClick) {
      onEditClick(job);
    } else {
      setEditJobDialogOpen(true);
    }
  };

  // Remove the duplicate deletion handler - use only the centralized one from JobCardNew
  // This prevents race conditions and ensures consistency

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file || !department) return;

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${department}/${job.id}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("job_documents")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("job_documents")
        .insert({
          job_id: job.id,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          original_type: null
        });
      if (dbError) throw dbError;

      // Broadcast push: new document uploaded
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'document.uploaded', job_id: job.id, file_name: file.name }
        });
      } catch {}

      queryClient.invalidateQueries({ queryKey: ["jobs"] });

      toast({
        title: "Document uploaded",
        description: "The document has been successfully uploaded."
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteDocument = async (doc: JobDocument) => {
    if (doc.read_only) {
      toast({
        title: "Cannot delete read-only document",
        description: "Template documents are attached automatically and cannot be removed manually.",
        variant: "destructive",
      });
      return;
    }

    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      console.log("useJobCard: Starting document deletion:", doc);
      const { bucket, path } = resolveJobDocLocation(doc.file_path);
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .remove([path]);
      
      if (storageError) {
        console.error("Storage deletion error:", storageError);
        throw storageError;
      }

      const { error: dbError } = await supabase
        .from("job_documents")
        .delete()
        .eq("id", doc.id);
      
      if (dbError) {
        console.error("Database deletion error:", dbError);
        throw dbError;
      }

      queryClient.invalidateQueries({ queryKey: ["jobs"] });

      toast({
        title: "Document deleted",
        description: "The document has been successfully deleted."
      });

      // Broadcast push: document deleted
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'document.deleted', job_id: job.id, file_name: doc.file_name }
        });
      } catch {}
    } catch (err: any) {
      console.error("Error in handleDeleteDocument:", err);
      toast({
        title: "Error deleting document",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  const refreshData = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isJobBeingDeleted) return; // Don't refresh if job is being deleted
    
    await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    await queryClient.invalidateQueries({ queryKey: ["sound-tasks", job.id] });
    await queryClient.invalidateQueries({ queryKey: ["sound-personnel", job.id] });

    toast({
      title: "Data refreshed",
      description: "The job information has been updated."
    });
  };

  // Sync with job prop updates
  useEffect(() => {
    setAssignments(job.job_assignments || []);
  }, [job.job_assignments]);

  useEffect(() => {
    setDocuments(job.job_documents || []);
  }, [job.job_documents]);

  return {
    // Styling
    borderColor,
    appliedBorderColor,
    bgColor, 
    appliedBgColor,
    
    // State
    collapsed,
    assignments,
    documents,
    dateTypes,
    soundTaskDialogOpen,
    lightsTaskDialogOpen,
    videoTaskDialogOpen,
    editJobDialogOpen,
    assignmentDialogOpen,
    isJobBeingDeleted,
    
    // Data - use pre-loaded or fallback
    soundTasks: soundTasks || fallbackSoundTasks,
    personnel: personnel || fallbackPersonnel,
    
    // Permissions
    isHouseTech,
    canEditJobs,
    canManageArtists,
    canUploadDocuments,
    canCreateFlexFolders,
    
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
    setAssignmentDialogOpen,

    // Folder handling
    updateFolderStatus
  };
};
