import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SetTechnicianPayoutOverrideParams {
  jobId: string;
  technicianId: string;
  amountEur: number;
  technicianName: string;
  calculatedTotal: number;
}

interface RemoveTechnicianPayoutOverrideParams {
  jobId: string;
  technicianId: string;
  technicianName: string;
}

interface TechnicianPayoutOverrideResult {
  success: boolean;
  job_id: string;
  job_title: string;
  job_start_time: string;
  technician_id: string;
  technician_name: string;
  technician_department: string;
  actor_id: string;
  old_override_amount_eur: number | null;
  new_override_amount_eur: number | null;
  calculated_total_eur: number;
  timestamp: string;
}

/**
 * Creates a mutation that sets a technician's payout override for a job, triggers a silent notification on success, and refreshes related job payout data.
 *
 * On successful mutation the hook invalidates related job payout queries and shows a success toast; on failure it logs the error and shows localized error toasts.
 *
 * @returns A React Query mutation object that accepts `SetTechnicianPayoutOverrideParams` and resolves to `TechnicianPayoutOverrideResult`.
 */
export function useSetTechnicianPayoutOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, technicianId, amountEur, calculatedTotal }: SetTechnicianPayoutOverrideParams) => {
      // Call the RPC function to set the override
      const { data, error } = await supabase.rpc('set_technician_payout_override', {
        _job_id: jobId,
        _technician_id: technicianId,
        _amount_eur: amountEur,
      });

      if (error) {
        throw error;
      }

      const result = data as TechnicianPayoutOverrideResult;

      // Send notification email if successful (silently, no user notifications)
      if (result.success) {
        try {
          const { error: emailError } = await supabase.functions.invoke(
            'send-payout-override-notification',
            {
              body: {
                jobId: result.job_id,
                jobTitle: result.job_title,
                jobStartTime: result.job_start_time,
                technicianId: result.technician_id,
                technicianName: result.technician_name,
                technicianDepartment: result.technician_department,
                actorId: result.actor_id,
                oldOverrideAmountEur: result.old_override_amount_eur,
                newOverrideAmountEur: result.new_override_amount_eur,
                calculatedTotal: result.calculated_total_eur,
              },
            }
          );

          if (emailError) {
            console.error('[useSetTechnicianPayoutOverride] Error sending notification email:', emailError);
            // Don't fail the mutation or show user notification, just log the error
          }
        } catch (emailErr) {
          console.error('[useSetTechnicianPayoutOverride] Unexpected error sending notification:', emailErr);
          // Don't fail the mutation or show user notification, just log the error
        }
      }

      return result;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout-overrides', data.job_id] });

      const changeType = data.old_override_amount_eur === null ? 'activado' : 'modificado';
      toast.success(`Override de pago ${changeType} para ${data.technician_name}`);
    },
    onError: (error: Error) => {
      console.error('[useSetTechnicianPayoutOverride] Error:', error);

      if (error.message.includes('Permission denied')) {
        toast.error('No tienes permiso para modificar el override de este técnico');
      } else if (error.message.includes('must be a positive number')) {
        toast.error('El monto debe ser un número positivo');
      } else if (error.message.includes('not assigned to this job')) {
        toast.error('Este técnico no está asignado a este trabajo');
      } else {
        toast.error('Error al guardar el override de pago');
      }
    },
  });
}

/**
 * Creates a React Query mutation that removes a technician's payout override for a specific job.
 *
 * On success the mutation invalidates job payout queries, shows a success toast, and (silently) invokes a notification function; notification failures are logged but do not fail the mutation.
 *
 * @returns A mutation object whose mutate/mutateAsync function accepts `{ jobId, technicianId }` and resolves to a `TechnicianPayoutOverrideResult` describing the outcome of the removal.
 */
export function useRemoveTechnicianPayoutOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, technicianId }: RemoveTechnicianPayoutOverrideParams) => {
      const { data, error } = await supabase.rpc('remove_technician_payout_override', {
        _job_id: jobId,
        _technician_id: technicianId,
      });

      if (error) {
        throw error;
      }

      const result = data as TechnicianPayoutOverrideResult;

      // Send notification email if successful (silently, no user notifications)
      if (result.success) {
        try {
          const { error: emailError } = await supabase.functions.invoke('send-payout-override-notification', {
            body: {
              jobId: result.job_id,
              jobTitle: result.job_title,
              jobStartTime: result.job_start_time,
              technicianId: result.technician_id,
              technicianName: result.technician_name,
              technicianDepartment: result.technician_department,
              actorId: result.actor_id,
              oldOverrideAmountEur: result.old_override_amount_eur,
              newOverrideAmountEur: null,
              calculatedTotal: result.calculated_total_eur,
            },
          });

          if (emailError) {
            console.error('[useRemoveTechnicianPayoutOverride] Error sending notification email:', emailError);
            // Don't fail the mutation or show user notification, just log the error
          }
        } catch (emailErr) {
          console.error('[useRemoveTechnicianPayoutOverride] Unexpected error sending notification:', emailErr);
          // Don't fail the mutation or show user notification, just log the error
        }
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout-overrides', data.job_id] });
      toast.success(`Override removido para ${data.technician_name}`);
    },
    onError: (error: Error) => {
      console.error('[useRemoveTechnicianPayoutOverride] Error:', error);
      toast.error('Error al remover el override de pago');
    },
  });
}

/**
 * Fetches technician payout override records for a specific job.
 *
 * @param jobId - The job identifier to fetch overrides for
 * @returns A React Query result whose `data` is an array of override records with fields: `job_id`, `technician_id`, `override_amount_eur`, `set_by`, `set_at`, and `updated_at`
 */
export function useJobTechnicianPayoutOverrides(jobId: string) {
  return useQuery({
    queryKey: ['job-tech-payout-overrides', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_technician_payout_overrides')
        .select('*')
        .eq('job_id', jobId);

      if (error) throw error;

      return (data || []) as Array<{
        job_id: string;
        technician_id: string;
        override_amount_eur: number;
        set_by: string;
        set_at: string;
        updated_at: string;
      }>;
    },
    enabled: !!jobId,
    staleTime: 30_000,
  });
}