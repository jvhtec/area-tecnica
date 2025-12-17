import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useToggleTechnicianPayoutApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      jobId,
      technicianId,
      approved,
    }: {
      jobId: string;
      technicianId: string;
      approved: boolean;
    }) => {
      const { error } = await supabase
        .from('timesheets')
        .update({ approved_by_manager: approved })
        .eq('job_id', jobId)
        .eq('technician_id', technicianId);

      if (error) throw error;
    },
    onSuccess: (_, { jobId, technicianId }) => {
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout', jobId, technicianId] });
      toast.success('Estado de aprobación actualizado');
    },
    onError: (error) => {
      console.error('Error updating approval:', error);
      toast.error('Error al actualizar la aprobación');
    },
  });
}
