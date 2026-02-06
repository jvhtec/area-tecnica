import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RehearsalDateRow {
  id: string;
  job_id: string;
  date: string;
}

/**
 * Fetches the set of dates marked as rehearsal for a given job.
 */
export function useJobRehearsalDates(jobId: string) {
  return useQuery({
    queryKey: ['job-rehearsal-dates', jobId],
    enabled: !!jobId,
    queryFn: async (): Promise<RehearsalDateRow[]> => {
      const { data, error } = await supabase
        .from('job_rehearsal_dates')
        .select('id, job_id, date')
        .eq('job_id', jobId);
      if (error) throw error;
      return (data || []) as RehearsalDateRow[];
    },
    staleTime: 30_000,
  });
}

interface ToggleDateRehearsalParams {
  jobId: string;
  date: string;        // ISO date string (yyyy-MM-dd)
  enabled: boolean;
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

      if (timesheets && timesheets.length > 0) {
        await Promise.allSettled(
          timesheets.map(ts =>
            supabase.rpc('compute_timesheet_amount_2025', {
              _timesheet_id: ts.id,
              _persist: true,
            })
          )
        );
      }

      return { jobId, date, enabled, recalculated: timesheets?.length ?? 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['job-rehearsal-dates', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-days', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['manager-job-quotes', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', result.jobId, 'tour-timesheet-data'] });
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

      if (timesheets && timesheets.length > 0) {
        await Promise.allSettled(
          timesheets.map(ts =>
            supabase.rpc('compute_timesheet_amount_2025', {
              _timesheet_id: ts.id,
              _persist: true,
            })
          )
        );
      }

      return { jobId, enabled, recalculated: timesheets?.length ?? 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['job-rehearsal-dates', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-days', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['manager-job-quotes', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', result.jobId, 'tour-timesheet-data'] });

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
