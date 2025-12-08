import React from 'react';
import { Button } from "@/components/ui/button";
import createFolderIcon from "@/assets/icons/icon.png";
import { Edit, Trash2, Upload, RefreshCw, Users, Loader2, FolderPlus, Clock, FileText, Scale, Zap, MessageCircle, ExternalLink, Info, ListChecks, Settings, ScrollText, Archive, RotateCw } from "lucide-react";
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
import {
  FLEX_FOLDER_IDS,
  createTourdateFilterPredicate,
  getElementTree,
  openFlexElement,
  type FlatElementNode,
  type FlexLinkIntent,
} from "@/utils/flex-folders";

function mapViewHintToIntent(viewHint?: string | null): FlexLinkIntent | "auto" | undefined {
  if (!viewHint || typeof viewHint !== "string") {
    return undefined;
  }

  const normalized = viewHint.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === "auto") {
    return "auto";
  }

  const canonical = normalized.replace(/[\s_]+/g, "-");

  switch (canonical) {
    case "contact-list":
    case "contactlist":
    case "crew-call":
    case "crewcall":
    case "crew-list":
    case "crewlist":
      return "contact-list";
    case "equipment-list":
    case "equipmentlist":
    case "pull-sheet":
    case "pullsheet":
    case "pull-list":
    case "pulllist":
      return "equipment-list";
    case "remote-file-list":
    case "remotefilelist":
    case "remote-files":
    case "remotefiles":
    case "remote-files-list":
      return "remote-file-list";
    case "expense-sheet":
    case "expensesheet":
    case "expense":
      return "expense-sheet";
    case "fin-doc":
    case "financial-document":
    case "financial-doc":
    case "financialdoc":
    case "presupuesto":
      return "fin-doc";
    case "simple-element":
    case "folder":
    case "element":
      return "simple-element";
    default:
      return undefined;
  }
}

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

const JobCardActionsComponent: React.FC<JobCardActionsProps> = ({
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
  const dryHirePresupuestoElementRef = React.useRef<string | null>(null);
  // Archive to Flex state
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [archiveResult, setArchiveResult] = React.useState<any | null>(null);
  const [archiveError, setArchiveError] = React.useState<string | null>(null);
  const [archiveMode, setArchiveMode] = React.useState<'by-prefix' | 'all-tech'>('by-prefix');
  const [archiveIncludeTemplates, setArchiveIncludeTemplates] = React.useState(false);
  const [archiveDryRun, setArchiveDryRun] = React.useState(false);
  // Backfill state
  const [backfillOpen, setBackfillOpen] = React.useState(false);
  const [backfilling, setBackfilling] = React.useState(false);
  const [backfillMsg, setBackfillMsg] = React.useState<string | null>(null);
  const [backfillResult, setBackfillResult] = React.useState<any | null>(null);
  const [bfSound, setBfSound] = React.useState(true);
  const [bfLights, setBfLights] = React.useState(true);
  const [bfVideo, setBfVideo] = React.useState(true);
  const [bfProduction, setBfProduction] = React.useState(true);
  const [uuidSound, setUuidSound] = React.useState('');
  const [uuidLights, setUuidLights] = React.useState('');
  const [uuidVideo, setUuidVideo] = React.useState('');
  const [uuidProduction, setUuidProduction] = React.useState('');

  React.useEffect(() => {
    if (job?.job_type !== "dryhire") {
      dryHirePresupuestoElementRef.current = null;
      return;
    }

    const candidateIds = [
      job?.dryhire_presupuesto_element_id,
      job?.dryhirePresupuestoElementId,
      job?.presupuesto_element_id,
      job?.presupuestoElementId,
      job?.flex_presupuesto_element_id,
      job?.flexPresupuestoElementId,
      job?.flex_budget_element_id,
      job?.flexBudgetElementId,
    ];

    for (const candidate of candidateIds) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        dryHirePresupuestoElementRef.current = candidate;
        return;
      }
    }

    const matchingFolder = job.flex_folders?.find((folder: any) => {
      const folderType = typeof folder?.folder_type === "string" ? folder.folder_type.toLowerCase() : "";
      const folderKey = typeof folder?.key === "string" ? folder.key.toLowerCase() : "";
      const folderName = typeof folder?.name === "string" ? folder.name.toLowerCase() : "";

      return (
        folderType === "dryhire_presupuesto" ||
        folderType === "presupuesto" ||
        folderType === "presupuesto_dryhire" ||
        folderKey === "dryhire_presupuesto" ||
        folderKey === "presupuesto" ||
        folderKey === "presupuestodryhire" ||
        folderName.includes("presupuesto")
      );
    });

    const storedElementId =
      typeof matchingFolder?.element_id === "string" && matchingFolder.element_id.trim().length > 0
        ? matchingFolder.element_id
        : typeof matchingFolder?.elementId === "string" && matchingFolder.elementId.trim().length > 0
          ? matchingFolder.elementId
          : null;

    dryHirePresupuestoElementRef.current = storedElementId;
  }, [job]);

  const handleTimesheetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/timesheets?jobId=${job.id}`);
  };

  const handleArchiveToFlex = async () => {
    setArchiving(true);
    setArchiveError(null);
    setArchiveResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('archive-to-flex', {
        body: {
          job_id: job.id,
          mode: archiveMode,
          include_templates: archiveIncludeTemplates,
          dry_run: archiveDryRun,
        }
      });
      if (error) throw error;
      setArchiveResult(data);
      toast({
        title: archiveDryRun ? 'Dry run complete' : 'Archive complete',
        description: `${data?.uploaded ?? 0} uploaded, ${data?.failed ?? 0} failed`,
      });
    } catch (err: any) {
      console.error('[JobCardActions] ArchiveToFlex error', err);
      setArchiveError(err?.message || 'Failed to archive');
      toast({ title: 'Archive failed', description: err?.message || 'Failed to archive', variant: 'destructive' });
    } finally {
      setArchiving(false);
    }
  };

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillMsg(null);
    setBackfillResult(null);
    try {
      const depts: string[] = [];
      if (bfSound) depts.push('sound');
      if (bfLights) depts.push('lights');
      if (bfVideo) depts.push('video');
      if (bfProduction) depts.push('production');
      const body: any = { job_id: job.id };
      if (depts.length) body.departments = depts;
      const manual: Array<{ dept: string; element_id: string }> = [];
      if (uuidSound.trim()) manual.push({ dept: 'sound', element_id: uuidSound.trim() });
      if (uuidLights.trim()) manual.push({ dept: 'lights', element_id: uuidLights.trim() });
      if (uuidVideo.trim()) manual.push({ dept: 'video', element_id: uuidVideo.trim() });
      if (uuidProduction.trim()) manual.push({ dept: 'production', element_id: uuidProduction.trim() });
      if (manual.length) body.manual = manual;
      const { data, error } = await supabase.functions.invoke('backfill-flex-doc-tecnica', { body });
      if (error) throw error;
      setBackfillResult(data);
      setBackfillMsg(`Inserted ${data?.inserted ?? 0}, already ${data?.already ?? 0}`);
      toast({ title: 'Backfill complete', description: `Inserted ${data?.inserted ?? 0}, already ${data?.already ?? 0}` });
    } catch (err: any) {
      console.error('[JobCardActions] Backfill error', err);
      setBackfillMsg(err?.message || 'Backfill failed');
      toast({ title: 'Backfill failed', description: err?.message || 'Backfill failed', variant: 'destructive' });
    } finally {
      setBackfilling(false);
    }
  };

  const canViewCalculators = isProjectManagementPage && (userRole === 'management' || userRole === 'admin');

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
      return "Creando carpetas...";
    }
    return foldersAreCreated ? "Las carpetas ya existen" : "Crear carpetas Flex";
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

    // Handle dry-hire jobs - check for saved presupuesto first, then fallback to tree traversal
    if (isProjectManagementPage && job.job_type === 'dryhire') {
      const dryHireFolder = job.flex_folders?.find((f: any) => f.folder_type === 'dryhire');
      const savedPresupuesto = job.flex_folders?.find((f: any) => f.folder_type === 'dryhire_presupuesto');

      let presupuestoElementId =
        typeof dryHirePresupuestoElementRef.current === 'string'
          ? dryHirePresupuestoElementRef.current
          : null;

      // Use saved presupuesto element_id if available
      if (!presupuestoElementId && savedPresupuesto?.element_id) {
        presupuestoElementId = savedPresupuesto.element_id;
        dryHirePresupuestoElementRef.current = presupuestoElementId;
      }

      // Fallback to tree traversal for jobs created before this fix
      if (!presupuestoElementId && dryHireFolder?.element_id) {
        try {
          console.log('[JobCardActions] Resolving dryhire presupuesto via element tree', {
            jobId: job.id,
            dryHireFolderId: dryHireFolder.element_id,
          });

          const tree = await getElementTree(dryHireFolder.element_id);
          const queue: any[] = Array.isArray(tree) ? [...tree] : [];

          while (queue.length > 0) {
            const node = queue.shift();

            if (!node || typeof node !== 'object') {
              continue;
            }

            const nodeElementId =
              typeof node.elementId === 'string' && node.elementId.trim().length > 0
                ? node.elementId
                : null;
            const nodeDefinitionId = typeof node.definitionId === 'string' ? node.definitionId : undefined;
            const nodeDisplayName =
              typeof node.displayName === 'string'
                ? node.displayName
                : typeof node.name === 'string'
                  ? node.name
                  : '';

            if (
              nodeElementId &&
              (
                nodeDefinitionId === FLEX_FOLDER_IDS.presupuestoDryHire ||
                (nodeDisplayName || '').toLowerCase().includes('presupuesto')
              )
            ) {
              presupuestoElementId = nodeElementId;
              break;
            }

            if (Array.isArray(node.children)) {
              queue.push(...node.children);
            }
          }

          if (presupuestoElementId) {
            dryHirePresupuestoElementRef.current = presupuestoElementId;
          }
        } catch (error) {
          console.error('[JobCardActions] Failed to resolve dryhire presupuesto element via tree:', {
            error,
            jobId: job.id,
            dryHireFolderId: dryHireFolder.element_id,
          });
          toast({
            title: 'Error',
            description: 'Failed to load the dry-hire presupuesto from Flex.',
            variant: 'destructive',
          });
          return;
        }
      }

      if (!presupuestoElementId) {
        console.error('[JobCardActions] No dryhire presupuesto element available:', {
          jobId: job.id,
          hasFlexFolders: !!job.flex_folders,
          flexFoldersCount: job.flex_folders?.length || 0,
        });
        toast({
          title: 'Presupuesto not found',
          description: 'No presupuesto element was found for this dry-hire job.',
          variant: 'destructive',
        });
        return;
      }

      await openFlexElement({
        elementId: presupuestoElementId,
        context: {
          jobType: job.job_type,
          folderType: 'dryhire',
          definitionId: FLEX_FOLDER_IDS.presupuestoDryHire,
        },
        onError: (error) => {
          console.error('[JobCardActions] Failed to open dryhire presupuesto element:', error);
          toast({
            title: 'Error',
            description: error.message || 'Failed to open Flex',
            variant: 'destructive',
          });
        },
        onWarning: (message) => {
          console.warn('[JobCardActions] Warning opening dryhire presupuesto element:', message);
          toast({
            title: 'Warning',
            description: message,
          });
        },
      });
      return;
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

  const handleFlexElementSelect = React.useCallback((elementId: string, node?: FlatElementNode) => {
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
      schemaId: node?.schemaId,
      viewHint: node?.viewHint,
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

    // Use shared navigation utility; it handles placeholder window and async resolution
    openFlexElement({
      elementId,
      context: {
        definitionId: node?.definitionId,
        domainId: node?.domainId,
        schemaId: node?.schemaId,
        viewHint: mapViewHintToIntent(node?.viewHint),
        jobType: job.job_type,
      },
      onError: (error) => {
        const errorDetails = {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          elementId,
          node,
          jobId: job.id,
          jobType: job.job_type,
          timestamp: new Date().toISOString(),
        };
        console.error('[JobCardActions] Failed to open Flex element from selector:', errorDetails);
        toast({
          title: 'Navigation error',
          description: error instanceof Error ? error.message : 'Failed to open Flex',
          variant: 'destructive',
        });
      },
      onWarning: (message) => {
        console.warn('[JobCardActions] Warning opening Flex element from selector:', {
          message,
          elementId,
          node,
          jobId: job.id,
        });
        toast({ title: 'Warning', description: message });
      },
    });
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
          title="Tareas"
        >
          <ListChecks className="h-4 w-4" />
          <span className="hidden sm:inline">Tareas</span>
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
      {isProjectManagementPage && (userRole === 'management' || userRole === 'admin') && onCreateWhatsappGroup && job.job_type !== 'dryhire' && (
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
          <span className="hidden sm:inline">Ver Detalles</span>
        </Button>
      )}

      {job.job_type === "festival" && isProjectManagementPage && canManageArtists && (
        <Button
          variant="outline"
          size="sm"
          onClick={onFestivalArtistsClick}
          className="hover:bg-accent/50"
          title={userRole === 'technician' || userRole === 'house_tech' ? 'Ver Festival' : 'Gestionar Festival'}
        >
          <Users className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{userRole === 'technician' || userRole === 'house_tech' ? 'Ver Festival' : 'Gestionar Festival'}</span>
        </Button>
      )}
      {job.job_type !== "festival" && job.job_type !== "dryhire" && isProjectManagementPage && canManageArtists && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleManageJob}
          className="hover:bg-accent/50"
          title={userRole === 'technician' || userRole === 'house_tech' ? 'Ver Trabajo' : 'Gestionar Trabajo'}
        >
          <Settings className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{userRole === 'technician' || userRole === 'house_tech' ? 'Ver Trabajo' : 'Gestionar Trabajo'}</span>
        </Button>
      )}
      {!isHouseTech && job.job_type !== "dryhire" && isProjectManagementPage && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAssignmentDialogOpen}
          className="hover:bg-accent/50"
          title="Asignar"
        >
          <Users className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Asignar</span>
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRefreshData}
        title="Actualizar"
        className="hover:bg-accent/50"
      >
        <RefreshCw className="h-4 w-4" />
      </Button>
      {isProjectManagementPage && canSyncFlex && showFlexButtons && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSyncFlex}
          title="Sincronizar estado con Flex"
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
          title="Gestionar Hojas de Tiempo"
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
            title="Calculadora de Pesos"
            onClick={(e) => navigateToCalculator(e, 'pesos')}
          >
            <Scale className="h-4 w-4" />
            <span className="hidden sm:inline">Pesos</span>
            {defaultsInfo?.weight && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-green-500" title="Existen valores predeterminados de gira" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            title="Calculadora de Consumos"
            onClick={(e) => navigateToCalculator(e, 'consumos')}
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Consumos</span>
            {defaultsInfo?.power && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-green-500" title="Existen valores predeterminados de gira" />}
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
            title="Editar detalles del trabajo"
            className="hover:bg-accent/50"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDeleteClick}
            title="Eliminar trabajo"
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
                  title: 'No se puede abrir Flex',
                  description: 'No hay un elemento Flex válido disponible para este trabajo.',
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
                ? 'No hay un elemento Flex válido disponible'
                : isFlexLoading || isCreatingFolders || folderStateLoading
                  ? 'Cargando…'
                  : 'Abrir en Flex'
            }
          >
            {(isFlexLoading || isCreatingFolders || folderStateLoading) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Abrir Flex</span>
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
              <img src={createFolderIcon} alt="Crear carpetas Flex" className="h-4 w-4" />
            )}
          </Button>
        )
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onCreateLocalFolders}
        disabled={isCreatingLocalFolders}
        title={isCreatingLocalFolders ? "Creando carpetas locales..." : "Crear estructura de carpetas locales"}
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
      {/* Archive to Flex */}
      {job.job_type !== 'dryhire' && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => { e.stopPropagation(); setArchiveOpen(true); }}
          className="gap-2"
          title="Archivar documentos en Flex"
        >
          <Archive className="h-4 w-4" />
          <span className="hidden sm:inline">Archivar</span>
        </Button>
      )}
      {/* Backfill Doc Técnica */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); setBackfillOpen(true); }}
        disabled={backfilling}
        title={backfilling ? 'Rellenando…' : 'Rellenar Doc Técnica'}
        className={backfilling ? 'opacity-50 cursor-not-allowed' : 'hover:bg-accent/50'}
      >
        {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
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

      {/* Archive to Flex Dialog */}
      {archiveOpen && (
        <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Archive documents to Flex</DialogTitle>
              <DialogDescription>
                Uploads all job documents to each department's Documentación Técnica in Flex and removes them from Supabase.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mode</label>
                  {/* Simple select without our custom select to keep dependencies light here */}
                  <select
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                    value={archiveMode}
                    onChange={(e) => setArchiveMode(e.target.value as 'by-prefix' | 'all-tech')}
                  >
                    <option value="by-prefix">By prefix (default)</option>
                    <option value="all-tech">All technical depts</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-6 sm:mt-[30px]">
                  <input id="includeTemplatesA" type="checkbox" checked={archiveIncludeTemplates} onChange={(e) => setArchiveIncludeTemplates(e.target.checked)} />
                  <label htmlFor="includeTemplatesA" className="text-sm">Include templates</label>
                </div>
                <div className="flex items-center gap-2">
                  <input id="dryRunA" type="checkbox" checked={archiveDryRun} onChange={(e) => setArchiveDryRun(e.target.checked)} />
                  <label htmlFor="dryRunA" className="text-sm">Dry run (no delete)</label>
                </div>
              </div>

              {archiving && (
                <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Archiving...</div>
              )}

              {archiveError && (
                <div className="text-sm text-red-600">{archiveError}</div>
              )}

              {archiveResult && (
                <div className="space-y-3">
                  <div className="text-sm">Summary</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Attempted: <span className="font-medium">{archiveResult.attempted ?? 0}</span></div>
                    <div>Uploaded: <span className="font-medium">{archiveResult.uploaded ?? 0}</span></div>
                    <div>Skipped: <span className="font-medium">{archiveResult.skipped ?? 0}</span></div>
                    <div>Failed: <span className="font-medium">{archiveResult.failed ?? 0}</span></div>
                  </div>
                  {archiveResult.details && Array.isArray(archiveResult.details) && (
                    <div className="max-h-48 overflow-auto border rounded p-2 text-xs">
                      {archiveResult.details.map((d: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between py-0.5">
                          <div className="truncate mr-2" title={d.file}>{d.file}</div>
                          <div className="text-muted-foreground">{d.status}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={archiving}>Cerrar</Button>
              <Button onClick={handleArchiveToFlex} disabled={archiving}>
                {archiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {archiveDryRun ? 'Prueba' : 'Iniciar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {isProjectManagementPage && canSyncFlex && showFlexButtons && (
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFlexLogs}
          className="gap-2"
          title="Registros de Sincronización"
        >
          <ScrollText className="h-4 w-4" />
          <span className="hidden sm:inline">Registros</span>
        </Button>
      )}

      {/* Backfill Dialog */}
      {backfillOpen && (
        <Dialog open={backfillOpen} onOpenChange={setBackfillOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Backfill Documentación Técnica</DialogTitle>
              <DialogDescription>
                Finds and persists missing Documentación Técnica elements for this job so archiving can target them reliably.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={bfSound} onChange={(e) => setBfSound(e.target.checked)} /> Sound
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={bfLights} onChange={(e) => setBfLights(e.target.checked)} /> Lights
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={bfVideo} onChange={(e) => setBfVideo(e.target.checked)} /> Video
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={bfProduction} onChange={(e) => setBfProduction(e.target.checked)} /> Production
                </label>
              </div>
              <div className="mt-2">
                <div className="text-xs text-muted-foreground mb-1">Manual UUIDs (optional)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs">Sound UUID</label>
                    <input className="w-full h-8 rounded border px-2 text-xs" value={uuidSound} onChange={(e) => setUuidSound(e.target.value)} placeholder="paste elementId" />
                  </div>
                  <div>
                    <label className="text-xs">Lights UUID</label>
                    <input className="w-full h-8 rounded border px-2 text-xs" value={uuidLights} onChange={(e) => setUuidLights(e.target.value)} placeholder="paste elementId" />
                  </div>
                  <div>
                    <label className="text-xs">Video UUID</label>
                    <input className="w-full h-8 rounded border px-2 text-xs" value={uuidVideo} onChange={(e) => setUuidVideo(e.target.value)} placeholder="paste elementId" />
                  </div>
                  <div>
                    <label className="text-xs">Production UUID</label>
                    <input className="w-full h-8 rounded border px-2 text-xs" value={uuidProduction} onChange={(e) => setUuidProduction(e.target.value)} placeholder="paste elementId" />
                  </div>
                </div>
              </div>

              {backfilling && (
                <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Backfilling…</div>
              )}
              {backfillMsg && <div className="text-muted-foreground">{backfillMsg}</div>}
              {backfillResult?.details && (
                <div className="max-h-48 overflow-auto border rounded p-2 text-xs">
                  {backfillResult.details.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-0.5">
                      <div className="truncate mr-2">{d.dept}</div>
                      <div className="truncate mr-2" title={d.elementId}>{d.elementId}</div>
                      <div className="text-muted-foreground">{d.status}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBackfillOpen(false)} disabled={backfilling}>Cerrar</Button>
              <Button onClick={runBackfill} disabled={backfilling}>
                {backfilling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Iniciar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
        }

        if (!selectorMainElementId) return null;

        if (job.job_type === 'dryhire') {
          return null;
        }

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

export const JobCardActions = React.memo(JobCardActionsComponent);
JobCardActions.displayName = 'JobCardActions';
