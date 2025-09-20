import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { JobExtra, JobExtraType } from '@/types/jobExtras';
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

export function useUpsertJobExtra() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (extra: Omit<JobExtra, 'updated_at'>) => {
      const { data, error } = await supabase
        .from('job_rate_extras')
        .upsert({
          ...extra,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ 
        queryKey: ['job-extras', data.job_id] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tour-job-rate-quotes'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['technician-tour-rate-quotes'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['job-tech-payout', data.job_id] 
      });
      
      toast.success('Job extras updated successfully');
    },
    onError: (error) => {
      console.error('Error updating job extras:', error);
      toast.error('Failed to update job extras');
    },
  });
}

export function useDeleteJobExtra() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      jobId,
      technicianId,
      extraType,
    }: {
      jobId: string;
      technicianId: string;
      extraType: JobExtraType;
    }) => {
      const { error } = await supabase
        .from('job_rate_extras')
        .delete()
        .eq('job_id', jobId)
        .eq('technician_id', technicianId)
        .eq('extra_type', extraType);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ 
        queryKey: ['job-extras', variables.jobId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['tour-job-rate-quotes'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['technician-tour-rate-quotes'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['job-tech-payout', variables.jobId] 
      });
      
      toast.success('Job extra removed successfully');
    },
    onError: (error) => {
      console.error('Error removing job extra:', error);
      toast.error('Failed to remove job extra');
    },
  });
}