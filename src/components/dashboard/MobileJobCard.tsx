import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Department } from "@/types/department";
import { useNavigate } from "react-router-dom";
import { useOptimizedJobCard } from '@/hooks/useOptimizedJobCard';
import { useJobActions } from '@/hooks/useJobActions';
import { useFolderExistence } from "@/hooks/useFolderExistence";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Users, 
  Clock, 
  FileUp, 
  FolderPlus, 
  HardDrive, 
  RefreshCw, 
  Star,
  Calendar,
  ExternalLink,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SoundTaskDialog } from "@/components/sound/SoundTaskDialog";
import { LightsTaskDialog } from "@/components/lights/LightsTaskDialog";
import { VideoTaskDialog } from "@/components/video/VideoTaskDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { useToast } from "@/hooks/use-toast";
import { useFlexUuidLazy } from "@/hooks/useFlexUuidLazy";
import { useIsMobile } from "@/hooks/use-mobile";

interface MobileJobCardProps {
  job: any;
  department?: Department;
  currentDate: Date;
  onDateTypeChange?: () => void;
  onEditClick?: (job: any) => void;
  onDeleteClick?: (jobId: string) => void;
  onJobClick?: (jobId: string) => void;
}

const DATE_TYPE_OPTIONS = [
  { value: 'travel', label: 'Travel', emoji: '✈️' },
  { value: 'setup', label: 'Setup', emoji: '🔧' },
  { value: 'show', label: 'Show', emoji: '🎭' },
  { value: 'off', label: 'Off', emoji: '😴' },
  { value: 'rehearsal', label: 'Rehearsal', emoji: '🎵' }
];

export function MobileJobCard({
  job,
  department = "sound",
  currentDate,
  onDateTypeChange,
  onEditClick,
  onDeleteClick,
  onJobClick
}: MobileJobCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [dateTypeDialogOpen, setDateTypeDialogOpen] = useState(false);
  const [selectedDateType, setSelectedDateType] = useState<string>('show');
  const isMobile = useIsMobile();
  const { uuid: flexUuid, isLoading: isLoadingFlexUuid, error: flexError, hasChecked, fetchFlexUuid } = useFlexUuidLazy();

  // Get user role
  React.useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        setUserRole(profile?.role || null);
      }
    };
    fetchUserRole();
  }, []);

  const {
    appliedBorderColor,
    appliedBgColor,
    assignments,
    documents,
    dateTypes,
    soundTaskDialogOpen,
    lightsTaskDialogOpen,
    videoTaskDialogOpen,
    editJobDialogOpen,
    assignmentDialogOpen,
    soundTasks,
    personnel,
    isHouseTech,
    canEditJobs,
    canManageArtists,
    canUploadDocuments,
    canCreateFlexFolders,
    handleEditButtonClick,
    handleFileUpload,
    handleDeleteDocument,
    refreshData,
    setSoundTaskDialogOpen,
    setLightsTaskDialogOpen,
    setVideoTaskDialogOpen,
    setEditJobDialogOpen,
    setAssignmentDialogOpen
  } = useOptimizedJobCard(job, department, userRole, onEditClick, onDeleteClick, onJobClick);

  const {
    handleDeleteClick,
    createFlexFoldersHandler,
    createLocalFoldersHandler,
    isCreatingFolders,
    isCreatingLocalFolders,
    isJobBeingDeleted
  } = useJobActions(job, userRole, onDeleteClick);

  // Check folder existence
  const { data: foldersExist, isLoading: isFoldersLoading } = useFolderExistence(job.id);
  const foldersAreCreated = foldersExist === true;

  const dateTypesArray: any[] = Array.isArray(dateTypes)
    ? dateTypes
    : (Array.isArray(job?.job_date_types) ? job.job_date_types : []);

  // Get current date type for this job on the selected date
  const currentDateType = dateTypesArray.find((dt: any) => {
    const dtDate = dt?.date ? new Date(dt.date) : null;
    return !!dtDate && dtDate.toDateString() === currentDate.toDateString();
  });

  const currentTypeValue = currentDateType ? (currentDateType.type || currentDateType.date_type) : undefined;

  const currentDateTypeEmoji = DATE_TYPE_OPTIONS.find(option => 
    option.value === currentTypeValue
  )?.emoji || '🎭';

  const jobTitle = job.title || job.job_name || 'Untitled Job';
  const jobVenue = job.location?.name || job.venue || 'No venue';
  const startTime = job.start_time ? format(new Date(job.start_time), 'HH:mm') : '';
  const endTime = job.end_time ? format(new Date(job.end_time), 'HH:mm') : '';
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : startTime;

  const isFestival = job.job_type === 'festival';

  const handleJobCardClick = () => {
    if (isHouseTech || isJobBeingDeleted) {
      return;
    }
    
    if (userRole !== "logistics" && onJobClick) {
      onJobClick(job.id);
    }
  };

  const handleTimesheetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isJobBeingDeleted) return;
    navigate('/timesheets');
  };

  const handleFestivalArtistsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isJobBeingDeleted) return;
    navigate(`/festival-management/${job.id}`);
  };

  const handleDateTypeChange = async (newType: string) => {
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('job_date_types')
        .upsert({
          job_id: job.id,
          date: dateStr,
          type: newType
        }, {
          onConflict: 'job_id,date'
        });

      if (error) throw error;

      toast({
        title: "Date type updated",
        description: `Set to ${DATE_TYPE_OPTIONS.find(opt => opt.value === newType)?.label}`
      });

      if (onDateTypeChange) {
        onDateTypeChange();
      }
    } catch (error: any) {
      console.error('Error updating date type:', error);
      toast({
        title: "Error",
        description: "Failed to update date type",
        variant: "destructive"
      });
    }
  };

  const handleDateTypeBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDateType(currentDateType?.type || 'show');
    setDateTypeDialogOpen(true);
  };

  // Flex helpers for dropdown menu
  const handleFlexClick = async () => {
    try {
      if (!hasChecked) {
        await fetchFlexUuid(job.id);
        return;
      }

      if (isLoadingFlexUuid) {
        toast({ title: "Loading", description: "Please wait while we load the Flex folder..." });
        return;
      }

      if (flexUuid) {
        const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
        window.open(flexUrl, '_blank', 'noopener');
      } else if (flexError) {
        toast({ title: "Error", description: String(flexError), variant: "destructive" });
      } else {
        toast({ title: "Info", description: "Flex folder not available for this job" });
      }
    } catch (err: any) {
      console.error('Flex navigation error', err);
    }
  };

  const getFlexMenuText = () => {
    if (!hasChecked) return 'Check Flex';
    if (isLoadingFlexUuid) return 'Loading Flex...';
    if (flexUuid) return 'Open Flex';
    return 'Flex';
  };

  const getFlexIcon = () => {
    if (isLoadingFlexUuid) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    return <ExternalLink className="mr-2 h-4 w-4" />;
  };

  return (
    <>
      <Card
        className={cn(
          "mb-3 transition-all duration-200",
          !isHouseTech && !isJobBeingDeleted && "cursor-pointer hover:shadow-md",
          isJobBeingDeleted && "opacity-50 pointer-events-none"
        )}
        onClick={handleJobCardClick}
        style={{
          borderLeftColor: appliedBorderColor,
          backgroundColor: appliedBgColor,
          borderLeftWidth: '4px'
        }}
      >
        {isJobBeingDeleted && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10 rounded">
            <div className="bg-background px-3 py-2 rounded shadow-lg">
              <span className="text-sm font-medium">Deleting job...</span>
            </div>
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Actions menu - moved to left */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  side="bottom" 
                  sideOffset={6} 
                  collisionPadding={16}
                  avoidCollisions={true}
                  className="w-48 bg-popover border shadow-md z-50"
                >
                  <DropdownMenuItem onClick={handleDateTypeBadgeClick}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Change Date Type
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); handleFlexClick(); }}
                    disabled={isLoadingFlexUuid}
                  >
                    {getFlexIcon()}
                    {getFlexMenuText()}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssignmentDialogOpen(true);
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Assign Users
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={handleTimesheetClick}>
                    <Clock className="mr-2 h-4 w-4" />
                    Timesheets
                  </DropdownMenuItem>
                  
                  {isFestival && canManageArtists && (
                    <DropdownMenuItem onClick={handleFestivalArtistsClick}>
                      <Star className="mr-2 h-4 w-4" />
                      Manage Artists
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {canUploadDocuments && (
                    <DropdownMenuItem asChild>
                      <label className="cursor-pointer">
                        <FileUp className="mr-2 h-4 w-4" />
                        Upload Document
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          onChange={handleFileUpload}
                        />
                      </label>
                    </DropdownMenuItem>
                  )}
                  
                  {canCreateFlexFolders && (
                    <DropdownMenuItem 
                      onClick={createFlexFoldersHandler}
                      disabled={isCreatingFolders || isFoldersLoading || foldersAreCreated}
                    >
                      {isCreatingFolders ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FolderPlus className="mr-2 h-4 w-4" />
                      )}
                      {isCreatingFolders ? 'Creating...' : foldersAreCreated ? 'Flex Folders Created' : 'Create Flex Folders'}
                    </DropdownMenuItem>
                  )}
                  
                  {!isMobile && (
                    <DropdownMenuItem 
                      onClick={createLocalFoldersHandler}
                      disabled={isCreatingLocalFolders}
                    >
                      <HardDrive className="mr-2 h-4 w-4" />
                      {isCreatingLocalFolders ? 'Creating...' : 'Create Local Folders'}
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {canEditJobs && (
                    <DropdownMenuItem onClick={handleEditButtonClick}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Job
                    </DropdownMenuItem>
                  )}
                  
                  {["admin", "management"].includes(userRole || "") && (
                    <DropdownMenuItem 
                      onClick={handleDeleteClick}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Job
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex-1 min-w-0 mx-3">
              <h3 className="font-semibold text-sm leading-tight mb-1 truncate">
                {jobTitle}
              </h3>
              <p className="text-xs text-muted-foreground truncate mb-1">
                {jobVenue}
              </p>
              {timeRange && (
                <p className="text-xs text-muted-foreground">
                  {timeRange}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* Date type badge - moved to right */}
              <Badge 
                variant="secondary" 
                className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                onClick={handleDateTypeBadgeClick}
              >
                {currentDateTypeEmoji}
              </Badge>
            </div>
          </div>
          
          {/* Department badges */}
          <div className="flex gap-1 flex-wrap">
            {job.job_departments?.map((dept: any) => (
              <Badge key={dept.department} variant="outline" className="text-xs">
                {dept.department}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Date Type Dialog */}
      <Dialog open={dateTypeDialogOpen} onOpenChange={setDateTypeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Date Type</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {DATE_TYPE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={selectedDateType === option.value ? "default" : "outline"}
                className="justify-start"
                onClick={() => {
                  setSelectedDateType(option.value);
                  handleDateTypeChange(option.value);
                  setDateTypeDialogOpen(false);
                }}
              >
                <span className="mr-2">{option.emoji}</span>
                {option.label}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <SoundTaskDialog
        jobId={job.id}
        open={soundTaskDialogOpen}
        onOpenChange={setSoundTaskDialogOpen}
      />

      <LightsTaskDialog
        jobId={job.id}
        open={lightsTaskDialogOpen}
        onOpenChange={setLightsTaskDialogOpen}
      />

      <VideoTaskDialog
        jobId={job.id}
        open={videoTaskDialogOpen}
        onOpenChange={setVideoTaskDialogOpen}
      />

      <EditJobDialog
        open={editJobDialogOpen}
        onOpenChange={setEditJobDialogOpen}
        job={job}
      />

      <JobAssignmentDialog
        isOpen={assignmentDialogOpen}
        onClose={() => setAssignmentDialogOpen(false)}
        onAssignmentChange={() => {}}
        jobId={job.id}
      />
    </>
  );
}