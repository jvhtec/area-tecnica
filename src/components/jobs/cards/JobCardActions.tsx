import React from 'react';
import { formatInTimeZone } from "date-fns-tz";

import { Button } from "@/components/ui/button";
import createFolderIcon from "@/assets/icons/icon.png";
import { Edit, Trash2, Upload, RefreshCw, Users, Loader2, FolderPlus, Clock, FileText, Scale, Zap, MessageCircle, ExternalLink, Info, ListChecks, Settings, ScrollText } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { TechnicianIncidentReportDialog } from "@/components/incident-reports/TechnicianIncidentReportDialog";
import { Department } from "@/types/department";
import { useQuery } from "@tanstack/react-query";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { supabase } from "@/integrations/supabase/client";
import { useFlexUuid } from "@/hooks/useFlexUuid";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { createQueryKey } from "@/lib/optimized-react-query";
import { FlexElementSelectorDialog } from "@/components/flex/FlexElementSelectorDialog";
import { getMainFlexElementIdSync, resolveTourFolderForTourdate } from "@/utils/flexMainFolderId";
import { ArchiveToFlexAction } from "./job-card-actions/ArchiveToFlexAction";
import { BackfillDocTecnicaAction } from "./job-card-actions/BackfillDocTecnicaAction";
import { mapViewHintToIntent } from "./job-card-actions/mapViewHintToIntent";
import {
  FLEX_FOLDER_IDS,
  createTourdateFilterPredicate,
  getElementTree,
  openFlexElement,
  type FlatElementNode,
} from "@/utils/flex-folders";

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
  onAddFlexFolders?: (e: React.MouseEvent) => void;
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
  onRetryWhatsappGroup?: (e: React.MouseEvent) => void;
  whatsappDisabled?: boolean;
  whatsappGroup?: any;
  whatsappRequest?: any;
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
  onAddFlexFolders,
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
  onRetryWhatsappGroup,
  whatsappDisabled,
  whatsappGroup,
  whatsappRequest,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userDepartment } = useOptimizedAuth();

  const normalizedUserDepartment = typeof userDepartment === 'string'
    ? userDepartment.toLowerCase().replace(/_warehouse$/, '')
    : '';
  const canSendProductionWhatsapp = Boolean(
    isProjectManagementPage
    && department === 'production'
    && (userRole === 'admin'
      || normalizedUserDepartment === 'production'
      || normalizedUserDepartment === 'produccion'
      || normalizedUserDepartment === 'producción')
  );

  const [waProdOpen, setWaProdOpen] = React.useState(false);
  const [waProdDateGroup, setWaProdDateGroup] = React.useState<string>('all');
  const [waProdRecipientIds, setWaProdRecipientIds] = React.useState<string[]>([]);
  const [waProdCallTime, setWaProdCallTime] = React.useState<string>('');
  const [waProdMessage, setWaProdMessage] = React.useState<string>('');
  const [waProdDirty, setWaProdDirty] = React.useState(false);
  const [waProdSending, setWaProdSending] = React.useState(false);

  const [waAlmacenOpen, setWaAlmacenOpen] = React.useState(false);
  const [waMessage, setWaMessage] = React.useState<string>("");
  const [isSendingWa, setIsSendingWa] = React.useState(false);
  const [flexSelectorOpen, setFlexSelectorOpen] = React.useState(false);
  const [tourdateSelectorInfo, setTourdateSelectorInfo] = React.useState<{
    mainElementId: string;
    filterDate: string;
  } | null>(null);
  const dryHirePresupuestoElementRef = React.useRef<string | null>(null);

  /**
   * Resolve job location label with priority: location_data > location > 'sin ubicación'.
   * If structured location data is available, include both venue name and formatted address when possible.
   */
  const resolveJobLocation = React.useCallback((): string => {
    const pick = (loc: any): string | null => {
      if (!loc || typeof loc !== 'object') return null;
      const name = typeof loc.name === 'string' ? loc.name.trim() : '';
      const addr = typeof loc.formatted_address === 'string' ? loc.formatted_address.trim() : '';

      if (name && addr) {
        if (name.toLowerCase() === addr.toLowerCase()) return name;
        return `${name} — ${addr}`;
      }
      return name || addr || null;
    };

    const structured = pick(job?.location_data) || pick(job?.location);
    if (structured) return structured;

    if (typeof job?.location === 'string' && job.location.trim()) return job.location.trim();

    return 'sin ubicación';
  }, [job]);

  const TZ = 'Europe/Madrid' as const;

  /** Suggest call time from job start_time formatted in Europe/Madrid (still marked REVISAR in template). */
  const resolveSuggestedCallTime = React.useCallback((): string => {
    try {
      if (!job?.start_time) return '';
      // Use 24h HH:mm in Europe/Madrid to match operational expectation.
      return formatInTimeZone(new Date(job.start_time), TZ, 'HH:mm');
    } catch {
      return '';
    }
  }, [job, TZ]);

  type JobAssignmentRow = {
    id: string;
    technician_id: string;
    single_day: boolean;
    assignment_date: string | null;
    profiles:
      | { first_name: string | null; last_name: string | null; phone: string | null }
      | { first_name: string | null; last_name: string | null; phone: string | null }[]
      | null;
  };

  type WaProdAssignment = {
    id: string;
    technician_id: string;
    single_day: boolean;
    assignment_date: string | null;
    profile: { first_name: string | null; last_name: string | null; phone: string | null } | null;
  };

  const { data: waProdAssignments = [], isLoading: waProdAssignmentsLoading } = useQuery({
    queryKey: createQueryKey.whatsapp.prodAssignmentsByJob(job.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_assignments')
        .select('id, technician_id, single_day, assignment_date, profiles!job_assignments_technician_id_fkey(first_name,last_name,phone)')
        .eq('job_id', job.id);
      if (error) throw error;

      const rows = (data as JobAssignmentRow[] | null || []).map((r) => {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return {
          id: r.id,
          technician_id: r.technician_id,
          single_day: Boolean(r.single_day),
          assignment_date: r.assignment_date || null,
          profile: profile
            ? { first_name: profile.first_name ?? null, last_name: profile.last_name ?? null, phone: profile.phone ?? null }
            : null,
        } as WaProdAssignment;
      });

      // Stable ordering: all-days first, then by date, then by name.
      rows.sort((a, b) => {
        const aKey = a.single_day && a.assignment_date ? a.assignment_date : '';
        const bKey = b.single_day && b.assignment_date ? b.assignment_date : '';
        if (aKey !== bKey) return aKey.localeCompare(bKey);
        const aName = `${a.profile?.first_name ?? ''} ${a.profile?.last_name ?? ''}`.trim();
        const bName = `${b.profile?.first_name ?? ''} ${b.profile?.last_name ?? ''}`.trim();
        return aName.localeCompare(bName);
      });

      return rows;
    },
    enabled: Boolean(waProdOpen && canSendProductionWhatsapp && job?.id),
    staleTime: 30_000,
  });

  /**
   * Check if an assignment is applicable to a WhatsApp date group.
   *
   * - groupKey=all: everyone assigned to the job.
   * - groupKey=day:YYYY-MM-DD:
   *   - single-day assignments only for that date
   *   - PLUS all-days assignments (they apply to every date)
   */
  const assignmentMatchesWaGroup = React.useCallback((a: WaProdAssignment, groupKey: string): boolean => {
    if (groupKey === 'all') return true;
    if (!groupKey.startsWith('day:')) return true;
    const d = groupKey.replace(/^day:/, '');
    if (a.single_day) return Boolean(a.assignment_date) && a.assignment_date === d;
    return true;
  }, []);

  /** Build selectable date groups for WhatsApp recipients (include weekends in job range). */
  const waProdGroups = React.useMemo(() => {
    const keys = new Set<string>();
    keys.add('all');

    // Include all days between job.start_time and job.end_time (inclusive), even if there are no single_day assignments.
    try {
      if (job?.start_time && job?.end_time) {
        const startIso = formatInTimeZone(new Date(job.start_time), TZ, 'yyyy-MM-dd');
        const endIso = formatInTimeZone(new Date(job.end_time), TZ, 'yyyy-MM-dd');

        // Iterate date-only strings without timezone shifts.
        let cur = new Date(`${startIso}T00:00:00`);
        const end = new Date(`${endIso}T00:00:00`);
        // Guard: avoid infinite loops on bad dates.
        for (let i = 0; i < 370 && cur <= end; i++) {
          const y = cur.getFullYear();
          const m = String(cur.getMonth() + 1).padStart(2, '0');
          const d = String(cur.getDate()).padStart(2, '0');
          keys.add(`day:${y}-${m}-${d}`);
          cur.setDate(cur.getDate() + 1);
        }
      }
    } catch {
      // best-effort; fall back to assignment-derived dates only
    }

    // Also include any explicit single-day assignment dates (even if outside the job range).
    for (const a of waProdAssignments) {
      if (a.single_day && a.assignment_date) keys.add(`day:${a.assignment_date}`);
    }

    const list = Array.from(keys).map((key) => {
      if (key === 'all') {
        const range = job?.start_time && job?.end_time
          ? `${formatInTimeZone(new Date(job.start_time), TZ, 'dd/MM/yyyy')} – ${formatInTimeZone(new Date(job.end_time), TZ, 'dd/MM/yyyy')}`
          : job?.start_time
            ? `${formatInTimeZone(new Date(job.start_time), TZ, 'dd/MM/yyyy')}`
            : '';
        return { key, label: range ? `Todos los días (${range})` : 'Todos los días' };
      }
      const date = key.replace(/^day:/, '');
      const label = (() => {
        try {
          // Date-only strings should not shift; interpret as local midnight.
          return formatInTimeZone(new Date(`${date}T00:00:00`), TZ, 'dd/MM/yyyy');
        } catch {
          return date;
        }
      })();
      return { key, label: label };
    });

    // Put 'all' first, then sorted by date.
    list.sort((a, b) => {
      if (a.key === 'all') return -1;
      if (b.key === 'all') return 1;
      return a.key.localeCompare(b.key);
    });

    return list;
  }, [waProdAssignments, job]);

  /** Build the prefilled WhatsApp message template for the selected job/date group/call time. */
  const buildWaProdTemplate = React.useCallback((opts: { groupKey: string; callTime: string }) => {
    const jobName = job?.title || job?.name || job?.job_name || 'Trabajo';
    const location = resolveJobLocation();

    let dateLabel = '';
    if (opts.groupKey === 'all') {
      if (job?.start_time && job?.end_time) {
        dateLabel = `${formatInTimeZone(new Date(job.start_time), TZ, 'dd/MM/yyyy')} – ${formatInTimeZone(new Date(job.end_time), TZ, 'dd/MM/yyyy')}`;
      } else if (job?.start_time) {
        dateLabel = `${formatInTimeZone(new Date(job.start_time), TZ, 'dd/MM/yyyy')}`;
      }
    } else if (opts.groupKey.startsWith('day:')) {
      const d = opts.groupKey.replace(/^day:/, '');
      try { dateLabel = formatInTimeZone(new Date(`${d}T00:00:00`), TZ, 'dd/MM/yyyy'); } catch { dateLabel = d; }
    }

    const callTimeLabel = opts.callTime ? `${opts.callTime}` : '';

    const lines = [
      `Buenas,`,
      ``,
      `Para el trabajo “${jobName}”:`,
      ``,
      `• Ubicación: ${location}`,
      dateLabel ? `• Fecha(s): ${dateLabel}` : undefined,
      `• Hora de citación (REVISAR): ${callTimeLabel || '—'}`,
      ``,
      `Si alguien llega más tarde / necesita algo, que me diga por aquí.`,
      `Gracias.`,
    ].filter(Boolean);

    return lines.join('\n');
  }, [job, resolveJobLocation]);

  type WaSendResult = {
    success: boolean;
    sentCount: number;
    failed: Array<{ recipient_id: string; reason: string }>;
    job_id: string | null;
  };

  /** Submit the WhatsApp message to the edge function after local validation. */
  const handleWaProdSend = React.useCallback(async () => {
    try {
      if (!waProdRecipientIds.length) {
        toast({ title: 'Selecciona destinatarios', description: 'Elige al menos una persona.', variant: 'destructive' });
        return;
      }
      const trimmed = (waProdMessage || '').trim();
      if (!trimmed) {
        toast({ title: 'Mensaje vacío', description: 'Escribe un mensaje antes de enviar.', variant: 'destructive' });
        return;
      }

      setWaProdSending(true);
      const { data, error } = await supabase.functions.invoke<WaSendResult>('send-job-whatsapp-message', {
        body: {
          job_id: job?.id,
          message: trimmed,
          recipient_ids: waProdRecipientIds,
        }
      });

      if (error) {
        toast({ title: 'Error al enviar', description: error.message, variant: 'destructive' });
        return;
      }

      const sent = data?.sentCount ?? null;
      const failed = data?.failed?.length ?? 0;
      toast({
        title: 'Enviado',
        description: sent !== null
          ? `Enviados: ${sent}. Fallos: ${failed}.`
          : `Mensaje enviado. Fallos: ${failed}.`,
      });
      setWaProdOpen(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setWaProdSending(false);
    }
  }, [job?.id, toast, waProdMessage, waProdRecipientIds]);

  // Modal state is initialized in the button click handler to avoid stale state reads.

  React.useEffect(() => {
    if (!waProdOpen) return;
    if (waProdDirty) return;
    setWaProdMessage(buildWaProdTemplate({ groupKey: waProdDateGroup || 'all', callTime: waProdCallTime }));
  }, [waProdOpen, waProdDirty, waProdDateGroup, waProdCallTime, buildWaProdTemplate]);

  React.useEffect(() => {
    if (!waProdOpen) return;
    // If the current selection doesn't match the chosen date group, clear it.
    if (!waProdRecipientIds.length) return;
    const allowedIds = new Set(
      waProdAssignments
        .filter((a) => assignmentMatchesWaGroup(a, waProdDateGroup))
        .map((a) => a.technician_id)
    );
    const filtered = waProdRecipientIds.filter((id) => allowedIds.has(id));
    const isSame = filtered.length === waProdRecipientIds.length
      && filtered.every((id, idx) => id === waProdRecipientIds[idx]);
    if (!isSame) setWaProdRecipientIds(filtered);
  }, [waProdOpen, waProdAssignments, waProdDateGroup, waProdRecipientIds, assignmentMatchesWaGroup]);

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

  const showFlexButtons = true;
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
      {isProjectManagementPage && department !== 'production' && (userRole === 'management' || userRole === 'admin') && onCreateWhatsappGroup && job.job_type !== 'dryhire' && (
        <>
          {/* Show retry button if there's a request but no group (failed creation) */}
          {whatsappRequest && !whatsappGroup && onRetryWhatsappGroup ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryWhatsappGroup}
              className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50"
              title="Reintentar crear grupo WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Reintentar</span>
            </Button>
          ) : (
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
        </>
      )}
      {isProjectManagementPage && department !== 'production' && (userRole === 'management' || userRole === 'admin') && (
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

      {/* WhatsApp coordinación (Producción / Admin) */}
      {canSendProductionWhatsapp && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const suggested = resolveSuggestedCallTime();
            setWaProdDateGroup('all');
            setWaProdRecipientIds([]);
            setWaProdCallTime(suggested);
            setWaProdDirty(false);
            setWaProdMessage(buildWaProdTemplate({ groupKey: 'all', callTime: suggested }));
            setWaProdOpen(true);
          }}
          className="gap-2"
          title="Enviar WhatsApp a personal asignado"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Aviso WA</span>
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
          <>
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

            {job.job_type !== 'dryhire' && onAddFlexFolders ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onAddFlexFolders}
                disabled={folderStateLoading || isCreatingFolders}
                title="Añadir carpetas Flex"
                className={
                  folderStateLoading || isCreatingFolders
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-accent/50"
                }
              >
                <img
                  src={createFolderIcon}
                  alt="Añadir carpetas Flex"
                  width={16}
                  height={16}
                  loading="lazy"
                  decoding="async"
                  className="h-4 w-4"
                />
              </Button>
            ) : null}
          </>
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
              <img
                src={createFolderIcon}
                alt="Crear carpetas Flex"
                width={16}
                height={16}
                loading="lazy"
                decoding="async"
                className="h-4 w-4"
              />
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
      <ArchiveToFlexAction job={job} />
      <BackfillDocTecnicaAction job={job} />
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
          title="Registros de Sincronización"
        >
          <ScrollText className="h-4 w-4" />
          <span className="hidden sm:inline">Registros</span>
        </Button>
      )}

      {/* WhatsApp coordinación dialog */}
      {waProdOpen && (
        <Dialog open={waProdOpen} onOpenChange={(open) => {
          setWaProdOpen(open);
          if (!open) {
            setWaProdRecipientIds([]);
            setWaProdDirty(false);
          }
        }}>
          <DialogContent className="sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle>Enviar WhatsApp</DialogTitle>
              <DialogDescription>
                Mensaje pre-rellenado (editable). La <b>hora de citación</b> se sugiere desde el inicio del trabajo y está marcada como <b>REVISAR</b>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Grupo de fechas</Label>
                  <RadioGroup
                    value={waProdDateGroup}
                    onValueChange={(value) => {
                      setWaProdDateGroup(value);
                      setWaProdRecipientIds([]);
                    }}
                    className="gap-2"
                  >
                    {waProdGroups.map((g) => (
                      <div key={g.key} className="flex items-center space-x-2">
                        <RadioGroupItem value={g.key} id={`wa-date-${g.key}`} />
                        <Label htmlFor={`wa-date-${g.key}`} className="font-normal">{g.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wa-calltime">Hora de citación (REVISAR)</Label>
                  <Input
                    id="wa-calltime"
                    value={waProdCallTime}
                    onChange={(e) => setWaProdCallTime(e.target.value)}
                    placeholder="HH:mm"
                    inputMode="numeric"
                  />
                  <p className="text-xs text-muted-foreground">Sugerida desde el inicio del trabajo. Ajusta si es necesario.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Destinatarios (asignados)</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const ids = Array.from(new Set(
                          waProdAssignments
                            .filter((a) => assignmentMatchesWaGroup(a, waProdDateGroup))
                            .map((a) => a.technician_id)
                        ));
                        setWaProdRecipientIds(ids);
                      }}
                      disabled={waProdAssignmentsLoading}
                    >
                      Seleccionar todos
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setWaProdRecipientIds([])}
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>

                <div className="border rounded-md p-2 max-h-[220px] overflow-y-auto space-y-2">
                  <div className="text-xs text-muted-foreground px-2">
                    Nota: el teléfono puede no ser visible aquí por permisos; el envío valida teléfonos en servidor.
                  </div>
                  {waProdAssignmentsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground p-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando asignaciones…
                    </div>
                  ) : (
                    waProdAssignments
                      .filter((a) => assignmentMatchesWaGroup(a, waProdDateGroup))
                      .map((a) => { 
                        const full = `${a.profile?.first_name ?? ''} ${a.profile?.last_name ?? ''}`.trim() || 'Sin nombre';
                        const hasPhone = Boolean((a.profile?.phone || '').trim());
                        const checked = waProdRecipientIds.includes(a.technician_id);
                        return (
                          <div key={`${a.technician_id}-${a.id}`} className={cn('flex items-start gap-2 p-2 rounded') }>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(next) => {
                                const isChecked = Boolean(next);
                                setWaProdRecipientIds((prev) => {
                                  if (isChecked) return Array.from(new Set([...prev, a.technician_id]));
                                  return prev.filter((id) => id !== a.technician_id);
                                });
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate" title={full}>{full}</div>
                              <div className="text-xs text-muted-foreground">
                                {hasPhone ? a.profile?.phone : 'Teléfono no disponible (se intentará enviar igualmente)'}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}

                  {!waProdAssignmentsLoading && waProdAssignments.filter((a) => assignmentMatchesWaGroup(a, waProdDateGroup)).length === 0 && (
                    <div className="text-sm text-muted-foreground p-2">No hay asignados en este grupo de fechas.</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Mensaje</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setWaProdDirty(false);
                      setWaProdMessage(buildWaProdTemplate({ groupKey: waProdDateGroup || 'all', callTime: waProdCallTime }));
                    }}
                  >
                    Restablecer
                  </Button>
                </div>
                <Textarea
                  value={waProdMessage}
                  onChange={(e) => {
                    setWaProdDirty(true);
                    setWaProdMessage(e.target.value);
                  }}
                  className="min-h-[140px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setWaProdOpen(false)} disabled={waProdSending}>Cancelar</Button>
              <Button
                onClick={handleWaProdSend}
                disabled={waProdSending}
              >
                {waProdSending ? 'Enviando…' : 'Enviar'}
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
                } catch (e: unknown) {
                  const message = e instanceof Error ? e.message : String(e);
                  toast({ title: 'Error', description: message, variant: 'destructive' });
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
