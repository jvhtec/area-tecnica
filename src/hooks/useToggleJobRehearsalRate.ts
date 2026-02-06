import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ToggleRehearsalRateParams {
  jobId: string;
  enabled: boolean;
}

/**
 * Toggles the use_rehearsal_rate flag on a job and recalculates all timesheets.
 * After toggling, it persists the new timesheet amounts via compute_timesheet_amount_2025.
 */
export function useToggleJobRehearsalRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, enabled }: ToggleRehearsalRateParams) => {
      // 1. Update the job flag
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ use_rehearsal_rate: enabled })
        .eq('id', jobId);

      if (updateError) throw updateError;

      // 2. Fetch all active timesheets for this job
      const { data: timesheets, error: tsError } = await supabase
        .from('timesheets')
        .select('id')
        .eq('job_id', jobId)
        .eq('is_active', true);

      if (tsError) throw tsError;

      // 3. Recalculate each timesheet with the new flag
      if (timesheets && timesheets.length > 0) {
        const results = await Promise.allSettled(
          timesheets.map(ts =>
            supabase.rpc('compute_timesheet_amount_2025', {
              _timesheet_id: ts.id,
              _persist: true,
            })
          )
        );

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
          console.warn(
            `[useToggleJobRehearsalRate] ${failures.length}/${timesheets.length} timesheet recalculations failed`
          );
        }
      }

      return { jobId, enabled, timesheetsRecalculated: timesheets?.length ?? 0 };
    },
    onSuccess: (result) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['job-payout-metadata', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-days', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['manager-job-quotes', result.jobId] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });

      toast.success(
        result.enabled
          ? 'Tarifa de ensayo activada'
          : 'Tarifa de ensayo desactivada',
        {
          description: `${result.timesheetsRecalculated} partes recalculados`,
        }
      );
    },
    onError: (error) => {
      console.error('[useToggleJobRehearsalRate] Error:', error);
      toast.error('No se pudo cambiar la tarifa de ensayo');
    },
  });
}
