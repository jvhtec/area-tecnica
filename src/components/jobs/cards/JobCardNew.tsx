
import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Department } from "@/types/department";
import { useNavigate } from "react-router-dom";
import { useFolderExistence } from "@/hooks/useFolderExistence";
import { useJobCard } from '@/hooks/useJobCard';
import { createAllFoldersForJob } from "@/utils/flex-folders";
import { supabase } from "@/lib/supabase";
import { deleteJobComprehensively } from "@/services/jobDeletionService";
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
    setAssignmentDialogOpen,
    
    // Folder handling
    updateFolderStatus
  } = useJobCard(job, department, userRole, onEditClick, onDeleteClick, onJobClick);

  // Check folder existence
  const { data: foldersExist } = useFolderExistence(job.id);
  const foldersAreCreated = job.flex_folders_created || foldersExist || job.flex_folders_exist;

  // Updated delete handler using the centralized service
  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone and will remove all related data.')) {
      return;
    }

    try {
      console.log("Starting job deletion from JobCardNew:", job.id);
      
      const result = await deleteJobComprehensively(job.id);
      
      if (result.success) {
        toast({
          title: "Job deleted successfully",
          description: result.details || "The job and all related records have been removed."
        });
        
        // Call the parent's onDeleteClick to handle any additional UI updates
        onDeleteClick(job.id);
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("Error deleting job:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const createFlexFoldersHandler = async (e: React.MouseEvent) => {
    e.stopPropagation();

    console.log("Folder existence check:", {
      jobId: job.id,
      flexFoldersCreated: job.flex_folders_created,
      foldersExist,
      flexFoldersExist: job.flex_folders_exist,
      combined: foldersAreCreated
    });

    if (foldersAreCreated) {
      console.log("Folders already exist, preventing creation");
      toast({
        title: "Folders already created",
        description: "Flex folders have already been created for this job.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log("Starting folder creation for job:", job.id);

      const { data: existingFolders } = await supabase
        .from("flex_folders")
        .select("id")
        .eq("job_id", job.id)
        .limit(1);

      if (existingFolders && existingFolders.length > 0) {
        console.log("Found existing folders in final check:", existingFolders);
        toast({
          title: "Folders already exist",
          description: "Flex folders have already been created for this job.",
          variant: "destructive"
        });
        return;
      }

      const startDate = new Date(job.start_time);
      const documentNumber = startDate
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");

      const formattedStartDate = new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
      const formattedEndDate = new Date(job.end_time).toISOString().split(".")[0] + ".000Z";

      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);
      await updateFolderStatus.mutateAsync();

      console.log("Successfully created folders for job:", job.id);
      toast({
        title: "Success",
        description: "Flex folders have been created successfully."
      });
    } catch (error: any) {
      console.error("Error creating Flex folders:", error);
      toast({
        title: "Error creating folders",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleJobCardClick = () => {
    if (isHouseTech) {
      return; // Block job card clicks for house techs
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
    console.log("Navigating to festival management:", job.id);
    navigate(`/festival-management/${job.id}`);
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900">
      <Card
        className={cn(
          "mb-4 hover:shadow-md transition-all duration-200",
          !isHouseTech && "cursor-pointer"
        )}
        onClick={handleJobCardClick}
        style={{
          borderLeftColor: appliedBorderColor,
          backgroundColor: appliedBgColor
        }}
      >
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
            foldersAreCreated={foldersAreCreated}
            isProjectManagementPage={isProjectManagementPage}
            isHouseTech={isHouseTech}
            showUpload={showUpload}
            canEditJobs={canEditJobs}
            canCreateFlexFolders={canCreateFlexFolders}
            canUploadDocuments={canUploadDocuments}
            canManageArtists={canManageArtists}
            onRefreshData={refreshData}
            onEditButtonClick={handleEditButtonClick}
            onDeleteClick={handleDeleteClick}
            onCreateFlexFolders={createFlexFoldersHandler}
            onFestivalArtistsClick={handleFestivalArtistsClick}
            onAssignmentDialogOpen={(e) => {
              e.stopPropagation();
              setAssignmentDialogOpen(true);
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

      {!isHouseTech && (
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
              open={assignmentDialogOpen}
              onOpenChange={setAssignmentDialogOpen}
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
