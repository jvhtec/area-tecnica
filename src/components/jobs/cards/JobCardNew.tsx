import React, { useState, useEffect, useRef } from 'react';
import { Department } from "@/types/department";

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
import { supabase } from "@/lib/supabase";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { createAllFoldersForJob } from "@/utils/flex-folders";
import { format } from "date-fns";
import { createSafeFolderName, sanitizeFolderName } from "@/utils/folderNameSanitizer";
import type { JobDocument } from './JobCardDocuments';
import { JobCardNewDetailsOnly } from "./job-card-new/JobCardNewDetailsOnly";
import { JobCardNewView } from "./job-card-new/JobCardNewView";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreateFoldersOptions } from "@/utils/flex-folders";

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
  detailsOnlyMode?: boolean;
  openHojaDeRuta?: boolean;
  onHojaDeRutaOpened?: () => void;
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
  hideTasks = false,
  detailsOnlyMode = false,
  openHojaDeRuta = false,
  onHojaDeRutaOpened
}: JobCardNewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addDeletingJob, removeDeletingJob, isDeletingJob } = useDeletionState();
  const [routeSheetOpen, setRouteSheetOpen] = useState(false);
  const [taskManagerOpen, setTaskManagerOpen] = useState(false);

  // Add folder creation loading state
  const [isCreatingFolders, setIsCreatingFolders] = useState(false);
  const [isCreatingLocalFolders, setIsCreatingLocalFolders] = useState(false);
  const [flexPickerOpen, setFlexPickerOpen] = useState(false);
  const [flexPickerOptions, setFlexPickerOptions] = useState<CreateFoldersOptions | undefined>(undefined);
  const [flexPickerMode, setFlexPickerMode] = useState<'create' | 'add'>('create');
  // Collapsible sections (collapsed by default)
  const [docsCollapsed, setDocsCollapsed] = useState(true);
  const [ridersCollapsed, setRidersCollapsed] = useState(true);

  // Track if we've already opened the modal from URL param to prevent race condition
  const openedFromParamRef = useRef(false);

  // Open hoja de ruta modal if requested via URL parameter
  useEffect(() => {
    if (!openHojaDeRuta) {
      openedFromParamRef.current = false;
      return;
    }
    // Only "consume" the URL param when we can actually show the modal
    if (!isProjectManagementPage || detailsOnlyMode) return;
    if (openedFromParamRef.current) return;

    openedFromParamRef.current = true;
    setRouteSheetOpen(true);
    onHojaDeRutaOpened?.();
  }, [openHojaDeRuta, isProjectManagementPage, detailsOnlyMode]);

  // Load artists then rider files (2-step RLS-friendly)
  const { data: cardArtists = [] } = useQuery({
    queryKey: ['jobcard-artists', job.id],
    enabled: !!job?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('festival_artists')
        .select('id, name')
        .eq('job_id', job.id);
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    }
  });
  const cardArtistIds = React.useMemo(() => cardArtists.map(a => a.id), [cardArtists]);
  const cardArtistNameMap = React.useMemo(() => new Map(cardArtists.map(a => [a.id, a.name])), [cardArtists]);
  const { data: riderFiles = [] } = useQuery({
    queryKey: ['jobcard-rider-files', job.id, cardArtistIds],
    enabled: !!job?.id && cardArtistIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from('festival_artist_files')
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

  const viewRider = async (file: { file_path: string }) => {
    const { data } = await supabase.storage
      .from('festival_artist_files')
      .createSignedUrl(file.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  };

  const downloadRider = async (file: { file_path: string; file_name: string }) => {
    const { data } = await supabase.storage
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
  const [selectedTransportRequest, setSelectedTransportRequest] = useState<any | null>(null);
  const [logisticsInitialEventType, setLogisticsInitialEventType] = useState<'load' | 'unload' | undefined>(undefined);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);

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
    isJobBeingDeleted,
    soundTasks,
    personnel,
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
  } = useOptimizedJobCard(job, department, userRole, onEditClick, onDeleteClick, onJobClick);

  // Check folder existence with proper loading state handling
  const { data: foldersExist, isLoading: isFoldersLoading } = useFolderExistence(job.id);

  // Updated logic: prioritize actual folder existence over database flags
  const actualFoldersExist = foldersExist === true;
  const systemThinksFoldersExist = job.flex_folders_created || job.flex_folders_exist;

  // Detect inconsistency for logging/debugging
  const hasInconsistency = systemThinksFoldersExist && !actualFoldersExist;
  if (hasInconsistency) {
    console.warn("JobCardNew: Folder state inconsistency detected for job", job.id, {
      systemThinks: systemThinksFoldersExist,
      actualExists: actualFoldersExist,
      dbFlag: job.flex_folders_created,
      flexFoldersExist: job.flex_folders_exist
    });
  }

  // Final decision: only consider folders created if they actually exist
  const foldersAreCreated = actualFoldersExist;

  // Load current user's department
  React.useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from('profiles')
          .select('department')
          .eq('id', user.id)
          .single();
        if (!error) setUserDepartment(data?.department || null);
      } catch { }
    })();
  }, []);

  // Queries for transport requests and logistics events
  const { data: myTransportRequest } = useQuery({
    queryKey: ['transport-request', job.id, userDepartment],
    queryFn: async () => {
      if (!userDepartment || !['sound', 'lights', 'video'].includes(userDepartment)) return null;
      const { data, error } = await supabase
        .from('transport_requests')
        .select('id, department, status, note, description, created_at, items:transport_request_items(id, transport_type, leftover_space_meters)')
        .eq('job_id', job.id)
        .eq('department', userDepartment)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!job?.id && !!userDepartment,
  });

  const { data: allRequests = [] } = useQuery({
    queryKey: ['transport-requests-all', job.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transport_requests')
        .select('id, department, status, note, description, created_at, items:transport_request_items(id, transport_type, leftover_space_meters)')
        .eq('job_id', job.id)
        .eq('status', 'requested')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!job?.id && ((userDepartment === 'logistics') || ['admin', 'management'].includes(userRole || '')),
  });

  const { data: jobEvents = [] } = useQuery({
    queryKey: ['logistics-events-for-job', job.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logistics_events')
        .select('id')
        .eq('job_id', job.id);
      if (error) return [];
      return data || [];
    },
    enabled: !!job?.id,
  });

  const isScheduled = (jobEvents?.length || 0) > 0;
  const hasRequest = Boolean(myTransportRequest) || (Array.isArray(allRequests) && allRequests.length > 0);
  const isTechDept = !!userDepartment && ['sound', 'lights', 'video'].includes(userDepartment);

  const handleCancelTransportRequest = React.useCallback(
    async (requestId: string) => {
      if (!requestId) return;
      const { error } = await supabase.from("transport_requests").update({ status: "cancelled" }).eq("id", requestId);
      if (error) {
        console.error("[JobCardNew] Failed to cancel transport request:", error);
        toast({
          title: "No se pudo cancelar",
          description: error.message || "Error cancelando la solicitud de transporte",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Solicitud cancelada",
        description: "La solicitud de transporte se ha cancelado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["transport-requests-all", job.id] });
    },
    [job.id, queryClient, toast]
  );

  const transportButtonLabel = (() => {
    if (isScheduled) return 'Transport Scheduled';
    if ((userDepartment === 'logistics') || ((userRole === 'management' || userRole === 'admin') && !isTechDept)) {
      return allRequests.length > 0 ? `Requests (${allRequests.length})` : 'Logistics';
    }
    if (isTechDept) {
      return myTransportRequest ? 'Transport Requested' : 'Request Transport';
    }
    return undefined;
  })();

  const transportButtonTone = isScheduled ? 'default' : hasRequest ? 'secondary' : 'outline';

  const handleTransportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ((userDepartment === 'logistics') || ((userRole === 'management' || userRole === 'admin') && !isTechDept)) {
      setTransportDialogOpen(true); // open requests manager
    } else if (isTechDept && userDepartment) {
      setTransportDialogOpen(true); // open request creator
    }
  };

  // WhatsApp group existence for this job + department (for management only)
  const { data: waGroup, refetch: refetchWaGroup } = useQuery({
    queryKey: ['job-whatsapp-group', job.id, department],
    enabled: !!job?.id && !!department && (userRole === 'management' || userRole === 'admin'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_whatsapp_groups')
        .select('id, wa_group_id')
        .eq('job_id', job.id)
        .eq('department', department)
        .maybeSingle();
      if (error) return null;
      return data;
    }
  });

  const { data: waRequest, refetch: refetchWaRequest } = useQuery({
    queryKey: ['job-whatsapp-group-request', job.id, department],
    enabled: !!job?.id && !!department && (userRole === 'management' || userRole === 'admin'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_whatsapp_group_requests')
        .select('id, created_at')
        .eq('job_id', job.id)
        .eq('department', department)
        .maybeSingle();
      if (error) return null;
      return data;
    }
  });

  // Fetch timesheet statuses per technician for this job (for badge color coding)
  const { data: jobTimesheets } = useQuery({
    queryKey: ["job-timesheets-status", job.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timesheets')
        .select('technician_id, status')
        .eq('job_id', job.id)
        .eq('is_active', true);
      if (error) throw error;
      return data as { technician_id: string; status: string }[];
    },
    enabled: job.job_type !== 'dryhire' && job.job_type !== 'tourdate',
    staleTime: 60_000
  });

  // Realtime invalidation when timesheets change
  useEffect(() => {
    if (job.job_type === 'dryhire' || job.job_type === 'tourdate') return;

    const channel = supabase
      .channel(`job-timesheets-${job.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'timesheets', filter: `job_id=eq.${job.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["job-timesheets-status", job.id] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [job.id, job.job_type, queryClient]);

  const handleCreateWhatsappGroup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!(userRole === 'management' || userRole === 'admin')) return;
    try {
      // Pre-check: warn for missing phones
      const { data: rows } = await supabase
        .from('job_assignments')
        .select('sound_role, lights_role, video_role, profiles!job_assignments_technician_id_fkey(first_name,last_name,phone)')
        .eq('job_id', job.id);
      const deptKey = department === 'sound' ? 'sound_role' : department === 'lights' ? 'lights_role' : 'video_role';
      const crew = (rows || []).filter((r: any) => !!r[deptKey]);
      const missing: string[] = [];
      let validPhones = 0;
      for (const r of crew) {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        const full = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Técnico';
        const ph = (profile?.phone || '').trim();
        if (!ph) missing.push(full); else validPhones += 1;
      }
      if (validPhones === 0) {
        toast({ title: 'Sin teléfonos', description: 'No hay teléfonos válidos para el equipo asignado.', variant: 'destructive' });
        return;
      }
      if (missing.length > 0) {
        const proceed = window.confirm(`Faltan teléfonos para ${missing.length} técnico(s):\n- ${missing.slice(0, 5).join('\n- ')}${missing.length > 5 ? '\n...' : ''}\n\n¿Crear el grupo igualmente?`);
        if (!proceed) return;
      }

      const { data, error } = await supabase.functions.invoke('create-whatsapp-group', {
        body: { job_id: job.id as string, department: department as any }
      });
      if (error) {
        // Even on error, lock may have been recorded. We’ll refetch lock and inform user.
        toast({ title: 'Grupo solicitado', description: 'Se ha solicitado la creación del grupo. El botón quedará bloqueado.', });
      } else {
        const warnings = (data as any)?.warnings;
        toast({
          title: (data as any)?.wa_group_id ? 'Grupo creado' : 'Grupo solicitado',
          description: warnings && (warnings.missing?.length || warnings.invalid?.length)
            ? `Avisos: sin teléfono ${warnings.missing?.length || 0}, inválidos ${warnings.invalid?.length || 0}`
            : ((data as any)?.note || 'Operación realizada.')
        });
      }
      await Promise.all([refetchWaGroup(), refetchWaRequest()]);
    } catch (err: any) {
      // Still lock; refetch
      await Promise.all([refetchWaGroup(), refetchWaRequest()]);
      toast({ title: 'Grupo solicitado', description: 'Se ha solicitado la creación del grupo. El botón quedará bloqueado.' });
    }
  };

  // Auto-fulfill request when both load and unload exist for the request's department
  const checkAndFulfillRequest = async (requestId: string, departmentForReq: string) => {
    try {
      const { data: events } = await supabase
        .from('logistics_events')
        .select('id, event_type, logistics_event_departments(department)')
        .eq('job_id', job.id)
        .eq('logistics_event_departments.department', departmentForReq);
      const hasLoad = !!events?.some((e: any) => e.event_type === 'load');
      const hasUnload = !!events?.some((e: any) => e.event_type === 'unload');
      if (hasLoad && hasUnload) {
        await supabase.from('transport_requests').update({ status: 'fulfilled' }).eq('id', requestId);
        queryClient.invalidateQueries({ queryKey: ['transport-request', job.id, departmentForReq] });
        queryClient.invalidateQueries({ queryKey: ['transport-requests-all', job.id] });
      }
    } catch { }
  };

  // Manual Flex sync handler
  const syncStatusToFlex = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const mapStatus = (s: string | null | undefined): 'tentativa' | 'confirmado' | 'cancelado' | null => {
        switch (s) {
          case 'Tentativa':
            return 'tentativa';
          case 'Confirmado':
            return 'confirmado';
          case 'Cancelado':
            return 'cancelado';
          default:
            return null; // skip 'Completado' and others
        }
      };
      const flexStatus = mapStatus(job.status);
      if (!flexStatus) {
        toast({ title: 'Not applicable', description: 'Only Tentativa/Confirmado/Cancelado are synced to Flex.' });
        return;
      }
      const { data: folders, error: fErr } = await supabase
        .from('flex_folders')
        .select('id, parent_id, department, folder_type')
        .eq('job_id', job.id);
	      if (fErr || !folders || folders.length === 0) {
	        toast({ title: 'No Flex folders', description: 'Create Flex folders before syncing status.', variant: 'destructive' });
	        return;
	      }
	      const master =
	        folders.find((f: any) => !f.parent_id && String(f.folder_type || '').toLowerCase() === 'main_event')
	        || folders.find((f: any) => !f.parent_id)
	        || null;

	      if (!master?.id) {
	        toast({ title: 'Flex sync failed', description: 'No Flex master folder found for this job.', variant: 'destructive' });
	        return;
	      }

	      const { data: res, error } = await supabase.functions.invoke('apply-flex-status', {
	        body: { folder_id: master.id, status: flexStatus, cascade: true }
	      });
	      if (error || !res?.success) {
	        const msg =
	          (res as any)?.error
	          || (res as any)?.response?.exceptionMessage
	          || (res as any)?.response?.primaryMessage
	          || (res as any)?.response?.message
	          || undefined;
	        toast({ title: 'Flex sync failed', description: msg || 'See logs for details.', variant: 'destructive' });
	      } else {
	        const cascade = (res as any)?.cascade as any;
	        const attempted = typeof cascade?.attempted === 'number' ? cascade.attempted : null;
	        const succeeded = typeof cascade?.succeeded === 'number' ? cascade.succeeded : null;
	        const failed = typeof cascade?.failed === 'number' ? cascade.failed : null;

	        if (attempted !== null && attempted > 0) {
	          if (failed === 0) {
	            toast({
	              title: 'Flex synced',
	              description: `Status synchronized with Flex (root + ${attempted} subfolder${attempted === 1 ? '' : 's'}).`
	            });
	          } else if (typeof failed === 'number' && failed > 0) {
	            toast({
	              title: 'Flex sync warning',
	              description: `Root synced, but only ${succeeded ?? 0}/${attempted} subfolders updated. Check Flex logs.`
	            });
	          } else {
	            toast({ title: 'Flex synced', description: 'Status synchronized with Flex.' });
	          }
	        } else if (attempted === 0) {
	          toast({ title: 'Flex synced', description: 'Status synchronized with Flex (root only; no subfolders found).' });
	        } else {
	          toast({ title: 'Flex synced', description: 'Status synchronized with Flex.' });
	        }
	      }
	    } catch (err: any) {
	      toast({ title: 'Error', description: err?.message || String(err), variant: 'destructive' });
	    }
	  };

  // Optimistic delete handler with instant UI feedback
  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isJobBeingDeleted) {
      console.log("JobCardNew: Job deletion already in progress");
      return;
    }

    if (!["admin", "management"].includes(userRole || "")) {
      toast({
        title: "Permission denied",
        description: "Only admin and management users can delete jobs",
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone and will remove all related data.')) {
      return;
    }

    try {
      console.log("JobCardNew: Starting optimistic job deletion for:", job.id);

      addDeletingJob(job.id);

      const result = await deleteJobOptimistically(job.id);

      if (result.success) {
        toast({
          title: "Job deleted",
          description: result.details || "The job has been removed and cleanup is running in background."
        });

        onDeleteClick(job.id);

        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
        await queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("JobCardNew: Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      removeDeletingJob(job.id);
    }
  };

  const createFlexFoldersHandler = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isCreatingFolders) {
      console.log("JobCardNew: Folder creation already in progress");
      return;
    }

    // For dryhire jobs, the structure is fixed — create directly without opening the picker
    if (job.job_type === 'dryhire') {
      console.log("JobCardNew: Dryhire detected — creating folders directly without picker", job.id);
      void handleFlexPickerConfirm(undefined, 'create');
      return;
    }

    if (actualFoldersExist) {
      console.log("JobCardNew: Folders already exist — opening picker in add mode", job.id);
      setFlexPickerMode('add');
      setFlexPickerOpen(true);
      return;
    }

    // Open the modal instead of creating immediately
    console.log("JobCardNew: Opening folder picker modal for job:", job.id);
    setFlexPickerMode('create');
    setFlexPickerOpen(true);
  };

  const addFlexFoldersHandler = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isCreatingFolders) {
      console.log("JobCardNew: Folder creation already in progress");
      return;
    }

    if (job.job_type === 'dryhire') {
      console.log("JobCardNew: Dryhire detected — add mode not applicable", job.id);
      return;
    }

    console.log("JobCardNew: Opening folder picker modal in add mode for job:", job.id);
    setFlexPickerMode('add');
    setFlexPickerOpen(true);
  };

  const handleFlexPickerConfirm = async (
    options?: CreateFoldersOptions,
    modeOverride?: 'create' | 'add'
  ) => {
    const mode = modeOverride ?? flexPickerMode;
    console.log("JobCardNew: Flex picker confirmed with options:", options);
    setFlexPickerOptions(options);
    setFlexPickerOpen(false);

    try {
      setIsCreatingFolders(true);

      if (mode === 'create') {
        // Double-check folders don't exist (create-only)
        const { data: existingFolders } = await supabase
          .from("flex_folders")
          .select("id")
          .eq("job_id", job.id)
          .limit(1);

        if (existingFolders && existingFolders.length > 0) {
          console.log("JobCardNew: Found existing folders in final check:", existingFolders);
          toast({
            title: "Folders already exist",
            description: "Flex folders have already been created for this job.",
            variant: "destructive"
          });
          return;
        }
      }

      const startDate = new Date(job.start_time);
      const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, "");

      const formattedStartDate = new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
      const formattedEndDate = new Date(job.end_time).toISOString().split(".")[0] + ".000Z";

      toast({
        title: mode === 'create' ? "Creating folders..." : "Adding folders...",
        description:
          mode === 'create'
            ? "Setting up Flex folder structure for this job."
            : "Creating the selected Flex folders."
      });

      // Pass options to the creation function
      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber, options);

      // Ensure the job is marked as having Flex folders (idempotent).
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ flex_folders_created: true })
        .eq('id', job.id);

      if (updateError) console.error("Error updating job record:", updateError);

      // Broadcast push notification: Flex folders created for job
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'flex.folders.created', job_id: job.id }
        });
      } catch (pushError) {
        console.error('Error sending push notification:', pushError);
      }

      toast({
        title: mode === 'create' ? "Success!" : "Updated!",
        description:
          mode === 'create'
            ? "Flex folders have been created successfully."
            : "Selected Flex folders have been added successfully."
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["optimized-jobs"] }),
        queryClient.invalidateQueries({ queryKey: ["folder-existence", job.id] }),
        queryClient.invalidateQueries({ queryKey: ["folder-existence"] }),
      ]);

    } catch (error: any) {
      console.error("JobCardNew: Error creating flex folders:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create Flex folders",
        variant: "destructive"
      });
    } finally {
      setIsCreatingFolders(false);
    }
  };

  const createLocalFoldersHandler = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isCreatingLocalFolders) {
      console.log("JobCardNew: Local folder creation already in progress");
      return;
    }

    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      toast({
        title: "Not supported",
        description: "Your browser doesn't support local folder creation. Please use Chrome, Edge, or another Chromium-based browser.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreatingLocalFolders(true);

      // Ask user to pick a base folder
      const baseDirHandle = await window.showDirectoryPicker();

      // Format the start date as yymmdd
      const startDate = new Date(job.start_time);
      const formattedDate = format(startDate, "yyMMdd");

      // Create safe folder name
      const { name: rootFolderName, wasSanitized } = createSafeFolderName(job.title, formattedDate);

      if (wasSanitized) {
        console.log('JobCardNew: Folder name was sanitized for safety:', { original: `${formattedDate} - ${job.title}`, sanitized: rootFolderName });
      }

      // Create root folder
      const rootDirHandle = await baseDirHandle.getDirectoryHandle(rootFolderName, { create: true });

      // Get current user's custom folder structure or use default
      const { data: { user } } = await supabase.auth.getUser();
      let folderStructure = null;

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('custom_folder_structure, role')
          .eq('id', user.id)
          .single();

        // Only use custom structure for management users
        if (profile && (profile.role === 'admin' || profile.role === 'management') && profile.custom_folder_structure) {
          folderStructure = profile.custom_folder_structure;
        }
      }

      // Default structure if no custom one exists
      if (!folderStructure) {
        folderStructure = [
          "CAD",
          "QT",
          "Material",
          "Documentación",
          "Rentals",
          "Compras",
          "Rider",
          "Predicciones"
        ];
      }

      // Create folders based on structure
      if (Array.isArray(folderStructure)) {
        for (const folder of folderStructure) {
          if (typeof folder === 'string') {
            // Simple string structure
            const safeFolderName = sanitizeFolderName(folder);
            const subDirHandle = await rootDirHandle.getDirectoryHandle(safeFolderName, { create: true });
            await subDirHandle.getDirectoryHandle("OLD", { create: true });
          } else if (folder && typeof folder === 'object' && folder.name) {
            // Object structure with subfolders
            const safeFolderName = sanitizeFolderName(folder.name);
            const subDirHandle = await rootDirHandle.getDirectoryHandle(safeFolderName, { create: true });

            // Create subfolders if they exist
            if (folder.subfolders && Array.isArray(folder.subfolders)) {
              for (const subfolder of folder.subfolders) {
                const safeSubfolderName = sanitizeFolderName(subfolder);
                await subDirHandle.getDirectoryHandle(safeSubfolderName, { create: true });
              }
            } else {
              // Default to OLD subfolder if no subfolders specified
              await subDirHandle.getDirectoryHandle("OLD", { create: true });
            }
          }
        }
      }

      const isCustom = user && folderStructure !== null;
      toast({
        title: "Success!",
        description: `${isCustom ? 'Custom' : 'Default'} folder structure created at "${rootFolderName}"`
      });

    } catch (error: any) {
      console.error("JobCardNew: Error creating local folders:", error);
      if (error.name === 'AbortError') {
        // User cancelled, don't show error
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create local folder structure",
        variant: "destructive"
      });
    } finally {
      setIsCreatingLocalFolders(false);
    }
  };

  const handleJobCardClick = () => {
    if (isHouseTech || isJobBeingDeleted) {
      return;
    }
    // On project management pages, do not open tasks on card click
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

  // Show loading state if job is being deleted
  const cardOpacity = isJobBeingDeleted ? "opacity-50" : "";
  const pointerEvents = isJobBeingDeleted ? "pointer-events-none" : "";

  // Simplified details-only mode for Dashboard, Sound, Light, Video pages
  if (detailsOnlyMode) {
    return (
      <JobCardNewDetailsOnly
        job={job}
        department={department}
        appliedBorderColor={appliedBorderColor}
        isJobBeingDeleted={isJobBeingDeleted}
        cardOpacity={cardOpacity}
        pointerEvents={pointerEvents}
        jobDetailsDialogOpen={jobDetailsDialogOpen}
        setJobDetailsDialogOpen={setJobDetailsDialogOpen}
      />
    );
  }

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
      foldersAreCreated={foldersAreCreated}
      isFoldersLoading={isFoldersLoading}
      showUpload={showUpload}
      canEditJobs={canEditJobs}
      canCreateFlexFolders={canCreateFlexFolders}
      canUploadDocuments={canUploadDocuments}
      canManageArtists={canManageArtists}
      isCreatingFolders={isCreatingFolders}
      isCreatingLocalFolders={isCreatingLocalFolders}
      personnel={personnel}
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
      userDepartment={userDepartment}
      myTransportRequest={myTransportRequest}
      allRequests={allRequests}
      queryClient={queryClient}
      checkAndFulfillRequest={checkAndFulfillRequest}
      requirementsDialogOpen={requirementsDialogOpen}
      flexPickerOpen={flexPickerOpen}
      setFlexPickerOpen={setFlexPickerOpen}
      flexPickerOptions={flexPickerOptions}
      handleFlexPickerConfirm={handleFlexPickerConfirm}
    />
  );
}

export type { JobDocument } from './JobCardDocuments';
