import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { RATES_QUERY_KEYS } from '@/constants/ratesQueryKeys';
import { queryKeys } from '@/lib/react-query';
import { setJobPreventiveResource } from '@/services/preventiveResourceService';

export function useSetPreventiveResource(jobId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (technicianId: string | null) => setJobPreventiveResource(jobId, technicianId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('job-details', jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('job-extras', jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('job-tech-payout', jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-job-rate-quotes') });
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('technician-tour-rate-quotes') });
      queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.approvals });

      if (!result.technician_id) {
        toast.success('Recurso preventivo eliminado');
        return;
      }

      if (result.email_sent) {
        toast.success('Recurso preventivo asignado y email enviado');
        return;
      }

      toast.warning('Recurso preventivo asignado, pero el email no se pudo enviar');
    },
    onError: (error) => {
      console.error('Failed to update preventive resource', error);
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el recurso preventivo');
    },
  });
}
