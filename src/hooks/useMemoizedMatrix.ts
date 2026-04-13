import { useCallback, useMemo } from 'react';
import { formatInTimeZone } from 'date-fns-tz';

const MADRID_TZ = 'Europe/Madrid';
const formatDateKeyMadrid = (date: Date) => formatInTimeZone(date, MADRID_TZ, 'yyyy-MM-dd');
const dateKeyToComparableTs = (dateKey: string) => Date.parse(`${dateKey}T00:00:00Z`);

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
    const uniqueByKey = new Map<string, { date: Date; key: string; ts: number }>();

    dates.forEach((date) => {
      const key = formatDateKeyMadrid(date);
      if (!uniqueByKey.has(key)) {
        uniqueByKey.set(key, {
          date,
          key,
          ts: dateKeyToComparableTs(key),
        });
      }
    });

    const entries = Array.from(uniqueByKey.values());
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

  const assignmentLookup = useMemo(() => {
    const lookup = new Map<string, Assignment>();

    assignments.forEach((assignment) => {
      if (!assignment.job) return;

      const jobStartTs = dateKeyToComparableTs(formatDateKeyMadrid(new Date(assignment.job.start_time)));
      const jobEndTs = dateKeyToComparableTs(formatDateKeyMadrid(new Date(assignment.job.end_time)));

      const startIdx = findLowerBound(jobStartTs);
      const endIdx = findUpperBound(jobEndTs);
      if (startIdx > endIdx || startIdx >= normalizedDateEntries.length || endIdx < 0) return;

      for (let idx = startIdx; idx <= endIdx; idx += 1) {
        const dateKey = normalizedDateEntries[idx]?.key;
        if (!dateKey) continue;
        lookup.set(`${assignment.technician_id}:${dateKey}`, assignment);
      }
    });

    return lookup;
  }, [assignments, findLowerBound, findUpperBound, normalizedDateEntries]);

  const availabilityLookup = useMemo(() => {
    const lookup = new Map<string, Availability>();

    availability.forEach((avail) => {
      lookup.set(`${avail.user_id}:${avail.date}`, avail);
    });

    return lookup;
  }, [availability]);

  const jobsByDate = useMemo(() => {
    const lookup = new Map<string, Job[]>();
    normalizedDateEntries.forEach(({ key }) => lookup.set(key, []));

    jobs.forEach((job) => {
      const jobStartTs = dateKeyToComparableTs(formatDateKeyMadrid(new Date(job.start_time)));
      const jobEndTs = dateKeyToComparableTs(formatDateKeyMadrid(new Date(job.end_time)));

      const startIdx = findLowerBound(jobStartTs);
      const endIdx = findUpperBound(jobEndTs);
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

  const getAssignment = useMemo(() =>
    (technicianId: string, date: Date) => assignmentLookup.get(`${technicianId}:${formatDateKeyMadrid(date)}`),
  [assignmentLookup]);

  const getAvailability = useMemo(() =>
    (technicianId: string, date: Date) => availabilityLookup.get(`${technicianId}:${formatDateKeyMadrid(date)}`),
  [availabilityLookup]);

  const getJobsForDate = useMemo(() =>
    (date: Date) => jobsByDate.get(formatDateKeyMadrid(date)) || [],
  [jobsByDate]);

  return {
    getAssignment,
    getAvailability,
    getJobsForDate,
    assignmentLookup,
    availabilityLookup,
    jobsByDate,
  };
};
