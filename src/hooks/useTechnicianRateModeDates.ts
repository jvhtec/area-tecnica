import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { createEntityQueryOptions } from '@/lib/react-query';
import { toast } from 'sonner';
import { invalidateRehearsalRateQueries, recalculateTimesheets } from '@/hooks/useToggleJobRehearsalRate';

export type TechnicianDateRateMode = 'inherit' | 'rehearsal' | 'standard';

type TechnicianRateModeRow = Tables<'job_technician_rate_mode_dates'>;

interface UseJobTechnicianRateModeDatesOptions {
  enabled?: boolean;
}

export function useJobTechnicianRateModeDates(
  jobId: string,
  options: UseJobTechnicianRateModeDatesOptions = {},
) {
  const { enabled = true } = options;

  return useQuery(
    createEntityQueryOptions<TechnicianRateModeRow[]>(
      'job-technician-rate-mode-dates',
      jobId,
      {
        enabled: !!jobId && enabled,
        queryFn: async (): Promise<TechnicianRateModeRow[]> => {
          const { data, error } = await supabase
            .from('job_technician_rate_mode_dates')
            .select('job_id, technician_id, date, use_rehearsal_rate, created_at, created_by, updated_at, updated_by')
            .eq('job_id', jobId);

          if (error) throw error;
          return (data || []) as TechnicianRateModeRow[];
        },
        staleTime: 30_000,
      },
    ),
  );
}

interface SetTechnicianDateRateModeParams {
  jobId: string;
  technicianId: string;
  date: string;
  mode: TechnicianDateRateMode;
}

export function useSetTechnicianDateRateMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, technicianId, date, mode }: SetTechnicianDateRateModeParams) => {
      if (mode === 'inherit') {
        const { error } = await supabase
          .from('job_technician_rate_mode_dates')
          .delete()
          .eq('job_id', jobId)
          .eq('technician_id', technicianId)
          .eq('date', date);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('job_technician_rate_mode_dates')
          .upsert(
            {
              job_id: jobId,
              technician_id: technicianId,
              date,
              use_rehearsal_rate: mode === 'rehearsal',
            },
            { onConflict: 'job_id,technician_id,date' },
          );

        if (error) throw error;
      }

      const { data: timesheets, error: timesheetError } = await supabase
        .from('timesheets')
        .select('id')
        .eq('job_id', jobId)
        .eq('technician_id', technicianId)
        .eq('date', date)
        .eq('is_active', true);

      if (timesheetError) throw timesheetError;

      const recalculated = await recalculateTimesheets(
        timesheets?.map((timesheet) => timesheet.id) ?? [],
      );

      return { jobId, technicianId, date, mode, recalculated };
    },
    onSuccess: (result) => {
      invalidateRehearsalRateQueries(queryClient, result.jobId);
      queryClient.invalidateQueries({ queryKey: ['job-technician-rate-mode-dates', result.jobId] });
    },
    onError: (error) => {
      console.error('[useSetTechnicianDateRateMode] Error:', error);
      toast.error('No se pudo actualizar la tarifa por técnico para esta fecha');
    },
  });
}
