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
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { dataLayerClient } from "@/services/dataLayerClient";
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
import { canViewDetails, isManagementRole } from "@/utils/permissions";
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
import { openFlexElement } from "@/utils/flex-folders";
import { getCalendarJobDisplayTitle } from "@/utils/calendarArtists";
import { isFestivalLikeJobType } from "@/utils/jobType";
import { DateType, DATE_TYPE_OPTIONS, getDateTypeMeta } from "@/constants/dateTypes";


import { queryKeys } from "@/lib/react-query";
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
  const { userRole } = useOptimizedAuth();
  const isManagementUser = isManagementRole(userRole);
  const canViewJobDetails = canViewDetails(userRole);
  const [dateTypeDialogOpen, setDateTypeDialogOpen] = useState(false);
  const [selectedDateType, setSelectedDateType] = useState<DateType>('show');
  const [jobDetailsDialogOpen, setJobDetailsDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const { uuid: flexUuid, isLoading: isLoadingFlexUuid, error: flexError, hasChecked, fetchFlexUuid } = useFlexUuidLazy();

  const {
    appliedBorderColor,
    appliedBgColor,
    soundTaskDialogOpen,
    lightsTaskDialogOpen,
    videoTaskDialogOpen,
    editJobDialogOpen,
    assignmentDialogOpen,
    isHouseTech,
    canEditJobs,
    canManageArtists,
    canUploadDocuments,
    canCreateFlexFolders,
    handleEditButtonClick,
    handleFileUpload,
    setSoundTaskDialogOpen,
    setLightsTaskDialogOpen,
    setVideoTaskDialogOpen,
    setEditJobDialogOpen,
    setAssignmentDialogOpen
  } = useOptimizedJobCard(job, department, userRole, onEditClick, onDeleteClick, onJobClick, {
    enableRoleSummary: false,
    enableSoundTasks: false,
  });

  const {
    handleDeleteClick,
    createFlexFoldersHandler,
    createLocalFoldersHandler,
    isCreatingFolders,
    isCreatingLocalFolders,
    isJobBeingDeleted
  } = useJobActions(job, userRole, onDeleteClick);

  // Check folder existence
  const { data: foldersExist, isLoading: isFoldersLoading } = useFolderExistence(job.id, job.tour_date_id);
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

  const currentDateTypeEmoji = getDateTypeMeta(currentTypeValue)?.emoji || '🎭';

  const fullJobTitle = getCalendarJobDisplayTitle(job, currentDate);
  const jobTitle = fullJobTitle.length > 26
    ? fullJobTitle.substring(0, 26) + '...'
    : fullJobTitle;
  const jobVenue = (job.location?.name || job.venue || 'Sin ubicación').length > 26
    ? (job.location?.name || job.venue || 'Sin ubicación').substring(0, 26) + '...'
    : (job.location?.name || job.venue || 'Sin ubicación');
  const startTime = job.start_time ? format(new Date(job.start_time), 'HH:mm') : '';
  const endTime = job.end_time ? format(new Date(job.end_time), 'HH:mm') : '';
  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : startTime;

  const isFestival = isFestivalLikeJobType(job.job_type);

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

  const handleDateTypeChange = async (newType: DateType) => {
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      const { error } = await dataLayerClient.from('job_date_types')
        .upsert({
          job_id: job.id,
          date: dateStr,
          type: newType
        }, {
          onConflict: 'job_id,date'
        });

      if (error) throw error;

      toast({
        title: "Tipo de fecha actualizado",
        description: `Cambiado a ${DATE_TYPE_OPTIONS.find(opt => opt.value === newType)?.label}`
      });

      // Ensure both mobile and desktop calendars refresh their caches
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('job_date_types', dateStr) });
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
        description: "No se pudo actualizar el tipo de fecha",
        variant: "destructive"
      });
    }
  };

  const handleDateTypeBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDateType((currentDateType?.type || 'show') as DateType);
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
        toast({ title: "Cargando", description: "Espera mientras cargamos la carpeta de Flex..." });
        return;
      }

      if (flexUuid) {
        await openFlexElement({
          elementId: flexUuid,
          context: {
            jobType: job.job_type,
          },
          onError: (error) => {
            toast({
              title: "Error",
              description: error.message || "No se pudo abrir Flex",
              variant: "destructive",
            });
          },
          onWarning: (message) => {
            toast({
              title: "Aviso",
              description: message,
            });
          },
        });
      } else if (flexError) {
        toast({ title: "Error", description: String(flexError), variant: "destructive" });
      } else {
        toast({ title: "Información", description: "La carpeta de Flex no está disponible para este trabajo" });
      }
    } catch (err: any) {
      console.error('Flex navigation error', err);
    }
  };

  const getFlexMenuText = () => {
    if (!hasChecked) return 'Comprobar Flex';
    if (isLoadingFlexUuid) return 'Cargando Flex...';
    if (flexUuid) return 'Abrir Flex';
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
              <span className="text-sm font-medium">Eliminando trabajo...</span>
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
                  align="end" 
                  side="top" 
                  sideOffset={-4} 
                  collisionPadding={-8}
                  avoidCollisions={true}
                  className="w-48 bg-popover border shadow-md z-50"
                >
                  <DropdownMenuItem onClick={handleDateTypeBadgeClick}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Cambiar tipo de fecha
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); handleFlexClick(); }}
                    disabled={isLoadingFlexUuid}
                  >
                    {getFlexIcon()}
                    {getFlexMenuText()}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* View details */}
                  {canViewJobDetails && (
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        setJobDetailsDialogOpen(true);
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Ver detalles
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssignmentDialogOpen(true);
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Asignar usuarios
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={handleTimesheetClick}>
                    <Clock className="mr-2 h-4 w-4" />
                    Partes de horas
                  </DropdownMenuItem>
                  
                  {isFestival && canManageArtists && (
                    <DropdownMenuItem onClick={handleFestivalArtistsClick}>
                      <Star className="mr-2 h-4 w-4" />
                      Gestionar artistas
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  {canUploadDocuments && (
                    <DropdownMenuItem asChild>
                      <label className="cursor-pointer">
                        <FileUp className="mr-2 h-4 w-4" />
                        Subir documento
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
                      {isCreatingFolders ? 'Creando...' : foldersAreCreated ? 'Carpetas Flex creadas' : 'Crear carpetas Flex'}
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
                      {isCreatingLocalFolders ? 'Creando...' : 'Crear carpetas locales'}
                    </DropdownMenuItem>
                  )}
                  
                  {canEditJobs && (
                    <DropdownMenuItem onClick={handleEditButtonClick}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar trabajo
                    </DropdownMenuItem>
                  )}
                  
                  {isManagementUser && (
                    <DropdownMenuItem 
                      onClick={handleDeleteClick}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar trabajo
                    </DropdownMenuItem>
                  )}
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
      </Card>

      {/* Date Type Dialog */}
      <Dialog open={dateTypeDialogOpen} onOpenChange={setDateTypeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar tipo de fecha</DialogTitle>
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
