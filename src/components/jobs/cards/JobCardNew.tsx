import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
import { Eye, Download, ChevronRight, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { createSafeFolderName, sanitizeFolderName } from "@/utils/folderNameSanitizer";
import { JobCardHeader } from './JobCardHeader';
import { JobCardActions } from './JobCardActions';
import { JobCardAssignments } from './JobCardAssignments';
import { JobCardDocuments, JobDocument } from './JobCardDocuments';
import { JobCardProgress } from './JobCardProgress';
import { SoundTaskDialog } from "@/components/sound/SoundTaskDialog";
import { LightsTaskDialog } from "@/components/lights/LightsTaskDialog";
import { VideoTaskDialog } from "@/components/video/VideoTaskDialog";
import { TaskManagerDialog } from "@/components/tasks/TaskManagerDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { JobDetailsDialog } from "@/components/jobs/JobDetailsDialog";
import { FlexSyncLogDialog } from "@/components/jobs/FlexSyncLogDialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModernHojaDeRuta } from "@/components/hoja-de-ruta/ModernHojaDeRuta";
import { TransportRequestDialog } from "@/components/logistics/TransportRequestDialog";
import { LogisticsEventDialog } from "@/components/logistics/LogisticsEventDialog";
import { JobRequirementsEditor } from "@/components/jobs/JobRequirementsEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlexFolderPicker } from "@/components/flex/FlexFolderPicker";
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
  detailsOnlyMode = false
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
  // Collapsible sections (collapsed by default)
  const [docsCollapsed, setDocsCollapsed] = useState(true);
  const [ridersCollapsed, setRidersCollapsed] = useState(true);
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
  const isTechDept = userDepartment && ['sound', 'lights', 'video'].includes(userDepartment);

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
      // Prefer the department subfolder's parent as master, using department column
      const deptLc = (department || '').toLowerCase();
      const sub = folders.find((f: any) => (f.department || '').toLowerCase() === deptLc)
        || folders.find((f: any) => ['sound', 'lights', 'video'].includes((f.department || f.folder_type || '').toLowerCase()));
      const master = sub?.parent_id ? folders.find((f: any) => f.id === sub.parent_id) : null;
      const targetFolderId = master?.id || sub?.parent_id || sub?.id; // fallback to any available id
      const { data: res, error } = await supabase.functions.invoke('apply-flex-status', {
        body: { folder_id: targetFolderId, status: flexStatus, cascade: true }
      });
      if (error || !res?.success) {
        toast({ title: 'Flex sync failed', description: 'See logs for details.' });
      } else {
        toast({ title: 'Flex synced', description: 'Status synchronized with Flex.' });
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
      void handleFlexPickerConfirm(undefined);
      return;
    }

    if (actualFoldersExist) {
      console.log("JobCardNew: Folders actually exist, preventing creation");
      toast({
        title: "Folders already created",
        description: "Flex folders have already been created for this job.",
        variant: "destructive"
      });
      return;
    }

    // Open the modal instead of creating immediately
    console.log("JobCardNew: Opening folder picker modal for job:", job.id);
    setFlexPickerOpen(true);
  };

  const handleFlexPickerConfirm = async (options?: CreateFoldersOptions) => {
    console.log("JobCardNew: Flex picker confirmed with options:", options);
    setFlexPickerOptions(options);
    setFlexPickerOpen(false);

    try {
      setIsCreatingFolders(true);

      // Double-check folders don't exist
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

      const startDate = new Date(job.start_time);
      const documentNumber = startDate.toISOString().slice(2, 10).replace(/-/g, "");

      const formattedStartDate = new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
      const formattedEndDate = new Date(job.end_time).toISOString().split(".")[0] + ".000Z";

      toast({
        title: "Creating folders...",
        description: "Setting up Flex folder structure for this job."
      });

      // Pass options to the creation function
      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber, options);

      const { error: updateError } = await supabase
        .from('jobs')
        .update({ flex_folders_created: true })
        .eq('id', job.id);

      if (updateError) {
        console.error("Error updating job record:", updateError);
      }

      // Broadcast push notification: Flex folders created for job
      try {
        void supabase.functions.invoke('push', {
          body: { action: 'broadcast', type: 'flex.folders.created', job_id: job.id }
        });
      } catch (pushError) {
        console.error('Error sending push notification:', pushError);
      }

      toast({
        title: "Success!",
        description: "Flex folders have been created successfully."
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
    const jobName = job.title || job.name || job.job_name || 'Unnamed Job';
    const startDate = job.start_time ? format(new Date(job.start_time), 'dd/MM/yyyy HH:mm') : '';
    const endDate = job.end_time ? format(new Date(job.end_time), 'dd/MM/yyyy HH:mm') : '';

    // Handle location - it can be a string or an object with {id, name, formatted_address}
    let location = 'No location';
    if (typeof job.location === 'string') {
      location = job.location;
    } else if (job.location && typeof job.location === 'object') {
      location = job.location.name || job.location.formatted_address || 'No location';
    } else if (job.location_data) {
      location = job.location_data.name || job.location_data.formatted_address || 'No location';
    } else if (job.venue_name) {
      location = job.venue_name;
    }

    return (
      <div className="p-2 bg-gray-50 dark:bg-gray-900">
        <Card
          className={cn(
            "hover:shadow-md transition-all duration-200",
            cardOpacity,
            pointerEvents
          )}
          style={{
            borderLeftColor: appliedBorderColor,
            borderLeftWidth: '4px',
          }}
        >
          {isJobBeingDeleted && (
            <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10 rounded">
              <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-md shadow-lg">
                <span className="text-sm font-medium">Deleting job...</span>
              </div>
            </div>
          )}

          <div className="p-4 space-y-3">
            {/* Job Name */}
            <h3 className="font-semibold text-lg truncate" title={jobName}>
              {jobName}
            </h3>

            {/* Dates */}
            <div className="text-sm text-muted-foreground">
              <div className="flex flex-col gap-1">
                {startDate && (
                  <div>
                    <span className="font-medium">Start:</span> {startDate}
                  </div>
                )}
                {endDate && (
                  <div>
                    <span className="font-medium">End:</span> {endDate}
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="text-sm">
              <span className="font-medium">Location:</span>{' '}
              <span className="text-muted-foreground">{location}</span>
            </div>

            {/* View Details Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                setJobDetailsDialogOpen(true);
              }}
            >
              View Details
            </Button>
          </div>
        </Card>

        {/* Job Details Dialog */}
        <JobDetailsDialog
          job={job}
          open={jobDetailsDialogOpen}
          onOpenChange={setJobDetailsDialogOpen}
          department={department}
        />
      </div>
    );
  }

  return (
    <div>
      <Card
        className={cn(
          "mb-4 hover:shadow-md transition-all duration-200",
          !isHouseTech && !isJobBeingDeleted && "cursor-pointer",
          cardOpacity,
          pointerEvents
        )}
        onClick={handleJobCardClick}
        style={{
          borderLeftColor: appliedBorderColor,
          borderLeftWidth: '4px',
          backgroundColor: appliedBgColor
        }}
      >
        {isJobBeingDeleted && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10 rounded">
            <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-md shadow-lg">
              <span className="text-sm font-medium">Deleting job...</span>
            </div>
          </div>
        )}

        <JobCardHeader
          job={job}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          appliedBorderColor={appliedBorderColor}
          appliedBgColor={appliedBgColor}
          dateTypes={job.job_date_types || {}}
          department={department}
          isProjectManagementPage={isProjectManagementPage}
          userRole={userRole}
        />

        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            {isProjectManagementPage && job.job_type !== 'dryhire' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setRouteSheetOpen(true); }}
                className="text-xs px-3 py-1 border rounded-md hover:bg-secondary"
                title="Abrir Hoja de Ruta"
              >
                Hoja de Ruta
              </button>
            )}
            {job.job_type === 'dryhire' && (
              <Badge variant="destructive">RECOGIDA CLIENTE</Badge>
            )}
            <div className="flex-1" />
          </div>
          <JobCardActions
            job={job}
            userRole={userRole || null}
            foldersAreCreated={foldersAreCreated}
            folderStateLoading={isFoldersLoading}
            isProjectManagementPage={isProjectManagementPage}
            isHouseTech={isHouseTech}
            showUpload={showUpload}
            canEditJobs={canEditJobs}
            canCreateFlexFolders={canCreateFlexFolders}
            canUploadDocuments={canUploadDocuments}
            canManageArtists={canManageArtists}
            department={department}
            isCreatingFolders={isCreatingFolders}
            isCreatingLocalFolders={isCreatingLocalFolders}
            techName={personnel?.find(p => p.id === assignments.find(a => a.technician_id)?.technician_id)?.display_name || ''}
            onRefreshData={refreshData}
            onEditButtonClick={handleEditButtonClick}
            onDeleteClick={handleDeleteClick}
            onCreateFlexFolders={createFlexFoldersHandler}
            onCreateLocalFolders={createLocalFoldersHandler}
            onFestivalArtistsClick={handleFestivalArtistsClick}
            onAssignmentDialogOpen={(e) => {
              e.stopPropagation();
              if (!isJobBeingDeleted) {
                setAssignmentDialogOpen(true);
              }
            }}
            handleFileUpload={handleFileUpload}
            onJobDetailsClick={() => setJobDetailsDialogOpen(true)}
            onOpenTasks={(e) => { e.stopPropagation(); setTaskManagerOpen(true); }}
            canSyncFlex={['admin', 'management', 'logistics'].includes(userRole || '')}
            onSyncFlex={syncStatusToFlex}
            onOpenFlexLogs={(e) => { e.stopPropagation(); setFlexLogDialogOpen(true); }}
            transportButtonLabel={job.job_type === 'dryhire' ? undefined : transportButtonLabel}
            transportButtonTone={transportButtonTone as any}
            onTransportClick={handleTransportClick}
            onCreateWhatsappGroup={handleCreateWhatsappGroup}
            whatsappDisabled={!!waGroup || !!waRequest}
          />
        </div>

        {/* Required vs Assigned summary per department */}
        {job.job_type !== 'dryhire' && Array.isArray(job.job_departments) && job.job_departments.length > 0 && (
          <div className="px-6 mt-2 flex items-center justify-between">
            <div className="flex gap-3 flex-wrap text-sm">
              {job.job_departments.map((d: any) => {
                const dept = d.department as 'sound' | 'lights' | 'video'
                const stats = (requiredVsAssigned as any)[dept] || { required: 0, assigned: 0 }
                const need = stats.required || 0
                const have = stats.assigned || 0
                const cls = need === 0 ? 'bg-muted text-muted-foreground' : (have >= need ? 'bg-green-500/20 text-green-700 dark:text-green-300' : (have > 0 ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'))
                return (
                  <div key={dept} className={`px-2 py-1 rounded ${cls}`}>
                    <span className="capitalize">{dept}</span>: <span className="tabular-nums">{have}/{need}</span>
                  </div>
                )
              })}
            </div>
            {['admin', 'management', 'logistics'].includes(userRole || '') && (
              <button
                type="button"
                className="text-xs px-2 py-1 border rounded-md hover:bg-secondary"
                onClick={(e) => { e.stopPropagation(); setRequirementsDialogOpen(true) }}
              >
                Edit requirements
              </button>
            )}
          </div>
        )}

        <div className="px-6 pb-6">
          <div className="space-y-2 text-sm">
            {job.job_type !== "dryhire" && (
              <>
                {assignments.length > 0 && (
                  <JobCardAssignments
                    assignments={assignments}
                    department={department}
                    jobTimesheets={jobTimesheets || []}
                  />
                )}

                {documents.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left px-2 py-1 rounded hover:bg-accent/40"
                      onClick={(e) => { e.stopPropagation(); setDocsCollapsed(prev => !prev); }}
                    >
                      <span className="text-sm font-medium">Documents ({documents.length})</span>
                      {docsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {!docsCollapsed && (
                      <div className="mt-1">
                        <JobCardDocuments
                          documents={documents}
                          userRole={userRole}
                          onDeleteDocument={handleDeleteDocument}
                          showTitle={false}
                        />
                      </div>
                    )}
                  </div>
                )}

                {riderFiles.length > 0 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between text-left px-2 py-1 rounded hover:bg-accent/40"
                      onClick={(e) => { e.stopPropagation(); setRidersCollapsed(prev => !prev); }}
                    >
                      <span className="text-sm font-medium">Artist Riders ({riderFiles.length})</span>
                      {ridersCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {!ridersCollapsed && (
                      <div className="mt-1 space-y-2">
                        {riderFiles.map((file) => (
                          <div key={file.id} className="flex items-center justify-between p-2 rounded-md bg-accent/20 hover:bg-accent/30 transition-colors" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{file.file_name}</span>
                              <span className="text-xs text-muted-foreground">Artist: {cardArtistNameMap.get(file.artist_id) || 'Unknown'}</span>
                            </div>
                            <div className="flex gap-2">
                              <button className="p-1 hover:bg-accent rounded" title="View" onClick={() => viewRider(file)}>
                                <Eye className="h-4 w-4" />
                              </button>
                              <button className="p-1 hover:bg-accent rounded" title="Download" onClick={() => downloadRider(file)}>
                                <Download className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {!collapsed && job.job_type !== "dryhire" && !hideTasks && (
            <JobCardProgress
              soundTasks={soundTasks}
              roleSummary={reqSummary}
            />
          )}
        </div>
      </Card>

      {!isHouseTech && !isJobBeingDeleted && (
        <>
          {taskManagerOpen && (
            <TaskManagerDialog
              open={taskManagerOpen}
              onOpenChange={setTaskManagerOpen}
              userRole={userRole}
              jobId={job.id}
            />
          )}
          {soundTaskDialogOpen && (
            <SoundTaskDialog
              open={soundTaskDialogOpen}
              onOpenChange={setSoundTaskDialogOpen}
              jobId={job.id}
            />
          )}
          {lightsTaskDialogOpen && (
            <LightsTaskDialog
              open={lightsTaskDialogOpen}
              onOpenChange={setLightsTaskDialogOpen}
              jobId={job.id}
            />
          )}
          {videoTaskDialogOpen && (
            <VideoTaskDialog
              open={videoTaskDialogOpen}
              onOpenChange={setVideoTaskDialogOpen}
              jobId={job.id}
            />
          )}
          {editJobDialogOpen && (
            <EditJobDialog
              open={editJobDialogOpen}
              onOpenChange={setEditJobDialogOpen}
              job={job}
            />
          )}
          {assignmentDialogOpen && job.job_type !== "dryhire" && (
            <JobAssignmentDialog
              isOpen={assignmentDialogOpen}
              onClose={() => setAssignmentDialogOpen(false)}
              onAssignmentChange={() => { }}
              jobId={job.id}
              department={department as Department}
            />
          )}

          {/* Job Details Dialog */}
          <JobDetailsDialog
            open={jobDetailsDialogOpen}
            onOpenChange={setJobDetailsDialogOpen}
            job={job}
            department={department}
          />
          {/* Flex Sync Logs Dialog */}
          <FlexSyncLogDialog
            jobId={job.id}
            open={flexLogDialogOpen}
            onOpenChange={setFlexLogDialogOpen}
          />

          {/* Hoja de Ruta Dialog (Project Management only) */}
          {isProjectManagementPage && (
            <Dialog open={routeSheetOpen} onOpenChange={setRouteSheetOpen}>
              <DialogContent className="max-w-[96vw] w-[96vw] h-[96vh] p-0 overflow-hidden">
                <div className="h-full overflow-auto">
                  <ModernHojaDeRuta jobId={job.id} />
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Transport Request / Logistics Dialogs */}
          {transportDialogOpen && isTechDept && userDepartment && (
            <TransportRequestDialog
              open={transportDialogOpen}
              onOpenChange={setTransportDialogOpen}
              jobId={job.id}
              department={userDepartment}
              requestId={myTransportRequest?.id || null}
              onSubmitted={() => {
                queryClient.invalidateQueries({ queryKey: ['transport-request', job.id, userDepartment] });
                queryClient.invalidateQueries({ queryKey: ['transport-requests-all', job.id] });
              }}
            />
          )}

          {transportDialogOpen && ((userDepartment === 'logistics') || ((userRole === 'management' || userRole === 'admin') && !isTechDept)) && (
            <Dialog open={transportDialogOpen} onOpenChange={setTransportDialogOpen}>
              <DialogContent className="max-w-xl">
                <div className="space-y-4">
                  <div className="text-lg font-semibold">Transport Requests</div>
                  {allRequests.length === 0 ? (
                    <div className="text-muted-foreground">No pending requests for this job.</div>) : (
                    <div className="space-y-2">
                      {allRequests.map((req: any) => (
                        <div key={req.id} className="border rounded p-2 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium capitalize">{req.department}</div>
                              {req.description && <div className="text-sm">{req.description}</div>}
                              {req.note && <div className="text-xs text-muted-foreground italic">{req.note}</div>}
                            </div>
                            <button
                              className="px-3 py-1 text-sm rounded border hover:bg-accent"
                              onClick={async (ev) => {
                                ev.stopPropagation();
                                await supabase.from('transport_requests').update({ status: 'cancelled' }).eq('id', req.id);
                                queryClient.invalidateQueries({ queryKey: ['transport-requests-all', job.id] });
                              }}
                            >
                              Cancel Request
                            </button>
                          </div>
                          <div className="space-y-1">
                            {(req.items || []).map((it: any) => (
                              <div key={it.id} className="flex items-center justify-between pl-2">
                                <div className="text-sm text-muted-foreground">
                                  {it.transport_type.replace('_', ' ')}
                                  {typeof it.leftover_space_meters === 'number' && (
                                    <span className="ml-2">· Leftover: {it.leftover_space_meters} m</span>
                                  )}
                                </div>
                                <button
                                  className="px-3 py-1 text-sm rounded border hover:bg-accent"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setSelectedTransportRequest({ ...req, selectedItem: it });
                                    setLogisticsInitialEventType('load');
                                    setTransportDialogOpen(false);
                                    setLogisticsDialogOpen(true);
                                  }}
                                >
                                  Create Event
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}

          {logisticsDialogOpen && selectedTransportRequest && (
            <LogisticsEventDialog
              open={logisticsDialogOpen}
              onOpenChange={(open) => {
                setLogisticsDialogOpen(open);
                if (!open) {
                  // Refresh data when dialog closes
                  queryClient.invalidateQueries({ queryKey: ['logistics-events-for-job', job.id] });
                  queryClient.invalidateQueries({ queryKey: ['today-logistics'] });
                }
              }}
              selectedDate={new Date(job.start_time)}
              initialJobId={job.id}
              initialDepartments={[selectedTransportRequest.department]}
              initialTransportType={selectedTransportRequest.selectedItem?.transport_type}
              initialEventType={logisticsInitialEventType}
              onCreated={(_details) => {
                // Attempt auto-fulfill; dialog can optionally auto-create unload itself
                if (selectedTransportRequest?.id && selectedTransportRequest?.department) {
                  void checkAndFulfillRequest(selectedTransportRequest.id, selectedTransportRequest.department);
                }
                setLogisticsInitialEventType(undefined);
              }}
            />
          )}

          {requirementsDialogOpen && (
            <JobRequirementsEditor
              open={requirementsDialogOpen}
              onOpenChange={setRequirementsDialogOpen}
              jobId={job.id}
              departments={(job.job_departments || []).map((d: any) => d.department)}
            />
          )}

          <FlexFolderPicker
            open={flexPickerOpen}
            onOpenChange={setFlexPickerOpen}
            onConfirm={handleFlexPickerConfirm}
            initialOptions={flexPickerOptions}
          />

        </>
      )}
    </div>
  );
}

export type { JobDocument } from './JobCardDocuments';
