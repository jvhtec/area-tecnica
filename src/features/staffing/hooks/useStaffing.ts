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
      const { data, error } = await supabase.functions.invoke('send-staffing-email', {
        body: payload
      })
      
      if (error) {
        throw new Error(error.message || 'Failed to send email')
      }
      
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['staffing', vars.job_id, vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['assignment-matrix'] })
      qc.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] })
    }
  })
}