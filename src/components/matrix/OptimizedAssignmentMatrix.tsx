import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useOptimizedMatrixData } from '@/hooks/useOptimizedMatrixData';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useStaffingRealtime } from '@/features/staffing/hooks/useStaffingRealtime';
import { useSendStaffingEmail, ConflictError } from '@/features/staffing/hooks/useStaffing';
import { useToast } from '@/hooks/use-toast';
import { dataLayerClient } from '@/services/dataLayerClient';
import { checkTimeConflictEnhanced } from '@/utils/technicianAvailability';
import { useStaffingMatrixStatuses } from '@/features/staffing/hooks/useStaffingMatrixStatuses';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelectedCellStore } from '@/stores/useSelectedCellStore';
import { formatUserName } from '@/utils/userName';
import { isManagementRole } from '@/utils/permissions';

import { OptimizedAssignmentMatrixView } from '@/components/matrix/optimized-assignment-matrix/OptimizedAssignmentMatrixView';
import { useMatrixScrollState } from '@/components/matrix/optimized-assignment-matrix/useMatrixScrollState';
import { useMatrixTechnicianOrdering } from '@/components/matrix/optimized-assignment-matrix/useMatrixTechnicianOrdering';
import type { CellAction, OptimizedAssignmentMatrixExtendedProps } from '@/components/matrix/optimized-assignment-matrix/types';
import { LENS_HEADER_ROW_HEIGHT, type MatrixLens } from '@/components/matrix/lenses/types';
import { useMatrixCoverage } from '@/hooks/matrix/useMatrixCoverage';
import { useMatrixWorkload } from '@/hooks/matrix/useMatrixWorkload';
import { computeDepartmentPercentiles } from '@/components/matrix/lenses/workload';
import { aggregateCost, formatEuro, formatEuroRange } from '@/components/matrix/lenses/cost';
import type { CellLensBadgeData, TechnicianLensSummaryData } from '@/components/matrix/lenses/types';
import { useMatrixDrag } from '@/components/matrix/dnd/useMatrixDrag';
import { useMoveAssignment } from '@/components/matrix/dnd/useMoveAssignment';
import { useMatrixTourRateQuotes, type TourRateQuotePair } from '@/hooks/matrix/useMatrixTourRateQuotes';
import { useMatrixRateEstimates } from '@/hooks/matrix/useMatrixRateEstimates';


import { queryKeys } from "@/lib/react-query";
const EMPTY_PROFILE_NAMES_MAP = new Map<string, string>();
const EMPTY_COST_BY_DATE = new Map<string, { amount: number; approved: number }>();

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
  lens = 'default',
  onOpenStaffingOrchestrator,
}: OptimizedAssignmentMatrixExtendedProps) => {
  const [cellAction, setCellAction] = useState<CellAction | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  // Global selected cell store for Stream Deck integration
  const {
    selectCell,
    clearSelection: clearGlobalSelection,
    isCellSelected: isGlobalCellSelected
  } = useSelectedCellStore();

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const { userRole } = useOptimizedAuth();
  const isManagementUser = isManagementRole(userRole);
  // Cost lens exposes payout amounts; defend in depth even if a stale
  // localStorage preference selected it before a role change.
  const effectiveLens: MatrixLens = lens === 'cost' && !isManagementUser ? 'default' : lens;
  const qc = useQueryClient();

  // Performance monitoring
  const { startRenderTimer, endRenderTimer, incrementCellRender } = usePerformanceMonitor('AssignmentMatrix');

  // Staffing functionality
  useStaffingRealtime();
  const { toast } = useToast();
  const { mutate: sendStaffingEmail } = useSendStaffingEmail();

  // Cell dimensions (overridable for mobile)
  const CELL_WIDTH = cellWidth ?? 160;
  const CELL_HEIGHT = cellHeight ?? 60;
  const TECHNICIAN_WIDTH = technicianWidth ?? 256;
  const BASE_HEADER_HEIGHT = headerHeight ?? 80;
  const showLensHeaderRow = effectiveLens === 'coverage' || effectiveLens === 'cost';
  const HEADER_HEIGHT = BASE_HEADER_HEIGHT + (showLensHeaderRow ? LENS_HEADER_ROW_HEIGHT : 0);

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

  // Lens data sources. Each hook is a no-op query when its lens isn't active.
  const jobIds = useMemo(() => jobs.map((job) => job.id), [jobs]);
  const technicianIds = useMemo(() => technicians.map((technician) => technician.id), [technicians]);
  const departmentByTech = useMemo(
    () => new Map(technicians.map((technician) => [technician.id, technician.department])),
    [technicians],
  );

  const { coverageByDate, coverageByJob } = useMatrixCoverage({
    dates,
    jobIds,
    getJobsForDate,
    enabled: effectiveLens === 'coverage',
  });

  const { byCell: workloadByCell, byTech: workloadByTech } = useMatrixWorkload({
    technicianIds,
    dates,
    enabled: effectiveLens === 'workload',
  });

  const {
    orderedTechnicians,
    setSortJobId,
    techMedalRankings,
    techLastYearMedalRankings,
    cycleTechSort,
    getSortLabel,
  } = useMatrixTechnicianOrdering({
    technicians,
    allAssignments,
    mobile,
    workloadByTech,
  });

  // Tour-date pay is a flat day/tour rate, knowable the moment the assignment
  // exists — the timesheet itself stays schedule-only/hours-empty for tour
  // dates by design, so it never gets an amount_eur. Fetch the real rate via
  // the same RPC the payout/quote UI already uses for every (tour-date job,
  // technician) pair currently on screen.
  const tourDateJobIds = useMemo(
    () => new Set(jobs.filter((job) => job.job_type === 'tourdate').map((job) => job.id)),
    [jobs],
  );
  const tourQuotePairs = useMemo<TourRateQuotePair[]>(() => {
    if (effectiveLens !== 'cost' || tourDateJobIds.size === 0) return [];
    const seen = new Set<string>();
    const pairs: TourRateQuotePair[] = [];
    allAssignments.forEach((assignment) => {
      if (!tourDateJobIds.has(assignment.job_id)) return;
      const key = `${assignment.job_id}:${assignment.technician_id}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ jobId: assignment.job_id, technicianId: assignment.technician_id });
    });
    return pairs;
  }, [effectiveLens, tourDateJobIds, allAssignments]);
  const tourQuoteAmountByPair = useMatrixTourRateQuotes({
    pairs: tourQuotePairs,
    enabled: effectiveLens === 'cost',
  });

  // Rough day-rate preview for cells with no real amount_eur yet (hours not
  // logged). See useMatrixRateEstimates for what this deliberately does and
  // doesn't account for.
  const rateEstimateByTechCategory = useMatrixRateEstimates({
    technicianIds,
    enabled: effectiveLens === 'cost',
  });

  const costAggregation = useMemo(
    () => (effectiveLens === 'cost' ? aggregateCost(allAssignments, tourQuoteAmountByPair, rateEstimateByTechCategory) : null),
    [effectiveLens, allAssignments, tourQuoteAmountByPair, rateEstimateByTechCategory],
  );

  const lensBadgeByCell = useMemo(() => {
    const map = new Map<string, CellLensBadgeData>();
    if (effectiveLens === 'workload') {
      workloadByCell.forEach((cell, key) => {
        map.set(key, {
          label: String(cell.streak),
          tone: cell.tone,
          title: `${cell.streak} día${cell.streak === 1 ? '' : 's'} seguidos trabajando`,
        });
      });
    } else if (effectiveLens === 'cost' && costAggregation) {
      costAggregation.byCell.forEach((cell, key) => {
        if (cell.amount === null) {
          map.set(key, cell.estimate
            ? {
              label: `~${formatEuroRange(cell.estimate)}`,
              tone: 'muted',
              title: 'Estimación aproximada (tarifa base, sin horas registradas todavía): no incluye nocturnidad, festivos ni horas extra reales',
            }
            : { label: '—', tone: 'warn', title: 'Sin tarifa asignada' });
          return;
        }
        const title = cell.source === 'tour_quote' ? 'Tarifa de gira' : cell.approved ? 'Aprobado' : 'Pendiente de aprobación';
        map.set(key, {
          label: formatEuro(cell.amount),
          tone: cell.source === 'tour_quote' ? 'neutral' : cell.approved ? 'ok' : 'neutral',
          title,
        });
      });
    }
    return map;
  }, [effectiveLens, workloadByCell, costAggregation]);

  const technicianLensSummaryByTech = useMemo(() => {
    const map = new Map<string, TechnicianLensSummaryData>();
    if (effectiveLens === 'workload') {
      const monthCounts = new Map<string, number>();
      workloadByTech.forEach((summary, techId) => monthCounts.set(techId, summary.monthCount));
      const percentiles = computeDepartmentPercentiles(monthCounts, departmentByTech);
      workloadByTech.forEach((summary, techId) => {
        const percentile = percentiles.get(techId);
        map.set(techId, {
          primary: `↯ ${summary.streakEndingToday} día${summary.streakEndingToday === 1 ? '' : 's'} seguidos`,
          secondary: `${summary.monthCount} este mes${percentile !== undefined ? ` · p${percentile}` : ''}`,
          tone: summary.tone,
        });
      });
    } else if (effectiveLens === 'cost' && costAggregation) {
      costAggregation.byTech.forEach((total, techId) => {
        map.set(techId, {
          primary: formatEuro(total.amount),
          secondary: total.missingRateCount > 0 ? `${total.missingRateCount} sin tarifa` : undefined,
          tone: total.missingRateCount > 0 ? 'warn' : 'neutral',
        });
      });
    }
    return map;
  }, [effectiveLens, workloadByTech, costAggregation, departmentByTech]);

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

  const {
    dateHeadersRef,
    technicianScrollRef,
    mainScrollRef,
    visibleCols,
    visibleRows,
    canNavLeft,
    canNavRight,
    handleMobileNav,
    handleDateHeadersScroll,
    handleTechnicianScroll,
    handleMainScroll,
  } = useMatrixScrollState({
    dates,
    techniciansLength: technicians.length,
    cellWidth: CELL_WIDTH,
    cellHeight: CELL_HEIGHT,
    matrixWidth,
    mobile,
    isInitialLoading,
    canExpandBefore,
    canExpandAfter,
    onNearEdgeScroll,
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

  // Drag-and-drop: same-date assignment moves. Management + direct-assign mode
  // only; on mobile this becomes tap-to-pick-up/tap-to-drop instead of native
  // HTML5 drag, which doesn't work on touch — see OptimizedMatrixCell's
  // handleCellClick for the tap-mode interception.
  const dragEnabled = allowDirectAssign && isManagementUser;
  const { pendingMove, isMoving, requestMove, cancelMove, commitMove } = useMoveAssignment();
  const {
    dragSource,
    dropTarget,
    beginDrag,
    dragOverCell,
    clearDragOver,
    dropOnCell,
    endDrag,
  } = useMatrixDrag({
    enabled: dragEnabled,
    mobile,
    fridgeSet,
    declinedJobsByTech,
    getAssignmentForCell,
    getAvailabilityForCell,
    onDrop: (source, targetTechnicianId, targetTechnicianName) => {
      void requestMove(source, targetTechnicianId, targetTechnicianName);
    },
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
    const dateStr = formatInTimeZone(date, 'Europe/Madrid', 'yyyy-MM-dd');
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
    console.log('Matrix handling cell click:', { technicianId, date: format(date, 'yyyy-MM-dd'), action });
    const assignment = getAssignmentForCell(technicianId, date);
    console.log('Assignment data:', assignment);
    // Block assignment/staffing interactions if technician is in fridge
    const isFridge = fridgeSet?.has(technicianId);
    if (isFridge && (action === 'select-job' || action === 'assign' || action === 'select-job-for-staffing' || action === 'confirm' || action === 'offer-details' || action === 'offer-details-wa' || action === 'availability-wa')) {
      toast({ title: 'En la nevera', description: 'Este técnico está en la nevera y no puede ser asignado.', variant: 'destructive' });
      return;
    }
    // Gate direct assign-related actions behind allowDirectAssign
    if (!allowDirectAssign && (action === 'select-job' || action === 'assign')) {
      console.log('Direct assign disabled by UI toggle; ignoring click');
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
        setAvailabilityDialog({ open: true, jobId: targetJobId, profileId: technicianId, dateIso: format(date, 'yyyy-MM-dd'), singleDay: true, channel: 'whatsapp' });
      } else {
        console.log('Setting WhatsApp intent for staffing job selection');
        setCellAction({ type: 'select-job-for-staffing', technicianId, date, assignment, intendedPhase: 'availability', intendedChannel: 'whatsapp' });
      }
      return;
    }

    if (action === 'availability-email') {
      // Open dialog with Email channel and single-day default
      const targetJobId = selectedJobId || assignment?.job_id || undefined;
      if (targetJobId) {
        setAvailabilityChannel('email');
        setAvailabilityDialog({ open: true, jobId: targetJobId, profileId: technicianId, dateIso: format(date, 'yyyy-MM-dd'), singleDay: true, channel: 'email' });
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
  }, [getAssignmentForCell, allowDirectAssign, fridgeSet, sendStaffingEmail, closeDialogs, toast, handleDirectToggleUnavailable, isManagementUser]);

  const handleJobSelected = useCallback((jobId: string) => {
    if (cellAction?.type === 'select-job') {
      setCellAction({
        ...cellAction,
        type: 'assign',
        selectedJobId: jobId
      });
    }
  }, [cellAction]);



  const handleCellSelect = useCallback((technicianId: string, date: Date, selected: boolean) => {
    const cellKey = `${technicianId}-${format(date, 'yyyy-MM-dd')}`;
    const newSelected = new Set(selectedCells);

    if (selected) {
      newSelected.add(cellKey);
      // Update global store for single-cell selection (for Stream Deck shortcuts)
      selectCell(technicianId, date);
    } else {
      newSelected.delete(cellKey);
      // Clear global selection if deselecting
      if (isGlobalCellSelected(technicianId, date)) {
        clearGlobalSelection();
      }
    }

    setSelectedCells(newSelected);
  }, [selectedCells, selectCell, isGlobalCellSelected, clearGlobalSelection]);

  const handleStaffingActionSelected = useCallback((jobId: string, action: 'availability' | 'offer', options?: { singleDay?: boolean }) => {
    console.log('🚀 OptimizedAssignmentMatrix: handleStaffingActionSelected called', {
      jobId,
      action,
      cellAction,
      technicianId: cellAction?.technicianId
    });

    if (cellAction?.type === 'select-job-for-staffing') {
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
        setCellAction({ ...cellAction, type: 'offer-details', selectedJobId: jobId, singleDay: options?.singleDay });
        return;
      }
      // Availability: pre-check conflicts, then direct-send via intent/preference if set, else ask
      (async () => {
        const technicianId = cellAction.technicianId;
        const conflictResult = await checkTimeConflictEnhanced(technicianId, jobId, {
          targetDateIso: format(cellAction.date, 'yyyy-MM-dd'),
          singleDayOnly: !!options?.singleDay,
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

        console.log('Opening availability dialog with channel:', defaultChannel);
        setAvailabilityChannel(defaultChannel);
        setAvailabilityDialog({
          open: true,
          jobId,
          profileId: technicianId,
          dateIso: format(cellAction.date, 'yyyy-MM-dd'),
          singleDay: !!options?.singleDay,
          channel: defaultChannel
        });
      })();
    } else {
      // no-op
    }
  }, [cellAction, sendStaffingEmail, toast, closeDialogs, availabilityPreferredChannel, offerPreferredChannel, setAvailabilityPreferredChannel]);

  const handleCellPrefetch = useCallback((technicianId: string) => {
    prefetchTechnicianData(technicianId);
  }, [prefetchTechnicianData]);

  const handleOptimisticUpdate = useCallback((technicianId: string, jobId: string, status: string) => {
    updateAssignmentOptimistically(technicianId, jobId, status);
  }, [updateAssignmentOptimistically]);

  // Batched staffing statuses for visible window
  const visibleTechIds = useMemo(() => {
    const start = Math.max(0, visibleRows.start - 10);
    const end = Math.min(orderedTechnicians.length - 1, visibleRows.end + 10);
    return orderedTechnicians.slice(start, end + 1).map(t => t.id);
  }, [orderedTechnicians, visibleRows.start, visibleRows.end]);
  // Fetch staffing statuses for ALL currently loaded dates and jobs for the visible technicians
  // This avoids re-fetching when scrolling horizontally, making badges render immediately.
  const allJobsLite = useMemo(() => jobs.map(j => ({ id: j.id, title: j.title, start_time: j.start_time, end_time: j.end_time })), [jobs]);
  const { data: staffingMaps } = useStaffingMatrixStatuses(visibleTechIds, allJobsLite, dates);
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

  useEffect(() => {
    if (availabilityDialog?.open) {
      setAvailabilityCoverage(availabilityDialog.singleDay ? 'single' : 'full');
      try {
        // Extract dates from selectedCells for this technician
        const technicianId = availabilityDialog.profileId;
        const selectedDatesForTech: Date[] = [];

        // Parse selectedCells to find all dates for this technician
        for (const cellKey of selectedCells) {
          // cellKey format: "${technicianId}-yyyy-MM-dd"
          if (cellKey.startsWith(`${technicianId}-`)) {
            const dateStr = cellKey.substring(technicianId.length + 1); // Remove "techId-" prefix
            try {
              const parsedDate = new Date(`${dateStr}T00:00:00`);
              if (!isNaN(parsedDate.getTime())) {
                selectedDatesForTech.push(parsedDate);
              }
            } catch { /* ignore invalid dates */ }
          }
        }

        // If we have multiple selected cells, use them; otherwise fall back to the clicked date
        if (selectedDatesForTech.length > 1) {
          // Multiple dates selected - initialize with all of them
          setAvailabilitySingleDate(null);
          setAvailabilityMultiDates(selectedDatesForTech.sort((a, b) => a.getTime() - b.getTime()));
          setAvailabilityCoverage('multi');
        } else {
          // Single date or no selection - use the clicked date
          const clickedDate = availabilityDialog.dateIso ? new Date(`${availabilityDialog.dateIso}T00:00:00`) : null;
          setAvailabilitySingleDate(clickedDate);
          setAvailabilityMultiDates(clickedDate ? [clickedDate] : []);
        }
      } catch { /* ignore */ }
    }
  }, [availabilityDialog?.open, selectedCells]);

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
    TECHNICIAN_WIDTH, HEADER_HEIGHT, BASE_HEADER_HEIGHT, CELL_WIDTH, CELL_HEIGHT, matrixWidth, matrixHeight,
    dateHeadersRef, technicianScrollRef, mainScrollRef, visibleCols, visibleRows,
    dates, technicians, orderedTechnicians,
    fridgeSet, allowDirectAssign, allowMarkUnavailable, mobile, staffingDepartment,
    hideStaffingEmailButtons, hideStaffingWhatsappButtons,
    canNavLeft, canNavRight, handleMobileNav,
    handleDateHeadersScroll, handleTechnicianScroll, handleMainScroll, cycleTechSort, getSortLabel,
    isManagementUser, setCreateUserOpen, createUserOpen, qc, setSortJobId,
    getJobsForDate, getAssignmentForCell, getAvailabilityForCell, selectedCells, staffingMaps,
    profileNamesMap,
    handleCellSelect, handleCellClick, handleCellPrefetch, handleOptimisticUpdate, incrementCellRender,
    declinedJobsByTech, cellAction, currentTechnician, closeDialogs,
    handleJobSelected, handleStaffingActionSelected, forcedStaffingAction, forcedStaffingChannel,
    jobs, offerChannel, toast, sendStaffingEmail, checkTimeConflictEnhanced,
    availabilityDialog, setAvailabilityDialog, availabilityCoverage, setAvailabilityCoverage,
    availabilitySingleDate, setAvailabilitySingleDate, availabilityMultiDates, setAvailabilityMultiDates,
    availabilitySending, setAvailabilitySending, handleEmailError, conflictDialog, setConflictDialog,
    isGlobalCellSelected, techMedalRankings, techLastYearMedalRankings,
    lens: effectiveLens, onOpenStaffingOrchestrator,
    coverageByDate, coverageByJob,
    costWindowTotal: costAggregation?.window ?? null, costByDate: costAggregation?.byDate ?? EMPTY_COST_BY_DATE,
    lensBadgeByCell, technicianLensSummaryByTech,
    dragEnabled, dragSource, dropTarget, beginDrag, dragOverCell, clearDragOver, dropOnCell, endDrag,
    pendingMove, isMoving, cancelMove, commitMove,
  };

  return <OptimizedAssignmentMatrixView {...viewProps} />;
};
