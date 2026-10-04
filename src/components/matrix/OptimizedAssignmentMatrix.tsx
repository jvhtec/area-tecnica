import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOptimizedMatrixData } from '@/hooks/useOptimizedMatrixData';
import { invalidateMatrixHeaderCounts } from '@/lib/matrix-header-counts';
import { formatMadridDateKey, madridDateKeyToCalendarDate } from '@/utils/timezoneUtils';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useStaffingRealtime } from '@/features/staffing/hooks/useStaffingRealtime';
import { useCancelStaffingRequest, useSendStaffingEmail, ConflictError } from '@/features/staffing/hooks/useStaffing';
import { useToast } from '@/hooks/use-toast';
import { dataLayerClient } from '@/services/dataLayerClient';
import { checkTimeConflictEnhanced } from '@/utils/technicianAvailability';
import { useStaffingMatrixStatuses } from '@/features/staffing/hooks/useStaffingMatrixStatuses';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelectedCellStore } from '@/stores/useSelectedCellStore';
import { formatUserName } from '@/utils/userName';
import { isManagementRole } from '@/utils/permissions';
import type { RoleSlot } from '@/features/matrix-v2/roleSlots';
import { useMatrixV2Config } from '@/features/matrix-v2/useMatrixV2Config';

import { OptimizedAssignmentMatrixView } from '@/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView';
import { useMatrixTechnicianOrdering } from '@/components/matrix/optimized-assignment-matrix/useMatrixTechnicianOrdering';
import { useMatrixHeaderCounts } from '@/hooks/useMatrixHeaderCounts';
import type { CellAction, OptimizedAssignmentMatrixExtendedProps } from '@/components/matrix/optimized-assignment-matrix/types';


import { queryKeys } from "@/lib/react-query";
const EMPTY_PROFILE_NAMES_MAP = new Map<string, string>();
const EMPTY_ROLE_SLOTS = new Map<string, RoleSlot[]>();

// The staffing badges are fetched for a block-aligned window of technicians
// rather than exactly the visible rows: the query is keyed on the id list, so
// a window that moved with every row scrolled refetched (three round trips)
// on nearly every scroll step. Aligned blocks only change at a boundary.
const STAFFING_TECH_BLOCK = 40;
const STAFFING_TECH_OVERSCAN = 10;

type ProfileNameRow = {
  id: string;
  first_name: string | null;
  nickname: string | null;
  last_name: string | null;
};

type StaffingEmailPayload = {
  job_id: string;
  profile_id: string;
  phase: 'availability' | 'offer';
  role?: string | null;
  message?: string | null;
  channel?: 'email' | 'whatsapp';
  target_date?: string | null;
  single_day?: boolean;
  dates?: string[];
  department?: string | null;
  override_conflicts?: boolean;
};

export const OptimizedAssignmentMatrix = ({
  technicians,
  dates,
  jobs,
  onNearEdgeScroll,
  canExpandBefore = false,
  canExpandAfter = false,
  allowDirectAssign = false,
  allowMarkUnavailable = false,
  fridgeSet,
  cellWidth,
  cellHeight,
  technicianWidth,
  headerHeight,
  mobile = false,
  staffingDepartment = null,
  hideStaffingEmailButtons = false,
  hideStaffingWhatsappButtons = false,
  matrixV2 = false,
  roleSlotsByJob = EMPTY_ROLE_SLOTS,
  focusJobId = null,
  focusStatus = 'invited',
  onFocusJobChange,
}: OptimizedAssignmentMatrixExtendedProps) => {
  const [cellAction, setCellAction] = useState<CellAction | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  // Global selected cell store for Stream Deck integration
  // Selected individually: the bare hook subscribes to the whole store, so
  // every selection change re-rendered the matrix a second time.
  const selectCell = useSelectedCellStore((state) => state.selectCell);
  const clearGlobalSelection = useSelectedCellStore((state) => state.clearSelection);
  const isGlobalCellSelected = useSelectedCellStore((state) => state.isCellSelected);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const { userRole } = useOptimizedAuth();
  const isManagementUser = isManagementRole(userRole);
  const qc = useQueryClient();

  // Performance monitoring
  const { startRenderTimer, endRenderTimer, incrementCellRender } = usePerformanceMonitor('AssignmentMatrix');

  // Staffing functionality
  useStaffingRealtime();
  const { toast } = useToast();
  // Owned here rather than in every cell: the grid renders hundreds of cells,
  // and each useMutation call registers its own observer.
  const { mutate: sendStaffingEmail, isPending: isSendingStaffingEmail } = useSendStaffingEmail();
  const { mutate: cancelStaffing, isPending: isCancellingStaffing } = useCancelStaffingRequest();

  // Cell dimensions (overridable for mobile). The desktop row is 72px so the
  // redesigned status card (job, role, and a "día único" line) fits without the
  // corner controls landing on top of the text.
  const CELL_WIDTH = cellWidth ?? 160;
  const CELL_HEIGHT = cellHeight ?? 72;
  const TECHNICIAN_WIDTH = technicianWidth ?? 256;
  const HEADER_HEIGHT = headerHeight ?? 80;

  // Use optimized data hook
  const {
    allAssignments,
    getAssignmentForCell,
    getAvailabilityForCell,
    getJobsForDate,
    prefetchTechnicianData,
    updateAssignmentOptimistically,
    invalidateAssignmentQueries,
    isInitialLoading,
    isFetching
  } = useOptimizedMatrixData({ technicians, dates, jobs });

  const {
    orderedTechnicians: baseOrderedTechnicians,
    setSortJobId,
    techMedalRankings,
    techLastYearMedalRankings,
    cycleTechSort,
    getSortLabel,
  } = useMatrixTechnicianOrdering({
    technicians,
    allAssignments,
    mobile,
  });

  // Build declined job sets per technician for targeted staffing blocking
  const declinedJobsByTech = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    allAssignments?.forEach((a) => {
      if (a?.status === 'declined' && a.technician_id && a.job_id) {
        if (!map.has(a.technician_id)) map.set(a.technician_id, new Set());
        map.get(a.technician_id)!.add(a.job_id);
      }
    });
    return map;
  }, [allAssignments]);

  // Matrix v2: the runner, inspector, quick actions and job focus.
  const {
    v2Config,
    orderedTechnicians,
    quickConfirm,
    openInspector,
  } = useMatrixV2Config({
    enabled: matrixV2,
    ready: !isInitialLoading,
    jobs,
    technicians,
    dates,
    baseOrderedTechnicians,
    allAssignments,
    getAssignmentForCell,
    getAvailabilityForCell,
    isManagementUser,
    roleSlotsByJob,
    declinedJobsByTech,
    fridgeSet,
    focusJobId,
    focusStatus,
    onFocusJobChange,
  });

  // Listen for assignment updates and refresh data
  useEffect(() => {
    const handleAssignmentUpdate = () => {
      invalidateAssignmentQueries();
    };

    window.addEventListener('assignment-updated', handleAssignmentUpdate);
    return () => window.removeEventListener('assignment-updated', handleAssignmentUpdate);
  }, [invalidateAssignmentQueries]);

  // Listen for staffing updates to refresh statuses
  useEffect(() => {
    const handler = () => {
      qc.invalidateQueries({ queryKey: queryKeys.scope('staffing-matrix') });
      // The date-header invitation/offer badges are counted off staffing_requests.
      void invalidateMatrixHeaderCounts(qc);
    };
    window.addEventListener('staffing-updated', handler);
    return () => window.removeEventListener('staffing-updated', handler);
  }, [qc]);

  // Start performance monitoring
  useEffect(() => {
    startRenderTimer();
    return () => endRenderTimer();
  }, [startRenderTimer, endRenderTimer]);

  // Calculate matrix dimensions
  const matrixWidth = dates.length * CELL_WIDTH;
  const matrixHeight = technicians.length * CELL_HEIGHT;

  // The scroll position and virtualised window live in the view, so a scroll
  // step re-renders the grid alone and not this component's data hooks. Only
  // the staffing badges need to know where the user is, and only per block of
  // technicians: the view reports the visible rows and this keeps the block.
  const [staffingBlock, setStaffingBlock] = useState({ start: 0, end: STAFFING_TECH_BLOCK });
  const handleVisibleRowsChange = useCallback((rows: { start: number; end: number }) => {
    const start = Math.floor(Math.max(0, rows.start - STAFFING_TECH_OVERSCAN) / STAFFING_TECH_BLOCK) * STAFFING_TECH_BLOCK;
    const end = (Math.floor((rows.end + STAFFING_TECH_OVERSCAN) / STAFFING_TECH_BLOCK) + 1) * STAFFING_TECH_BLOCK;
    setStaffingBlock((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  // Date header counts for the whole range (no per-column queries on scroll).
  const getHeaderCounts = useMatrixHeaderCounts({
    dates,
    jobs,
    allAssignments,
    getJobsForDate,
    includeOpenSlots: !mobile,
  });

  const [availabilityPreferredChannel, setAvailabilityPreferredChannel] = useState<null | 'email' | 'whatsapp'>(null);
  const [offerChannel, setOfferChannel] = useState<'email' | 'whatsapp'>('email');
  const [offerPreferredChannel, setOfferPreferredChannel] = useState<null | 'email' | 'whatsapp'>(null);
  const [availabilityDialog, setAvailabilityDialog] = useState<null | { open: boolean; jobId: string; profileId: string; dateIso: string; singleDay: boolean; channel: 'email' | 'whatsapp' }>(null);

  // Conflict dialog state
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    details: unknown;
    originalPayload: StaffingEmailPayload;
  } | null>(null);

  const forcedStaffingAction = useMemo<undefined | 'availability' | 'offer'>(() => {
    if (cellAction?.type !== 'select-job-for-staffing') return undefined;
    if (cellAction.intendedPhase) return cellAction.intendedPhase;
    if (availabilityPreferredChannel) return 'availability';
    if (offerPreferredChannel) return 'offer';
    return undefined;
  }, [cellAction, availabilityPreferredChannel, offerPreferredChannel]);

  const forcedStaffingChannel = useMemo<undefined | 'email' | 'whatsapp'>(() => {
    if (cellAction?.type !== 'select-job-for-staffing') return undefined;
    if (cellAction.intendedChannel) return cellAction.intendedChannel;
    if (forcedStaffingAction === 'availability') {
      return availabilityPreferredChannel ?? undefined;
    }
    if (forcedStaffingAction === 'offer') {
      return offerPreferredChannel ?? undefined;
    }
    return undefined;
  }, [cellAction, forcedStaffingAction, availabilityPreferredChannel, offerPreferredChannel]);

  const closeDialogs = useCallback(() => {
    setCellAction(null);
    setSelectedCells(new Set());
    setAvailabilityPreferredChannel(null);
    setOfferPreferredChannel(null);
    // Invalidate queries when closing dialogs to refresh data
    invalidateAssignmentQueries();
  }, [invalidateAssignmentQueries]);

  const handleDirectToggleUnavailable = useCallback(async (technicianId: string, date: Date) => {
    const dateStr = formatMadridDateKey(date);
    const existing = getAvailabilityForCell(technicianId, date);
    if (existing) {
      const { error } = await dataLayerClient.from('technician_availability')
        .delete()
        .eq('technician_id', technicianId)
        .eq('date', dateStr);
      if (error) {
        console.error('Error removing unavailability:', error);
        toast({ title: 'Error', description: 'No se pudo eliminar la no disponibilidad.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Disponibilidad restaurada', description: `${dateStr} marcado como disponible.` });
    } else {
      const { error } = await dataLayerClient.from('technician_availability')
        .upsert([{ technician_id: technicianId, date: dateStr, status: 'day_off' }], { onConflict: 'technician_id,date' });
      if (error) {
        console.error('Error marking unavailable:', error);
        toast({ title: 'Error', description: 'No se pudo marcar como no disponible.', variant: 'destructive' });
        return;
      }
      toast({ title: 'No disponible', description: `${dateStr} marcado como no disponible.` });
    }
    window.dispatchEvent(new CustomEvent('assignment-updated'));
  }, [getAvailabilityForCell, toast]);

  const handleCellClick = useCallback((technicianId: string, date: Date, action: 'select-job' | 'select-job-for-staffing' | 'assign' | 'unavailable' | 'confirm' | 'decline' | 'offer-details' | 'offer-details-wa' | 'offer-details-email' | 'availability-wa' | 'availability-email' | 'toggle-unavailable', selectedJobId?: string) => {
    const assignment = getAssignmentForCell(technicianId, date);
    // Block assignment/staffing interactions if technician is in fridge
    const isFridge = fridgeSet?.has(technicianId);
    if (isFridge && (action === 'select-job' || action === 'assign' || action === 'select-job-for-staffing' || action === 'confirm' || action === 'offer-details' || action === 'offer-details-wa' || action === 'availability-wa')) {
      toast({ title: 'En la nevera', description: 'Este técnico está en la nevera y no puede ser asignado.', variant: 'destructive' });
      return;
    }
    // Matrix v2: confirm and decline are quick actions, everything else is the inspector.
    if (matrixV2) {
      if (action === 'confirm') {
        quickConfirm(technicianId, date);
        return;
      }
      if (action === 'decline') {
        openInspector(technicianId, date, null, 'decline');
        return;
      }
      if (action === 'unavailable') {
        openInspector(technicianId, date, null);
        return;
      }
    }
    // Gate direct assign-related actions behind allowDirectAssign
    if (!allowDirectAssign && (action === 'select-job' || action === 'assign')) {
      return;
    }
    // Gate unavailability actions behind management/admin role
    if ((action === 'unavailable' || action === 'toggle-unavailable') && !isManagementUser) {
      toast({ title: 'Sin permiso', description: 'Solo managers y administradores pueden marcar disponibilidad.', variant: 'destructive' });
      return;
    }

    // Special flows
    if (action === 'availability-wa') {
      // Open dialog with WhatsApp channel and single-day default
      const targetJobId = selectedJobId || assignment?.job_id || undefined;
      if (targetJobId) {
        setAvailabilityChannel('whatsapp');
        setAvailabilityDialog({ open: true, jobId: targetJobId, profileId: technicianId, dateIso: formatMadridDateKey(date), singleDay: true, channel: 'whatsapp' });
      } else {
        setCellAction({ type: 'select-job-for-staffing', technicianId, date, assignment, intendedPhase: 'availability', intendedChannel: 'whatsapp' });
      }
      return;
    }

    if (action === 'availability-email') {
      // Open dialog with Email channel and single-day default
      const targetJobId = selectedJobId || assignment?.job_id || undefined;
      if (targetJobId) {
        setAvailabilityChannel('email');
        setAvailabilityDialog({ open: true, jobId: targetJobId, profileId: technicianId, dateIso: formatMadridDateKey(date), singleDay: true, channel: 'email' });
      } else {
        setAvailabilityPreferredChannel('email');
        setCellAction({ type: 'select-job-for-staffing', technicianId, date, assignment });
      }
      return;
    }

    if (action === 'offer-details-wa') {
      const targetJobId = selectedJobId || assignment?.job_id || undefined;
      if (targetJobId) {
        setOfferChannel('whatsapp');
        setCellAction({ type: 'offer-details', technicianId, date, assignment, selectedJobId: targetJobId });
      } else {
        setOfferPreferredChannel('whatsapp');
        setCellAction({ type: 'select-job-for-staffing', technicianId, date, assignment });
      }
      return;
    }

    if (action === 'offer-details-email') {
      const targetJobId = selectedJobId || assignment?.job_id || undefined;
      if (targetJobId) {
        setOfferChannel('email');
        setCellAction({ type: 'offer-details', technicianId, date, assignment, selectedJobId: targetJobId });
      } else {
        setOfferPreferredChannel('email');
        setCellAction({ type: 'select-job-for-staffing', technicianId, date, assignment });
      }
      return;
    }

    // Direct toggle unavailable (no dialog, instant write)
    if (action === 'toggle-unavailable') {
      handleDirectToggleUnavailable(technicianId, date);
      return;
    }

    // Default behavior
    setCellAction({ type: action, technicianId, date, assignment, selectedJobId });
  }, [getAssignmentForCell, allowDirectAssign, fridgeSet, sendStaffingEmail, closeDialogs, toast, handleDirectToggleUnavailable, isManagementUser, matrixV2, quickConfirm, openInspector]);

  const handleJobSelected = useCallback((jobId: string) => {
    if (cellAction?.type === 'select-job') {
      setCellAction({
        ...cellAction,
        type: 'assign',
        selectedJobId: jobId
      });
    }
  }, [cellAction]);



  // Independent of selectedCells, so the callback every cell receives stays
  // stable: depending on the set handed each of the hundreds of memoized cells
  // a new onSelect on every click, re-rendering the whole visible grid.
  const handleCellSelect = useCallback((technicianId: string, date: Date, selected: boolean) => {
    const cellKey = `${technicianId}-${formatMadridDateKey(date)}`;

    if (selected) {
      // Update global store for single-cell selection (for Stream Deck shortcuts)
      selectCell(technicianId, date);
    } else if (isGlobalCellSelected(technicianId, date)) {
      // Clear global selection if deselecting
      clearGlobalSelection();
    }

    setSelectedCells((prev) => {
      if (prev.has(cellKey) === selected) return prev;
      const next = new Set(prev);
      if (selected) next.add(cellKey);
      else next.delete(cellKey);
      return next;
    });
  }, [selectCell, isGlobalCellSelected, clearGlobalSelection]);

  const clearCellSelection = useCallback(() => {
    setSelectedCells(new Set());
    clearGlobalSelection();
  }, [clearGlobalSelection]);

  const handleStaffingActionSelected = useCallback(async (jobId: string, action: 'availability' | 'offer', options?: { singleDay?: boolean }) => {
    if (cellAction?.type === 'select-job-for-staffing') {
      const dateKey = formatMadridDateKey(cellAction.date);
      const existingDates = allAssignments.filter(a => a.job_id === jobId && a.technician_id === cellAction.technicianId && a.status === 'confirmed');
      let isAddedDate = existingDates.length > 0 && !existingDates.some(a => a.date === dateKey);
      if (existingDates.length === 0 && !options?.singleDay) {
        try {
          // The grid contains only visible dates. Verify coverage outside it
          // before defaulting an extension to a whole-job solicitation.
          isAddedDate = await qc.fetchQuery({
            queryKey: queryKeys.scope('matrix-staffing-existing-coverage', jobId, cellAction.technicianId, dateKey),
            staleTime: 0,
            queryFn: async () => {
              const [assignment, schedule] = await Promise.all([
                dataLayerClient.from('job_assignments').select('status').eq('job_id', jobId)
                  .eq('technician_id', cellAction.technicianId).eq('status', 'confirmed').maybeSingle(),
                dataLayerClient.from('timesheets').select('date').eq('job_id', jobId)
                  .eq('technician_id', cellAction.technicianId).eq('is_active', true).neq('date', dateKey).limit(1),
              ]);
              if (assignment.error) throw assignment.error;
              if (schedule.error) throw schedule.error;
              return assignment.data?.status === 'confirmed' && Boolean(schedule.data?.length);
            },
          });
        } catch {
          toast({ title: 'No se pudo verificar la cobertura', description: 'Inténtalo de nuevo antes de enviar la solicitud.', variant: 'destructive' });
          return;
        }
      }
      const singleDay = isAddedDate || !!options?.singleDay;
      // If the technician already declined this job, block staffing for this job only
      const declinedSet = declinedJobsByTech.get(cellAction.technicianId);
      if (declinedSet?.has(jobId)) {
        toast({ title: 'Trabajo ya rechazado', description: 'Elige otro trabajo para este técnico en esta fecha.', variant: 'destructive' });
        return;
      }
      if (action === 'offer') {
        // Decide channel (respect WA preference if set)
        setOfferChannel(offerPreferredChannel ?? 'email');
        setOfferPreferredChannel(null);
        // Open offer details dialog; do not send immediately
        setCellAction({ ...cellAction, type: 'offer-details', selectedJobId: jobId, singleDay });
        return;
      }
      // Availability: pre-check conflicts, then direct-send via intent/preference if set, else ask
      (async () => {
        const technicianId = cellAction.technicianId;
        const conflictResult = await checkTimeConflictEnhanced(technicianId, jobId, {
          targetDateIso: formatMadridDateKey(cellAction.date),
          singleDayOnly: singleDay,
          includePending: true,
        });
        if (conflictResult.hasHardConflict) {
          const conflict = conflictResult.hardConflicts[0];
          toast({
            title: 'Conflicto de horarios',
            description: `Ya tiene confirmado: ${conflict.title} (${new Date(conflict.start_time).toLocaleString()} - ${new Date(conflict.end_time).toLocaleString()})`,
            variant: 'destructive'
          });
          return;
        }

        const intentPhase = cellAction.intendedPhase;
        const intentChannel = cellAction.intendedChannel;
        const defaultChannel = intentChannel || availabilityPreferredChannel || 'email';

        setAvailabilityChannel(defaultChannel);
        setAvailabilityDialog({
          open: true,
          jobId,
          profileId: technicianId,
          dateIso: formatMadridDateKey(cellAction.date),
          singleDay,
          channel: defaultChannel
        });
      })();
    } else {
      // no-op
    }
  }, [cellAction, allAssignments, declinedJobsByTech, sendStaffingEmail, toast, closeDialogs, availabilityPreferredChannel, offerPreferredChannel, setAvailabilityPreferredChannel, qc]);

  const handleCellPrefetch = useCallback((technicianId: string) => {
    prefetchTechnicianData(technicianId);
  }, [prefetchTechnicianData]);

  const handleOptimisticUpdate = useCallback((technicianId: string, jobId: string, status: string) => {
    updateAssignmentOptimistically(technicianId, jobId, status);
  }, [updateAssignmentOptimistically]);

  // Batched staffing statuses for visible window
  const visibleTechIds = useMemo(
    () => orderedTechnicians.slice(staffingBlock.start, staffingBlock.end).map(t => t.id),
    [orderedTechnicians, staffingBlock],
  );
  // Fetch staffing statuses for ALL currently loaded dates and jobs for the visible technicians
  // This avoids re-fetching when scrolling horizontally, making badges render immediately.
  const allJobsLite = useMemo(() => jobs.map(j => ({ id: j.id, title: j.title, start_time: j.start_time, end_time: j.end_time })), [jobs]);
  const visibleStaffingAssignments = useMemo(() => {
    const ids = new Set(visibleTechIds);
    return allAssignments.filter(a => ids.has(a.technician_id));
  }, [allAssignments, visibleTechIds]);
  const { data: staffingMaps } = useStaffingMatrixStatuses(visibleTechIds, allJobsLite, dates, visibleStaffingAssignments);
  const actorIdsForTooltip = useMemo(() => {
    const ids = new Set<string>();
    allAssignments.forEach((assignment) => {
      if (assignment?.assigned_by) ids.add(assignment.assigned_by);
    });
    staffingMaps?.byDate?.forEach((status) => {
      if (!status?.availability_actor_label && status?.availability_requested_by) ids.add(status.availability_requested_by);
      if (!status?.offer_actor_label && status?.offer_requested_by) ids.add(status.offer_requested_by);
    });
    return Array.from(ids);
  }, [allAssignments, staffingMaps]);

  const { data: profileNamesMap = EMPTY_PROFILE_NAMES_MAP } = useQuery({
    queryKey: queryKeys.scope('matrix-tooltip-profile-names', [...actorIdsForTooltip].sort().join(',')),
    queryFn: async () => {
      if (!actorIdsForTooltip.length) return EMPTY_PROFILE_NAMES_MAP;
      const chunk = <T,>(arr: T[], size: number) => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const batches = chunk(actorIdsForTooltip, 50);
      const map = new Map<string, string>();
      for (const batch of batches) {
        const { data, error } = await dataLayerClient.from('profiles')
          .select('id, first_name, last_name, nickname')
          .in('id', batch);
        if (error) {
          console.warn('Failed loading tooltip profile names', error);
          continue;
        }
        ((data || []) as ProfileNameRow[]).forEach((profile) => {
          const fullName = formatUserName(profile.first_name, profile.nickname, profile.last_name) || 'Usuario';
          if (profile.id) map.set(profile.id, fullName);
        });
      }
      return map;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // Keep the names already loaded while a wider id set fetches, rather than
    // dropping every tooltip back to "unknown sender" in the meantime.
    placeholderData: (previous) => previous,
    enabled: actorIdsForTooltip.length > 0,
  });

  const getCurrentTechnician = useCallback(() => {
    if (!cellAction?.technicianId) return null;
    return technicians.find(t => t.id === cellAction.technicianId);
  }, [cellAction?.technicianId, technicians]);

  const currentTechnician = getCurrentTechnician();

  // Availability channel dialog state (moved up before usage)
  const [availabilityChannel, setAvailabilityChannel] = useState<'email' | 'whatsapp'>('email');
  const [availabilitySending, setAvailabilitySending] = useState(false);
  const [availabilityCoverage, setAvailabilityCoverage] = useState<'full' | 'single' | 'multi'>('single');
  const [availabilitySingleDate, setAvailabilitySingleDate] = useState<Date | null>(null);
  const [availabilityMultiDates, setAvailabilityMultiDates] = useState<Date[]>([]);

  // Helper to handle conflict errors
  const handleEmailError = (error: unknown, payload: StaffingEmailPayload) => {
    setAvailabilitySending(false);
    if (error instanceof ConflictError) {
      // Show conflict dialog with details and option to override
      setConflictDialog({
        open: true,
        details: error.details,
        originalPayload: payload
      });
    } else {
      // Show regular error toast
      toast({
        title: 'Error al enviar',
        description: error instanceof Error ? error.message : 'No se pudo enviar la solicitud de staffing',
        variant: 'destructive'
      });
    }
  };

  // Read at seed time only, so a selection change does not re-seed an open dialog.
  // Synced in an effect rather than during render: a render React discards would
  // otherwise leave the ref holding a selection that was never committed. This
  // effect is declared before the seeding effect so the ref is current when it runs.
  const selectedCellsRef = React.useRef(selectedCells);
  useEffect(() => {
    selectedCellsRef.current = selectedCells;
  }, [selectedCells]);
  const availabilityDialogOpen = !!availabilityDialog?.open;
  const availabilityDialogProfileId = availabilityDialog?.profileId;
  const availabilityDialogDateIso = availabilityDialog?.dateIso;
  const availabilityDialogSingleDay = availabilityDialog?.singleDay;
  const availabilityDialogJobId = availabilityDialog?.jobId;

  // Read through a ref for the same reason as selectedCells: a jobs refetch must
  // not re-seed a dialog the user is already editing.
  const jobsRef = React.useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  /** The day keys this technician has selected in the grid, oldest first. */
  const collectSelectedDayKeys = useCallback((technicianId?: string) => {
    if (!technicianId) return [] as string[];
    const prefix = `${technicianId}-`;
    const keys: string[] = [];
    selectedCellsRef.current.forEach((cellKey) => {
      if (cellKey.startsWith(prefix)) keys.push(cellKey.slice(prefix.length));
    });
    return keys.sort();
  }, []);

  /**
   * A grid selection can span days the chosen job does not run on. Those days
   * would be seeded into the picker, counted by the CTA and sent — while the
   * calendar itself refuses to select them. Clamp at the source.
   */
  const clampDayKeysToJob = useCallback((dayKeys: string[], jobId?: string | null) => {
    const job = jobId ? jobsRef.current.find((candidate) => candidate.id === jobId) : null;
    if (!job?.start_time) return dayKeys;
    const startKey = formatMadridDateKey(job.start_time);
    const endKey = job.end_time ? formatMadridDateKey(job.end_time) : startKey;
    return dayKeys.filter((key) => key >= startKey && key <= endKey);
  }, []);

  /**
   * Offers honour the grid selection exactly as availability requests do, so a
   * long-press multi-select means the same thing whichever action follows it.
   */
  const offerSeedDates = useMemo(() => {
    if (cellAction?.type !== 'offer-details') return undefined;
    const keys = clampDayKeysToJob(
      collectSelectedDayKeys(cellAction.technicianId),
      cellAction.selectedJobId,
    );
    return keys.length > 1 ? keys : undefined;
    // selectedCells is a dependency in spirit: it is read through the ref that
    // the effect above keeps current, and it cannot change while a modal is up.
  }, [cellAction, clampDayKeysToJob, collectSelectedDayKeys]);

  useEffect(() => {
    if (availabilityDialogOpen) {
      setAvailabilityCoverage(availabilityDialogSingleDay ? 'single' : 'full');
      try {
        // The grid selection, minus any day this job does not run on.
        const selectedDatesForTech = clampDayKeysToJob(
          collectSelectedDayKeys(availabilityDialogProfileId),
          availabilityDialogJobId,
        )
          .map((dayKey) => madridDateKeyToCalendarDate(dayKey))
          .filter((date): date is Date => !!date);

        // If we have multiple selected cells, use them; otherwise fall back to the clicked date
        if (selectedDatesForTech.length > 1) {
          // Multiple dates selected - initialize with all of them
          setAvailabilitySingleDate(null);
          setAvailabilityMultiDates(selectedDatesForTech.sort((a, b) => a.getTime() - b.getTime()));
          setAvailabilityCoverage('multi');
        } else {
          // Single date or no selection - use the clicked date
          const clickedDate = availabilityDialogDateIso ? madridDateKeyToCalendarDate(availabilityDialogDateIso) : null;
          setAvailabilitySingleDate(clickedDate);
          setAvailabilityMultiDates(clickedDate ? [clickedDate] : []);
        }
      } catch { /* ignore */ }
    }
    // Seeds once per opening. Depending on selectedCells re-ran this while the
    // dialog was open, discarding the coverage and dates the user had picked.
    // availabilityDialogJobId is fixed for the life of one opening, so it can
    // sit here without re-seeding mid-edit.
  }, [
    availabilityDialogOpen,
    availabilityDialogProfileId,
    availabilityDialogDateIso,
    availabilityDialogSingleDay,
    availabilityDialogJobId,
    clampDayKeysToJob,
    collectSelectedDayKeys,
  ]);

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Cargando matriz...</p>
        </div>
      </div>
    );
  }

  const viewProps = {
    isFetching, isInitialLoading,
    TECHNICIAN_WIDTH, HEADER_HEIGHT, CELL_WIDTH, CELL_HEIGHT, matrixWidth, matrixHeight,
    canExpandBefore, canExpandAfter, onNearEdgeScroll, onVisibleRowsChange: handleVisibleRowsChange,
    dates, technicians, orderedTechnicians,
    fridgeSet, mobile, staffingDepartment,
    // Matrix v2 has no editing modes: managers can always assign (the inspector
    // is read-only for everyone else), and the staffing icons live in the inspector.
    allowDirectAssign: matrixV2 ? isManagementUser : allowDirectAssign,
    allowMarkUnavailable: matrixV2 ? false : allowMarkUnavailable,
    hideStaffingEmailButtons: matrixV2 ? true : hideStaffingEmailButtons,
    hideStaffingWhatsappButtons: matrixV2 ? true : hideStaffingWhatsappButtons,
    cycleTechSort, getSortLabel,
    isManagementUser, setCreateUserOpen, createUserOpen, qc, setSortJobId,
    getJobsForDate, getHeaderCounts, getAssignmentForCell, getAvailabilityForCell, selectedCells, staffingMaps,
    profileNamesMap,
    handleCellSelect, handleCellClick, handleCellPrefetch, handleOptimisticUpdate, incrementCellRender,
    declinedJobsByTech, cellAction, currentTechnician, closeDialogs,
    handleJobSelected, handleStaffingActionSelected, forcedStaffingAction, forcedStaffingChannel,
    jobs, offerChannel, toast, sendStaffingEmail, checkTimeConflictEnhanced,
    isSendingStaffingEmail, cancelStaffing, isCancellingStaffing,
    availabilityDialog, setAvailabilityDialog, availabilityCoverage, setAvailabilityCoverage,
    availabilitySingleDate, setAvailabilitySingleDate, availabilityMultiDates, setAvailabilityMultiDates,
    availabilitySending, setAvailabilitySending, handleEmailError, conflictDialog, setConflictDialog,
    offerSeedDates,
    isGlobalCellSelected, techMedalRankings, techLastYearMedalRankings,
    clearCellSelection,
    v2: v2Config,
  };

  return <OptimizedAssignmentMatrixView {...viewProps} />;
};
