import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateJobAssignmentMultiplierOverride } from '@/lib/supabase/queries/jobAssignments';
import { toast } from 'sonner';

interface UpdateMultiplierOverrideParams {
  jobId: string;
  technicianId: string;
  useTourMultipliers: boolean;
}

/**
 * Hook to update the tour multiplier override flag for a job assignment
 * Forces tour multiplier calculation even if tech is not in tour_assignments table
 */
export function useUpdateMultiplierOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, technicianId, useTourMultipliers }: UpdateMultiplierOverrideParams) =>
      updateJobAssignmentMultiplierOverride(jobId, technicianId, useTourMultipliers),

    onSuccess: (data, variables) => {
      // Invalidate all rate quote queries to trigger recalculation
      queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['technician-tour-rate-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['manager-job-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['job-tech-payout'] });

      // Show success message
      toast.success(
        variables.useTourMultipliers
          ? 'Multiplicadores tour activados'
          : 'Multiplicadores tour desactivados'
      );
    },

    onError: (error) => {
      console.error('Failed to update multiplier override:', error);
      toast.error('Error al actualizar multiplicadores');
    },
  });
}
