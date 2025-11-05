import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { JobExtra, JobExtraType } from '@/types/jobExtras';
import { RATES_QUERY_KEYS } from '@/constants/ratesQueryKeys';
import { toast } from 'sonner';

export function useJobExtras(jobId: string, technicianId?: string) {
  return useQuery({
    queryKey: ['job-extras', jobId, technicianId],
    queryFn: async (): Promise<JobExtra[]> => {
      let query = supabase
        .from('job_rate_extras')
        .select('*')
        .eq('job_id', jobId);
      
      if (technicianId) {
        query = query.eq('technician_id', technicianId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

interface UpsertJobExtraPayload {
  jobId: string;
  technicianId: string;
  extraType: JobExtraType;
  quantity: number;
  amountOverrideEur?: number;
}

const invalidateJobExtrasContext = (queryClient: ReturnType<typeof useQueryClient>, jobId: string) => {
  queryClient.invalidateQueries({ queryKey: ['job-extras', jobId] });
  queryClient.invalidateQueries({ queryKey: ['tour-job-rate-quotes'] });
  queryClient.invalidateQueries({ queryKey: ['technician-tour-rate-quotes'] });
  queryClient.invalidateQueries({ queryKey: ['job-tech-payout', jobId] });
  queryClient.invalidateQueries({ queryKey: ['job-approval-status', jobId] });
  queryClient.invalidateQueries({ queryKey: RATES_QUERY_KEYS.approvals });
};

export function useUpsertJobExtra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, technicianId, extraType, quantity, amountOverrideEur }: UpsertJobExtraPayload) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) throw new Error('Not authenticated');

      const now = new Date().toISOString();

      // If quantity is 0, delete the row instead of upserting
      if (quantity === 0) {
        const { error } = await supabase
          .from('job_rate_extras')
          .delete()
          .eq('job_id', jobId)
          .eq('technician_id', technicianId)
          .eq('extra_type', extraType);

        if (error) throw error;

        return {
          job_id: jobId,
          technician_id: technicianId,
          extra_type: extraType,
          quantity: 0,
          status: 'approved',
          updated_at: now,
        } as JobExtra;
      }

      // Simple direct upsert - managers set quantities directly, no approval workflow
      const { data, error } = await supabase
        .from('job_rate_extras')
        .upsert({
          job_id: jobId,
          technician_id: technicianId,
          extra_type: extraType,
          quantity: quantity,
          amount_override_eur: amountOverrideEur,
          status: 'approved', // Always approved since managers set directly
          updated_by: auth.user.id,
          updated_at: now,
        })
        .select()
        .single();

      if (error) throw error;
      return data as JobExtra;
    },
    onSuccess: (data) => {
      invalidateJobExtrasContext(queryClient, data.job_id);
      toast.success('Extra saved successfully');
    },
    onError: (error) => {
      console.error('Error saving job extra:', error);
      toast.error('Failed to save extra');
    },
  });
}