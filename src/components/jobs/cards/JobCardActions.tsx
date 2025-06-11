import React from 'react';
import { Button } from "@/components/ui/button";
import createFolderIcon from "@/assets/icons/icon.png";
import { Edit, Trash2, Upload, RefreshCw, Users, Loader2 } from "lucide-react";

interface JobCardActionsProps {
  job: any;
  userRole: string | null;
  foldersAreCreated: boolean;
  isProjectManagementPage: boolean;
  isHouseTech: boolean;
  showUpload: boolean;
  canEditJobs: boolean;
  canCreateFlexFolders: boolean;
  canUploadDocuments: boolean;
  canManageArtists: boolean;
  isCreatingFolders?: boolean;
  onRefreshData: (e: React.MouseEvent) => void;
  onEditButtonClick: (e: React.MouseEvent) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  onCreateFlexFolders: (e: React.MouseEvent) => void;
  onFestivalArtistsClick: (e: React.MouseEvent) => void;
  onAssignmentDialogOpen: (e: React.MouseEvent) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const JobCardActions: React.FC<JobCardActionsProps> = ({
  job,
  userRole,
  foldersAreCreated,
  isProjectManagementPage,
  isHouseTech,
  showUpload,
  canEditJobs,
  canCreateFlexFolders,
  canUploadDocuments,
  canManageArtists,
  isCreatingFolders = false,
  onRefreshData,
  onEditButtonClick,
  onDeleteClick,
  onCreateFlexFolders,
  onFestivalArtistsClick,
  onAssignmentDialogOpen,
  handleFileUpload
}) => {
  return (
    <div className="flex flex-wrap gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      {job.job_type === "festival" && isProjectManagementPage && canManageArtists && (
        <Button
          variant="outline"
          size="sm"
          onClick={onFestivalArtistsClick}
          className="hover:bg-accent/50"
        >
          {userRole === 'technician' || userRole === 'house_tech' ? 'View Festival' : 'Manage Festival'}
        </Button>
      )}
      {!isHouseTech && job.job_type !== "dryhire" && isProjectManagementPage && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAssignmentDialogOpen}
          className="hover:bg-accent/50"
        >
          <Users className="h-4 w-4 mr-2" />
          Assign
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRefreshData}
        title="Refresh"
        className="hover:bg-accent/50"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      {canEditJobs && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEditButtonClick}
            title="Edit job details"
            className="hover:bg-accent/50"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDeleteClick}
            className="hover:bg-accent/50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
      {canCreateFlexFolders && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreateFlexFolders}
          disabled={foldersAreCreated || isCreatingFolders}
          title={
            isCreatingFolders
              ? "Creating folders..."
              : foldersAreCreated
              ? "Folders already exist"
              : "Create Flex folders"
          }
          className={
            foldersAreCreated || isCreatingFolders
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-accent/50"
          }
        >
          {isCreatingFolders ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <img src={createFolderIcon} alt="Create Flex folders" className="h-4 w-4" />
          )}
        </Button>
      )}
      {job.job_type !== "dryhire" && showUpload && canUploadDocuments && (
        <div className="relative">
          <input
            type="file"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onClick={(ev) => ev.stopPropagation()}
          />
          <Button variant="ghost" size="icon" className="hover:bg-accent/50">
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
