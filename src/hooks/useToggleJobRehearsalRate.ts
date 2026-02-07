import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { createEntityQueryOptions, optimizedInvalidation } from '@/lib/react-query';
import { toast } from 'sonner';

type RehearsalDateRow = Tables<'job_rehearsal_dates'>;

interface UseJobRehearsalDatesOptions {
  enabled?: boolean;
}

/**
 * Fetches the set of dates marked as rehearsal for a given job.
 */
export function useJobRehearsalDates(jobId: string, options: UseJobRehearsalDatesOptions = {}) {
  const { enabled = true } = options;

  return useQuery(
    createEntityQueryOptions<RehearsalDateRow[]>(
      'job-rehearsal-dates',
      jobId,
      {
        enabled: !!jobId && enabled,
        queryFn: async (): Promise<RehearsalDateRow[]> => {
          const { data, error } = await supabase
            .from('job_rehearsal_dates')
            .select('id, job_id, date')
            .eq('job_id', jobId);
          if (error) throw error;
          return (data || []) as RehearsalDateRow[];
        },
        staleTime: 30_000,
      }
    )
  );
}

interface ToggleDateRehearsalParams {
  jobId: string;
  date: string;        // ISO date string (yyyy-MM-dd)
  enabled: boolean;
}

const invalidateRehearsalRateQueries = (queryClient: QueryClient, jobId: string) => {
  optimizedInvalidation.invalidateQueryKeys(queryClient, [
    ['job-rehearsal-dates', jobId],
    ['job-tech-payout', jobId],
    ['job-tech-days', jobId],
    ['manager-job-quotes', jobId],
    ['timesheets'],
    ['job-tech-payout', jobId, 'tour-timesheet-data'],
  ]);
};

/**
 * Recalculates timesheet amounts for multiple timesheets.
 * Uses Promise.allSettled to attempt all recalculations even if some fail.
 * @returns The number of successfully recalculated timesheets
 * @throws Error if any recalculations fail
 */
async function recalculateTimesheets(timesheetIds: string[]): Promise<number> {
  if (timesheetIds.length === 0) return 0;

  const results = await Promise.allSettled(
    timesheetIds.map((id) =>
      supabase.rpc('compute_timesheet_amount_2025', {
        _timesheet_id: id,
        _persist: true,
      })
    )
  );

  // Check for any failures (rejected promises or RPC errors)
  const failures = results.filter((r) => r.status === 'rejected');
  const rpcErrors = results.filter(
    (r) => r.status === 'fulfilled' && r.value.error != null
  );

  if (failures.length > 0 || rpcErrors.length > 0) {
    const totalErrors = failures.length + rpcErrors.length;
    throw new Error(
      `Failed to recalculate ${totalErrors} of ${timesheetIds.length} timesheet(s)`
    );
  }

  return timesheetIds.length;
}

/**
 * Toggles rehearsal rate for a single date on a job.
 * Inserts or deletes from job_rehearsal_dates and recalculates affected timesheets.
 */
export function useToggleDateRehearsalRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, date, enabled }: ToggleDateRehearsalParams) => {
      if (enabled) {
        // Insert the date (upsert-safe via unique constraint)
        const { error } = await supabase
          .from('job_rehearsal_dates')
          .insert({ job_id: jobId, date });
        if (error && error.code !== '23505') throw error; // ignore duplicate
      } else {
        const { error } = await supabase
          .from('job_rehearsal_dates')
          .delete()
          .eq('job_id', jobId)
          .eq('date', date);
        if (error) throw error;
      }

      // Recalculate timesheets for this job + date
      const { data: timesheets, error: tsError } = await supabase
        .from('timesheets')
        .select('id')
        .eq('job_id', jobId)
        .eq('date', date)
        .eq('is_active', true);
      if (tsError) throw tsError;

      const recalculated = await recalculateTimesheets(
        timesheets?.map((ts) => ts.id) ?? []
      );

      return { jobId, date, enabled, recalculated };
    },
    onSuccess: (result) => {
      invalidateRehearsalRateQueries(queryClient, result.jobId);
    },
    onError: (error) => {
      console.error('[useToggleDateRehearsalRate] Error:', error);
      toast.error('No se pudo cambiar la tarifa de ensayo para esta fecha');
    },
  });
}

interface ToggleAllDatesRehearsalParams {
  jobId: string;
  dates: string[];     // All date strings to toggle
  enabled: boolean;
}

/**
 * Toggles rehearsal rate for ALL dates of a job at once.
 */
export function useToggleAllDatesRehearsalRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, dates, enabled }: ToggleAllDatesRehearsalParams) => {
      if (dates.length === 0) return { jobId, enabled, recalculated: 0 };

      if (enabled) {
        // Insert all dates (ignore duplicates)
        const rows = dates.map(date => ({ job_id: jobId, date }));
        const { error } = await supabase
          .from('job_rehearsal_dates')
          .upsert(rows, { onConflict: 'job_id,date', ignoreDuplicates: true });
        if (error) throw error;
      } else {
        // Delete all dates for this job
        const { error } = await supabase
          .from('job_rehearsal_dates')
          .delete()
          .eq('job_id', jobId);
        if (error) throw error;
      }

      // Recalculate all timesheets for this job
      const { data: timesheets, error: tsError } = await supabase
        .from('timesheets')
        .select('id')
        .eq('job_id', jobId)
        .eq('is_active', true);
      if (tsError) throw tsError;

      const recalculated = await recalculateTimesheets(
        timesheets?.map((ts) => ts.id) ?? []
      );

      return { jobId, enabled, recalculated };
    },
    onSuccess: (result) => {
      invalidateRehearsalRateQueries(queryClient, result.jobId);

      toast.success(
        result.enabled
          ? 'Tarifa de ensayo activada para todas las fechas'
          : 'Tarifa de ensayo desactivada para todas las fechas',
        { description: `${result.recalculated} partes recalculados` }
      );
    },
    onError: (error) => {
      console.error('[useToggleAllDatesRehearsalRate] Error:', error);
      toast.error('No se pudo cambiar la tarifa de ensayo');
    },
  });
}
