import React, { useState } from 'react';
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
  Loader2,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SoundTaskDialog } from "@/components/sound/SoundTaskDialog";
import { LightsTaskDialog } from "@/components/lights/LightsTaskDialog";
import { VideoTaskDialog } from "@/components/video/VideoTaskDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import { useToast } from "@/hooks/use-toast";
import { useFlexUuidLazy } from "@/hooks/useFlexUuidLazy";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { GlassButton, GlassCard, GlassSurface } from "@/components/ui/glass";

interface MobileJobCardProps {
  job: any;
  department?: Department;
  currentDate: Date;
  dateTypes?: Record<string, any>;
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
  dateTypes: propDateTypes,
  onDateTypeChange,
  onEditClick,
  onDeleteClick,
  onJobClick
}: MobileJobCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [dateTypeDialogOpen, setDateTypeDialogOpen] = useState(false);
  const [selectedDateType, setSelectedDateType] = useState<string>('show');
  const [jobDetailsDialogOpen, setJobDetailsDialogOpen] = useState(false);
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
    assignments,
    documents,
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

  // Get current date type for this job on the selected date using the key format
  const dateTypeKey = `${job.id}-${format(currentDate, 'yyyy-MM-dd')}`;
  const currentDateType = propDateTypes?.[dateTypeKey] || 
    (Array.isArray(job?.job_date_types) ? 
      job.job_date_types.find((dt: any) => {
        const dtDate = dt?.date ? new Date(dt.date) : null;
        return !!dtDate && dtDate.toDateString() === currentDate.toDateString();
      }) : null);

  const currentTypeValue = currentDateType ? (currentDateType.type || currentDateType.date_type) : undefined;

  const currentDateTypeEmoji = DATE_TYPE_OPTIONS.find(option => 
    option.value === currentTypeValue
  )?.emoji || '🎭';

  const jobTitle = (job.title || job.job_name || 'Untitled Job').length > 26 
    ? (job.title || job.job_name || 'Untitled Job').substring(0, 26) + '...'
    : (job.title || job.job_name || 'Untitled Job');
  const jobVenue = (job.location?.name || job.venue || 'No venue').length > 26
    ? (job.location?.name || job.venue || 'No venue').substring(0, 26) + '...'
    : (job.location?.name || job.venue || 'No venue');
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

      // Ensure both mobile and desktop calendars refresh their caches
      queryClient.invalidateQueries({ queryKey: ['job_date_types', dateStr] });
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'date-types'
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
      <GlassCard
        className={cn(
          "mb-3 transition-all duration-200",
          !isHouseTech && !isJobBeingDeleted && "cursor-pointer hover:-translate-y-0.5",
          isJobBeingDeleted && "pointer-events-none opacity-60"
        )}
        glassSurfaceClassName="relative overflow-hidden"
        glassContentClassName="flex flex-col"
        mobileOptions={{ featureFlag: "mobile_glass_ui", minimumDeviceMemory: 3 }}
        onClick={handleJobCardClick}
      >
        <div className="relative flex flex-col rounded-2xl p-4">
          <div
            aria-hidden
            className="absolute left-0 top-3 bottom-3 w-1.5 rounded-full"
            style={{ backgroundColor: appliedBorderColor || 'hsl(var(--primary))' }}
          />

          {isJobBeingDeleted && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/30">
              <div className="rounded-lg bg-background/80 px-3 py-2 text-sm font-medium shadow-lg">
                Deleting job...
              </div>
            </div>
          )}

          <div className="relative z-[1]">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Actions menu - moved to left */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <GlassButton
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    mobileOptions={{ featureFlag: "mobile_glass_ui" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </GlassButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  side="top"
                  sideOffset={-4}
                  collisionPadding={-8}
                  avoidCollisions={true}
                  className="z-50 w-52 border-0 bg-transparent p-0 shadow-none"
                >
                  <GlassSurface
                    className="overflow-hidden"
                    contentClassName="flex flex-col py-2"
                    mobileOptions={{ featureFlag: "mobile_glass_ui" }}
                    displacementScale={0.35}
                    blurAmount={18}
                    variant="dark"
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

                    {/* View Details - for technicians and house techs */}
                    {(userRole === 'technician' || userRole === 'house_tech') && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setJobDetailsDialogOpen(true);
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                    )}

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
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log("MobileJobCard: Create Flex Folders clicked", {
                            canCreateFlexFolders,
                            isCreatingFolders,
                            isFoldersLoading,
                            foldersAreCreated,
                            jobId: job.id
                          });
                          createFlexFoldersHandler(e);
                        }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          createLocalFoldersHandler(e);
                        }}
                        disabled={isCreatingLocalFolders}
                      >
                        <HardDrive className="mr-2 h-4 w-4" />
                        {isCreatingLocalFolders ? 'Creating...' : 'Create Local Folders'}
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    {(userRole === 'technician' || userRole === 'house_tech') && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setJobDetailsDialogOpen(true);
                        }}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                    )}

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
                  </GlassSurface>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex-1 min-w-0 mx-3 overflow-hidden">
              <h3 className="font-semibold text-sm leading-tight mb-1 truncate max-w-full">
                {jobTitle}
              </h3>
              <p className="text-xs text-muted-foreground truncate mb-1 max-w-full">
                {jobVenue}
              </p>
              {timeRange && (
                <p className="text-xs text-muted-foreground truncate max-w-full">
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
        </div>
      </GlassCard>

      {/* Date Type Dialog */}
      <Dialog open={dateTypeDialogOpen} onOpenChange={setDateTypeDialogOpen}>
        <DialogContent
          className="sm:max-w-md"
          glass
          glassSurfaceProps={{
            mobileOptions: { featureFlag: "mobile_glass_ui" },
            displacementScale: 0.4,
            blurAmount: 20,
          }}
        >
          <DialogHeader>
            <DialogTitle>Change Date Type</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {DATE_TYPE_OPTIONS.map((option) => (
              <GlassButton
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
              </GlassButton>
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

      {/* Job Details Dialog */}
      <JobDetailsDialog
        open={jobDetailsDialogOpen}
        onOpenChange={setJobDetailsDialogOpen}
        job={job}
        department={department}
      />
    </>
  );
}
