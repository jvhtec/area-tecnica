
import React from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Edit, Trash2, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

interface JobOptionsContextMenuProps {
  children: React.ReactNode;
  jobId: string;
  onEditJob: () => void;
  onDeleteJob: () => void;
  onCreateFlexFolders: () => void;
  flexFoldersExist: boolean;
  userRole?: string | null;
}

export const JobOptionsContextMenu = ({ 
  children, 
  jobId, 
  onEditJob,
  onDeleteJob,
  onCreateFlexFolders,
  flexFoldersExist,
  userRole
}: JobOptionsContextMenuProps) => {
  const queryClient = useQueryClient();
  
  // Check permissions
  const canEditJobs = ['admin', 'management', 'logistics'].includes(userRole || '');
  const canDeleteJobs = ['admin', 'management'].includes(userRole || '');
  const canCreateFolders = ['admin', 'management', 'logistics'].includes(userRole || '');
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onEditJob();
  };
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!canDeleteJobs) {
      toast.error("You don't have permission to delete jobs");
      return;
    }
    onDeleteJob();
  };
  
  const handleCreateFoldersClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (flexFoldersExist) {
      toast.error("Folders already exist for this job");
      return;
    }
    onCreateFlexFolders();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {canEditJobs && (
          <ContextMenuItem onClick={handleEditClick} className="flex items-center gap-2">
            <Edit className="h-4 w-4" /> Edit Job
          </ContextMenuItem>
        )}
        {canDeleteJobs && (
          <ContextMenuItem onClick={handleDeleteClick} className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Delete Job
          </ContextMenuItem>
        )}
        {canCreateFolders && (
          <ContextMenuItem 
            onClick={handleCreateFoldersClick} 
            disabled={flexFoldersExist}
            className={flexFoldersExist ? "opacity-50 cursor-not-allowed flex items-center gap-2" : "flex items-center gap-2"}
          >
            <FolderPlus className="h-4 w-4" /> Create Flex Folders
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
