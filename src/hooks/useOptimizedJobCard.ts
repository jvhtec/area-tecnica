
import { useState, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { JobDocument } from '@/components/jobs/cards/JobCardDocuments';
import { Department } from '@/types/department';
import { useDeletionState } from './useDeletionState';

/**
 * Optimized job card hook that reduces redundant queries and subscriptions
 * Replaces useJobCard with better performance and fewer database calls
 */
export const useOptimizedJobCard = (
  job: any, 
  department: Department, 
  userRole: string | null, 
  onEditClick?: (job: any) => void, 
  onDeleteClick?: (jobId: string) => void, 
  onJobClick?: (jobId: string) => void
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { isDeletingJob } = useDeletionState();

  // Memoized styling calculations
  const styling = useMemo(() => {
    const borderColor = job.color ? job.color : "#7E69AB";
    const appliedBorderColor = isDark ? (job.darkColor ? job.darkColor : borderColor) : borderColor;
    const bgColor = job.color ? `${job.color}05` : "#7E69AB05";
    const appliedBgColor = isDark ? (job.darkColor ? `${job.darkColor}15` : bgColor) : bgColor;
    
    return { borderColor, appliedBorderColor, bgColor, appliedBgColor };
  }, [job.color, job.darkColor, isDark]);

  // State management
  const [collapsed, setCollapsed] = useState(true);
  const [soundTaskDialogOpen, setSoundTaskDialogOpen] = useState(false);
  const [lightsTaskDialogOpen, setLightsTaskDialogOpen] = useState(false);
  const [videoTaskDialogOpen, setVideoTaskDialogOpen] = useState(false);
  const [editJobDialogOpen, setEditJobDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);

  // Memoized permissions
  const permissions = useMemo(() => ({
    isHouseTech: userRole === 'house_tech',
    canEditJobs: ['admin', 'management', 'logistics'].includes(userRole || ''),
    canManageArtists: ['admin', 'management', 'logistics', 'technician', 'house_tech'].includes(userRole || ''),
    canUploadDocuments: ['admin', 'management', 'logistics'].includes(userRole || ''),
    canCreateFlexFolders: ['admin', 'management', 'logistics'].includes(userRole || '')
  }), [userRole]);

  // Use pre-loaded data from optimized query instead of separate queries
  // Fixed: Use job.job_assignments instead of job.assignments
  const assignments = job.job_assignments || [];
  const documents = job.job_documents || [];
  const soundTasks = job.tasks?.sound || [];
  const personnel = job.personnel?.sound;
  const dateTypes = job.job_date_types?.reduce((acc: any, dt: any) => {
    const key = `${job.id}-${dt.date}`;
    acc[key] = dt;
    return acc;
  }, {}) || {};

  const isJobBeingDeleted = isDeletingJob(job.id);

  // Update folder status mutation - optimized
  const updateFolderStatus = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("jobs")
        .update({ flex_folders_created: true })
        .eq("id", job.id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Only invalidate specific query keys to avoid unnecessary refetches
      queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });
    }
  });

  // Optimized event handlers
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
          file_size: file.size
        });
      if (dbError) throw dbError;

      // Optimized cache invalidation
      queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });

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
    if (!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      console.log("useOptimizedJobCard: Starting document deletion:", doc);
      
      const { error: storageError } = await supabase.storage
        .from("job_documents")
        .remove([doc.file_path]);
      
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

      queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });

      toast({
        title: "Document deleted",
        description: "The document has been successfully deleted."
      });
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
    if (isJobBeingDeleted) return;
    
    await queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });

    toast({
      title: "Data refreshed",
      description: "The job information has been updated."
    });
  };

  return {
    // Styling
    ...styling,
    
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
    
    // Data (pre-loaded from optimized query)
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
    setAssignmentDialogOpen,

    // Folder handling
    updateFolderStatus
  };
};
