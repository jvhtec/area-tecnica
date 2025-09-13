import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useStaffingStatus(jobId: string, profileId: string) {
  return useQuery({
    queryKey: ['staffing', jobId, profileId],
    queryFn: async () => {
      console.log('🔍 Fetching staffing status for:', { jobId, profileId })
      
      // Query staffing_requests for this job and technician
      const { data: staffingData } = await supabase
        .from('staffing_requests')
        .select(`
          *,
          staffing_events(*)
        `)
        .eq('job_id', jobId)
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (!staffingData || staffingData.length === 0) {
        console.log('📋 No staffing data found')
        return { availability_status: null, offer_status: null }
      }
      
      // Get the latest status from staffing_events
      const request = staffingData[0]
      const events = request.staffing_events || []
      
      let availability_status = null
      let offer_status = null
      
      // Find the latest availability and offer events
      for (const eventRecord of events) {
        if (eventRecord.event === 'email_sent') {
          availability_status = 'requested'
        }
        if (eventRecord.event === 'clicked_confirm') {
          availability_status = 'confirmed'
        }
        if (eventRecord.event === 'clicked_decline') {
          availability_status = 'declined'
        }
        if (eventRecord.event === 'offer_sent') {
          offer_status = 'sent'
        }
        if (eventRecord.event === 'offer_confirmed') {
          offer_status = 'confirmed'
        }
        if (eventRecord.event === 'offer_declined') {
          offer_status = 'declined'
        }
      }
      
      const result = { availability_status, offer_status }
      console.log('📋 Staffing status result:', result)
      return result
    },
    staleTime: 1_000, // Reduced from 10 seconds to 1 second for faster updates
    refetchOnWindowFocus: true, // Refetch when window becomes focused
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
      qc.invalidateQueries({ queryKey: ['staffing-by-date', vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['assignment-matrix'] })
      qc.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] })
    }
  })
}