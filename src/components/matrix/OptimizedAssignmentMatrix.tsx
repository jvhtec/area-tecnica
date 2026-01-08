
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { useOptimizedMatrixData } from '@/hooks/useOptimizedMatrixData';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useStaffingRealtime } from '@/features/staffing/hooks/useStaffingRealtime';
import { useSendStaffingEmail, ConflictError } from '@/features/staffing/hooks/useStaffing';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { checkTimeConflictEnhanced } from '@/utils/technicianAvailability';
import { useStaffingMatrixStatuses } from '@/features/staffing/hooks/useStaffingMatrixStatuses';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { throttle } from '@/utils/throttle';
import { useSelectedCellStore } from '@/stores/useSelectedCellStore';

import { OptimizedAssignmentMatrixView } from './optimized-assignment-matrix/OptimizedAssignmentMatrixView';
import type { CellAction, OptimizedAssignmentMatrixExtendedProps, TechSortMethod } from './optimized-assignment-matrix/types';

export const OptimizedAssignmentMatrix = ({
  technicians,
  dates,
  jobs,
  onNearEdgeScroll,
  canExpandBefore = false,
  canExpandAfter = false,
  allowDirectAssign = false,
  fridgeSet,
  cellWidth,
  cellHeight,
  technicianWidth,
  headerHeight,
  mobile = false
}: OptimizedAssignmentMatrixExtendedProps) => {
  const [cellAction, setCellAction] = useState<CellAction | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  // Global selected cell store for Stream Deck integration
  const {
    selectedCell,
    selectCell,
    clearSelection: clearGlobalSelection,
    isCellSelected: isGlobalCellSelected
  } = useSelectedCellStore();

  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const technicianScrollRef = useRef<HTMLDivElement>(null);
  const dateHeadersRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollAttempts, setScrollAttempts] = useState(0);
  const syncInProgressRef = useRef(false);
  const lastKnownScrollRef = useRef({ left: 0, top: 0 });
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const { userRole } = useOptimizedAuth();
  const isManagementUser = ['admin', 'management'].includes(userRole || '');
  const qc = useQueryClient();
  // Sorting focus by job
  const [sortJobId, setSortJobId] = useState<string | null>(null);
  // Technician column sorting
  const [techSortMethod, setTechSortMethod] = useState<TechSortMethod>('default');

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

  // Technician IDs for queries
  const allTechIds = useMemo(() => technicians.map(t => t.id), [technicians]);

  // When sorting by a job, fetch statuses for that job across all technicians (batched)
  const { data: sortJobStatuses } = useQuery({
    queryKey: ['matrix-sort-job-statuses', sortJobId, allTechIds.join(',')],
    queryFn: async () => {
      if (!sortJobId || !allTechIds.length) return new Map<string, { availability_status: string | null; offer_status: string | null }>();
      // Batch the call to RPC to avoid payload limits
      const chunk = <T,>(arr: T[], size: number) => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const batches = chunk(allTechIds, 30);
      const map = new Map<string, { availability_status: string | null; offer_status: string | null }>();
      for (const b of batches) {
        const { data, error } = await supabase
          .rpc('get_assignment_matrix_staffing')
          .eq('job_id', sortJobId)
          .in('profile_id', b);
        if (error) {
          console.warn('Sort job statuses RPC error', error);
          continue;
        }
        (data || []).forEach((r: any) => {
          const av = r.availability_status === 'pending' ? 'requested' : (r.availability_status === 'expired' ? null : r.availability_status);
          const of = r.offer_status === 'pending' ? 'sent' : (r.offer_status === 'expired' ? null : r.offer_status);
          map.set(r.profile_id, { availability_status: av, offer_status: of });
        });
      }
      return map;
    },
    enabled: !!sortJobId,
    staleTime: 2_000,
    gcTime: 60_000,
  });

  // Fetch residencia for all technicians for location-based sorting
  const { data: techResidencias } = useQuery({
    queryKey: ['tech-residencias', allTechIds.join(',')],
    queryFn: async () => {
      if (!allTechIds.length) return new Map<string, string | null>();
      const { data, error } = await supabase
        .from('profiles')
        .select('id, residencia')
        .in('id', allTechIds);
      if (error) {
        console.warn('Failed to fetch residencias', error);
        return new Map<string, string | null>();
      }
      const map = new Map<string, string | null>();
      (data || []).forEach((r: any) => {
        map.set(r.id, r.residencia);
      });
      return map;
    },
    enabled: allTechIds.length > 0 && techSortMethod === 'location',
    staleTime: 60_000, // 1 minute
    gcTime: 300_000, // 5 minutes
  });

  // Fetch confirmed job counts for all technicians for default sorting
  const { data: techConfirmedCounts } = useQuery({
    queryKey: ['tech-confirmed-counts', allTechIds.join(',')],
    queryFn: async () => {
      if (!allTechIds.length) return new Map<string, number>();
      // Get all confirmed assignments for all technicians
      const { data, error } = await supabase
        .from('job_assignments')
        .select('technician_id')
        .eq('status', 'confirmed')
        .in('technician_id', allTechIds);

      if (error) {
        console.warn('Failed to fetch confirmed job counts', error);
        return new Map<string, number>();
      }

      // Count assignments per technician
      const countMap = new Map<string, number>();
      allTechIds.forEach(id => countMap.set(id, 0));
      (data || []).forEach((assignment: any) => {
        const current = countMap.get(assignment.technician_id) || 0;
        countMap.set(assignment.technician_id, current + 1);
      });

      return countMap;
    },
    enabled: allTechIds.length > 0 && techSortMethod === 'default' && !sortJobId,
    staleTime: 60_000, // 1 minute
    gcTime: 300_000, // 5 minutes
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
      qc.invalidateQueries({ queryKey: ['staffing-matrix'] });
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

  // Visible window state for virtualization
  const [visibleRows, setVisibleRows] = useState({ start: 0, end: Math.min(technicians.length - 1, 20) });
  const [visibleCols, setVisibleCols] = useState({ start: 0, end: Math.min(dates.length - 1, 14) });
  // Higher overscan to keep cells rendered during fast vertical/horizontal scrolls
  const OVERSCAN_ROWS = mobile ? 6 : 10;
  const OVERSCAN_COLS = mobile ? 4 : 6;

  // Mobile date navigation state
  const [canNavLeft, setCanNavLeft] = useState(false);
  const [canNavRight, setCanNavRight] = useState(true);
  const [navStep, setNavStep] = useState(3);

  const updateNavAvailability = useCallback(() => {
    if (!mobile) return;
    const el = dateHeadersRef.current;
    if (!el) return;
    const sl = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth - 1;
    setCanNavLeft(sl > 2);
    setCanNavRight(sl < max);
  }, [mobile]);

  const updateVisibleWindow = useCallback(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop;
    const scrollLeft = el.scrollLeft;
    const clientH = el.clientHeight;
    const clientW = el.clientWidth;

    const rowStart = Math.max(0, Math.floor(scrollTop / CELL_HEIGHT) - OVERSCAN_ROWS);
    const rowEnd = Math.min(technicians.length - 1, Math.floor((scrollTop + clientH) / CELL_HEIGHT) + OVERSCAN_ROWS);
    const colStart = Math.max(0, Math.floor(scrollLeft / CELL_WIDTH) - OVERSCAN_COLS);
    const colEnd = Math.min(dates.length - 1, Math.floor((scrollLeft + clientW) / CELL_WIDTH) + OVERSCAN_COLS);

    setVisibleRows(prev => (prev.start !== rowStart || prev.end !== rowEnd ? { start: rowStart, end: rowEnd } : prev));
    setVisibleCols(prev => (prev.start !== colStart || prev.end !== colEnd ? { start: colStart, end: colEnd } : prev));
  }, [technicians.length, dates.length]);

  // Avoid the first-scroll "snap": run a direct window update on the very first scroll event
  const hasHandledFirstScrollRef = useRef(false);

  // Throttle visible window updates with rAF
  const updateScheduledRef = useRef(false);
  const scheduleVisibleWindowUpdate = useCallback(() => {
    if (!hasHandledFirstScrollRef.current) {
      hasHandledFirstScrollRef.current = true;
      updateVisibleWindow();
      return;
    }
    if (updateScheduledRef.current) return;
    updateScheduledRef.current = true;
    requestAnimationFrame(() => {
      updateScheduledRef.current = false;
      updateVisibleWindow();
    });
  }, [updateVisibleWindow]);

  // Build declined job sets per technician for targeted staffing blocking
  const declinedJobsByTech = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    (allAssignments as any[])?.forEach((a: any) => {
      if (a?.status === 'declined' && a.technician_id && a.job_id) {
        if (!map.has(a.technician_id)) map.set(a.technician_id, new Set());
        map.get(a.technician_id)!.add(a.job_id);
      }
    });
    return map;
  }, [allAssignments]);

  // Optimized scroll synchronization
  const syncScrollPositions = useCallback((scrollLeft: number, scrollTop: number, source: string) => {
    if (syncInProgressRef.current) return;

    syncInProgressRef.current = true;

    requestAnimationFrame(() => {
      try {
        if (source !== 'dateHeaders' && dateHeadersRef.current) {
          dateHeadersRef.current.scrollLeft = scrollLeft;
        }
        if (source !== 'main' && mainScrollRef.current) {
          mainScrollRef.current.scrollLeft = scrollLeft;
        }
        if (source !== 'technician' && technicianScrollRef.current) {
          technicianScrollRef.current.scrollTop = scrollTop;
        }
        if (source !== 'main' && mainScrollRef.current) {
          mainScrollRef.current.scrollTop = scrollTop;
        }
      } finally {
        syncInProgressRef.current = false;
      }
    });
  }, []);

  const handleMainScrollCore = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncInProgressRef.current) return;
    const scrollLeft = e.currentTarget.scrollLeft;
    const scrollTop = e.currentTarget.scrollTop;

    const previousScrollLeftRef =
      (handleMainScrollCore as any)._previousScrollLeftRef ||
      ((handleMainScrollCore as any)._previousScrollLeftRef = { value: null as number | null });
    const previousScrollLeft = previousScrollLeftRef.value;
    const horizontalDelta = previousScrollLeft === null ? 0 : scrollLeft - previousScrollLeft;
    const movedHorizontally = previousScrollLeft !== null && horizontalDelta !== 0;

    // Ignore pure vertical scrolls while keeping scroll positions in sync
    if (previousScrollLeft !== null && !movedHorizontally) {
      syncScrollPositions(scrollLeft, scrollTop, 'main');
      scheduleVisibleWindowUpdate();
      return;
    }

    previousScrollLeftRef.value = scrollLeft;

    const movingTowardLeftEdge = movedHorizontally && horizontalDelta < 0;
    const movingTowardRightEdge = movedHorizontally && horizontalDelta > 0;

    // Check if we're near the edges and can expand
    const scrollElement = e.currentTarget;
    const scrollWidth = scrollElement.scrollWidth;
    const clientWidth = scrollElement.clientWidth;
    const maxScrollLeft = scrollWidth - clientWidth;

    const nearLeftEdge = scrollLeft < 200; // Within 200px of left edge
    const nearRightEdge = scrollLeft > maxScrollLeft - 200; // Within 200px of right edge

    // Trigger expansion if we're near an edge and can expand
    // Edge expansion throttled to avoid repeated triggers
    const now = performance.now();
    const lastEdgeRef = (handleMainScrollCore as any)._lastEdgeRef || ((handleMainScrollCore as any)._lastEdgeRef = { t: 0 });
    if (movedHorizontally && now - lastEdgeRef.t > 300) {
      if (movingTowardLeftEdge && nearLeftEdge && canExpandBefore && onNearEdgeScroll) {
        onNearEdgeScroll('before');
        lastEdgeRef.t = now;
      } else if (movingTowardRightEdge && nearRightEdge && canExpandAfter && onNearEdgeScroll) {
        onNearEdgeScroll('after');
        lastEdgeRef.t = now;
      }
    }

    syncScrollPositions(scrollLeft, scrollTop, 'main');
    lastKnownScrollRef.current.left = scrollLeft;
    lastKnownScrollRef.current.top = scrollTop;
    // Update visible window for virtualization
    scheduleVisibleWindowUpdate();
  }, [syncScrollPositions, canExpandBefore, canExpandAfter, onNearEdgeScroll, scheduleVisibleWindowUpdate]);

  const handleDateHeadersScrollCore = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncInProgressRef.current) return;
    const scrollLeft = e.currentTarget.scrollLeft;
    syncScrollPositions(scrollLeft, mainScrollRef.current?.scrollTop || 0, 'dateHeaders');
    lastKnownScrollRef.current.left = scrollLeft;
    updateNavAvailability();
  }, [syncScrollPositions, updateNavAvailability]);

  const handleTechnicianScrollCore = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncInProgressRef.current) return;
    const scrollTop = e.currentTarget.scrollTop;
    syncScrollPositions(mainScrollRef.current?.scrollLeft || 0, scrollTop, 'technician');
    lastKnownScrollRef.current.top = scrollTop;
    // Ensure virtualization window follows when scrolling the technician column
    scheduleVisibleWindowUpdate();
  }, [syncScrollPositions, scheduleVisibleWindowUpdate]);

  // Keep main scroll handler unthrottled for tighter sync between grid and header/technician column
  const handleMainScroll = handleMainScrollCore;

  const handleDateHeadersScroll = useMemo(
    () => throttle(handleDateHeadersScrollCore, 12),
    [handleDateHeadersScrollCore]
  );

  // Keep technician column scroll unthrottled to stay locked with main grid vertically
  const handleTechnicianScroll = handleTechnicianScrollCore;

  useEffect(() => {
    return () => {
      if ((handleMainScroll as any)?.cancel) (handleMainScroll as any).cancel();
      if ((handleDateHeadersScroll as any)?.cancel) handleDateHeadersScroll.cancel();
      if ((handleTechnicianScroll as any)?.cancel) handleTechnicianScroll.cancel();
    };
  }, [handleDateHeadersScroll, handleMainScroll, handleTechnicianScroll]);

  const [availabilityPreferredChannel, setAvailabilityPreferredChannel] = useState<null | 'email' | 'whatsapp'>(null);
  const [offerChannel, setOfferChannel] = useState<'email' | 'whatsapp'>('email');
  const [offerPreferredChannel, setOfferPreferredChannel] = useState<null | 'email' | 'whatsapp'>(null);
  const [availabilityDialog, setAvailabilityDialog] = useState<null | { open: boolean; jobId: string; profileId: string; dateIso: string; singleDay: boolean; channel: 'email' | 'whatsapp' }>(null);

  // Conflict dialog state
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    details: any;
    originalPayload: any;
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

  const handleCellClick = useCallback((technicianId: string, date: Date, action: 'select-job' | 'select-job-for-staffing' | 'assign' | 'unavailable' | 'confirm' | 'decline' | 'offer-details' | 'offer-details-wa' | 'offer-details-email' | 'availability-wa' | 'availability-email', selectedJobId?: string) => {
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

    // Default behavior
    setCellAction({ type: action, technicianId, date, assignment, selectedJobId });
  }, [getAssignmentForCell, allowDirectAssign, fridgeSet, sendStaffingEmail, closeDialogs, toast]);

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

  // Improved auto-scroll to today with retry mechanism (run once)
  const autoScrolledRef = useRef(false);
  const scrollToToday = useCallback(() => {
    if (!mainScrollRef.current || dates.length === 0) {
      return false;
    }

    const today = new Date();
    const todayIndex = dates.findIndex(date => isSameDay(date, today));

    if (todayIndex === -1) {
      return false;
    }

    const container = mainScrollRef.current;
    const containerWidth = container.clientWidth;

    if (containerWidth === 0) {
      return false;
    }

    let scrollPosition = (todayIndex * CELL_WIDTH) - (containerWidth / 2) + (CELL_WIDTH / 2);
    const maxScroll = matrixWidth - containerWidth;
    scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));


    container.scrollLeft = scrollPosition;

    // Verify the scroll actually happened
    requestAnimationFrame(() => { /* verify next frame (no-op) */ });

    return true;
  }, [dates, CELL_WIDTH, matrixWidth]);

  // Auto-scroll to today with retry mechanism (only first render)
  useEffect(() => {
    if (autoScrolledRef.current) return;
    if (isInitialLoading || dates.length === 0) return;

    const attemptScroll = () => {
      const success = scrollToToday();
      if (!success && scrollAttempts < 5) {
        setScrollAttempts(prev => prev + 1);
        setTimeout(attemptScroll, 100 * (scrollAttempts + 1)); // Increasing delay
      } else if (success) {
        setScrollAttempts(0);
        autoScrolledRef.current = true;
      } else {
        // give up
      }
    };

    const timeoutId = setTimeout(attemptScroll, 50);
    return () => clearTimeout(timeoutId);
  }, [scrollToToday, isInitialLoading, dates.length, scrollAttempts]);

  // Initialize visible window after mount and when sizes change
  useEffect(() => {
    updateVisibleWindow();
    hasHandledFirstScrollRef.current = false;
  }, [technicians.length, dates.length, scheduleVisibleWindowUpdate]);

  // Keep scroll position stable when dates expand before/after
  const prevDatesRef = useRef<Date[] | null>(null);
  useEffect(() => {
    const prev = prevDatesRef.current;
    const main = mainScrollRef.current;
    const headers = dateHeadersRef.current;
    const technicianScroller = technicianScrollRef.current;
    if (!main || dates.length === 0) {
      prevDatesRef.current = dates.slice();
      return;
    }

    const lastLeft = lastKnownScrollRef.current.left ?? main.scrollLeft;
    const lastTop = lastKnownScrollRef.current.top ?? main.scrollTop;

    let targetLeft = lastLeft;

    if (prev && prev.length > 0) {
      const prevFirstIso = prev[0].toISOString();
      const nextIndex = dates.findIndex(date => date.toISOString() === prevFirstIso);

      if (nextIndex > 0) {
        targetLeft = lastLeft + nextIndex * CELL_WIDTH;
      } else if (nextIndex === -1) {
        // Range replaced entirely; keep current anchor instead of jumping to start
        targetLeft = lastLeft;
      }
    }

    const applyScroll = (element: HTMLDivElement | null, value: number) => {
      if (!element) return;
      if (Math.abs(element.scrollLeft - value) > 1) {
        element.scrollLeft = value;
      }
    };

    applyScroll(main, targetLeft);
    applyScroll(headers, targetLeft);
    if (technicianScroller && Math.abs(technicianScroller.scrollTop - lastTop) > 1) {
      technicianScroller.scrollTop = lastTop;
    }
    if (Math.abs(main.scrollTop - lastTop) > 1) {
      main.scrollTop = lastTop;
    }

    lastKnownScrollRef.current.left = targetLeft;
    lastKnownScrollRef.current.top = lastTop;

    const previousScrollLeftRef =
      (handleMainScrollCore as any)._previousScrollLeftRef ||
      ((handleMainScrollCore as any)._previousScrollLeftRef = { value: null as number | null });
    previousScrollLeftRef.value = targetLeft;

    prevDatesRef.current = dates.slice();
  }, [dates, CELL_WIDTH]);

  // Determine step (3-4) based on header width
  useEffect(() => {
    if (!mobile) return;
    const updateStep = () => {
      const w = dateHeadersRef.current?.clientWidth || 0;
      const cols = Math.max(3, Math.min(4, Math.floor(w / CELL_WIDTH)) || 3);
      setNavStep(cols);
    };
    updateStep();
    window.addEventListener('resize', updateStep);
    return () => window.removeEventListener('resize', updateStep);
  }, [mobile, CELL_WIDTH]);

  useEffect(() => {
    if (!mobile) return;
    updateNavAvailability();
  }, [mobile, visibleCols, dates.length, updateNavAvailability]);

  const handleMobileNav = useCallback((dir: 'left' | 'right') => {
    const el = dateHeadersRef.current;
    const main = mainScrollRef.current;
    if (!el || !main) return;
    const delta = navStep * CELL_WIDTH * (dir === 'left' ? -1 : 1);
    const target = Math.max(0, Math.min(el.scrollLeft + delta, el.scrollWidth - el.clientWidth));
    el.scrollTo({ left: target, behavior: 'smooth' });
    main.scrollTo({ left: target, top: main.scrollTop, behavior: 'smooth' as ScrollBehavior });
  }, [navStep, CELL_WIDTH]);

  // Batched staffing statuses for visible window
  const orderedTechnicians = useMemo(() => {
    let techs = [...technicians];

    // Job sorting takes precedence over column sorting
    if (sortJobId) {
      const baseOrder = new Map<string, number>();
      technicians.forEach((t, i) => baseOrder.set(t.id, i));
      // Build engagement scores for current sort job
      const scoreMap = new Map<string, number>();
      // Prefer using allAssignments (confirmed assignment) for the job
      (allAssignments as any[])?.forEach((a: any) => {
        if (a.job_id !== sortJobId) return;
        const cur = scoreMap.get(a.technician_id) || 0;
        const status = (a.status || '').toLowerCase();
        const add = status === 'confirmed' ? 3 : (status === 'invited' ? 1 : 0);
        scoreMap.set(a.technician_id, Math.max(cur, add));
      });
      // Use fetched statuses for all technicians to boost scores consistently
      if (sortJobStatuses && sortJobStatuses.size) {
        technicians.forEach(t => {
          const s = sortJobStatuses.get(t.id);
          if (!s) return;
          const cur = scoreMap.get(t.id) || 0;
          let add = 0;
          if (s.offer_status === 'confirmed') add = Math.max(add, 2);
          else if (s.offer_status === 'sent') add = Math.max(add, 1.5);
          if (s.availability_status === 'confirmed') add = Math.max(add, 1.2);
          else if (s.availability_status === 'requested') add = Math.max(add, 1);
          if (add > 0) scoreMap.set(t.id, Math.max(cur, add));
        });
      }
      // Sort by score desc, then original order
      techs.sort((a, b) => {
        const sa = scoreMap.get(a.id) || 0;
        const sb = scoreMap.get(b.id) || 0;
        if (sb !== sa) return sb - sa;
        return (baseOrder.get(a.id)! - baseOrder.get(b.id)!);
      });
      return techs;
    }

    // Apply technician column sorting
    switch (techSortMethod) {
      case 'location':
        techs.sort((a, b) => {
          const resA = techResidencias?.get(a.id) || '';
          const resB = techResidencias?.get(b.id) || '';

          // Sort by residencia, with empty values at the end
          if (resA && !resB) return -1;
          if (!resA && resB) return 1;
          if (!resA && !resB) return a.first_name.localeCompare(b.first_name);

          // Parse city and country (format: "City, Country" or just "City")
          const parseLocation = (loc: string) => {
            const parts = loc.split(',').map(p => p.trim());
            if (parts.length > 1) {
              return { city: parts[0], country: parts[1] };
            }
            return { city: parts[0], country: 'España' }; // Default to Spain
          };

          const locA = parseLocation(resA);
          const locB = parseLocation(resB);

          // First sort by country (Spain first, then alphabetically)
          const isSpainA = locA.country === 'España' || locA.country === 'Spain';
          const isSpainB = locB.country === 'España' || locB.country === 'Spain';

          if (isSpainA && !isSpainB) return -1;
          if (!isSpainA && isSpainB) return 1;
          if (!isSpainA && !isSpainB) {
            const countryCompare = locA.country.localeCompare(locB.country, 'es');
            if (countryCompare !== 0) return countryCompare;
          }

          // Then sort by city within same country
          const cityCompare = locA.city.localeCompare(locB.city, 'es');
          if (cityCompare !== 0) return cityCompare;

          // Finally sort by first name
          return a.first_name.localeCompare(b.first_name);
        });
        break;
      case 'name-asc':
        techs.sort((a, b) => a.first_name.localeCompare(b.first_name));
        break;
      case 'name-desc':
        techs.sort((a, b) => b.first_name.localeCompare(a.first_name));
        break;
      case 'surname-asc':
        techs.sort((a, b) => a.last_name.localeCompare(b.last_name));
        break;
      case 'surname-desc':
        techs.sort((a, b) => b.last_name.localeCompare(a.last_name));
        break;
      case 'default':
      default:
        // House techs first, then sort by confirmed job count (descending)
        techs.sort((a, b) => {
          const aIsHouse = a.role === 'house_tech';
          const bIsHouse = b.role === 'house_tech';
          if (aIsHouse && !bIsHouse) return -1;
          if (!aIsHouse && bIsHouse) return 1;

          // Within regular techs, sort by confirmed job count (descending)
          if (!aIsHouse && !bIsHouse && techConfirmedCounts) {
            const aCount = techConfirmedCounts.get(a.id) || 0;
            const bCount = techConfirmedCounts.get(b.id) || 0;
            if (bCount !== aCount) return bCount - aCount;
          }

          // Maintain original order as tiebreaker
          return 0;
        });
        break;
    }

    return techs;
  }, [technicians, sortJobId, techSortMethod, techResidencias, allAssignments, sortJobStatuses, techConfirmedCounts]);

  // Calculate medal rankings (top 3 non-house techs by confirmed jobs)
  const techMedalRankings = useMemo(() => {
    const rankings = new Map<string, 'gold' | 'silver' | 'bronze'>();

    if (!techConfirmedCounts || techSortMethod !== 'default' || sortJobId) {
      return rankings;
    }

    // Filter out house techs and sort by confirmed count
    const regularTechs = technicians
      .filter(t => t.role !== 'house_tech')
      .map(t => ({ id: t.id, count: techConfirmedCounts.get(t.id) || 0 }))
      .sort((a, b) => b.count - a.count);

    // Assign medals to top 3 (only if they have confirmed jobs)
    if (regularTechs.length > 0 && regularTechs[0].count > 0) {
      rankings.set(regularTechs[0].id, 'gold');
    }
    if (regularTechs.length > 1 && regularTechs[1].count > 0) {
      rankings.set(regularTechs[1].id, 'silver');
    }
    if (regularTechs.length > 2 && regularTechs[2].count > 0) {
      rankings.set(regularTechs[2].id, 'bronze');
    }

    return rankings;
  }, [technicians, techConfirmedCounts, techSortMethod, sortJobId]);

  const visibleTechIds = useMemo(() => {
    const start = Math.max(0, visibleRows.start - 10);
    const end = Math.min(orderedTechnicians.length - 1, visibleRows.end + 10);
    return orderedTechnicians.slice(start, end + 1).map(t => t.id);
  }, [orderedTechnicians, visibleRows.start, visibleRows.end]);
  // Fetch staffing statuses for ALL currently loaded dates and jobs for the visible technicians
  // This avoids re-fetching when scrolling horizontally, making badges render immediately.
  const allJobsLite = useMemo(() => jobs.map(j => ({ id: j.id, start_time: j.start_time, end_time: j.end_time })), [jobs]);
  const { data: staffingMaps } = useStaffingMatrixStatuses(visibleTechIds, allJobsLite, dates);

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
  const handleEmailError = (error: any, payload: any) => {
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
        description: error.message || 'No se pudo enviar la solicitud de staffing',
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

  // Cycle through technician sorting methods
  const cycleTechSort = useCallback(() => {
    const methods: TechSortMethod[] = ['default', 'location', 'name-asc', 'name-desc', 'surname-asc', 'surname-desc'];
    const currentIndex = methods.indexOf(techSortMethod);
    const nextIndex = (currentIndex + 1) % methods.length;
    setTechSortMethod(methods[nextIndex]);
    // Clear job sorting when changing tech sorting
    if (sortJobId) {
      setSortJobId(null);
    }
  }, [techSortMethod, sortJobId]);

  // Get label for current sorting method
  const getSortLabel = useCallback(() => {
    switch (techSortMethod) {
      case 'location': return mobile ? '📍 Ubic.' : '📍 Ubicación';
      case 'name-asc': return mobile ? 'A→Z' : 'A→Z Nombre';
      case 'name-desc': return mobile ? 'Z→A' : 'Z→A Nombre';
      case 'surname-asc': return mobile ? 'A→Z Ape.' : 'A→Z Apellido';
      case 'surname-desc': return mobile ? 'Z→A Ape.' : 'Z→A Apellido';
      case 'default': return '';
      default: return '';
    }
  }, [techSortMethod, mobile]);

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
    dateHeadersRef, technicianScrollRef, mainScrollRef, visibleCols, visibleRows,
    dates, technicians, orderedTechnicians,
    fridgeSet, allowDirectAssign, mobile, canNavLeft, canNavRight, handleMobileNav,
    handleDateHeadersScroll, handleTechnicianScroll, handleMainScroll, cycleTechSort, getSortLabel,
    isManagementUser, setCreateUserOpen, createUserOpen, qc, setSortJobId,
    getJobsForDate, getAssignmentForCell, getAvailabilityForCell, selectedCells, staffingMaps,
    handleCellSelect, handleCellClick, handleCellPrefetch, handleOptimisticUpdate, incrementCellRender,
    declinedJobsByTech, cellAction, currentTechnician, closeDialogs,
    handleJobSelected, handleStaffingActionSelected, forcedStaffingAction, forcedStaffingChannel,
    jobs, offerChannel, toast, sendStaffingEmail, checkTimeConflictEnhanced,
    availabilityDialog, setAvailabilityDialog, availabilityCoverage, setAvailabilityCoverage,
    availabilitySingleDate, setAvailabilitySingleDate, availabilityMultiDates, setAvailabilityMultiDates,
    availabilitySending, setAvailabilitySending, handleEmailError, conflictDialog, setConflictDialog,
    isGlobalCellSelected, techMedalRankings,
  };

  return <OptimizedAssignmentMatrixView {...viewProps} />;
};
