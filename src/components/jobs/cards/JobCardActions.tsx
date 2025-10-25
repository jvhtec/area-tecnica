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
import { getMainFlexElementIdSync } from "@/utils/flexMainFolderId";

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

  const handleOpenFlex = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (folderStateLoading || isCreatingFolders || isFlexLoading) {
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
      setFlexSelectorOpen(true);
      return;
    }

    // Otherwise, retain existing direct flexUuid navigation
    if (flexUuid) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${flexUuid}/view/simple-element/header`;
      window.open(flexUrl, '_blank', 'noopener');
      return;
    }
    if (flexError) {
      toast({ title: 'Error', description: flexError, variant: 'destructive' });
    } else {
      toast({ title: 'Info', description: 'Flex folder not available for this job' });
    }
  };

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
            onClick={handleOpenFlex}
            disabled={folderStateLoading || isCreatingFolders || isFlexLoading}
            className="gap-2"
            title={isFlexLoading || isCreatingFolders || folderStateLoading ? 'Loading…' : 'Open in Flex'}
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
      {mainFlexInfo?.elementId && (
        <FlexElementSelectorDialog
          open={flexSelectorOpen}
          onOpenChange={setFlexSelectorOpen}
          mainElementId={mainFlexInfo.elementId}
          defaultDepartment={department}
          jobId={job.id}
        />
      )}
    </div>
  );
};
