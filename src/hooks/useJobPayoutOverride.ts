import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SetPayoutOverrideParams {
  jobId: string;
  enabled: boolean;
  amountEur?: number;
  calculatedTotal: number;
}

interface PayoutOverrideResult {
  success: boolean;
  job_id: string;
  job_title: string;
  job_start_time: string;
  actor_id: string;
  old_override_enabled: boolean;
  old_override_amount_eur: number | null;
  new_override_enabled: boolean;
  new_override_amount_eur: number | null;
  timestamp: string;
}

export function useJobPayoutOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, enabled, amountEur, calculatedTotal }: SetPayoutOverrideParams) => {
      // Call the RPC function to set the override
      const { data, error } = await supabase.rpc('set_job_payout_override', {
        _job_id: jobId,
        _enabled: enabled,
        _amount_eur: enabled ? amountEur : null,
      });

      if (error) {
        throw error;
      }

      const result = data as PayoutOverrideResult;

      // Send notification email if successful
      if (result.success) {
        try {
          const { error: emailError } = await supabase.functions.invoke(
            'send-payout-override-notification',
            {
              body: {
                jobId: result.job_id,
                jobTitle: result.job_title,
                jobStartTime: result.job_start_time,
                actorId: result.actor_id,
                oldOverrideEnabled: result.old_override_enabled,
                oldOverrideAmountEur: result.old_override_amount_eur,
                newOverrideEnabled: result.new_override_enabled,
                newOverrideAmountEur: result.new_override_amount_eur,
                calculatedTotal,
              },
            }
          );

          if (emailError) {
            console.error('[useJobPayoutOverride] Error sending notification email:', emailError);
            // Don't fail the mutation, just log the error
            toast.warning('Override guardado, pero no se pudo enviar el email de notificación');
          }
        } catch (emailErr) {
          console.error('[useJobPayoutOverride] Unexpected error sending notification:', emailErr);
          toast.warning('Override guardado, pero no se pudo enviar el email de notificación');
        }
      }

      return result;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['job-payout-metadata', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', data.job_id] });

      const changeType = !data.old_override_enabled && data.new_override_enabled
        ? 'activado'
        : data.old_override_enabled && !data.new_override_enabled
        ? 'desactivado'
        : 'modificado';

      toast.success(`Override de pago ${changeType} correctamente`);
    },
    onError: (error: Error) => {
      console.error('[useJobPayoutOverride] Error:', error);

      if (error.message.includes('Permission denied')) {
        toast.error('No tienes permiso para modificar el override de pago');
      } else if (error.message.includes('must be a positive number')) {
        toast.error('El monto debe ser un número positivo');
      } else {
        toast.error('Error al guardar el override de pago');
      }
    },
  });
}
