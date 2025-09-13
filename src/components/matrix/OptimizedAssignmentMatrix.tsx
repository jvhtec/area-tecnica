
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { format, isSameDay } from 'date-fns';
import { TechnicianRow } from './TechnicianRow';
import { OptimizedMatrixCell } from './OptimizedMatrixCell';
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
import { supabase } from '@/integrations/supabase/client';

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
    department: string;
    role: string;
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
}

interface OptimizedAssignmentMatrixExtendedProps extends OptimizedAssignmentMatrixProps {
  onNearEdgeScroll?: (direction: 'before' | 'after') => void;
  canExpandBefore?: boolean;
  canExpandAfter?: boolean;
}

export const OptimizedAssignmentMatrix = ({ 
  technicians, 
  dates, 
  jobs, 
  onNearEdgeScroll,
  canExpandBefore = false,
  canExpandAfter = false
}: OptimizedAssignmentMatrixExtendedProps) => {
  const [cellAction, setCellAction] = useState<CellAction | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const technicianScrollRef = useRef<HTMLDivElement>(null);
  const dateHeadersRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [scrollAttempts, setScrollAttempts] = useState(0);
  const syncInProgressRef = useRef(false);
  
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
      console.log('Assignment update event received, refreshing data...');
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
    if (nearLeftEdge && canExpandBefore && onNearEdgeScroll) {
      onNearEdgeScroll('before');
    } else if (nearRightEdge && canExpandAfter && onNearEdgeScroll) {
      onNearEdgeScroll('after');
    }
    
    syncScrollPositions(scrollLeft, scrollTop, 'main');
  }, [syncScrollPositions, canExpandBefore, canExpandAfter, onNearEdgeScroll]);

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
    setCellAction({ type: action, technicianId, date, assignment, selectedJobId });
  }, [getAssignmentForCell]);

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

  const handleStaffingActionSelected = useCallback((jobId: string, action: 'availability' | 'offer') => {
    console.log('🚀 OptimizedAssignmentMatrix: handleStaffingActionSelected called', { 
      jobId, 
      action, 
      cellAction,
      technicianId: cellAction?.technicianId 
    });
    
    if (cellAction?.type === 'select-job-for-staffing') {
      if (action === 'offer') {
        // Open offer details dialog; do not send immediately
        setCellAction({ ...cellAction, type: 'offer-details', selectedJobId: jobId });
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
        console.log('🚀 ABOUT TO SEND STAFFING EMAIL:', { jobId, action, technicianId: cellAction.technicianId });
        sendStaffingEmail(
          { job_id: jobId, profile_id: cellAction.technicianId, phase: action },
          {
            onSuccess: (data) => {
              console.log('✅ STAFFING EMAIL SUCCESS:', data);
              toast({ title: "Email sent!", description: `Availability request sent successfully.` });
              closeDialogs();
            },
            onError: (error) => {
              console.error('❌ STAFFING EMAIL ERROR:', error);
              toast({ title: "Email failed", description: `Failed to send availability email: ${error.message}`, variant: "destructive" });
              closeDialogs();
            }
          }
        );
      })();
    } else {
      console.log('❌ cellAction is not select-job-for-staffing:', cellAction);
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
      console.log('Auto-scroll: Container not ready or no dates');
      return false;
    }

    const today = new Date();
    const todayIndex = dates.findIndex(date => isSameDay(date, today));
    
    console.log('Auto-scroll: Today index:', todayIndex, 'Total dates:', dates.length);
    
    if (todayIndex === -1) {
      console.log('Auto-scroll: Today not found in dates array');
      return false;
    }

    const container = mainScrollRef.current;
    const containerWidth = container.clientWidth;
    
    console.log('Auto-scroll: Container width:', containerWidth);
    
    if (containerWidth === 0) {
      console.log('Auto-scroll: Container not properly sized yet');
      return false;
    }
    
    let scrollPosition = (todayIndex * CELL_WIDTH) - (containerWidth / 2) + (CELL_WIDTH / 2);
    const maxScroll = matrixWidth - containerWidth;
    scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
    
    console.log('Auto-scroll: Calculated position:', scrollPosition, 'Max scroll:', maxScroll);
    
    container.scrollLeft = scrollPosition;
    
    // Verify the scroll actually happened
    requestAnimationFrame(() => {
      const actualScrollLeft = container.scrollLeft;
      console.log('Auto-scroll: Actual scroll position:', actualScrollLeft);
      if (Math.abs(actualScrollLeft - scrollPosition) < 5) {
        console.log('Auto-scroll: Successfully scrolled to today');
        return true;
      }
    });
    
    return true;
  }, [dates, CELL_WIDTH, matrixWidth]);

  // Auto-scroll to today with retry mechanism
  useEffect(() => {
    if (isLoading || dates.length === 0) return;

    const attemptScroll = () => {
      const success = scrollToToday();
      
      if (!success && scrollAttempts < 5) {
        console.log(`Auto-scroll attempt ${scrollAttempts + 1} failed, retrying...`);
        setScrollAttempts(prev => prev + 1);
        setTimeout(attemptScroll, 100 * (scrollAttempts + 1)); // Increasing delay
      } else if (success) {
        console.log('Auto-scroll: Successfully completed');
        setScrollAttempts(0);
      } else {
        console.log('Auto-scroll: Max attempts reached, giving up');
      }
    };

    // Initial attempt with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(attemptScroll, 50);
    
    return () => clearTimeout(timeoutId);
  }, [scrollToToday, isLoading, dates.length, scrollAttempts]);

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
        <div className="flex items-center justify-center h-full font-semibold bg-card border-r border-b">
          Technicians
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
        <div style={{ width: matrixWidth, height: '100%', display: 'flex' }}>
          {dates.map((date, index) => (
            <DateHeader
              key={index}
              date={date}
              width={CELL_WIDTH}
              jobs={getJobsForDate(date)}
            />
          ))}
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
          <div style={{ height: matrixHeight }}>
            {technicians.map((technician) => (
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
            {technicians.map((technician, techIndex) => (
              <div 
                key={technician.id} 
                className="matrix-row"
                style={{ 
                  top: techIndex * CELL_HEIGHT,
                  height: CELL_HEIGHT
                }}
              >
                {dates.map((date, dateIndex) => {
                  const assignment = getAssignmentForCell(technician.id, date);
                  const availability = getAvailabilityForCell(technician.id, date);
                  const cellKey = `${technician.id}-${format(date, 'yyyy-MM-dd')}`;
                  const isSelected = selectedCells.has(cellKey);
                  
                  return (
                    <div
                      key={dateIndex}
                      className="matrix-cell-wrapper"
                      style={{
                        left: dateIndex * CELL_WIDTH,
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
                        jobId={assignment?.job_id}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
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
          technicianName={`${currentTechnician.first_name} ${currentTechnician.last_name}`}
          date={cellAction.date}
          availableJobs={getJobsForDate(cellAction.date)}
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
          onSubmit={({ role, message }) => {
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
                { job_id: cellAction.selectedJobId, profile_id: currentTechnician.id, phase: 'offer', role, message },
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
