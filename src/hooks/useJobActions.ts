import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useDeletionState } from "@/hooks/useDeletionState";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { createAllFoldersForJob } from "@/utils/flex-folders";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { createSafeFolderName, sanitizeFolderName } from "@/utils/folderNameSanitizer";

export const useJobActions = (job: any, userRole: string | null, onDeleteClick?: (jobId: string) => void) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addDeletingJob, removeDeletingJob, isDeletingJob } = useDeletionState();
  
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  const [isCreatingLocalFolders, setIsCreatingLocalFolders] = useState(false);
  
  const isJobBeingDeleted = isDeletingJob(job.id);

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isJobBeingDeleted) {
      console.log("useJobActions: Job deletion already in progress");
      return;
    }
    
    if (!["admin", "management"].includes(userRole || "")) {
      toast({
        title: "Permission denied",
        description: "Only admin and management users can delete jobs",
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone and will remove all related data.')) {
      return;
    }

    try {
      console.log("useJobActions: Starting optimistic job deletion for:", job.id);
      
      addDeletingJob(job.id);
      
      const result = await deleteJobOptimistically(job.id);
      
      if (result.success) {
        toast({
          title: "Job deleted",
          description: result.details || "The job has been removed and cleanup is running in background."
        });
        
        if (onDeleteClick) {
          onDeleteClick(job.id);
        }
        
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
        await queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("useJobActions: Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      removeDeletingJob(job.id);
    }
  };

  const createFlexFoldersHandler = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isCreatingFolders) {
      console.log("useJobActions: Folder creation already in progress");
      return;
    }

    console.log("useJobActions: Starting folder creation for job:", job.id);

    try {
      setIsCreatingFolders(true);

      // Check if folders already exist - createAllFoldersForJob is NOT fully idempotent
      // and will create duplicates if run again (e.g., hojaInfo elements are created
      // unconditionally without checking for existing flex_folders rows)
      const { data: existingFolders } = await supabase
        .from("flex_folders")
        .select("id")
        .eq("job_id", job.id)
        .limit(1);

      if (existingFolders && existingFolders.length > 0) {
        console.log("useJobActions: Found existing folders, guiding user to add mode:", existingFolders);
        toast({
          title: "Folders already exist",
          description: "To add more folders or elements to this job, use the 'Add Folders' button (+ icon) instead.",
        });
        return;
      }

      const startDate = new Date(job.start_time);
      const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, "");

      const formattedStartDate = new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
      const formattedEndDate = new Date(job.end_time).toISOString().split(".")[0] + ".000Z";

      toast({
        title: "Creating folders...",
        description: "Setting up Flex folder structure for this job."
      });

      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ flex_folders_created: true })
        .eq('id', job.id);

      if (updateError) {
        console.error("Error updating job record:", updateError);
      }

      // Broadcast push: Flex folders created for job
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'flex.folders.created', job_id: job.id }
        });
      } catch {}

      toast({
        title: "Success!",
        description: "Flex folders have been created successfully."
      });

      queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["folder-existence"] });

    } catch (error: any) {
      console.error("useJobActions: Error creating flex folders:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create Flex folders",
        variant: "destructive"
      });
    } finally {
      setIsCreatingFolders(false);
    }
  };

  const createLocalFoldersHandler = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isCreatingLocalFolders) {
      console.log("useJobActions: Local folder creation already in progress");
      return;
    }

    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      toast({
        title: "Not supported",
        description: "Your browser doesn't support local folder creation. Please use Chrome, Edge, or another Chromium-based browser.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreatingLocalFolders(true);

      // Ask user to pick a base folder
      const baseDirHandle = await window.showDirectoryPicker();

      // Format the start date as yymmdd
      const startDate = new Date(job.start_time);
      const formattedDate = format(startDate, "yyMMdd");
      
      // Create safe folder name
      const { name: rootFolderName, wasSanitized } = createSafeFolderName(job.title, formattedDate);
      
      if (wasSanitized) {
        console.log('useJobActions: Folder name was sanitized for safety:', { original: `${formattedDate} - ${job.title}`, sanitized: rootFolderName });
      }

      // Create root folder
      const rootDirHandle = await baseDirHandle.getDirectoryHandle(rootFolderName, { create: true });

      // Get current user's custom folder structure or use default
      const { data: { user } } = await supabase.auth.getUser();
      let folderStructure = null;
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('custom_folder_structure, role')
          .eq('id', user.id)
          .single();
        
        // Only use custom structure for management users
        if (profile && (profile.role === 'admin' || profile.role === 'management') && profile.custom_folder_structure) {
          folderStructure = profile.custom_folder_structure;
        }
      }
      
      // Default structure if no custom one exists
      if (!folderStructure) {
        folderStructure = [
          "CAD",
          "QT", 
          "Material",
          "Documentación",
          "Rentals",
          "Compras",
          "Rider",
          "Predicciones"
        ];
      }
      
      // Create folders based on structure
      if (Array.isArray(folderStructure)) {
        for (const folder of folderStructure) {
          if (typeof folder === 'string') {
            // Simple string structure
            const safeFolderName = sanitizeFolderName(folder);
            const subDirHandle = await rootDirHandle.getDirectoryHandle(safeFolderName, { create: true });
            await subDirHandle.getDirectoryHandle("OLD", { create: true });
          } else if (folder && typeof folder === 'object' && folder.name) {
            // Object structure with subfolders
            const safeFolderName = sanitizeFolderName(folder.name);
            const subDirHandle = await rootDirHandle.getDirectoryHandle(safeFolderName, { create: true });
            
            // Create subfolders if they exist
            if (folder.subfolders && Array.isArray(folder.subfolders)) {
              for (const subfolder of folder.subfolders) {
                const safeSubfolderName = sanitizeFolderName(subfolder);
                await subDirHandle.getDirectoryHandle(safeSubfolderName, { create: true });
              }
            } else {
              // Default to OLD subfolder if no subfolders specified
              await subDirHandle.getDirectoryHandle("OLD", { create: true });
            }
          }
        }
      }

      const isCustom = user && folderStructure !== null;
      toast({
        title: "Success!",
        description: `${isCustom ? 'Custom' : 'Default'} folder structure created at "${rootFolderName}"`
      });

    } catch (error: any) {
      console.error("useJobActions: Error creating local folders:", error);
      if (error.name === 'AbortError') {
        // User cancelled, don't show error
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create local folder structure",
        variant: "destructive"
      });
    } finally {
      setIsCreatingLocalFolders(false);
    }
  };

  return {
    handleDeleteClick,
    createFlexFoldersHandler,
    createLocalFoldersHandler,
    isCreatingFolders,
    isCreatingLocalFolders,
    isJobBeingDeleted
  };
};
