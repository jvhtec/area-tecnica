
import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Department } from "@/types/department";
import { useNavigate } from "react-router-dom";
import { useFolderExistence } from "@/hooks/useFolderExistence";
import { useOptimizedJobCard } from '@/hooks/useOptimizedJobCard';
import { useDeletionState } from '@/hooks/useDeletionState';
import { supabase } from "@/lib/supabase";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { createAllFoldersForJob } from "@/utils/flex-folders";
import { format } from "date-fns";
import { JobCardHeader } from './JobCardHeader';
import { JobCardActions } from './JobCardActions';
import { JobCardAssignments } from './JobCardAssignments';
import { JobCardDocuments, JobDocument } from './JobCardDocuments';
import { JobCardProgress } from './JobCardProgress';
import { SoundTaskDialog } from "@/components/sound/SoundTaskDialog";
import { LightsTaskDialog } from "@/components/lights/LightsTaskDialog";
import { VideoTaskDialog } from "@/components/video/VideoTaskDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export interface JobCardNewProps {
  job: any;
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  showAssignments?: boolean;
  department?: Department;
  userRole?: string | null;
  onDeleteDocument?: (jobId: string, document: JobDocument) => void;
  showUpload?: boolean;
  showManageArtists?: boolean;
  isProjectManagementPage?: boolean;
  hideTasks?: boolean;
}

export function JobCardNew({
  job,
  onEditClick,
  onDeleteClick,
  onJobClick,
  showAssignments = false,
  department = "sound",
  userRole,
  onDeleteDocument,
  showUpload = false,
  showManageArtists = false,
  isProjectManagementPage = false,
  hideTasks = false
}: JobCardNewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addDeletingJob, removeDeletingJob, isDeletingJob } = useDeletionState();
  
  // Add folder creation loading state
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  
  const {
    // Styling
    appliedBorderColor,
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
    
    // Data
    soundTasks,
    personnel,
    
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
    setAssignmentDialogOpen
  } = useOptimizedJobCard(job, department, userRole, onEditClick, onDeleteClick, onJobClick);

  // Check folder existence with proper loading state handling
  const { data: foldersExist, isLoading: isFoldersLoading } = useFolderExistence(job.id);
  
  // Updated logic: prioritize actual folder existence over database flags
  const actualFoldersExist = foldersExist === true;
  const systemThinksFoldersExist = job.flex_folders_created || job.flex_folders_exist;
  
  // Detect inconsistency for logging/debugging
  const hasInconsistency = systemThinksFoldersExist && !actualFoldersExist;
  if (hasInconsistency) {
    console.warn("JobCardNew: Folder state inconsistency detected for job", job.id, {
      systemThinks: systemThinksFoldersExist,
      actualExists: actualFoldersExist,
      dbFlag: job.flex_folders_created,
      flexFoldersExist: job.flex_folders_exist
    });
  }
  
  // Final decision: only consider folders created if they actually exist
  const foldersAreCreated = actualFoldersExist;

  // Optimistic delete handler with instant UI feedback
  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check if already being deleted
    if (isJobBeingDeleted) {
      console.log("JobCardNew: Job deletion already in progress");
      return;
    }
    
    // Check permissions
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
      console.log("JobCardNew: Starting optimistic job deletion for:", job.id);
      
      // Mark job as being deleted for immediate visual feedback
      addDeletingJob(job.id);
      
      // Call optimistic deletion service
      const result = await deleteJobOptimistically(job.id);
      
      if (result.success) {
        toast({
          title: "Job deleted",
          description: result.details || "The job has been removed and cleanup is running in background."
        });
        
        // Call the parent's onDeleteClick to handle any additional UI updates
        onDeleteClick(job.id);
        
        // Invalidate queries to refresh the list
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
        await queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("JobCardNew: Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      // Always remove from deletion state, even on error
      removeDeletingJob(job.id);
    }
  };

  const createFlexFoldersHandler = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isCreatingFolders) {
      console.log("JobCardNew: Folder creation already in progress");
      return;
    }

    console.log("JobCardNew: Starting sophisticated folder creation for job:", job.id);

    if (actualFoldersExist) {
      console.log("JobCardNew: Folders actually exist, preventing creation");
      toast({
        title: "Folders already created",
        description: "Flex folders have already been created for this job.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreatingFolders(true);

      // Double-check in the database before creating
      const { data: existingFolders } = await supabase
        .from("flex_folders")
        .select("id")
        .eq("job_id", job.id)
        .limit(1);

      if (existingFolders && existingFolders.length > 0) {
        console.log("JobCardNew: Found existing folders in final check:", existingFolders);
        toast({
          title: "Folders already exist",
          description: "Flex folders have already been created for this job.",
          variant: "destructive"
        });
        return;
      }

      // Use the restored sophisticated flex folder creation system
      const startDate = new Date(job.start_time);
      const endDate = new Date(job.end_time);
      const formattedStartDate = format(startDate, 'yyyy-MM-dd');
      const formattedEndDate = format(endDate, 'yyyy-MM-dd');
      const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, "");

      toast({
        title: "Creating folders...",
        description: "Setting up sophisticated Flex folder structure for this job."
      });

      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);

      toast({
        title: "Success!",
        description: "Flex folders have been created successfully with proper configuration."
      });

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["folder-existence"] });

    } catch (error: any) {
      console.error("JobCardNew: Error creating sophisticated flex folders:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create Flex folders",
        variant: "destructive"
      });
    } finally {
      setIsCreatingFolders(false);
    }
  };

  const handleJobCardClick = () => {
    if (isHouseTech || isJobBeingDeleted) {
      return; // Block job card clicks for house techs or jobs being deleted
    }
    
    if (isProjectManagementPage) {
      if (department === "sound") {
        setSoundTaskDialogOpen(true);
      } else if (department === "lights") {
        setLightsTaskDialogOpen(true);
      } else if (department === "video") {
        setVideoTaskDialogOpen(true);
      }
    } else {
      if (userRole !== "logistics" && onJobClick) {
        onJobClick(job.id);
      }
    }
  };

  const handleFestivalArtistsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isJobBeingDeleted) return;
    console.log("JobCardNew: Navigating to festival management:", job.id);
    navigate(`/festival-management/${job.id}`);
  };

  // Show loading state if job is being deleted
  const cardOpacity = isJobBeingDeleted ? "opacity-50" : "";
  const pointerEvents = isJobBeingDeleted ? "pointer-events-none" : "";

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900">
      <Card
        className={cn(
          "mb-4 hover:shadow-md transition-all duration-200",
          !isHouseTech && !isJobBeingDeleted && "cursor-pointer",
          cardOpacity,
          pointerEvents
        )}
        onClick={handleJobCardClick}
        style={{
          borderLeftColor: appliedBorderColor,
          backgroundColor: appliedBgColor
        }}
      >
        {isJobBeingDeleted && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10 rounded">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-md shadow-lg">
              <span className="text-sm font-medium">Deleting job...</span>
            </div>
          </div>
        )}

        <JobCardHeader 
          job={job}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          appliedBorderColor={appliedBorderColor}
          appliedBgColor={appliedBgColor}
          dateTypes={dateTypes}
          department={department}
        />

        <div className="flex items-center justify-between px-6">
          <div className="flex-1"></div>
          <JobCardActions 
            job={job}
            userRole={userRole || null}
            foldersAreCreated={foldersAreCreated || isFoldersLoading}
            isProjectManagementPage={isProjectManagementPage}
            isHouseTech={isHouseTech}
            showUpload={showUpload}
            canEditJobs={canEditJobs}
            canCreateFlexFolders={canCreateFlexFolders}
            canUploadDocuments={canUploadDocuments}
            canManageArtists={canManageArtists}
            isCreatingFolders={isCreatingFolders}
            currentFolderStep=""
            onRefreshData={refreshData}
            onEditButtonClick={handleEditButtonClick}
            onDeleteClick={handleDeleteClick}
            onCreateFlexFolders={createFlexFoldersHandler}
            onFestivalArtistsClick={handleFestivalArtistsClick}
            onAssignmentDialogOpen={(e) => {
              e.stopPropagation();
              if (!isJobBeingDeleted) {
                setAssignmentDialogOpen(true);
              }
            }}
            handleFileUpload={handleFileUpload}
          />
        </div>

        <div className="px-6 pb-6">
          <div className="space-y-2 text-sm">
            {job.job_type !== "dryhire" && (
              <>
                {assignments.length > 0 && (
                  <JobCardAssignments 
                    assignments={assignments} 
                    department={department} 
                  />
                )}
                
                {documents.length > 0 && (
                  <JobCardDocuments 
                    documents={documents} 
                    userRole={userRole}
                    onDeleteDocument={handleDeleteDocument}
                  />
                )}
              </>
            )}
          </div>

          {!collapsed && job.job_type !== "dryhire" && !hideTasks && (
            <JobCardProgress 
              soundTasks={soundTasks} 
              personnel={personnel}
            />
          )}
        </div>
      </Card>

      {!isHouseTech && !isJobBeingDeleted && (
        <>
          {soundTaskDialogOpen && (
            <SoundTaskDialog
              open={soundTaskDialogOpen}
              onOpenChange={setSoundTaskDialogOpen}
              jobId={job.id}
            />
          )}
          {lightsTaskDialogOpen && (
            <LightsTaskDialog
              open={lightsTaskDialogOpen}
              onOpenChange={setLightsTaskDialogOpen}
              jobId={job.id}
            />
          )}
          {videoTaskDialogOpen && (
            <VideoTaskDialog
              open={videoTaskDialogOpen}
              onOpenChange={setVideoTaskDialogOpen}
              jobId={job.id}
            />
          )}
          {editJobDialogOpen && (
            <EditJobDialog
              open={editJobDialogOpen}
              onOpenChange={setEditJobDialogOpen}
              job={job}
            />
          )}
          {assignmentDialogOpen && job.job_type !== "dryhire" && (
            <JobAssignmentDialog
              isOpen={assignmentDialogOpen}
              onClose={() => setAssignmentDialogOpen(false)}
              onAssignmentChange={() => {}}
              jobId={job.id}
              department={department as Department}
            />
          )}
        </>
      )}
    </div>
  );
}

export type { JobDocument } from './JobCardDocuments';
