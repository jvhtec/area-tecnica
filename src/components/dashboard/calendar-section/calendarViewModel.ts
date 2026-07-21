import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from 'date-fns';
import type { CalendarExportRange } from './types';
import { isJobOnDate } from '@/utils/timezoneUtils';

export interface PreparedCalendarJob {
  id: string;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string | null;
  jobTimezone: string;
  job_type?: string | null;
  status?: string | null;
  job_departments?: Array<{ department?: string | null }> | null;
  departmentIds: Array<string | null | undefined>;
  [key: string]: unknown;
}

export interface CalendarJobInput extends Record<string, unknown> {
  id: string;
  timezone?: string | null;
  job_departments?: Array<{ department?: string | null }> | null;
}

export function buildCalendarDays(month: Date): Date[] {
  const firstDayOfMonth = startOfMonth(month);
  const lastDayOfMonth = endOfMonth(month);
  const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
  const startDay = firstDayOfMonth.getDay();
  const paddingDays = startDay === 0 ? 6 : startDay - 1;
  const prefixDays = Array.from({ length: paddingDays }, (_, index) => {
    const day = new Date(firstDayOfMonth);
    day.setDate(day.getDate() - (paddingDays - index));
    return day;
  });
  const suffixDays = Array.from(
    { length: 42 - (prefixDays.length + daysInMonth.length) },
    (_, index) => {
      const day = new Date(lastDayOfMonth);
      day.setDate(day.getDate() + index + 1);
      return day;
    },
  );

  return [...prefixDays, ...daysInMonth, ...suffixDays];
}

export function prepareCalendarJobs(jobs: CalendarJobInput[]): PreparedCalendarJob[] {
  return jobs.map((job) => ({
    ...job,
    jobTimezone: job.timezone || 'Europe/Madrid',
    departmentIds: job.job_departments?.map(
      (department: { department?: string | null }) => department.department,
    ) || [],
  })) as PreparedCalendarJob[];
}

interface CalendarJobFilters {
  department?: string;
  selectedJobTypes: string[];
  selectedJobStatuses: string[];
}

export function filterCalendarJobsForDate(
  jobs: PreparedCalendarJob[],
  date: Date,
  filters: CalendarJobFilters,
): PreparedCalendarJob[] {
  return jobs.filter((job) => {
    try {
      if (!job.start_time || !job.end_time) {
        console.warn('Invalid date found for job:', job);
        return false;
      }

      const isWithinDuration = isJobOnDate(
        job.start_time,
        job.end_time,
        date,
        job.jobTimezone,
      );
      const matchesDepartment = filters.department
        ? isWithinDuration && job.departmentIds.some((item) => item === filters.department)
        : isWithinDuration;
      const matchesJobType = filters.selectedJobTypes.length === 0
        || filters.selectedJobTypes.includes(job.job_type || '');
      const matchesJobStatus = filters.selectedJobStatuses.length === 0
        || filters.selectedJobStatuses.includes(job.status || '');
      return matchesDepartment && matchesJobType && matchesJobStatus;
    } catch (error) {
      console.error('Error processing job dates:', error, job);
      return false;
    }
  });
}

export function formatCalendarDays(days: Date[]): Array<{ date: Date; formatted: string }> {
  return days.map((date) => ({ date, formatted: format(date, 'yyyy-MM-dd') }));
}

export function collectCalendarJobIds(
  days: Array<{ date: Date }>,
  getJobsForDate: (date: Date) => Array<{ id: string }>,
): string[] {
  const jobIds = new Set<string>();
  days.forEach(({ date }) => {
    getJobsForDate(date).forEach((job) => jobIds.add(job.id));
  });
  return Array.from(jobIds);
}

export function getCalendarExportInterval(
  range: CalendarExportRange,
  currentDate: Date,
): { startDate: Date; endDate: Date } {
  if (range === 'quarter') {
    const startDate = startOfQuarter(addMonths(currentDate, 1));
    return { startDate, endDate: endOfQuarter(addMonths(startDate, 2)) };
  }
  if (range === 'year') {
    return { startDate: startOfYear(currentDate), endDate: endOfYear(currentDate) };
  }
  return { startDate: startOfMonth(currentDate), endDate: endOfMonth(currentDate) };
}
