import { useCallback, useMemo } from 'react';
import { format } from 'date-fns';

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
  const normalizedDateEntries = useMemo(() => {
    const entries = dates.map((date) => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return {
        date,
        key: format(normalized, 'yyyy-MM-dd'),
        ts: normalized.getTime(),
      };
    });
    entries.sort((a, b) => a.ts - b.ts);
    return entries;
  }, [dates]);

  const dateTimestamps = useMemo(() => normalizedDateEntries.map((entry) => entry.ts), [normalizedDateEntries]);

  const findLowerBound = useCallback((target: number) => {
    let left = 0;
    let right = dateTimestamps.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (dateTimestamps[mid] < target) left = mid + 1;
      else right = mid;
    }
    return left;
  }, [dateTimestamps]);

  const findUpperBound = useCallback((target: number) => {
    let left = 0;
    let right = dateTimestamps.length;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (dateTimestamps[mid] <= target) left = mid + 1;
      else right = mid;
    }
    return left - 1;
  }, [dateTimestamps]);

  // Pre-compute assignment lookups
  const assignmentLookup = useMemo(() => {
    const lookup = new Map<string, Assignment>();
    
    assignments.forEach(assignment => {
      if (!assignment.job) return;
      
      const jobStart = new Date(assignment.job.start_time);
      const jobEnd = new Date(assignment.job.end_time);
      jobStart.setHours(0, 0, 0, 0);
      jobEnd.setHours(0, 0, 0, 0);

      const startIdx = findLowerBound(jobStart.getTime());
      const endIdx = findUpperBound(jobEnd.getTime());
      if (startIdx > endIdx || startIdx >= normalizedDateEntries.length || endIdx < 0) return;

      for (let idx = startIdx; idx <= endIdx; idx += 1) {
        const dateKey = normalizedDateEntries[idx]?.key;
        if (!dateKey) continue;
        const key = `${assignment.technician_id}:${dateKey}`;
        lookup.set(key, assignment);
      }
    });
    
    return lookup;
  }, [assignments, findLowerBound, findUpperBound, normalizedDateEntries]);

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
    normalizedDateEntries.forEach(({ key }) => lookup.set(key, []));

    jobs.forEach((job) => {
      const jobStart = new Date(job.start_time);
      const jobEnd = new Date(job.end_time);
      jobStart.setHours(0, 0, 0, 0);
      jobEnd.setHours(0, 0, 0, 0);

      const startIdx = findLowerBound(jobStart.getTime());
      const endIdx = findUpperBound(jobEnd.getTime());
      if (startIdx > endIdx || startIdx >= normalizedDateEntries.length || endIdx < 0) return;

      for (let idx = startIdx; idx <= endIdx; idx += 1) {
        const dateKey = normalizedDateEntries[idx]?.key;
        if (!dateKey) continue;
        const bucket = lookup.get(dateKey);
        if (bucket) bucket.push(job);
      }
    });
    
    return lookup;
  }, [jobs, findLowerBound, findUpperBound, normalizedDateEntries]);

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
