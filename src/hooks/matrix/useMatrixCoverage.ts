import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';

import { queryKeys } from '@/lib/react-query';
import { fetchStaffingSummaryForJobs, MATRIX_STAFFING_SUMMARY_QUERY_SCOPE } from '@/pages/job-assignment-matrix/utils';
import {
  aggregateCoverageByDate,
  aggregateCoverageByDateJob,
  aggregateJobDepartmentCoverage,
  type CoverageByDateDept,
  type CoverageByJobDept,
  type CoverageByDateJobDept,
} from '@/components/matrix/lenses/coverage';

const MADRID_TIMEZONE = 'Europe/Madrid';

interface UseMatrixCoverageArgs {
  dates: Date[];
  jobIds: string[];
  getJobsForDate: (date: Date) => Array<{ id: string }>;
  enabled: boolean;
}

const EMPTY_JOB_COVERAGE: CoverageByJobDept = new Map();
const EMPTY_DATE_COVERAGE: CoverageByDateDept = new Map();
const EMPTY_DATE_JOB_COVERAGE: CoverageByDateJobDept = new Map();

/**
 * Coverage lens data source. Deliberately shares the query key/queryFn with
 * JobAssignmentMatrix's staffing reminder query (same "required roles vs
 * actual assignments, across every department" read) so the two features
 * read from one React Query cache entry instead of double-fetching.
 */
export const useMatrixCoverage = ({ dates, jobIds, getJobsForDate, enabled }: UseMatrixCoverageArgs) => {
  const jobIdsKey = useMemo(() => (jobIds.length ? jobIds.slice().sort().join(',') : 'none'), [jobIds]);

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.scope(MATRIX_STAFFING_SUMMARY_QUERY_SCOPE, jobIdsKey),
    queryFn: () => fetchStaffingSummaryForJobs(jobIds),
    enabled: enabled && jobIds.length > 0,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const coverageByJob = useMemo<CoverageByJobDept>(() => {
    if (!enabled || !data) return EMPTY_JOB_COVERAGE;
    const scheduledPairs = new Set(data.scheduled.map((row) => `${row.job_id}:${row.technician_id}`));
    return aggregateJobDepartmentCoverage(data.summaries, data.assignments, scheduledPairs);
  }, [enabled, data]);

  const coverageByDateJob = useMemo<CoverageByDateJobDept>(() => {
    if (!enabled || !data) return EMPTY_DATE_JOB_COVERAGE;
    const dateKeys = dates.map((date) => formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd'));
    const jobsByDateKey = new Map<string, Array<{ id: string }>>();
    dates.forEach((date, idx) => {
      jobsByDateKey.set(dateKeys[idx], getJobsForDate(date));
    });

    return aggregateCoverageByDateJob(
      dateKeys,
      (key) => jobsByDateKey.get(key) || [],
      data.summaries,
      data.assignments,
      data.scheduled,
    );
  }, [enabled, dates, getJobsForDate, data]);

  const coverageByDate = useMemo<CoverageByDateDept>(() => {
    if (!enabled || coverageByDateJob.size === 0) return EMPTY_DATE_COVERAGE;
    const dateKeys = dates.map((date) => formatInTimeZone(date, MADRID_TIMEZONE, 'yyyy-MM-dd'));
    const jobsByDateKey = new Map<string, Array<{ id: string }>>();
    dates.forEach((date, idx) => jobsByDateKey.set(dateKeys[idx], getJobsForDate(date)));
    return aggregateCoverageByDate(dateKeys, (key) => jobsByDateKey.get(key) || [], coverageByDateJob);
  }, [enabled, dates, getJobsForDate, coverageByDateJob]);

  return { coverageByJob, coverageByDateJob, coverageByDate, isFetching };
};
