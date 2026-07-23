import React, { useState, useEffect, useRef } from 'react';
import { Department } from "@/types/department";
import { useTheme } from "next-themes";

// File System Access API types
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}
import { useNavigate } from "react-router-dom";
import { useFolderExistence } from "@/hooks/useFolderExistence";
import { useOptimizedJobCard } from '@/hooks/useOptimizedJobCard';
import { useDeletionState } from '@/hooks/useDeletionState';
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useSelectedJobStore } from '@/stores/useSelectedJobStore';
import { dataLayerClient } from "@/services/dataLayerClient";
import type { JobDocument } from './JobCardDocuments';
import { JobCardNewDetailsOnly } from "./job-card-new/JobCardNewDetailsOnly";
import { JobCardNewView } from "./job-card-new/JobCardNewView";
import type {
  JobCardJob,
  SelectedTransportRequest,
} from "@/features/jobs/job-card-new/jobCardNewTypes";
import { useJobCardFolderActions } from "@/features/jobs/job-card-new/useJobCardFolderActions";
import { useJobCardTransport } from "@/features/jobs/job-card-new/useJobCardTransport";
import { loadHojaDeRutaPdfData } from "@/utils/hoja-de-ruta/load-hoja-de-ruta-pdf-data";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateFoldersOptions } from "@/utils/flex-folders";
import { isFestivalLikeJobType } from "@/utils/jobType";
import {
  isAdminRole,
  isDepartmentManagementRole,
  isManagementRole,
} from "@/utils/permissions";


import { queryKeys } from "@/lib/react-query";
export interface JobCardNewProps {
  job: JobCardJob;
  onEditClick: (job: JobCardJob) => void;
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
  detailsOnlyMode?: boolean;
  selectedDate?: Date;
  openHojaDeRuta?: boolean;
  onHojaDeRutaOpened?: () => void;
}

function JobCardNewDetailsOnlyCard({
  job,
  department = "sound",
  selectedDate,
}: JobCardNewProps) {
  const { theme } = useTheme();
  const isJobBeingDeleted = useDeletionState((state) => state.deletingJobs.has(job.id));
  const [jobDetailsDialogOpen, setJobDetailsDialogOpen] = useState(false);

  const appliedBorderColor = React.useMemo(() => {
    const isDark = theme === "dark";
    const borderColor = job.color || "#7E69AB";
    return isDark ? (job.darkColor || borderColor) : borderColor;
  }, [job.color, job.darkColor, theme]);

  const cardOpacity = isJobBeingDeleted ? "opacity-50" : "";
  const pointerEvents = isJobBeingDeleted ? "pointer-events-none" : "";

  return (
    <JobCardNewDetailsOnly
      job={job}
      department={department}
      appliedBorderColor={appliedBorderColor}
      isJobBeingDeleted={isJobBeingDeleted}
      cardOpacity={cardOpacity}
      pointerEvents={pointerEvents}
      selectedDate={selectedDate}
      jobDetailsDialogOpen={jobDetailsDialogOpen}
      setJobDetailsDialogOpen={setJobDetailsDialogOpen}
    />
  );
}

function JobCardNewFull({
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
  hideTasks = false,
  openHojaDeRuta = false,
  onHojaDeRutaOpened
}: JobCardNewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { addDeletingJob, removeDeletingJob, isDeletingJob } = useDeletionState();

  // Stream Deck integration: selected job state
  const { selectJob, clearSelection, isJobSelected } = useSelectedJobStore();
  const isSelected = isJobSelected(job.id);
  const [routeSheetOpen, setRouteSheetOpen] = useState(false);
  const [projectNotesOpen, setProjectNotesOpen] = useState(false);
  const [taskManagerOpen, setTaskManagerOpen] = useState(false);
  const [isGeneratingTransportPdf, setIsGeneratingTransportPdf] = useState(false);
  const [isGeneratingCrewReportPdf, setIsGeneratingCrewReportPdf] = useState(false);

  // Add folder creation loading state
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  const [isCreatingLocalFolders, setIsCreatingLocalFolders] = useState(false);
  const [flexPickerOpen, setFlexPickerOpen] = useState(false);
  const [flexPickerOptions, setFlexPickerOptions] = useState<CreateFoldersOptions | undefined>(undefined);
  const [flexPickerMode, setFlexPickerMode] = useState<'create' | 'add'>('create');
  // Collapsible sections (collapsed by default)
  const [docsCollapsed, setDocsCollapsed] = useState(true);
  const [ridersCollapsed, setRidersCollapsed] = useState(true);
  const [tourDocsCollapsed, setTourDocsCollapsed] = useState(true);
  const isFestivalLike = isFestivalLikeJobType(job?.job_type);

  // Track if we've already opened the modal from URL param to prevent race condition
  const openedFromParamRef = useRef(false);

  // Open hoja de ruta modal if requested via URL parameter
  useEffect(() => {
    if (!openHojaDeRuta) {
      openedFromParamRef.current = false;
      return;
    }
    // Only "consume" the URL param when we can actually show the modal
    if (!isProjectManagementPage) return;
    if (openedFromParamRef.current) return;

    openedFromParamRef.current = true;
    setRouteSheetOpen(true);
    onHojaDeRutaOpened?.();
  }, [openHojaDeRuta, isProjectManagementPage, onHojaDeRutaOpened]);

  // Load artists then rider files (2-step RLS-friendly) for all job types except dry hire
  const { data: cardArtists = [] } = useQuery({
    queryKey: queryKeys.scope('jobcard-artists', job.id),
    enabled: !!job?.id && job.job_type !== 'dryhire',
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('festival_artists')
        .select('id, name')
        .eq('job_id', job.id);
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    },
    staleTime: 5 * 60_000,
  });
  const cardArtistIds = React.useMemo(() => cardArtists.map(a => a.id), [cardArtists]);
  const cardArtistNameMap = React.useMemo(() => new Map(cardArtists.map(a => [a.id, a.name])), [cardArtists]);
  const { data: riderFiles = [] } = useQuery({
    queryKey: queryKeys.scope('jobcard-rider-files', job.id, cardArtistIds),
    enabled: !!job?.id && cardArtistIds.length > 0,
    queryFn: async () => {
      let query = dataLayerClient.from('festival_artist_files')
        .select('id, file_name, file_path, uploaded_at, artist_id')
        .order('uploaded_at', { ascending: false });
      if (cardArtistIds.length === 1) {
        query = query.eq('artist_id', cardArtistIds[0]);
      } else {
        const orExpr = cardArtistIds.map((id) => `artist_id.eq.${id}`).join(',');
        query = query.or(orExpr);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Array<{ id: string; file_name: string; file_path: string; uploaded_at: string; artist_id: string }>;
    }
  });

  // Load tour documents for jobs linked to a tour (e.g. tourdate jobs)
  const cardTourId: string | null = job.tour_id || job.tour_date?.tour?.id || null;
  const { data: tourDocuments = [] } = useQuery({
    queryKey: queryKeys.scope('jobcard-tour-documents', job.id, cardTourId),
    enabled: !!cardTourId && job.job_type !== 'dryhire',
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('tour_documents')
        .select('id, file_name, file_path, uploaded_at')
        .eq('tour_id', cardTourId)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{ id: string; file_name: string; file_path: string; uploaded_at: string }>;
    },
    staleTime: 5 * 60_000,
  });

  const viewTourDocument = async (file: { file_path: string }) => {
    try {
      const { data, error } = await dataLayerClient.storage
        .from('tour-documents')
        .createSignedUrl(file.file_path, 3600);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
    } catch (error) {
      console.error('Error viewing tour document:', error);
      toast({
        title: "Error",
        description: "No se pudo abrir el documento de la gira",
        variant: "destructive"
      });
    }
  };

  const downloadTourDocument = async (file: { file_path: string; file_name: string }) => {
    let url: string | null = null;
    try {
      const { data, error } = await dataLayerClient.storage
        .from('tour-documents')
        .download(file.file_path);
      if (error) throw error;
      if (!data) return;
      url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading tour document:', error);
      toast({
        title: "Error",
        description: "No se pudo descargar el documento de la gira",
        variant: "destructive"
      });
    } finally {
      if (url) window.URL.revokeObjectURL(url);
    }
  };

  const viewRider = async (file: { file_path: string }) => {
    const { data } = await dataLayerClient.storage
      .from('festival_artist_files')
      .createSignedUrl(file.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  };

  const downloadRider = async (file: { file_path: string; file_name: string }) => {
    const { data } = await dataLayerClient.storage
      .from('festival_artist_files')
      .download(file.file_path);
    if (!data) return;
    const url = window.URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };
  const [jobDetailsDialogOpen, setJobDetailsDialogOpen] = useState(false);
  const [flexLogDialogOpen, setFlexLogDialogOpen] = useState(false);
  const [transportDialogOpen, setTransportDialogOpen] = useState(false);
  const [logisticsDialogOpen, setLogisticsDialogOpen] = useState(false);
  const [requirementsDialogOpen, setRequirementsDialogOpen] = useState(false);
  const [selectedTransportRequest, setSelectedTransportRequest] =
    useState<SelectedTransportRequest | null>(null);
  const [logisticsInitialEventType, setLogisticsInitialEventType] = useState<'load' | 'unload' | undefined>(undefined);
  const { user, userDepartment: currentUserDepartment } = useOptimizedAuth();
  const isManagementUser = isManagementRole(userRole);
  const canManageProjectNotes = isProjectManagementPage && isManagementUser;

  const canGenerateTransportPdf = React.useMemo(() => {
    const normalizedDepartment = (currentUserDepartment || '').trim().toLowerCase();

    if (isAdminRole(userRole)) return true;
    if (!isDepartmentManagementRole(userRole)) return false;

    return ['logistics', 'production', 'produccion', 'producción'].includes(normalizedDepartment);
  }, [currentUserDepartment, userRole]);

  const canGenerateCrewReportPdf = React.useMemo(() => (
    isProjectManagementPage &&
    department === "production" &&
    job.job_type !== "dryhire" &&
    isManagementRole(userRole)
  ), [department, isProjectManagementPage, job.job_type, userRole]);

  const {
    appliedBorderColor,
    appliedBgColor,
    collapsed,
    assignments,
    documents,
    reqSummary,
    requiredVsAssigned,
    soundTaskDialogOpen,
    lightsTaskDialogOpen,
    videoTaskDialogOpen,
    editJobDialogOpen,
    assignmentDialogOpen,
    soundTasks,
    isHouseTech,
    canEditJobs,
    canManageArtists,
    canUploadDocuments,
    canCreateFlexFolders,
    toggleCollapse,
    handleEditButtonClick,
    handleFileUpload,
    handleDeleteDocument,
    refreshData,
    setSoundTaskDialogOpen,
    setLightsTaskDialogOpen,
    setVideoTaskDialogOpen,
    setEditJobDialogOpen,
    setAssignmentDialogOpen
  } = useOptimizedJobCard(job, department, userRole, onEditClick, onDeleteClick, onJobClick, {
    enableRoleSummary: true,
    enableSoundTasks: !hideTasks,
    refreshAssignmentsOnMount: isProjectManagementPage,
  });

  const isJobBeingDeleted = isDeletingJob(job.id);

  const techName = React.useMemo(() => {
    const currentUserId = user?.id;
    if (!currentUserId) return "";

    const assignmentRows = assignments;
    const match =
      assignmentRows.find((a) => a?.technician_id === currentUserId && a?.profiles) ||
      assignmentRows.find((a) => a?.profiles);

    const profile = match?.profiles ? (Array.isArray(match.profiles) ? match.profiles[0] : match.profiles) : null;
    if (!profile) return "";

    return [profile.first_name, profile.nickname, profile.last_name].filter(Boolean).join(" ").trim();
  }, [assignments, user?.id]);

  const systemThinksFoldersExist = Boolean(job.flex_folders_created || job.flex_folders_exist);
  const shouldCheckFolders = canCreateFlexFolders;

  // Check folder existence only when folder actions are available (avoids N+1 queries for tech-only views)
  const folderExistenceJobId = shouldCheckFolders ? job.id : "";
  const folderExistenceTourDateId = shouldCheckFolders ? job.tour_date_id : null;
  const { data: foldersExist, isLoading: isFoldersLoading } = useFolderExistence(
    folderExistenceJobId,
    folderExistenceTourDateId
  );

  const actualFoldersExist = foldersExist === true;
  const foldersAreCreated = shouldCheckFolders ? actualFoldersExist : systemThinksFoldersExist;

  // Detect inconsistency for logging/debugging (only when we actually checked)
  const hasInconsistency = shouldCheckFolders && systemThinksFoldersExist && foldersExist === false;
  if (hasInconsistency) {
    console.warn("JobCardNew: Folder state inconsistency detected for job", job.id, {
      systemThinks: systemThinksFoldersExist,
      actualExists: actualFoldersExist,
      dbFlag: job.flex_folders_created,
      flexFoldersExist: job.flex_folders_exist
    });
  }

  const {
    allRequests,
    checkAndFulfillRequest,
    handleCreateWhatsappGroup,
    handleRetryWhatsappGroup,
    handleTransportClick,
    isTechDept,
    jobTimesheets,
    myTransportRequest,
    transportButtonLabel,
    transportButtonTone,
    waGroup,
    waRequest,
  } = useJobCardTransport({
    assignments,
    confirm,
    currentUserDepartment,
    department,
    isFestivalLike,
    isManagementUser,
    job,
    queryClient,
    setLogisticsDialogOpen,
    setLogisticsInitialEventType,
    setSelectedTransportRequest,
    setTransportDialogOpen,
    toast,
  });

  const {
    addFlexFoldersHandler,
    createFlexFoldersHandler,
    createLocalFoldersHandler,
    handleDeleteClick,
    handleFlexPickerConfirm,
    syncStatusToFlex,
  } = useJobCardFolderActions({
    actualFoldersExist,
    addDeletingJob,
    confirm,
    flexPickerMode,
    isCreatingFolders,
    isCreatingLocalFolders,
    isJobBeingDeleted,
    isManagementUser,
    job,
    onDeleteClick,
    queryClient,
    removeDeletingJob,
    setFlexPickerMode,
    setFlexPickerOpen,
    setFlexPickerOptions,
    setIsCreatingFolders,
    setIsCreatingLocalFolders,
    toast,
  });

  const handleJobCardClick = (e?: React.MouseEvent) => {
    console.log('[JobCard] Click detected:', {
      hasEvent: !!e,
      ctrlKey: e?.ctrlKey,
      altKey: e?.altKey,
      metaKey: e?.metaKey,
      isHouseTech,
      isJobBeingDeleted,
      isSelected,
      jobId: job.id
    });

    if (isHouseTech || isJobBeingDeleted) {
      console.log('[JobCard] Click ignored - houseTech or being deleted');
      return;
    }

    // Ctrl+Click / Alt+Click: Toggle job selection for Stream Deck shortcuts
    if (e && (e.ctrlKey || e.altKey || e.metaKey)) {
      console.log('[JobCard] Ctrl/Alt/Meta click detected - toggling selection');
      if (isSelected) {
        console.log('[JobCard] Clearing selection');
        clearSelection();
      } else {
        console.log('[JobCard] Selecting job:', job.id);
        selectJob({
          id: job.id,
          title: job.title,
          department: department,
          job_type: job.job_type,
          start_time: job.start_time,
          end_time: job.end_time,
          color: job.color,
        });
      }
      return;
    }

    // Normal click: open job details
    if (!isProjectManagementPage) {
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

  const handleGenerateTransportPdf = React.useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canGenerateTransportPdf || isGeneratingTransportPdf) return;

    setIsGeneratingTransportPdf(true);
    try {
      const hojaPdfData = await loadHojaDeRutaPdfData(job.id);

      if (!hojaPdfData) {
        toast({
          title: "Sin datos de Hoja de Ruta",
          description: "No existe una Hoja de Ruta guardada para este trabajo.",
          variant: "destructive",
        });
        return;
      }

      const { generateDriverCertificatePDF } = await import("@/utils/hoja-de-ruta/pdf");

      await generateDriverCertificatePDF({
        eventData: hojaPdfData.eventData,
        selectedJobId: job.id,
        jobTitle: job.title || "",
        jobDate: job.start_time || undefined,
        venueMapPreview: hojaPdfData.venueMapPreview,
        toast,
      });
    } catch (error) {
      console.error("JobCardNew: Error generating Hoja de Transportes PDF:", error);
      toast({
        title: "Error al generar PDF",
        description: "No se pudo generar la Hoja de Transportes para este trabajo.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTransportPdf(false);
    }
  }, [canGenerateTransportPdf, isGeneratingTransportPdf, job.id, job.start_time, job.title, toast]);

  const handleGenerateCrewReportPdf = React.useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canGenerateCrewReportPdf || isGeneratingCrewReportPdf) return;

    setIsGeneratingCrewReportPdf(true);
    try {
      const { downloadProjectCrewReportPdf } = await import("@/utils/pdf/projectCrewReportPdf");
      const result = await downloadProjectCrewReportPdf({
        id: job.id,
        title: job.title,
        start_time: job.start_time,
        end_time: job.end_time,
        timezone: job.timezone,
        job_date_types: job.job_date_types,
        tour_date: job.tour_date,
        location:
          job.location && typeof job.location === "object"
            ? job.location
            : null,
      });

      toast({
        title: "PDF de personal generado",
        description: `Informe creado con ${result.crewCount} persona${result.crewCount === 1 ? "" : "s"} asignada${result.crewCount === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      console.error("JobCardNew: Error generating crew report PDF:", error);
      toast({
        title: "Error al generar PDF",
        description: "No se pudo generar el informe de personal para este trabajo.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCrewReportPdf(false);
    }
  }, [canGenerateCrewReportPdf, isGeneratingCrewReportPdf, job, toast]);

  // Show loading state if job is being deleted
  const cardOpacity = isJobBeingDeleted ? "opacity-50" : "";
  const pointerEvents = isJobBeingDeleted ? "pointer-events-none" : "";

  return (
    <JobCardNewView
      job={job}
      department={department}
      userRole={userRole}
      isProjectManagementPage={isProjectManagementPage}
      hideTasks={hideTasks}
      isHouseTech={isHouseTech}
      isJobBeingDeleted={isJobBeingDeleted}
      cardOpacity={cardOpacity}
      pointerEvents={pointerEvents}
      appliedBorderColor={appliedBorderColor}
      appliedBgColor={appliedBgColor}
      collapsed={collapsed}
      toggleCollapse={toggleCollapse}
      handleJobCardClick={handleJobCardClick}
      routeSheetOpen={routeSheetOpen}
      setRouteSheetOpen={setRouteSheetOpen}
      canGenerateTransportPdf={canGenerateTransportPdf}
      isGeneratingTransportPdf={isGeneratingTransportPdf}
      handleGenerateTransportPdf={handleGenerateTransportPdf}
      canGenerateCrewReportPdf={canGenerateCrewReportPdf}
      isGeneratingCrewReportPdf={isGeneratingCrewReportPdf}
      handleGenerateCrewReportPdf={handleGenerateCrewReportPdf}
      canManageProjectNotes={canManageProjectNotes}
      projectNotesOpen={projectNotesOpen}
      setProjectNotesOpen={setProjectNotesOpen}
      foldersAreCreated={foldersAreCreated}
      isFoldersLoading={isFoldersLoading}
      showUpload={showUpload}
      canEditJobs={canEditJobs}
      canCreateFlexFolders={canCreateFlexFolders}
      canUploadDocuments={canUploadDocuments}
      canManageArtists={canManageArtists}
      isCreatingFolders={isCreatingFolders}
      isCreatingLocalFolders={isCreatingLocalFolders}
      techName={techName}
      assignments={assignments}
      jobTimesheets={jobTimesheets || []}
      documents={documents}
      docsCollapsed={docsCollapsed}
      setDocsCollapsed={setDocsCollapsed}
      handleDeleteDocument={handleDeleteDocument}
      riderFiles={riderFiles}
      cardArtistNameMap={cardArtistNameMap}
      ridersCollapsed={ridersCollapsed}
      setRidersCollapsed={setRidersCollapsed}
      viewRider={viewRider}
      downloadRider={downloadRider}
      tourDocuments={tourDocuments}
      tourDocsCollapsed={tourDocsCollapsed}
      setTourDocsCollapsed={setTourDocsCollapsed}
      viewTourDocument={viewTourDocument}
      downloadTourDocument={downloadTourDocument}
      soundTasks={soundTasks}
      reqSummary={reqSummary}
      requiredVsAssigned={requiredVsAssigned}
      setRequirementsDialogOpen={setRequirementsDialogOpen}
      refreshData={refreshData}
      handleEditButtonClick={handleEditButtonClick}
      handleDeleteClick={handleDeleteClick}
      createFlexFoldersHandler={createFlexFoldersHandler}
      addFlexFoldersHandler={addFlexFoldersHandler}
      createLocalFoldersHandler={createLocalFoldersHandler}
      handleFestivalArtistsClick={handleFestivalArtistsClick}
      handleFileUpload={handleFileUpload}
      syncStatusToFlex={syncStatusToFlex}
      transportButtonLabel={transportButtonLabel}
      transportButtonTone={transportButtonTone}
      handleTransportClick={handleTransportClick}
      handleCreateWhatsappGroup={handleCreateWhatsappGroup}
      handleRetryWhatsappGroup={handleRetryWhatsappGroup}
      waGroup={waGroup}
      waRequest={waRequest}
      setTaskManagerOpen={setTaskManagerOpen}
      taskManagerOpen={taskManagerOpen}
      soundTaskDialogOpen={soundTaskDialogOpen}
      setSoundTaskDialogOpen={setSoundTaskDialogOpen}
      lightsTaskDialogOpen={lightsTaskDialogOpen}
      setLightsTaskDialogOpen={setLightsTaskDialogOpen}
      videoTaskDialogOpen={videoTaskDialogOpen}
      setVideoTaskDialogOpen={setVideoTaskDialogOpen}
      editJobDialogOpen={editJobDialogOpen}
      setEditJobDialogOpen={setEditJobDialogOpen}
      assignmentDialogOpen={assignmentDialogOpen}
      setAssignmentDialogOpen={setAssignmentDialogOpen}
      jobDetailsDialogOpen={jobDetailsDialogOpen}
      setJobDetailsDialogOpen={setJobDetailsDialogOpen}
      flexLogDialogOpen={flexLogDialogOpen}
      setFlexLogDialogOpen={setFlexLogDialogOpen}
      transportDialogOpen={transportDialogOpen}
      setTransportDialogOpen={setTransportDialogOpen}
      logisticsDialogOpen={logisticsDialogOpen}
      setLogisticsDialogOpen={setLogisticsDialogOpen}
      selectedTransportRequest={selectedTransportRequest}
      setSelectedTransportRequest={setSelectedTransportRequest}
      logisticsInitialEventType={logisticsInitialEventType}
      setLogisticsInitialEventType={setLogisticsInitialEventType}
      isTechDept={isTechDept}
      userDepartment={currentUserDepartment}
      myTransportRequest={myTransportRequest}
      allRequests={allRequests}
      queryClient={queryClient}
      checkAndFulfillRequest={checkAndFulfillRequest}
      requirementsDialogOpen={requirementsDialogOpen}
      flexPickerOpen={flexPickerOpen}
      setFlexPickerOpen={setFlexPickerOpen}
      flexPickerOptions={flexPickerOptions}
      handleFlexPickerConfirm={handleFlexPickerConfirm}
      isSelected={isSelected}
    />
  );
}

export function JobCardNew(props: JobCardNewProps) {
  if (props.detailsOnlyMode) {
    return <JobCardNewDetailsOnlyCard {...props} />;
  }

  return <JobCardNewFull {...props} />;
}

export type { JobDocument } from './JobCardDocuments';
