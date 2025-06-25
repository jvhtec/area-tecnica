
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { format, isSameDay, isWithinInterval } from 'date-fns';
import { TechnicianRow } from './TechnicianRow';
import { MatrixCell } from './MatrixCell';
import { DateHeader } from './DateHeader';
import { SelectJobDialog } from './SelectJobDialog';
import { AssignJobDialog } from './AssignJobDialog';
import { AssignmentStatusDialog } from './AssignmentStatusDialog';
import { MarkUnavailableDialog } from './MarkUnavailableDialog';
import { useJobAssignmentsRealtime } from '@/hooks/useJobAssignmentsRealtime';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface AssignmentMatrixProps {
  technicians: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    department: string;
    role: string;
  }>;
  dates: Date[];
  jobs: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    color?: string;
    status: string;
  }>;
}

interface CellAction {
  type: 'select-job' | 'assign' | 'unavailable' | 'confirm' | 'decline';
  technicianId: string;
  date: Date;
  assignment?: any;
  selectedJobId?: string;
}

export const AssignmentMatrix = ({ technicians, dates, jobs }: AssignmentMatrixProps) => {
  const [cellAction, setCellAction] = useState<CellAction | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const matrixContainerRef = useRef<HTMLDivElement>(null);
  const technicianScrollRef = useRef<HTMLDivElement>(null);
  const dateHeadersRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  const syncTimeoutRef = useRef<number>();
  
  // Increased cell width for better content space
  const CELL_WIDTH = 160;
  const CELL_HEIGHT = 60;
  const TECHNICIAN_WIDTH = 256;
  const HEADER_HEIGHT = 80;

  // Calculate matrix dimensions
  const matrixWidth = dates.length * CELL_WIDTH;
  const matrixHeight = technicians.length * CELL_HEIGHT;

  // Get all job assignments for all jobs that might have assignments
  const jobIds = jobs.map(job => job.id);
  
  // Fetch all assignments for jobs in the date range
  const { data: allAssignments = [] } = useQuery({
    queryKey: ['matrix-assignments', jobIds],
    queryFn: async () => {
      if (jobIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          *,
          profiles (
            first_name,
            last_name,
            department
          ),
          jobs (
            id,
            title,
            start_time,
            end_time,
            color
          )
        `)
        .in('job_id', jobIds);

      if (error) throw error;
      return data || [];
    },
    enabled: jobIds.length > 0
  });

  // Fetch availability schedules for the date range
  const { data: availabilityData = [] } = useQuery({
    queryKey: ['matrix-availability', technicians.map(t => t.id), dates[0], dates[dates.length - 1]],
    queryFn: async () => {
      if (technicians.length === 0 || dates.length === 0) return [];
      
      const { data, error } = await supabase
        .from('availability_schedules')
        .select('*')
        .in('user_id', technicians.map(t => t.id))
        .gte('date', format(dates[0], 'yyyy-MM-dd'))
        .lte('date', format(dates[dates.length - 1], 'yyyy-MM-dd'));

      if (error) throw error;
      return data || [];
    },
    enabled: technicians.length > 0 && dates.length > 0
  });

  // Get assignment for a specific technician and date
  const getAssignmentForCell = (technicianId: string, date: Date) => {
    return allAssignments.find(assignment => {
      if (assignment.technician_id !== technicianId || !assignment.jobs) {
        return false;
      }
      
      const jobStart = new Date(assignment.jobs.start_time);
      const jobEnd = new Date(assignment.jobs.end_time);
      
      // Check if the date falls within the job's date range
      return isWithinInterval(date, { start: jobStart, end: jobEnd }) || 
             isSameDay(date, jobStart) || 
             isSameDay(date, jobEnd);
    });
  };

  // Get availability status for a specific technician and date
  const getAvailabilityForCell = (technicianId: string, date: Date) => {
    return availabilityData.find(availability =>
      availability.user_id === technicianId &&
      isSameDay(new Date(availability.date), date)
    );
  };

  // Get jobs for a specific date
  const getJobsForDate = (date: Date) => {
    return jobs.filter(job => {
      const jobStart = new Date(job.start_time);
      const jobEnd = new Date(job.end_time);
      
      return isWithinInterval(date, { start: jobStart, end: jobEnd }) || 
             isSameDay(date, jobStart) || 
             isSameDay(date, jobEnd);
    });
  };

  // IMPROVED: Smooth scroll synchronization with performance optimization
  const syncScrollPositions = useCallback((scrollLeft: number, scrollTop: number) => {
    // Use requestAnimationFrame for smoother sync
    requestAnimationFrame(() => {
      // Sync horizontal scroll with date headers
      if (dateHeadersRef.current) {
        const dateHeaders = dateHeadersRef.current;
        const maxScrollLeft = Math.max(0, dateHeaders.scrollWidth - dateHeaders.clientWidth);
        const clampedScrollLeft = Math.min(scrollLeft, maxScrollLeft);
        
        if (Math.abs(dateHeaders.scrollLeft - clampedScrollLeft) > 1) {
          dateHeaders.scrollLeft = clampedScrollLeft;
        }
      }
      
      // Sync vertical scroll with technician column
      if (technicianScrollRef.current) {
        const techScroll = technicianScrollRef.current;
        const maxScrollTop = Math.max(0, techScroll.scrollHeight - techScroll.clientHeight);
        const clampedScrollTop = Math.min(scrollTop, maxScrollTop);
        
        if (Math.abs(techScroll.scrollTop - clampedScrollTop) > 1) {
          techScroll.scrollTop = clampedScrollTop;
        }
      }
    });
  }, []);

  // IMPROVED: Main scroll handler with debouncing and error handling
  const handleMainScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const scrollTop = e.currentTarget.scrollTop;
    
    // Clear any pending sync operations
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    // Immediate sync for smooth user experience
    syncScrollPositions(scrollLeft, scrollTop);
    
    // Debounced sync as backup
    syncTimeoutRef.current = window.setTimeout(() => {
      syncScrollPositions(scrollLeft, scrollTop);
    }, 16); // ~60fps
  }, [syncScrollPositions]);

  // IMPROVED: Setup scroll containers with precise dimensions
  useEffect(() => {
    if (dateHeadersRef.current && mainScrollRef.current && technicianScrollRef.current) {
      const dateHeadersElement = dateHeadersRef.current;
      const mainScrollElement = mainScrollRef.current;
      const techScrollElement = technicianScrollRef.current;
      
      // Ensure identical scrollable widths
      const targetScrollWidth = matrixWidth;
      
      // Set up date headers container
      dateHeadersElement.style.width = `${mainScrollElement.clientWidth}px`;
      
      // Ensure technician scroll height matches main scroll area
      const targetScrollHeight = matrixHeight;
      techScrollElement.style.height = `${mainScrollElement.clientHeight}px`;
      
      console.log('Scroll containers setup:', {
        matrixWidth: targetScrollWidth,
        matrixHeight: targetScrollHeight,
        dateHeadersClientWidth: dateHeadersElement.clientWidth,
        dateHeadersScrollWidth: dateHeadersElement.scrollWidth,
        mainScrollClientWidth: mainScrollElement.clientWidth,
        mainScrollScrollWidth: mainScrollElement.scrollWidth,
        techScrollClientHeight: techScrollElement.clientHeight,
        techScrollScrollHeight: techScrollElement.scrollHeight
      });
    }
  }, [dates.length, technicians.length, CELL_WIDTH, CELL_HEIGHT, matrixWidth, matrixHeight]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  const handleCellClick = (technicianId: string, date: Date, action: 'select-job' | 'assign' | 'unavailable' | 'confirm' | 'decline') => {
    const assignment = getAssignmentForCell(technicianId, date);
    setCellAction({ type: action, technicianId, date, assignment });
  };

  const handleJobSelected = (jobId: string) => {
    if (cellAction?.type === 'select-job') {
      setCellAction({
        ...cellAction,
        type: 'assign',
        selectedJobId: jobId
      });
    }
  };

  const handleCellSelect = (technicianId: string, date: Date, selected: boolean) => {
    const cellKey = `${technicianId}-${format(date, 'yyyy-MM-dd')}`;
    const newSelected = new Set(selectedCells);
    
    if (selected) {
      newSelected.add(cellKey);
    } else {
      newSelected.delete(cellKey);
    }
    
    setSelectedCells(newSelected);
  };

  const closeDialogs = () => {
    setCellAction(null);
    setSelectedCells(new Set());
  };

  // Auto-scroll to today
  useEffect(() => {
    if (hasScrolledToToday || !mainScrollRef.current || dates.length === 0) return;

    const scrollToToday = () => {
      const today = new Date();
      const todayIndex = dates.findIndex(date => isSameDay(date, today));
      
      if (todayIndex !== -1 && mainScrollRef.current) {
        const container = mainScrollRef.current;
        const containerWidth = container.clientWidth;
        
        // Calculate scroll position to center today's date
        let scrollPosition = (todayIndex * CELL_WIDTH) - (containerWidth / 2) + (CELL_WIDTH / 2);
        
        // Ensure we don't scroll past the boundaries
        const maxScroll = matrixWidth - containerWidth;
        scrollPosition = Math.max(0, Math.min(scrollPosition, maxScroll));
        
        container.scrollLeft = scrollPosition;
        setHasScrolledToToday(true);
      }
    };

    const timeoutId = setTimeout(scrollToToday, 300);
    return () => clearTimeout(timeoutId);
  }, [dates, hasScrolledToToday, CELL_WIDTH, matrixWidth]);

  // Get technician name for dialogs
  const getCurrentTechnician = () => {
    if (!cellAction?.technicianId) return null;
    return technicians.find(t => t.id === cellAction.technicianId);
  };

  const currentTechnician = getCurrentTechnician();

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

      {/* IMPROVED: Date Headers with precise scrolling */}
      <div 
        ref={dateHeadersRef}
        className="matrix-date-headers"
        style={{ 
          left: TECHNICIAN_WIDTH, 
          height: HEADER_HEIGHT,
          width: `calc(100% - ${TECHNICIAN_WIDTH}px)`,
          minWidth: `calc(100% - ${TECHNICIAN_WIDTH}px)`
        }}
      >
        {dates.map((date, index) => (
          <DateHeader
            key={index}
            date={date}
            width={CELL_WIDTH}
            jobs={getJobsForDate(date)}
          />
        ))}
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
        <div ref={technicianScrollRef} className="matrix-technician-scroll">
          {technicians.map((technician) => (
            <TechnicianRow
              key={technician.id}
              technician={technician}
              height={CELL_HEIGHT}
            />
          ))}
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
                      <MatrixCell
                        technician={technician}
                        date={date}
                        assignment={assignment}
                        availability={availability}
                        width={CELL_WIDTH}
                        height={CELL_HEIGHT}
                        isSelected={isSelected}
                        onSelect={(selected) => handleCellSelect(technician.id, date, selected)}
                        onClick={(action) => handleCellClick(technician.id, date, action)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Job Selection Dialog */}
      {cellAction?.type === 'select-job' && currentTechnician && (
        <SelectJobDialog
          open={true}
          onClose={closeDialogs}
          onJobSelected={handleJobSelected}
          technicianName={`${currentTechnician.first_name} ${currentTechnician.last_name}`}
          date={cellAction.date}
          availableJobs={jobs.filter(job => {
            const jobStart = new Date(job.start_time);
            const jobEnd = new Date(job.end_time);
            
            return isWithinInterval(cellAction.date, { start: jobStart, end: jobEnd }) || 
                   isSameDay(cellAction.date, jobStart) || 
                   isSameDay(cellAction.date, jobEnd);
          })}
        />
      )}

      {/* Assignment Dialog */}
      {cellAction?.type === 'assign' && (
        <AssignJobDialog
          open={true}
          onClose={closeDialogs}
          technicianId={cellAction.technicianId}
          date={cellAction.date}
          availableJobs={jobs.filter(job => {
            const jobStart = new Date(job.start_time);
            const jobEnd = new Date(job.end_time);
            
            return isWithinInterval(cellAction.date, { start: jobStart, end: jobEnd }) || 
                   isSameDay(cellAction.date, jobStart) || 
                   isSameDay(cellAction.date, jobEnd);
          })}
          existingAssignment={cellAction.assignment}
          preSelectedJobId={cellAction.selectedJobId}
        />
      )}

      {/* Status Change Dialogs */}
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

      {/* Unavailability Dialog */}
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
