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

interface SubmitJobExtraPayload {
  jobId: string;
  technicianId: string;
  extraType: JobExtraType;
  approvedQuantity: number;
  requestedQuantity: number;
  hasExistingRow: boolean;
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
    mutationFn: async ({
      jobId,
      technicianId,
      extraType,
      approvedQuantity,
      requestedQuantity,
      hasExistingRow,
    }: SubmitJobExtraPayload) => {
      const { data: auth } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const hasChange = approvedQuantity !== requestedQuantity;

      if (!hasChange) {
        if (!hasExistingRow) {
          return {
            job_id: jobId,
            technician_id: technicianId,
            extra_type: extraType,
            quantity: approvedQuantity,
            pending_quantity: null,
            status: 'approved',
            updated_at: now,
          } as unknown as JobExtra;
        }

        // No difference; clear pending state if present but avoid creating empty rows
        const { data, error } = await supabase
          .from('job_rate_extras')
          .upsert({
            job_id: jobId,
            technician_id: technicianId,
            extra_type: extraType,
            quantity: approvedQuantity,
            pending_quantity: null,
            status: 'approved',
            rejection_reason: null,
            updated_at: now,
            updated_by: auth.user?.id ?? null,
          })
          .select()
          .single();

        if (error) throw error;
        return data as JobExtra;
      }

      const { data, error } = await supabase
        .from('job_rate_extras')
        .upsert({
          job_id: jobId,
          technician_id: technicianId,
          extra_type: extraType,
          quantity: approvedQuantity,
          pending_quantity: requestedQuantity,
          status: 'pending',
          submitted_by: auth.user?.id ?? null,
          submitted_at: now,
          rejection_reason: null,
          updated_at: now,
          updated_by: auth.user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as JobExtra;
    },
    onSuccess: (data) => {
      invalidateJobExtrasContext(queryClient, data.job_id);
      toast.success('Extra change submitted for approval');
    },
    onError: (error) => {
      console.error('Error updating job extras:', error);
      toast.error('Failed to submit extra change');
    },
  });
}

interface ReviewJobExtraPayload {
  jobId: string;
  technicianId: string;
  extraType: JobExtraType;
  reason?: string;
}

export function useReviewJobExtra() {
  const queryClient = useQueryClient();

  const approve = useMutation({
    mutationFn: async ({ jobId, technicianId, extraType }: Omit<ReviewJobExtraPayload, 'reason'>) => {
      const { data: existing, error: fetchError } = await supabase
        .from('job_rate_extras')
        .select('pending_quantity, quantity')
        .eq('job_id', jobId)
        .eq('technician_id', technicianId)
        .eq('extra_type', extraType)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!existing) throw new Error('Extra not found');

      const pendingQuantity = existing.pending_quantity;
      const newQuantity = pendingQuantity ?? existing.quantity ?? 0;

      const { data: auth } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('job_rate_extras')
        .update({
          quantity: newQuantity,
          pending_quantity: null,
          status: 'approved',
          approved_at: now,
          approved_by: auth.user?.id ?? null,
          rejection_reason: null,
          updated_at: now,
          updated_by: auth.user?.id ?? null,
        })
        .eq('job_id', jobId)
        .eq('technician_id', technicianId)
        .eq('extra_type', extraType);

      if (updateError) throw updateError;

      if (!newQuantity || newQuantity <= 0) {
        await supabase
          .from('job_rate_extras')
          .delete()
          .eq('job_id', jobId)
          .eq('technician_id', technicianId)
          .eq('extra_type', extraType);
      }

      return { job_id: jobId };
    },
    onSuccess: (data) => {
      invalidateJobExtrasContext(queryClient, data.job_id);
      toast.success('Extra approved');
    },
    onError: (error) => {
      console.error('Error approving job extra:', error);
      toast.error('Failed to approve extra');
    },
  });

  const reject = useMutation({
    mutationFn: async ({ jobId, technicianId, extraType, reason }: ReviewJobExtraPayload) => {
      const { data: auth } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('job_rate_extras')
        .update({
          pending_quantity: null,
          status: 'rejected',
          rejection_reason: reason ?? null,
          approved_at: null,
          approved_by: null,
          updated_at: now,
          updated_by: auth.user?.id ?? null,
        })
        .eq('job_id', jobId)
        .eq('technician_id', technicianId)
        .eq('extra_type', extraType);

      if (error) throw error;

      return { job_id: jobId };
    },
    onSuccess: (data) => {
      invalidateJobExtrasContext(queryClient, data.job_id);
      toast.success('Extra rejected');
    },
    onError: (error) => {
      console.error('Error rejecting job extra:', error);
      toast.error('Failed to reject extra');
    },
  });

  return { approve, reject };
}