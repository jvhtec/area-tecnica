import React from 'react';
import { Button } from "@/components/ui/button";
import createFolderIcon from "@/assets/icons/icon.png";
import { Edit, Trash2, Upload, RefreshCw, Users, Loader2, FolderPlus, Clock, FileText, Scale, Zap, MessageCircle, ExternalLink, Info, ListChecks, Settings, ScrollText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { TechnicianIncidentReportDialog } from "@/components/incident-reports/TechnicianIncidentReportDialog";
import { Department } from "@/types/department";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FlexElementSelectorDialog } from "@/components/flex/FlexElementSelectorDialog";
import { getMainFlexElementIdSync, resolveTourFolderForTourdate } from "@/utils/flexMainFolderId";
import { createTourdateFilterPredicate, openFlexElement, resolveFlexUrlSync } from "@/utils/flex-folders";

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
  department?: Department;
  isCreatingFolders?: boolean;
  isCreatingLocalFolders?: boolean;
  folderStateLoading?: boolean;
  currentFolderStep?: string;
  techName?: string;
  onRefreshData: (e: React.MouseEvent) => void;
  onEditButtonClick: (e: React.MouseEvent) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  onCreateFlexFolders: (e: React.MouseEvent) => void;
  onCreateLocalFolders: (e: React.MouseEvent) => void;
  onFestivalArtistsClick: (e: React.MouseEvent) => void;
  onAssignmentDialogOpen: (e: React.MouseEvent) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onJobDetailsClick?: () => void;
  // Tasks
  onOpenTasks?: (e: React.MouseEvent) => void;
  // Flex sync + logs
  canSyncFlex?: boolean;
  onSyncFlex?: (e: React.MouseEvent) => void;
  onOpenFlexLogs?: (e: React.MouseEvent) => void;
  // Transport / Logistics
  transportButtonLabel?: string;
  transportButtonTone?: 'default' | 'outline' | 'secondary' | 'ghost';
  onTransportClick?: (e: React.MouseEvent) => void;
  // WhatsApp group
  onCreateWhatsappGroup?: (e: React.MouseEvent) => void;
  whatsappDisabled?: boolean;
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
  department,
  isCreatingFolders = false,
  isCreatingLocalFolders = false,
  folderStateLoading = false,
  techName,
  onRefreshData,
  onEditButtonClick,
  onDeleteClick,
  onCreateFlexFolders,
  onCreateLocalFolders,
  onFestivalArtistsClick,
  onAssignmentDialogOpen,
  handleFileUpload,
  onJobDetailsClick,
  onOpenTasks,
  canSyncFlex,
  onSyncFlex,
  onOpenFlexLogs,
  transportButtonLabel,
  transportButtonTone,
  onTransportClick,
  onCreateWhatsappGroup,
  whatsappDisabled,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [waAlmacenOpen, setWaAlmacenOpen] = React.useState(false);
  const [waMessage, setWaMessage] = React.useState<string>("");
  const [isSendingWa, setIsSendingWa] = React.useState(false);
  const [flexSelectorOpen, setFlexSelectorOpen] = React.useState(false);
  const [tourdateSelectorInfo, setTourdateSelectorInfo] = React.useState<{
    mainElementId: string;
    filterDate: string;
  } | null>(null);

  const handleTimesheetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/timesheets?jobId=${job.id}`);
  };

  const canViewCalculators = isProjectManagementPage && (userRole === 'management');

  const allowedJobType = ['single', 'festival', 'tourdate'].includes(job?.job_type);

  const navigateToCalculator = (e: React.MouseEvent, type: 'pesos' | 'consumos') => {
    e.stopPropagation();
    const params = new URLSearchParams({ jobId: job.id });
    let path = '';
    switch (department) {
      case 'sound':
        path = type === 'pesos' ? '/sound/pesos' : '/sound/consumos';
        break;
      case 'lights':
        path = type === 'pesos' ? '/lights-pesos-tool' : '/lights-consumos-tool';
        break;
      case 'video':
        path = type === 'pesos' ? '/video-pesos-tool' : '/video-consumos-tool';
        break;
      default:
        // Fallback to sound if department is undefined/other
        path = type === 'pesos' ? '/sound/pesos' : '/sound/consumos';
    }
    navigate(`${path}?${params.toString()}`);
  };

  // Show tour defaults indicator on buttons if defaults exist for this tour and department
  const tourId: string | undefined = job?.tour_id || job?.tour?.id || undefined;
  const { data: defaultsInfo } = useQuery<{ weight: boolean; power: boolean }>({
    queryKey: ['tour-default-exists', tourId, department],
    enabled: Boolean(tourId && department && canViewCalculators && allowedJobType),
    queryFn: async () => {
      const { data: sets, error: err1 } = await supabase
        .from('tour_default_sets')
        .select('id')
        .eq('tour_id', tourId!)
        .eq('department', department!);
      if (err1) throw err1;
      if (!sets || sets.length === 0) return { weight: false, power: false };
      const setIds = sets.map(s => s.id);
      const { data: tables, error: err2 } = await supabase
        .from('tour_default_tables')
        .select('id, table_type')
        .in('set_id', setIds);
      if (err2) throw err2;
      const weight = (tables || []).some(t => t.table_type === 'weight');
      const power = (tables || []).some(t => t.table_type === 'power');
      return { weight, power };
    }
  });
  const getFlexButtonTitle = () => {
    if (isCreatingFolders) {
      return "Creating folders...";
    }
    return foldersAreCreated ? "Folders already exist" : "Create Flex folders";
  };

  // Compute the main Flex element ID from the job's flex_folders
  const mainFlexInfo = React.useMemo(() => {
    return getMainFlexElementIdSync(job);
  }, [job]);

  // When folders exist, enable "Open in Flex" behavior by resolving UUID
  const { flexUuid, isLoading: isFlexLoading, error: flexError } = useFlexUuid(foldersAreCreated ? job.id : "");

  // Determine if the Open Flex button should be enabled
  const canOpenFlex = React.useMemo(() => {
    if (folderStateLoading || isCreatingFolders || isFlexLoading) return false;
    
    // For project management page with selector dialog support
    if (isProjectManagementPage) {
      // Main element available - can open selector
      if (mainFlexInfo?.elementId) return true;
      
      // Tourdate job - needs tour folder resolution (check later)
      if (job.job_type === 'tourdate') return true;
      
      // Dry-hire job - check if we have any flex_folders with dryhire type
      if (job.job_type === 'dryhire') {
        const dryHireFolder = job.flex_folders?.find((f: any) => f.folder_type === 'dryhire');
        return !!dryHireFolder?.element_id;
      }
    }
    
    // Otherwise need flexUuid
    return !!flexUuid;
  }, [folderStateLoading, isCreatingFolders, isFlexLoading, isProjectManagementPage, mainFlexInfo, job, flexUuid]);

  const handleOpenFlex = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (folderStateLoading || isCreatingFolders || isFlexLoading) {
      console.warn('[JobCardActions] Open Flex clicked while loading:', {
        folderStateLoading,
        isCreatingFolders,
        isFlexLoading,
      });
      toast({
        title: "Loading",
        description: isCreatingFolders
          ? "Creating Flex folders, please wait..."
          : "Please wait while we load the Flex folder...",
      });
      return;
    }

    // If on project management page and main element exists, open selector dialog
    if (isProjectManagementPage && mainFlexInfo?.elementId) {
      console.log(`[JobCardActions] Opening Flex element selector for main element: ${mainFlexInfo.elementId}`);
      setFlexSelectorOpen(true);
      return;
    }

    // Handle tourdate jobs - resolve tour folder and open filtered selector
    if (isProjectManagementPage && job.job_type === 'tourdate') {
      try {
        console.log(`[JobCardActions] Resolving tour folder for tourdate job ${job.id}`);
        const tourFolderId = await resolveTourFolderForTourdate(job, department);
        
        if (!tourFolderId) {
          console.error('[JobCardActions] No tour folder found for tourdate job:', job.id);
          toast({
            title: "Tour folders not found",
            description: "Please ensure the parent tour has Flex folders created first.",
            variant: "destructive",
          });
          return;
        }

        // Get the tour date from job data
        const tourDate = job.start_time;
        if (!tourDate) {
          console.error('[JobCardActions] No start_time found for tourdate job:', job.id);
          toast({
            title: "Date not found",
            description: "Unable to determine tour date for filtering.",
            variant: "destructive",
          });
          return;
        }

        console.log(`[JobCardActions] Opening filtered selector for tourdate: ${tourDate}, folder: ${tourFolderId}`);
        setTourdateSelectorInfo({
          mainElementId: tourFolderId,
          filterDate: tourDate,
        });
        setFlexSelectorOpen(true);
        return;
      } catch (error) {
        console.error('[JobCardActions] Error resolving tour folder:', error);
        toast({
          title: "Error",
          description: "Failed to load tour folder information.",
          variant: "destructive",
        });
        return;
      }
    }

    // Handle dry-hire jobs - try to find dryhire folder from flex_folders first
    if (isProjectManagementPage && job.job_type === 'dryhire') {
      const dryHireFolder = job.flex_folders?.find((f: any) => f.folder_type === 'dryhire');
      
      if (dryHireFolder?.element_id) {
        console.log(`[JobCardActions] Opening dryhire subfolder from flex_folders:`, {
          elementId: dryHireFolder.element_id,
          department: dryHireFolder.department,
          jobId: job.id,
        });
        
        // Open selector dialog with the dryhire subfolder as main element
        // This allows selecting expense sheets and other documents within
        setFlexSelectorOpen(true);
        return;
      } else if (flexUuid) {
        // Fallback to flexUuid if available
        console.log(`[JobCardActions] No dryhire subfolder in flex_folders, using flexUuid fallback:`, {
          flexUuid,
          jobId: job.id,
        });
        
        await openFlexElement({
          elementId: flexUuid,
          context: {
            jobType: job.job_type,
            folderType: 'dryhire',
          },
          onError: (error) => {
            console.error('[JobCardActions] Failed to open dryhire element:', error);
            toast({
              title: 'Error',
              description: error.message || 'Failed to open Flex',
              variant: 'destructive',
            });
          },
          onWarning: (message) => {
            console.warn('[JobCardActions] Warning opening dryhire element:', message);
            toast({
              title: 'Warning',
              description: message,
            });
          },
        });
        return;
      } else {
        console.error('[JobCardActions] No dryhire element available:', {
          jobId: job.id,
          hasFlexFolders: !!job.flex_folders,
          flexFoldersCount: job.flex_folders?.length || 0,
          flexUuid,
        });
        toast({
          title: 'Dryhire folder not found',
          description: 'No dryhire subfolder or element available for this job.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Otherwise, use direct flexUuid navigation with shared utility
    if (flexUuid) {
      console.log(`[JobCardActions] Opening Flex folder for job ${job.id}, element: ${flexUuid}, type: ${job.job_type}`);
      
      await openFlexElement({
        elementId: flexUuid,
        context: {
          jobType: job.job_type,
        },
        onError: (error) => {
          console.error('[JobCardActions] Failed to open Flex element:', error);
          toast({
            title: 'Error',
            description: error.message || 'Failed to open Flex',
            variant: 'destructive',
          });
        },
        onWarning: (message) => {
          console.warn('[JobCardActions] Warning opening Flex element:', message);
          toast({
            title: 'Warning',
            description: message,
          });
        },
      });
      return;
    }
    
    // No valid element available
    console.error('[JobCardActions] No valid Flex element available:', {
      jobId: job.id,
      jobType: job.job_type,
      foldersAreCreated,
      hasMainFlexInfo: !!mainFlexInfo,
      flexUuid,
      flexError,
      hasFlexFolders: !!job.flex_folders,
    });
    
    if (flexError) {
      toast({ title: 'Error', description: flexError, variant: 'destructive' });
    } else {
      toast({ 
        title: 'Flex folder not available', 
        description: 'No valid Flex element found for this job. Please ensure folders are created.',
        variant: 'destructive',
      });
    }
  };

  const handleFlexElementSelect = React.useCallback((elementId: string, node?: any) => {
    // Synchronous navigation path to preserve user gesture
    console.log(`[JobCardActions] Opening Flex element from selector`, {
      elementId,
      elementIdType: typeof elementId,
      elementIdValue: elementId,
      elementIdNull: elementId === null,
      elementIdUndefined: elementId === undefined,
      elementIdEmpty: elementId === '',
      elementIdValid: !!elementId && (typeof elementId === 'string') && elementId.trim().length > 0,
      elementIdLength: elementId?.length || 0,
      node,
      domainId: node?.domainId,
      definitionId: node?.definitionId,
      displayName: node?.displayName,
      documentNumber: node?.documentNumber,
      jobType: job.job_type,
      jobId: job.id,
    });

    // Validate elementId first
    if (!elementId || typeof elementId !== 'string' || elementId.trim().length === 0) {
      const errorDetails = {
        elementId,
        elementIdType: typeof elementId,
        node,
        jobId: job.id,
        jobType: job.job_type,
        timestamp: new Date().toISOString(),
      };
      
      console.error('[JobCardActions] Invalid elementId received from selector:', errorDetails);
      console.error('[JobCardActions] Telemetry: Missing element ID detected', errorDetails);
      
      toast({
        title: 'Invalid element',
        description: node?.displayName 
          ? `Cannot open "${node.displayName}" - invalid element ID.`
          : 'Invalid element ID received. Cannot navigate to Flex.',
        variant: 'destructive',
      });
      return;
    }

    // Build URL synchronously using the resolver, leveraging selector metadata
    let url: string | null = null;
    
    try {
      url = resolveFlexUrlSync({
        elementId,
        context: {
          definitionId: node?.definitionId,
          domainId: node?.domainId,
          jobType: job.job_type,
        },
      });
    } catch (error) {
      const errorDetails = {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        elementId,
        node,
        jobId: job.id,
        jobType: job.job_type,
        timestamp: new Date().toISOString(),
      };
      
      console.error('[JobCardActions] Exception while resolving Flex URL:', errorDetails);
      console.error('[JobCardActions] Telemetry: URL resolution exception', errorDetails);
      
      toast({
        title: 'Navigation error',
        description: 'An error occurred while preparing the Flex URL.',
        variant: 'destructive',
      });
      return;
    }

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      const errorDetails = {
        url,
        urlType: typeof url,
        elementId,
        definitionId: node?.definitionId,
        domainId: node?.domainId,
        displayName: node?.displayName,
        documentNumber: node?.documentNumber,
        jobId: job.id,
        jobType: job.job_type,
        timestamp: new Date().toISOString(),
      };
      
      console.error('[JobCardActions] resolveFlexUrlSync returned null/invalid URL:', errorDetails);
      console.error('[JobCardActions] Telemetry: Unmapped intent detected - no valid URL scheme found', errorDetails);
      
      toast({
        title: 'Navigation failed',
        description: node?.displayName
          ? `Could not determine how to open "${node.displayName}" in Flex.`
          : 'Could not construct a valid Flex URL for the selected element.',
        variant: 'destructive',
      });
      return;
    }

    // Validate URL contains the elementId (sanity check)
    if (!url.includes(elementId)) {
      const warningDetails = {
        url,
        elementId,
        urlContainsElementId: false,
        jobId: job.id,
        timestamp: new Date().toISOString(),
      };
      
      console.warn('[JobCardActions] URL does not contain elementId - possible issue:', warningDetails);
      console.warn('[JobCardActions] Telemetry: URL validation warning', warningDetails);
    }

    const schema = url.includes('#fin-doc/') ? 'fin-doc' : 'simple-element';
    console.log('[JobCardActions] Resolved Flex URL and schema:', {
      url,
      schema,
      elementId,
      displayName: node?.displayName,
      documentNumber: node?.documentNumber,
      jobId: job.id,
    });
    
    console.log('[JobCardActions] Telemetry: Navigation successful', {
      elementId,
      schema,
      displayName: node?.displayName,
      documentNumber: node?.documentNumber,
      definitionId: node?.definitionId,
      domainId: node?.domainId,
      jobId: job.id,
      jobType: job.job_type,
      timestamp: new Date().toISOString(),
    });

    // Create ephemeral anchor to navigate in the same gesture
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      
      console.log('[JobCardActions] Navigation anchor clicked successfully');
    } catch (error) {
      const errorDetails = {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        url,
        elementId,
        jobId: job.id,
        timestamp: new Date().toISOString(),
      };
      
      console.error('[JobCardActions] Failed to create/click navigation anchor:', errorDetails);
      console.error('[JobCardActions] Telemetry: Anchor navigation failure', errorDetails);
      
      toast({
        title: 'Navigation error',
        description: 'Failed to open the Flex window. Please try again.',
        variant: 'destructive',
      });
    }
  }, [job.job_type, job.id, toast]);

  const handleManageJob = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams({ singleJob: 'true' });
    navigate(`/festival-management/${job.id}?${params.toString()}`);
  };

  const showFlexButtons = false; // Temporarily hide Flex sync and logs buttons
  const isMobile = useIsMobile();

  return (
    <div className={cn("flex flex-wrap", isMobile ? "gap-1" : "gap-1.5")} onClick={(e) => e.stopPropagation()}>
      {isProjectManagementPage && job.job_type !== 'dryhire' && onOpenTasks && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenTasks}
          className="gap-2"
          title="Tasks"
        >
          <ListChecks className="h-4 w-4" />
          <span className="hidden sm:inline">Tasks</span>
        </Button>
      )}
      {transportButtonLabel && onTransportClick && (
        <Button
          variant={transportButtonTone || 'outline'}
          size="sm"
          onClick={onTransportClick}
          className="gap-2"
          title={transportButtonLabel}
        >
          {transportButtonLabel}
        </Button>
      )}
      {isProjectManagementPage && (userRole === 'management' || userRole === 'admin') && onCreateWhatsappGroup && job.job_type !== 'tourdate' && job.job_type !== 'dryhire' && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateWhatsappGroup}
          disabled={!!whatsappDisabled}
          className="gap-2"
          title={whatsappDisabled ? 'Grupo ya creado' : 'Crear grupo WhatsApp'}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </Button>
      )}
      {isProjectManagementPage && (userRole === 'management' || userRole === 'admin') && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const title = job?.title || 'trabajo';
            setWaMessage(`He hecho cambios en el PS del ${title} por favor echad un vistazo`);
            setWaAlmacenOpen(true);
          }}
          className="gap-2"
          title="Enviar mensaje a Almacén sonido"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Almacén</span>
        </Button>
      )}
      {/* View Details - available in dashboard/department contexts for all roles */}
      {onJobDetailsClick && (
        <Button
          variant="outline"
          size="sm"
          onClick={onJobDetailsClick}
          className="gap-2"
        >
          <Info className="h-4 w-4" />
          <span className="hidden sm:inline">View Details</span>
        </Button>
      )}

      {job.job_type === "festival" && isProjectManagementPage && canManageArtists && (
        <Button
          variant="outline"
          size="sm"
          onClick={onFestivalArtistsClick}
          className="hover:bg-accent/50"
          title={userRole === 'technician' || userRole === 'house_tech' ? 'View Festival' : 'Manage Festival'}
        >
          <Users className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{userRole === 'technician' || userRole === 'house_tech' ? 'View Festival' : 'Manage Festival'}</span>
        </Button>
      )}
      {job.job_type !== "festival" && job.job_type !== "dryhire" && isProjectManagementPage && canManageArtists && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleManageJob}
          className="hover:bg-accent/50"
          title={userRole === 'technician' || userRole === 'house_tech' ? 'View Job' : 'Manage Job'}
        >
          <Settings className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{userRole === 'technician' || userRole === 'house_tech' ? 'View Job' : 'Manage Job'}</span>
        </Button>
      )}
      {!isHouseTech && job.job_type !== "dryhire" && isProjectManagementPage && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAssignmentDialogOpen}
          className="hover:bg-accent/50"
          title="Assign"
        >
          <Users className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Assign</span>
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
      {isProjectManagementPage && canSyncFlex && showFlexButtons && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSyncFlex}
          title="Sync status to Flex"
          className="hover:bg-accent/50"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
      {job.job_type !== 'dryhire' && job.job_type !== 'tourdate' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleTimesheetClick}
          title="Manage Timesheets"
          className="hover:bg-accent/50"
        >
          <Clock className="h-4 w-4" />
        </Button>
      )}

      {canViewCalculators && allowedJobType && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            title="Weights (Pesos) Calculator"
            onClick={(e) => navigateToCalculator(e, 'pesos')}
          >
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">Pesos</span>
            {defaultsInfo?.weight && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-green-500" title="Tour defaults exist" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            title="Power (Consumos) Calculator"
            onClick={(e) => navigateToCalculator(e, 'consumos')}
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Consumos</span>
            {defaultsInfo?.power && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-green-500" title="Tour defaults exist" />}
          </Button>
        </>
      )}
      {userRole === 'technician' && job.job_type !== "dryhire" && (
        <TechnicianIncidentReportDialog 
          job={job} 
          techName={techName}
        />
      )}
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
        foldersAreCreated ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              if (!canOpenFlex) {
                e.stopPropagation();
                toast({
                  title: 'Cannot open Flex',
                  description: 'No valid Flex element available for this job.',
                  variant: 'destructive',
                });
                return;
              }
              handleOpenFlex(e);
            }}
            disabled={!canOpenFlex}
            className="gap-2"
            title={
              !canOpenFlex
                ? 'No valid Flex element available'
                : isFlexLoading || isCreatingFolders || folderStateLoading
                ? 'Loading…'
                : 'Open in Flex'
            }
          >
            {(isFlexLoading || isCreatingFolders || folderStateLoading) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Open Flex</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCreateFlexFolders}
            disabled={folderStateLoading || isCreatingFolders}
            title={getFlexButtonTitle()}
            className={
              folderStateLoading || isCreatingFolders
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
        )
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onCreateLocalFolders}
        disabled={isCreatingLocalFolders}
        title={isCreatingLocalFolders ? "Creating local folders..." : "Create local folder structure"}
        className={
          isCreatingLocalFolders
            ? "opacity-50 cursor-not-allowed"
            : "hover:bg-accent/50"
        }
      >
        {isCreatingLocalFolders ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FolderPlus className="h-4 w-4" />
        )}
      </Button>
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
      {isProjectManagementPage && canSyncFlex && showFlexButtons && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFlexLogs}
          className="gap-2"
          title="Sync Logs"
        >
          <ScrollText className="h-4 w-4" />
          <span className="hidden sm:inline">Sync Logs</span>
        </Button>
      )}

      {/* Send to Almacén sonido dialog */}
      {waAlmacenOpen && (
        <Dialog open={waAlmacenOpen} onOpenChange={setWaAlmacenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar a Almacén sonido</DialogTitle>
              <DialogDescription>Este mensaje se enviará al grupo de WhatsApp "Almacén sonido" desde tu endpoint WAHA.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensaje</label>
              <Textarea
                value={waMessage}
                onChange={(e) => setWaMessage(e.target.value)}
                placeholder="Escribe tu mensaje…"
                className="min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWaAlmacenOpen(false)} disabled={isSendingWa}>Cancelar</Button>
              <Button onClick={async () => {
                try {
                  setIsSendingWa(true);
                  const defaultMsg = `He hecho cambios en el PS del ${job?.title || 'trabajo'} por favor echad un vistazo`;
                  const trimmed = (waMessage || '').trim();
                  const finalMsg = trimmed || defaultMsg;
                  const isDefault = finalMsg.trim().toLowerCase() === defaultMsg.trim().toLowerCase();
                  const { error } = await supabase
                    .functions.invoke('send-warehouse-message', { body: { message: finalMsg, job_id: job?.id, highlight: isDefault } });
                  if (error) {
                    toast({ title: 'Error al enviar', description: error.message, variant: 'destructive' });
                  } else {
                    toast({ title: 'Enviado', description: 'Mensaje enviado a Almacén sonido.' });
                    setWaAlmacenOpen(false);
                  }
                } catch (e: any) {
                  toast({ title: 'Error', description: e?.message || String(e), variant: 'destructive' });
                } finally {
                  setIsSendingWa(false);
                }
              }} disabled={isSendingWa}>
                {isSendingWa ? 'Enviando…' : 'Enviar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Flex Element Selector Dialog */}
      {(() => {
        // Determine the main element ID for the selector
        let selectorMainElementId: string | undefined;
        
        if (tourdateSelectorInfo) {
          selectorMainElementId = tourdateSelectorInfo.mainElementId;
        } else if (mainFlexInfo?.elementId) {
          selectorMainElementId = mainFlexInfo.elementId;
        } else if (job.job_type === 'dryhire') {
          // For dryhire, use the dryhire subfolder as the main element
          const dryHireFolder = job.flex_folders?.find((f: any) => f.folder_type === 'dryhire');
          selectorMainElementId = dryHireFolder?.element_id;
        }
        
        if (!selectorMainElementId) return null;
        
        return (
          <FlexElementSelectorDialog
            open={flexSelectorOpen}
            onOpenChange={(open) => {
              setFlexSelectorOpen(open);
              if (!open) {
                setTourdateSelectorInfo(null);
              }
            }}
            mainElementId={selectorMainElementId}
            onSelect={handleFlexElementSelect}
            defaultElementId={
              // Try to find department-specific folder as default
              job.flex_folders?.find((f: any) => 
                f.department?.toLowerCase() === department?.toLowerCase()
              )?.element_id || mainFlexInfo?.elementId
            }
            filterPredicate={
              tourdateSelectorInfo
                ? createTourdateFilterPredicate(tourdateSelectorInfo.filterDate)
                : undefined
            }
          />
        );
      })()}
    </div>
  );
};
