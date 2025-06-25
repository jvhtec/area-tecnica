import React, { useState, useRef, useEffect } from 'react';
import { format, isSameDay } from 'date-fns';
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
  const dateHeaderScrollRef = useRef<HTMLDivElement>(null);
  const matrixScrollRef = useRef<HTMLDivElement>(null);
  const technicianScrollRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);
  
  const CELL_WIDTH = 120;
  const CELL_HEIGHT = 60;
  const SIDEBAR_WIDTH = 256;
  const HEADER_HEIGHT = 80;

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
    return allAssignments.find(assignment => 
      assignment.technician_id === technicianId && 
      assignment.jobs &&
      isSameDay(new Date(assignment.jobs.start_time), date)
    );
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
    return jobs.filter(job => isSameDay(new Date(job.start_time), date));
  };

  // Sync horizontal scroll between header and matrix
  const handleMatrixScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (dateHeaderScrollRef.current) {
      dateHeaderScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Sync vertical scroll between technician list and matrix
  const handleTechnicianScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (matrixScrollRef.current) {
      matrixScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

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

  // Fixed auto-scroll to today functionality
  useEffect(() => {
    if (hasScrolledToToday || !matrixScrollRef.current || !dateHeaderScrollRef.current || dates.length === 0) return;

    const scrollToToday = () => {
      const today = new Date();
      const todayIndex = dates.findIndex(date => isSameDay(date, today));
      
      if (todayIndex !== -1 && matrixScrollRef.current && dateHeaderScrollRef.current) {
        const matrixContainer = matrixScrollRef.current;
        const headerContainer = dateHeaderScrollRef.current;
        
        requestAnimationFrame(() => {
          if (!matrixContainer || !headerContainer) return;
          
          const containerWidth = matrixContainer.clientWidth;
          const totalWidth = dates.length * CELL_WIDTH;
          
          // Calculate scroll position to center today's date
          let scrollPosition = (todayIndex * CELL_WIDTH) - (containerWidth / 2) + (CELL_WIDTH / 2);
          
          // Ensure we don't scroll past the boundaries
          scrollPosition = Math.max(0, Math.min(scrollPosition, totalWidth - containerWidth));
          
          // Sync scroll for both containers
          matrixContainer.scrollLeft = scrollPosition;
          headerContainer.scrollLeft = scrollPosition;
          setHasScrolledToToday(true);
          
          console.log('Auto-scrolled to today:', {
            todayIndex,
            scrollPosition,
            containerWidth,
            totalWidth
          });
        });
      }
    };

    const timeoutId = setTimeout(scrollToToday, 300);
    return () => clearTimeout(timeoutId);
  }, [dates, hasScrolledToToday]);

  // Get technician name for dialogs
  const getCurrentTechnician = () => {
    if (!cellAction?.technicianId) return null;
    return technicians.find(t => t.id === cellAction.technicianId);
  };

  const currentTechnician = getCurrentTechnician();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Fixed Header Layout */}
      <div className="flex border-b bg-card z-30 relative">
        {/* Fixed corner header */}
        <div 
          className="border-r bg-card p-4 flex items-center justify-center font-semibold sticky left-0 z-40"
          style={{ width: SIDEBAR_WIDTH, height: HEADER_HEIGHT }}
        >
          Technicians
        </div>
        
        {/* Fixed date headers - horizontally scrollable */}
        <div 
          ref={dateHeaderScrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin"
          style={{ height: HEADER_HEIGHT }}
        >
          <div className="flex" style={{ width: dates.length * CELL_WIDTH }}>
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
      </div>

      {/* Matrix Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Fixed technician column - vertically scrollable */}
        <div 
          ref={technicianScrollRef}
          className="border-r bg-card overflow-y-auto overflow-x-hidden sticky left-0 z-20 scrollbar-thin"
          style={{ width: SIDEBAR_WIDTH }}
          onScroll={handleTechnicianScroll}
        >
          {technicians.map((technician) => (
            <TechnicianRow
              key={technician.id}
              technician={technician}
              height={CELL_HEIGHT}
            />
          ))}
        </div>

        {/* Scrollable matrix cells */}
        <div 
          ref={matrixScrollRef}
          className="flex-1 overflow-auto scrollbar-thin"
          onScroll={handleMatrixScroll}
        >
          <div style={{ width: dates.length * CELL_WIDTH }}>
            {technicians.map((technician) => (
              <div key={technician.id} className="flex border-b" style={{ height: CELL_HEIGHT }}>
                {dates.map((date, dateIndex) => {
                  const assignment = getAssignmentForCell(technician.id, date);
                  const availability = getAvailabilityForCell(technician.id, date);
                  const cellKey = `${technician.id}-${format(date, 'yyyy-MM-dd')}`;
                  const isSelected = selectedCells.has(cellKey);
                  
                  return (
                    <MatrixCell
                      key={dateIndex}
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
          availableJobs={jobs.filter(job => 
            isSameDay(new Date(job.start_time), cellAction.date)
          )}
        />
      )}

      {/* Assignment Dialog */}
      {cellAction?.type === 'assign' && (
        <AssignJobDialog
          open={true}
          onClose={closeDialogs}
          technicianId={cellAction.technicianId}
          date={cellAction.date}
          availableJobs={jobs.filter(job => 
            isSameDay(new Date(job.start_time), cellAction.date)
          )}
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
