
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { TechnicianRow } from './TechnicianRow';
import { OptimizedMatrixCell } from './OptimizedMatrixCell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DateHeader } from './DateHeader';
import { SelectJobDialog } from './SelectJobDialog';
import { StaffingJobSelectionDialog } from './StaffingJobSelectionDialog';
import { AssignJobDialog } from './AssignJobDialog';
import { AssignmentStatusDialog } from './AssignmentStatusDialog';
import { MarkUnavailableDialog } from './MarkUnavailableDialog';
import { useOptimizedMatrixData } from '@/hooks/useOptimizedMatrixData';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { useStaffingRealtime } from '@/features/staffing/hooks/useStaffingRealtime';
import { useSendStaffingEmail } from '@/features/staffing/hooks/useStaffing';
import { useToast } from '@/hooks/use-toast';
import { OfferDetailsDialog } from './OfferDetailsDialog';
import { supabase } from '@/lib/supabase';
import { checkTimeConflict } from '@/utils/technicianAvailability';
import { useStaffingMatrixStatuses } from '@/features/staffing/hooks/useStaffingMatrixStatuses';
import { Button } from '@/components/ui/button';
import { UserPlus, Calendar as CalendarIcon } from 'lucide-react';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';

// Define the specific job type that matches what's passed from JobAssignmentMatrix
interface MatrixJob {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
  status: string;
  job_type: string;
}

interface OptimizedAssignmentMatrixProps {
  technicians: Array<{
    id: string;
    first_name: string;
    nickname?: string | null;
    last_name: string;
    email: string;
    phone?: string | null;
    dni?: string | null;
    department: string;
    role: string;
    skills?: Array<{ name?: string; category?: string | null; proficiency?: number | null; is_primary?: boolean | null }>;
  }>;
  dates: Date[];
  jobs: MatrixJob[];
}

interface CellAction {
  type: 'select-job' | 'select-job-for-staffing' | 'assign' | 'unavailable' | 'confirm' | 'decline' | 'offer-details' | 'offer-details-wa' | 'offer-details-email' | 'availability-wa' | 'availability-email';
  technicianId: string;
  date: Date;
  assignment?: any;
  selectedJobId?: string;
  singleDay?: boolean;
  intendedPhase?: 'availability' | 'offer';
  intendedChannel?: 'email' | 'whatsapp';
}

interface OptimizedAssignmentMatrixExtendedProps extends OptimizedAssignmentMatrixProps {
  onNearEdgeScroll?: (direction: 'before' | 'after') => void;
  canExpandBefore?: boolean;
  canExpandAfter?: boolean;
  allowDirectAssign?: boolean;
  fridgeSet?: Set<string>;
  cellWidth?: number;
  cellHeight?: number;
  technicianWidth?: number;
  headerHeight?: number;
  mobile?: boolean;
}

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
  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const technicianScrollRef = useRef<HTMLDivElement>(null);
  const dateHeadersRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollAttempts, setScrollAttempts] = useState(0);
  const syncInProgressRef = useRef(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const { userRole } = useOptimizedAuth();
  const isManagementUser = ['admin', 'management'].includes(userRole || '');
  const qc = useQueryClient();
  // Sorting focus by job
  const [sortJobId, setSortJobId] = useState<string | null>(null);
  
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
    isLoading
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
  }, []);

  // Calculate matrix dimensions
  const matrixWidth = dates.length * CELL_WIDTH;
  const matrixHeight = technicians.length * CELL_HEIGHT;

  // Visible window state for virtualization
  const [visibleRows, setVisibleRows] = useState({ start: 0, end: Math.min(technicians.length - 1, 20) });
  const [visibleCols, setVisibleCols] = useState({ start: 0, end: Math.min(dates.length - 1, 14) });
  const OVERSCAN_ROWS = 2;
  const OVERSCAN_COLS = 2;

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

  // Throttle visible window updates with rAF
  const updateScheduledRef = useRef(false);
  const scheduleVisibleWindowUpdate = useCallback(() => {
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

  const handleMainScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncInProgressRef.current) return;
    const scrollLeft = e.currentTarget.scrollLeft;
    const scrollTop = e.currentTarget.scrollTop;
    
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
    const lastEdgeRef = (handleMainScroll as any)._lastEdgeRef || ((handleMainScroll as any)._lastEdgeRef = { t: 0 });
    if (now - lastEdgeRef.t > 300) {
      if (nearLeftEdge && canExpandBefore && onNearEdgeScroll) {
        onNearEdgeScroll('before');
        lastEdgeRef.t = now;
      } else if (nearRightEdge && canExpandAfter && onNearEdgeScroll) {
        onNearEdgeScroll('after');
        lastEdgeRef.t = now;
      }
    }
    
    syncScrollPositions(scrollLeft, scrollTop, 'main');
    // Update visible window for virtualization
    scheduleVisibleWindowUpdate();
  }, [syncScrollPositions, canExpandBefore, canExpandAfter, onNearEdgeScroll, scheduleVisibleWindowUpdate]);

  const handleDateHeadersScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncInProgressRef.current) return;
    const scrollLeft = e.currentTarget.scrollLeft;
    syncScrollPositions(scrollLeft, mainScrollRef.current?.scrollTop || 0, 'dateHeaders');
    updateNavAvailability();
  }, [syncScrollPositions]);

  const handleTechnicianScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncInProgressRef.current) return;
    const scrollTop = e.currentTarget.scrollTop;
    syncScrollPositions(mainScrollRef.current?.scrollLeft || 0, scrollTop, 'technician');
  }, [syncScrollPositions]);

  const [availabilityPreferredChannel, setAvailabilityPreferredChannel] = useState<null | 'email' | 'whatsapp'>(null);
  const [offerChannel, setOfferChannel] = useState<'email' | 'whatsapp'>('email');
  const [offerPreferredChannel, setOfferPreferredChannel] = useState<null | 'email' | 'whatsapp'>(null);
  const [availabilityDialog, setAvailabilityDialog] = useState<null | { open: boolean; jobId: string; profileId: string; dateIso: string; singleDay: boolean }>(null);

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
        setAvailabilityDialog({ open: true, jobId: targetJobId, profileId: technicianId, dateIso: format(date, 'yyyy-MM-dd'), singleDay: true });
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
        setAvailabilityDialog({ open: true, jobId: targetJobId, profileId: technicianId, dateIso: format(date, 'yyyy-MM-dd'), singleDay: true });
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
    } else {
      newSelected.delete(cellKey);
    }
    
    setSelectedCells(newSelected);
  }, [selectedCells]);

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
        toast({ title: 'Job already declined', description: 'Choose another job for this technician on this date.', variant: 'destructive' });
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
        const conflict = await checkTimeConflict(technicianId, jobId, format(cellAction.date, 'yyyy-MM-dd'), !!options?.singleDay);
        if (conflict) {
          toast({
            title: 'Conflicto de horarios',
            description: `Ya tiene confirmado: ${conflict.title} (${new Date(conflict.start_time).toLocaleString()} - ${new Date(conflict.end_time).toLocaleString()})`,
            variant: 'destructive'
          });
          return;
        }

        const intentPhase = cellAction.intendedPhase;
        const intentChannel = cellAction.intendedChannel;
        const openAvailabilityDialogWith = (channel: 'email' | 'whatsapp') => {
          setAvailabilityChannel(channel);
          setAvailabilityDialog({ open: true, jobId, profileId: technicianId, dateIso: format(cellAction.date, 'yyyy-MM-dd'), singleDay: !!options?.singleDay });
        };

        if (intentPhase === 'availability' && intentChannel) {
          console.log('Using stored staffing intent', { intentPhase, intentChannel });
          openAvailabilityDialogWith(intentChannel);
          return;
        }

        console.log('Checking availabilityPreferredChannel:', availabilityPreferredChannel);
        if (availabilityPreferredChannel === 'whatsapp' || availabilityPreferredChannel === 'email') {
          openAvailabilityDialogWith(availabilityPreferredChannel);
        } else {
          // Store date as yyyy-MM-dd for consistency and open dialog (channel selectable inside)
          setAvailabilityDialog({ open: true, jobId, profileId: technicianId, dateIso: format(cellAction.date, 'yyyy-MM-dd'), singleDay: !!options?.singleDay });
        }
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
    if (isLoading || dates.length === 0) return;

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
  }, [scrollToToday, isLoading, dates.length, scrollAttempts]);

  // Initialize visible window after mount and when sizes change
  useEffect(() => {
    updateVisibleWindow();
  }, [technicians.length, dates.length, scheduleVisibleWindowUpdate]);

  // Keep scroll position stable when dates expand before/after
  const prevDatesRef = useRef<Date[] | null>(null);
  useEffect(() => {
    const prev = prevDatesRef.current;
    if (!prev || prev.length === 0 || dates.length === 0) {
      prevDatesRef.current = dates.slice();
      return;
    }
    const prevFirst = prev[0];
    const prevLast = prev[prev.length - 1];
    const nextFirst = dates[0];
    const nextLast = dates[dates.length - 1];

    // If new range extends earlier than before, adjust scrollLeft to compensate added columns on the left
    if (nextFirst < prevFirst) {
      const daysAddedLeft = Math.round((prevFirst.getTime() - nextFirst.getTime()) / (1000 * 60 * 60 * 24));
      const delta = daysAddedLeft * CELL_WIDTH;
      if (delta > 0) {
        if (dateHeadersRef.current) dateHeadersRef.current.scrollLeft += delta;
        if (mainScrollRef.current) mainScrollRef.current.scrollLeft += delta;
      }
    }
    // If only extended to the right, no adjustment needed.
    prevDatesRef.current = dates.slice();
  }, [dates]);

  // Mobile date navigation state
  const [canNavLeft, setCanNavLeft] = useState(false);
  const [canNavRight, setCanNavRight] = useState(true);
  const [navStep, setNavStep] = useState(3);

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

  const updateNavAvailability = useCallback(() => {
    if (!mobile) return;
    const el = dateHeadersRef.current;
    if (!el) return;
    const sl = el.scrollLeft;
    const max = el.scrollWidth - el.clientWidth - 1;
    setCanNavLeft(sl > 2);
    setCanNavRight(sl < max);
  }, [mobile]);

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
    if (!sortJobId) return technicians;
    const baseOrder = new Map<string, number>();
    technicians.forEach((t, i) => baseOrder.set(t.id, i));
    // Build engagement scores for current sort job
    // Pull data via queries in a synchronous manner using cache, or compute fallbacks
    // We'll compute from cached assignment/query sources where possible
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
    // Note: sorting relies on confirmed assignments and aggregated job statuses for the selected job.
    // Sort by score desc, then original order
    const arr = [...technicians];
    arr.sort((a, b) => {
      const sa = scoreMap.get(a.id) || 0;
      const sb = scoreMap.get(b.id) || 0;
      if (sb !== sa) return sb - sa;
      return (baseOrder.get(a.id)! - baseOrder.get(b.id)!);
    });
    return arr;
  }, [technicians, sortJobId, allAssignments, sortJobStatuses]);

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

  useEffect(() => {
    if (availabilityDialog?.open) {
      setAvailabilityCoverage(availabilityDialog.singleDay ? 'single' : 'full');
      try {
        setAvailabilitySingleDate(availabilityDialog.dateIso ? new Date(`${availabilityDialog.dateIso}T00:00:00`) : null);
        setAvailabilityMultiDates(availabilityDialog.dateIso ? [new Date(`${availabilityDialog.dateIso}T00:00:00`)] : []);
      } catch { /* ignore */ }
    }
  }, [availabilityDialog?.open]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Loading assignment matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="matrix-layout">
      {/* Fixed Corner Header */}
      <div 
        className="matrix-corner"
        style={{ 
          width: TECHNICIAN_WIDTH, 
          height: HEADER_HEIGHT 
        }}
      >
        <div className="flex items-center justify-between h-full bg-card border-r border-b px-2">
          {mobile ? (
            <div className="font-semibold text-sm" aria-label="Technicians">Techs</div>
          ) : (
            <div className="font-semibold" aria-label="Technicians">Technicians</div>
          )}
          {isManagementUser && (
            mobile ? (
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setCreateUserOpen(true)} aria-label="Add user">
                <UserPlus className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-8" onClick={() => setCreateUserOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> Add
              </Button>
            )
          )}
        </div>
      </div>

      {/* Date Headers */}
      <div 
        ref={dateHeadersRef}
        className="matrix-date-headers"
        style={{ 
          left: TECHNICIAN_WIDTH,
          height: HEADER_HEIGHT,
          width: `calc(100% - ${TECHNICIAN_WIDTH}px)`
        }}
        onScroll={handleDateHeadersScroll}
      >
        {mobile && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-1">
            <button
              aria-label="Previous dates"
              className={`pointer-events-auto rounded-full bg-background/80 border shadow h-8 w-8 flex items-center justify-center ${canNavLeft ? 'opacity-100' : 'opacity-40'}`}
              onClick={(e) => { e.stopPropagation(); handleMobileNav('left'); }}
              disabled={!canNavLeft}
            >
              <span className="sr-only">Previous</span>
              {'<'}
            </button>
            <button
              aria-label="Next dates"
              className={`pointer-events-auto rounded-full bg-background/80 border shadow h-8 w-8 flex items-center justify-center ${canNavRight ? 'opacity-100' : 'opacity-40'}`}
              onClick={(e) => { e.stopPropagation(); handleMobileNav('right'); }}
              disabled={!canNavRight}
            >
              <span className="sr-only">Next</span>
              {'>'}
            </button>
          </div>
        )}
        <div style={{ width: matrixWidth, height: '100%', display: 'flex', position: 'relative' }}>
          {/* Leading spacer for virtualized columns */}
          <div style={{ width: visibleCols.start * CELL_WIDTH }} />
          {dates.slice(visibleCols.start, visibleCols.end + 1).map((date, idx) => (
            <DateHeader
              key={visibleCols.start + idx}
              date={date}
              width={CELL_WIDTH}
              jobs={getJobsForDate(date)}
              technicianIds={technicians.map(t => t.id)}
              onJobClick={(jobId) => {
                setSortJobId(prev => (prev === jobId ? null : jobId));
              }}
            />
          ))}
          {/* Trailing spacer to fill remaining width */}
          <div style={{ width: Math.max(0, (dates.length - (visibleCols.end + 1)) * CELL_WIDTH) }} />
        </div>
      </div>

      {/* Fixed Technician Names Column */}
      <div 
        className="matrix-technician-column"
        style={{ 
          width: TECHNICIAN_WIDTH, 
          top: HEADER_HEIGHT,
          height: `calc(100% - ${HEADER_HEIGHT}px)`
        }}
      >
        <div 
          ref={technicianScrollRef} 
          className="matrix-technician-scroll"
          onScroll={handleTechnicianScroll}
        >
          <div style={{ height: matrixHeight, position: 'relative' }}>
            {/* Leading spacer for virtualized rows */}
            <div style={{ height: visibleRows.start * CELL_HEIGHT }} />
            {orderedTechnicians.slice(visibleRows.start, visibleRows.end + 1).map((technician) => (
              <TechnicianRow
                key={technician.id}
                technician={technician}
                height={CELL_HEIGHT}
                isFridge={fridgeSet?.has(technician.id) || false}
                // @ts-ignore – optional prop for compact rendering
                compact={mobile}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Scrollable Matrix Area */}
      <div 
        className="matrix-main-area"
        style={{ 
          left: TECHNICIAN_WIDTH, 
          top: HEADER_HEIGHT,
          width: `calc(100% - ${TECHNICIAN_WIDTH}px)`,
          height: `calc(100% - ${HEADER_HEIGHT}px)`
        }}
      >
        <TooltipProvider>
        <div 
          ref={mainScrollRef}
          className="matrix-main-scroll"
          onScroll={handleMainScroll}
        >
          <div 
            className="matrix-grid"
            style={{ 
              width: matrixWidth,
              height: matrixHeight
            }}
          >
            {orderedTechnicians.slice(visibleRows.start, visibleRows.end + 1).map((technician, idx) => {
              const techIndex = visibleRows.start + idx;
              return (
              <div 
                key={technician.id} 
                className="matrix-row"
                style={{ 
                  transform: `translate3d(0, ${techIndex * CELL_HEIGHT}px, 0)`,
                  height: CELL_HEIGHT
                }}
              >
                {dates.slice(visibleCols.start, visibleCols.end + 1).map((date, jdx) => {
                  const dateIndex = visibleCols.start + jdx;
                  const assignment = getAssignmentForCell(technician.id, date);
                  const availability = getAvailabilityForCell(technician.id, date);
                  const cellKey = `${technician.id}-${format(date, 'yyyy-MM-dd')}`;
                  const isSelected = selectedCells.has(cellKey);
                  const jobId = assignment?.job_id;
                  const byJobKey = jobId ? `${jobId}-${technician.id}` : '';
                  const byDateKey = `${technician.id}-${format(date, 'yyyy-MM-dd')}`;
                  const providedByJob = jobId && staffingMaps?.byJob.get(byJobKey) ? (staffingMaps?.byJob.get(byJobKey) as any) : null;
                  const providedByDate = staffingMaps?.byDate.get(byDateKey) ? (staffingMaps?.byDate.get(byDateKey) as any) : null;
                  
                  return (
                    <div
                      key={dateIndex}
                      className="matrix-cell-wrapper"
                      style={{
                        transform: `translate3d(${dateIndex * CELL_WIDTH}px, 0, 0)`,
                        width: CELL_WIDTH,
                        height: CELL_HEIGHT
                      }}
                    >
                      <OptimizedMatrixCell
                        technician={technician}
                        date={date}
                        assignment={assignment}
                        availability={availability}
                        width={CELL_WIDTH}
                        height={CELL_HEIGHT}
                        isSelected={isSelected}
                        onSelect={(selected) => handleCellSelect(technician.id, date, selected)}
                        onClick={(action, selectedJobId) => handleCellClick(technician.id, date, action, selectedJobId)}
                        onPrefetch={() => handleCellPrefetch(technician.id)}
                        onOptimisticUpdate={(status) => assignment && handleOptimisticUpdate(technician.id, assignment.job_id, status)}
                        onRender={() => incrementCellRender()}
                        jobId={jobId}
                        declinedJobIdsSet={declinedJobsByTech.get(technician.id) || new Set<string>()}
                        allowDirectAssign={allowDirectAssign}
                        staffingStatusProvided={providedByJob}
                        staffingStatusByDateProvided={providedByDate}
                        isFridge={fridgeSet?.has(technician.id) || false}
                        mobile={mobile}
                      />
                    </div>
                  );
                })}
              </div>
            )})}
          </div>
        </div>
        </TooltipProvider>
      </div>

      {/* Dialogs */}
      {cellAction?.type === 'select-job' && currentTechnician && (
        <SelectJobDialog
          open={true}
          onClose={closeDialogs}
          onJobSelected={handleJobSelected}
          technicianName={`${currentTechnician.first_name} ${currentTechnician.last_name}`}
          date={cellAction.date}
          availableJobs={getJobsForDate(cellAction.date)}
        />
      )}

      {cellAction?.type === 'select-job-for-staffing' && currentTechnician && (
        <StaffingJobSelectionDialog
          open={true}
          onClose={closeDialogs}
          onStaffingActionSelected={handleStaffingActionSelected}
          technicianId={cellAction.technicianId}
          technicianName={`${currentTechnician.first_name} ${currentTechnician.last_name}`}
          date={cellAction.date}
          availableJobs={getJobsForDate(cellAction.date)}
          declinedJobIds={Array.from(declinedJobsByTech.get(cellAction.technicianId) || [])}
          preselectedJobId={cellAction.selectedJobId || null}
          forcedAction={forcedStaffingAction}
          forcedChannel={forcedStaffingChannel}
        />
      )}

      {cellAction?.type === 'assign' && (
        <AssignJobDialog
          open={true}
          onClose={closeDialogs}
          technicianId={cellAction.technicianId}
          date={cellAction.date}
          availableJobs={getJobsForDate(cellAction.date)}
          existingAssignment={cellAction.assignment}
          preSelectedJobId={cellAction.selectedJobId}
        />
      )}

      {(cellAction?.type === 'confirm' || cellAction?.type === 'decline') && (
        <AssignmentStatusDialog
          open={true}
          onClose={closeDialogs}
          technicianId={cellAction.technicianId}
          date={cellAction.date}
          assignment={cellAction.assignment}
          action={cellAction.type}
        />
      )}

      {cellAction?.type === 'offer-details' && currentTechnician && (
        <OfferDetailsDialog
          open={true}
          onClose={closeDialogs}
          technicianName={`${currentTechnician.first_name} ${currentTechnician.last_name}`}
          jobTitle={jobs.find(j => j.id === cellAction.selectedJobId)?.title}
          technicianDepartment={currentTechnician.department}
          defaultSingleDay={cellAction.singleDay}
          jobStartTimeIso={jobs.find(j => j.id === cellAction.selectedJobId)?.start_time}
          jobEndTimeIso={jobs.find(j => j.id === cellAction.selectedJobId)?.end_time}
          defaultDateIso={format(cellAction.date, 'yyyy-MM-dd')}
          onSubmit={({ role, message, singleDay, dates }) => {
            if (!cellAction.selectedJobId) return;
            (async () => {
              const jobId = cellAction.selectedJobId!;
              const profileId = currentTechnician.id;
              const via = offerChannel;
              if (singleDay) {
                const selectedDates = Array.isArray(dates) && dates.length ? dates : [format(cellAction.date, 'yyyy-MM-dd')];
                for (const d of selectedDates) {
                  const conflict = await checkTimeConflict(profileId, jobId, d, true);
                  if (conflict) {
                    toast({ title: 'Conflicto de horarios', description: `(${d}) Ya tiene confirmado: ${conflict.title}`, variant: 'destructive' });
                    return;
                  }
                }
                const targetDate = selectedDates[0];
                sendStaffingEmail(({ job_id: jobId, profile_id: profileId, phase: 'offer', role, message, channel: via, single_day: true, dates: selectedDates, target_date: targetDate } as any), {
                  onSuccess: (data: any) => {
                    const ch = data?.channel || via;
                    toast({ title: 'Offer sent', description: `${role} offer sent via ${ch} (${selectedDates.length} day${selectedDates.length>1?'s':''}).` });
                    closeDialogs();
                  },
                  onError: (error: any) => {
                    toast({ title: 'Failed to send offer', description: error.message, variant: 'destructive' });
                  }
                });
                return;
              }
              // Full span
              const conflict = await checkTimeConflict(profileId, jobId);
              if (conflict) {
                toast({ title: 'Conflicto de horarios', description: `Ya tiene confirmado: ${conflict.title}`, variant: 'destructive' });
                return;
              }
              sendStaffingEmail(({ job_id: jobId, profile_id: profileId, phase: 'offer', role, message, channel: via, single_day: false } as any), {
                onSuccess: (data: any) => {
                  const ch = data?.channel || via;
                  toast({ title: 'Offer sent', description: `${role} offer sent via ${ch}.` });
                  closeDialogs();
                },
                onError: (error: any) => {
                  toast({ title: 'Failed to send offer', description: error.message, variant: 'destructive' });
                }
              });
            })();
          }}
        />
      )}

      {availabilityDialog?.open && (
        <Dialog open={true} onOpenChange={(v) => { if (!v) setAvailabilityDialog(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send availability request</DialogTitle>
              <DialogDescription>
                Choose how to contact {currentTechnician?.first_name} {currentTechnician?.last_name}.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <div className="space-y-3">
                <label className="font-medium text-sm text-foreground">Channel</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="availability-channel"
                      checked={availabilityChannel === 'email'}
                      onChange={() => setAvailabilityChannel('email')}
                    />
                    <span>Email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="availability-channel"
                      checked={availabilityChannel === 'whatsapp'}
                      onChange={() => setAvailabilityChannel('whatsapp')}
                    />
                    <span>WhatsApp</span>
                  </label>
                </div>
              </div>
              {/* Coverage selection */}
              <div className="space-y-3 mt-4">
                <label className="font-medium text-sm text-foreground">Coverage</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="availability-coverage"
                      checked={availabilityCoverage === 'full'}
                      onChange={() => setAvailabilityCoverage('full')}
                    />
                    <span>Full job span</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="availability-coverage"
                      checked={availabilityCoverage === 'single'}
                      onChange={() => setAvailabilityCoverage('single')}
                    />
                    <span>Single day</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="availability-coverage"
                      checked={availabilityCoverage === 'multi'}
                      onChange={() => setAvailabilityCoverage('multi')}
                    />
                    <span>Multiple days</span>
                  </label>
                </div>
                {(() => {
                  const job = jobs.find(j => j.id === availabilityDialog.jobId);
                  const start = job?.start_time ? new Date(job.start_time) : undefined;
                  const end = job?.end_time ? new Date(job.end_time) : start;
                  if (start) start.setHours(0,0,0,0);
                  if (end) end.setHours(0,0,0,0);
                  const isAllowed = (d: Date) => {
                    if (!start || !end) return true;
                    const t = new Date(d); t.setHours(0,0,0,0);
                    return t >= start && t <= end;
                  };
                  return (
                    <>
                      {availabilityCoverage === 'single' && (
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="gap-2">
                                <CalendarIcon className="h-4 w-4" />
                                {availabilitySingleDate ? format(availabilitySingleDate, 'PPP') : availabilityDialog.dateIso}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarPicker
                                mode="single"
                                selected={availabilitySingleDate ?? undefined}
                                onSelect={(d) => { if (d && isAllowed(d)) setAvailabilitySingleDate(d); }}
                                disabled={(d) => !isAllowed(d)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <p className="text-xs text-muted-foreground">Send for the selected date only.</p>
                        </div>
                      )}
                      {availabilityCoverage === 'multi' && (
                        <div className="space-y-2">
                          <CalendarPicker
                            mode="multiple"
                            selected={availabilityMultiDates}
                            onSelect={(ds) => setAvailabilityMultiDates((ds || []).filter(d => isAllowed(d)))}
                            disabled={(d) => !isAllowed(d)}
                            numberOfMonths={2}
                          />
                          <p className="text-xs text-muted-foreground">Creates one single-day request per selected date.</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAvailabilityDialog(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!availabilityDialog) return;
                  setAvailabilitySending(true);
                  const jobId = availabilityDialog.jobId;
                  const profileId = availabilityDialog.profileId;
                  const via = availabilityChannel;
                  if (availabilityCoverage === 'full') {
                    sendStaffingEmail(({ job_id: jobId, profile_id: profileId, phase: 'availability', channel: via, single_day: false } as any), {
                      onSuccess: (data: any) => {
                        setAvailabilitySending(false);
                        setAvailabilityDialog(null);
                        toast({ title: 'Request sent', description: `Availability request sent via ${data?.channel || via}.` });
                        closeDialogs();
                      },
                      onError: (error: any) => {
                        setAvailabilitySending(false);
                        toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
                      }
                    });
                    return;
                  }
                  const dates = availabilityCoverage === 'single'
                    ? (availabilitySingleDate ? [format(availabilitySingleDate, 'yyyy-MM-dd')] : [availabilityDialog.dateIso])
                    : Array.from(new Set((availabilityMultiDates || []).map(d => format(d, 'yyyy-MM-dd'))));
                  if (dates.length === 0) {
                    setAvailabilitySending(false);
                    toast({ title: 'Select date(s)', description: 'Choose at least one date within the job span.', variant: 'destructive' });
                    return;
                  }
                  const targetDate = dates[0];
                  sendStaffingEmail(({ job_id: jobId, profile_id: profileId, phase: 'availability', channel: via, single_day: true, dates, target_date: targetDate } as any), {
                    onSuccess: (data: any) => {
                      setAvailabilitySending(false);
                      setAvailabilityDialog(null);
                      toast({ title: 'Request sent', description: `Availability request sent for ${dates.length} day${dates.length>1?'s':''} via ${data?.channel || via}.` });
                      closeDialogs();
                    },
                    onError: (error: any) => {
                      setAvailabilitySending(false);
                      toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
                    }
                  });
                }}
                disabled={availabilitySending}
              >
                {availabilitySending ? 'Sending…' : 'Send'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {cellAction?.type === 'unavailable' && (
        <MarkUnavailableDialog
          open={true}
          onClose={closeDialogs}
          technicianId={cellAction.technicianId}
          selectedDate={cellAction.date}
          selectedCells={Array.from(selectedCells)}
        />
      )}

      {isManagementUser && (
        <CreateUserDialog
          open={createUserOpen}
          onOpenChange={(open) => {
            if (!open) {
              qc.invalidateQueries({ queryKey: ['optimized-matrix-technicians'] });
            }
            setCreateUserOpen(open);
          }}
        />
      )}
    </div>
  );
};

