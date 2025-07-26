import { useMemo } from 'react';
import { format, isWithinInterval, isSameDay } from 'date-fns';

interface Assignment {
  job_id: string;
  technician_id: string;
  status: string;
  job: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    color?: string;
  };
}

interface Availability {
  user_id: string;
  date: string;
  status: string;
  notes?: string;
}

interface Job {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
  status: string;
  job_type: string;
}

export const useMemoizedMatrix = (
  assignments: Assignment[],
  availability: Availability[],
  jobs: Job[],
  dates: Date[]
) => {
  // Pre-compute assignment lookups
  const assignmentLookup = useMemo(() => {
    const lookup = new Map<string, Assignment>();
    
    assignments.forEach(assignment => {
      if (!assignment.job) return;
      
      const jobStart = new Date(assignment.job.start_time);
      const jobEnd = new Date(assignment.job.end_time);
      
      dates.forEach(date => {
        if (isWithinInterval(date, { start: jobStart, end: jobEnd }) || 
            isSameDay(date, jobStart) || 
            isSameDay(date, jobEnd)) {
          const key = `${assignment.technician_id}:${format(date, 'yyyy-MM-dd')}`;
          lookup.set(key, assignment);
        }
      });
    });
    
    return lookup;
  }, [assignments, dates]);

  // Pre-compute availability lookups
  const availabilityLookup = useMemo(() => {
    const lookup = new Map<string, Availability>();
    
    availability.forEach(avail => {
      const key = `${avail.user_id}:${avail.date}`;
      lookup.set(key, avail);
    });
    
    return lookup;
  }, [availability]);

  // Pre-compute jobs by date
  const jobsByDate = useMemo(() => {
    const lookup = new Map<string, Job[]>();
    
    dates.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const dateJobs = jobs.filter(job => {
        const jobStart = new Date(job.start_time);
        const jobEnd = new Date(job.end_time);
        
        return isWithinInterval(date, { start: jobStart, end: jobEnd }) || 
               isSameDay(date, jobStart) || 
               isSameDay(date, jobEnd);
      });
      
      lookup.set(dateKey, dateJobs);
    });
    
    return lookup;
  }, [jobs, dates]);

  // Optimized getter functions
  const getAssignment = useMemo(() => 
    (technicianId: string, date: Date) => {
      const key = `${technicianId}:${format(date, 'yyyy-MM-dd')}`;
      return assignmentLookup.get(key);
    }, [assignmentLookup]
  );

  const getAvailability = useMemo(() => 
    (technicianId: string, date: Date) => {
      const key = `${technicianId}:${format(date, 'yyyy-MM-dd')}`;
      return availabilityLookup.get(key);
    }, [availabilityLookup]
  );

  const getJobsForDate = useMemo(() => 
    (date: Date) => {
      const key = format(date, 'yyyy-MM-dd');
      return jobsByDate.get(key) || [];
    }, [jobsByDate]
  );

  return {
    getAssignment,
    getAvailability,
    getJobsForDate,
    assignmentLookup,
    availabilityLookup,
    jobsByDate
  };
};