
import { useState, useEffect, useMemo } from 'react';
import { useJobs } from './useJobs';
import { eachDayOfInterval, format, isWithinInterval } from 'date-fns';
import { useDateRange } from '@/context/DateRangeContext';
import { Department } from '@/types/department';
import { getStartOfDay, getEndOfDay } from '@/lib/date-utils';

export interface CalendarDay {
  date: Date;
  jobs: any[];
  isToday: boolean;
  isInCurrentMonth: boolean;
}

/**
 * Custom hook for efficiently loading and organizing calendar data
 * with date range support and department filtering
 */
export function useCalendarData(department?: Department) {
  const { startDate, endDate } = useDateRange();
  const { data: allJobs = [], isLoading } = useJobs();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Filter jobs for the department
  const filteredJobs = useMemo(() => {
    if (!allJobs) return [];
    
    // If no department specified, return all jobs
    if (!department) return allJobs;
    
    // Filter by department
    return allJobs.filter((job) => {
      const departments = job.job_departments?.map((dep: any) => dep.department) || [];
      return departments.includes(department);
    });
  }, [allJobs, department]);

  // Generate days for the date range with associated jobs
  const calendarDays = useMemo(() => {
    setIsProcessing(true);
    
    try {
      if (!startDate || !endDate) return [];
      
      const today = getStartOfDay(new Date());
      const currentMonth = new Date().getMonth();
      
      // Generate all days in the range
      const daysInRange = eachDayOfInterval({ start: startDate, end: endDate });
      
      // Create calendar day objects with jobs
      const days: CalendarDay[] = daysInRange.map(date => {
        const dayStart = getStartOfDay(date);
        const dayEnd = getEndOfDay(date);
        const formattedDate = format(date, 'yyyy-MM-dd');
        
        // Find jobs for this day with efficient filtering
        const dayJobs = filteredJobs.filter(job => {
          const jobStart = new Date(job.start_time);
          const jobEnd = new Date(job.end_time);
          
          return isWithinInterval(dayStart, {
            start: getStartOfDay(jobStart),
            end: getEndOfDay(jobEnd)
          }) || isWithinInterval(dayEnd, {
            start: getStartOfDay(jobStart),
            end: getEndOfDay(jobEnd)
          });
        });
        
        // Create day object
        return {
          date,
          jobs: dayJobs,
          isToday: format(today, 'yyyy-MM-dd') === formattedDate,
          isInCurrentMonth: date.getMonth() === currentMonth
        };
      });
      
      return days;
    } catch (error) {
      console.error("Error processing calendar data:", error);
      return [];
    } finally {
      setIsProcessing(false);
    }
  }, [startDate, endDate, filteredJobs]);
  
  return {
    calendarDays,
    isLoading: isLoading || isProcessing,
    allJobs: filteredJobs
  };
}
