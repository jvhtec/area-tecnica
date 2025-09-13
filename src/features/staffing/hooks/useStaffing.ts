import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useStaffingStatus(jobId: string, profileId: string) {
  return useQuery({
    queryKey: ['staffing', jobId, profileId],
    queryFn: async () => {
      const { data } = await supabase
        .from('assignment_matrix_staffing')
        .select('*')
        .eq('job_id', jobId)
        .eq('profile_id', profileId)
        .maybeSingle()
      return data ?? { availability_status: null, offer_status: null }
    },
    staleTime: 10_000,
    enabled: !!jobId && !!profileId
  })
}

export function useSendStaffingEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { job_id: string, profile_id: string, phase: 'availability'|'offer' }) => {
      console.log('🚀 SENDING STAFFING EMAIL:', {
        payload,
        job_id_type: typeof payload.job_id,
        profile_id_type: typeof payload.profile_id,
        phase_valid: ['availability', 'offer'].includes(payload.phase)
      });
      
      const { data, error } = await supabase.functions.invoke('send-staffing-email', {
        body: payload
      })
      
      console.log('📨 EMAIL RESPONSE:', { data, error });
      
      if (error) {
        console.error('❌ EMAIL ERROR:', error);
        throw new Error(error.message || 'Failed to send email')
      }
      
      if (data?.error) {
        console.error('❌ EMAIL API ERROR:', data);
        throw new Error(data.error || 'Email API returned an error')
      }
      
      console.log('✅ EMAIL SENT SUCCESSFULLY');
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['staffing', vars.job_id, vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['assignment-matrix'] })
      qc.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] })
    }
  })
}