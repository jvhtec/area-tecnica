import React, { useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { useMemoizedMatrix } from '@/hooks/useMemoizedMatrix';

interface MatrixPerformanceWrapperProps {
  children: (props: {
    getAssignment: (technicianId: string, date: Date) => any;
    getAvailability: (technicianId: string, date: Date) => any;
    getJobsForDate: (date: Date) => any[];
  }) => React.ReactNode;
  assignments: any[];
  availability: any[];
  jobs: any[];
  dates: Date[];
}

export const MatrixPerformanceWrapper = ({
  children,
  assignments,
  availability,
  jobs,
  dates
}: MatrixPerformanceWrapperProps) => {
  // Use the memoized matrix hook for optimized lookups
  const { getAssignment, getAvailability, getJobsForDate } = useMemoizedMatrix(
    assignments,
    availability,
    jobs,
    dates
  );

  // Memoize the render function to prevent unnecessary re-renders
  const memoizedChildren = useMemo(() => 
    children({ getAssignment, getAvailability, getJobsForDate }),
    [children, getAssignment, getAvailability, getJobsForDate]
  );

  return <>{memoizedChildren}</>;
};