
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
import { useStaffingMatrixStatuses } from '@/features/staffing/hooks/useStaffingMatrixStatuses';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useQueryClient } from '@tanstack/react-query';

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
  type: 'select-job' | 'select-job-for-staffing' | 'assign' | 'unavailable' | 'confirm' | 'decline' | 'offer-details';
  technicianId: string;
  date: Date;
  assignment?: any;
  selectedJobId?: string;
  singleDay?: boolean;
}

interface OptimizedAssignmentMatrixExtendedProps extends OptimizedAssignmentMatrixProps {
  onNearEdgeScroll?: (direction: 'before' | 'after') => void;
  canExpandBefore?: boolean;
  canExpandAfter?: boolean;
  allowDirectAssign?: boolean;
}

export const OptimizedAssignmentMatrix = ({ 
  technicians, 
  dates, 
  jobs, 
  onNearEdgeScroll,
  canExpandBefore = false,
  canExpandAfter = false,
  allowDirectAssign = false
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
  
  // Performance monitoring
  const { startRenderTimer, endRenderTimer, incrementCellRender } = usePerformanceMonitor('AssignmentMatrix');
  
  // Staffing functionality
  useStaffingRealtime();
  const { toast } = useToast();
  const { mutate: sendStaffingEmail } = useSendStaffingEmail();
  
  // Cell dimensions
  const CELL_WIDTH = 160;
  const CELL_HEIGHT = 60;
  const TECHNICIAN_WIDTH = 256;
  const HEADER_HEIGHT = 80;

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

  // Listen for assignment updates and refresh data
  useEffect(() => {
    const handleAssignmentUpdate = () => {
      invalidateAssignmentQueries();
    };

    window.addEventListener('assignment-updated', handleAssignmentUpdate);
    return () => window.removeEventListener('assignment-updated', handleAssignmentUpdate);
  }, [invalidateAssignmentQueries]);

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
  }, [syncScrollPositions]);

  const handleTechnicianScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (syncInProgressRef.current) return;
    const scrollTop = e.currentTarget.scrollTop;
    syncScrollPositions(mainScrollRef.current?.scrollLeft || 0, scrollTop, 'technician');
  }, [syncScrollPositions]);

  const handleCellClick = useCallback((technicianId: string, date: Date, action: 'select-job' | 'select-job-for-staffing' | 'assign' | 'unavailable' | 'confirm' | 'decline' | 'offer-details', selectedJobId?: string) => {
    console.log('Matrix handling cell click:', { technicianId, date: format(date, 'yyyy-MM-dd'), action });
    const assignment = getAssignmentForCell(technicianId, date);
    console.log('Assignment data:', assignment);
    // Gate direct assign-related actions behind allowDirectAssign
    if (!allowDirectAssign && (action === 'select-job' || action === 'assign')) {
      console.log('Direct assign disabled by UI toggle; ignoring click');
      return;
    }
    setCellAction({ type: action, technicianId, date, assignment, selectedJobId });
  }, [getAssignmentForCell, allowDirectAssign]);

  const handleJobSelected = useCallback((jobId: string) => {
    if (cellAction?.type === 'select-job') {
      setCellAction({
        ...cellAction,
        type: 'assign',
        selectedJobId: jobId
      });
    }
  }, [cellAction]);

  const closeDialogs = useCallback(() => {
    setCellAction(null);
    setSelectedCells(new Set());
    // Invalidate queries when closing dialogs to refresh data
    invalidateAssignmentQueries();
  }, [invalidateAssignmentQueries]);

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
        // Open offer details dialog; do not send immediately
        setCellAction({ ...cellAction, type: 'offer-details', selectedJobId: jobId, singleDay: options?.singleDay });
        return;
      }
      // Availability: pre-check conflicts, then send
      (async () => {
        const conflict = await checkTimeConflict(cellAction.technicianId, jobId);
        if (conflict) {
          toast({
            title: 'Conflicto de horarios',
            description: `Ya tiene confirmado: ${conflict.title} (${new Date(conflict.start_time).toLocaleString()} - ${new Date(conflict.end_time).toLocaleString()})`,
            variant: 'destructive'
          });
          return;
        }
        sendStaffingEmail(
          ({ job_id: jobId, profile_id: cellAction.technicianId, phase: action, target_date: cellAction.date.toISOString(), single_day: !!options?.singleDay } as any),
          {
            onSuccess: (_data) => {
              toast({ title: "Email sent!", description: `Availability request sent successfully.` });
              closeDialogs();
            },
            onError: (error) => {
              toast({ title: "Email failed", description: `Failed to send availability email: ${error.message}`, variant: "destructive" });
              closeDialogs();
            }
          }
        );
      })();
    } else {
      // no-op
    }
  }, [cellAction, sendStaffingEmail, toast, closeDialogs]);

  const handleCellPrefetch = useCallback((technicianId: string) => {
    prefetchTechnicianData(technicianId);
  }, [prefetchTechnicianData]);

  const handleOptimisticUpdate = useCallback((technicianId: string, jobId: string, status: string) => {
    updateAssignmentOptimistically(technicianId, jobId, status);
  }, [updateAssignmentOptimistically]);

  // Improved auto-scroll to today with retry mechanism
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

  // Auto-scroll to today with retry mechanism
  useEffect(() => {
    if (isLoading || dates.length === 0) return;

    const attemptScroll = () => {
      const success = scrollToToday();
      if (!success && scrollAttempts < 5) {
        setScrollAttempts(prev => prev + 1);
        setTimeout(attemptScroll, 100 * (scrollAttempts + 1)); // Increasing delay
      } else if (success) {
        setScrollAttempts(0);
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

  // Batched staffing statuses for visible window
  const visibleTechIds = useMemo(() => {
    const start = Math.max(0, visibleRows.start - 10);
    const end = Math.min(technicians.length - 1, visibleRows.end + 10);
    return technicians.slice(start, end + 1).map(t => t.id);
  }, [technicians, visibleRows.start, visibleRows.end]);
  // Fetch staffing statuses for ALL currently loaded dates and jobs for the visible technicians
  // This avoids re-fetching when scrolling horizontally, making badges render immediately.
  const allJobsLite = useMemo(() => jobs.map(j => ({ id: j.id, start_time: j.start_time, end_time: j.end_time })), [jobs]);
  const { data: staffingMaps } = useStaffingMatrixStatuses(visibleTechIds, allJobsLite, dates);

  const getCurrentTechnician = useCallback(() => {
    if (!cellAction?.technicianId) return null;
    return technicians.find(t => t.id === cellAction.technicianId);
  }, [cellAction?.technicianId, technicians]);

  const currentTechnician = getCurrentTechnician();

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
          <div className="font-semibold">Technicians</div>
          {isManagementUser && (
            <Button size="sm" variant="outline" className="h-8" onClick={() => setCreateUserOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Add
            </Button>
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
        <div style={{ width: matrixWidth, height: '100%', display: 'flex', position: 'relative' }}>
          {/* Leading spacer for virtualized columns */}
          <div style={{ width: visibleCols.start * CELL_WIDTH }} />
          {dates.slice(visibleCols.start, visibleCols.end + 1).map((date, idx) => (
            <DateHeader
              key={visibleCols.start + idx}
              date={date}
              width={CELL_WIDTH}
              jobs={getJobsForDate(date)}
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
            {technicians.slice(visibleRows.start, visibleRows.end + 1).map((technician) => (
              <TechnicianRow
                key={technician.id}
                technician={technician}
                height={CELL_HEIGHT}
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
            {technicians.slice(visibleRows.start, visibleRows.end + 1).map((technician, idx) => {
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
          onSubmit={({ role, message, singleDay }) => {
            if (!cellAction.selectedJobId) return;
            (async () => {
              const conflict = await checkTimeConflict(currentTechnician.id, cellAction.selectedJobId!);
              if (conflict) {
                toast({
                  title: 'Conflicto de horarios',
                  description: `Ya tiene confirmado: ${conflict.title} (${new Date(conflict.start_time).toLocaleString()} - ${new Date(conflict.end_time).toLocaleString()})`,
                  variant: 'destructive'
                });
                return;
              }
              sendStaffingEmail(
                ({ job_id: cellAction.selectedJobId, profile_id: currentTechnician.id, phase: 'offer', role, message, target_date: cellAction.date.toISOString(), single_day: !!singleDay } as any),
                {
                  onSuccess: () => {
                    toast({ title: 'Offer email sent', description: `${role} offer sent to ${currentTechnician.first_name}` });
                    closeDialogs();
                  },
                  onError: (error: any) => {
                    toast({ title: 'Failed to send offer', description: error.message, variant: 'destructive' });
                  }
                }
              )
            })();
          }}
        />
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

// Helper: check if technician has a confirmed overlapping job
async function checkTimeConflict(technicianId: string, targetJobId: string): Promise<{ id: string, title: string, start_time: string, end_time: string } | null> {
  try {
    const { data: targetJob, error: jErr } = await supabase
      .from('jobs')
      .select('id,title,start_time,end_time')
      .eq('id', targetJobId)
      .maybeSingle();
    if (jErr || !targetJob) return null;

    const { data: assignments, error: aErr } = await supabase
      .from('job_assignments')
      .select('job_id,status')
      .eq('technician_id', technicianId)
      .eq('status', 'confirmed');
    if (aErr || !assignments?.length) return null;

    const otherIds = assignments.map(a => a.job_id).filter(id => id !== targetJobId);
    if (!otherIds.length) return null;
    const { data: jobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('id,title,start_time,end_time')
      .in('id', otherIds);
    if (jobsErr || !jobs?.length) return null;

    const ts = targetJob.start_time ? new Date(targetJob.start_time) : null;
    const te = targetJob.end_time ? new Date(targetJob.end_time) : null;
    if (!ts || !te) return null;
    const overlap = jobs.find(j => j.start_time && j.end_time && (new Date(j.start_time) < te) && (new Date(j.end_time) > ts));
    return overlap ? { id: overlap.id, title: overlap.title, start_time: overlap.start_time!, end_time: overlap.end_time! } : null;
  } catch (e) {
    console.warn('Conflict pre-check error', e);
    return null;
  }
}
