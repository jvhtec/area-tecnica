import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useStaffingStatus(jobId: string, profileId: string) {
  return useQuery({
    queryKey: ['staffing', jobId, profileId],
    queryFn: async () => {
      console.log('🔍 Fetching staffing status (view) for:', { jobId, profileId })

      // Use the RPC function which reflects the latest statuses
      const { data, error } = await supabase
        .rpc('get_assignment_matrix_staffing')
        .eq('job_id', jobId)
        .eq('profile_id', profileId)
        .maybeSingle()

      if (error) {
        console.warn('⚠️ staffing view error, falling back to null:', error)
      }

      if (!data) {
        return { availability_status: null, offer_status: null }
      }

      // Map DB statuses to UI statuses
      const mapAvailability = (s: string | null) => {
        if (!s) return null
        if (s === 'pending') return 'requested'
        if (s === 'expired') return null
        return s
      }
      const mapOffer = (s: string | null) => {
        if (!s) return null
        if (s === 'pending') return 'sent'
        if (s === 'expired') return null
        return s
      }

      const result = {
        availability_status: mapAvailability(data.availability_status as any),
        offer_status: mapOffer(data.offer_status as any)
      }
      console.log('📋 Staffing status (view) result:', result)
      return result
    },
    staleTime: 1_000,
    refetchOnWindowFocus: true,
    enabled: !!jobId && !!profileId
  })
}

export function useSendStaffingEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { job_id: string, profile_id: string, phase: 'availability'|'offer', role?: string | null, message?: string | null, channel?: 'email' | 'whatsapp', target_date?: string | null, single_day?: boolean, dates?: string[] }) => {
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
      
      console.log('✅ STAFFING REQUEST SENT SUCCESSFULLY');
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['staffing', vars.job_id, vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['staffing-by-date', vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['staffing-matrix'] })
      qc.invalidateQueries({ queryKey: ['assignment-matrix'] })
      qc.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] })
      try { window.dispatchEvent(new CustomEvent('staffing-updated')); } catch {}
      // Fan out push notification (fire-and-forget)
      try {
        const type = vars.phase === 'availability' ? 'staffing.availability.sent' : 'staffing.offer.sent'
        void supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type,
            job_id: vars.job_id,
            recipient_id: vars.profile_id,
            channel: vars.channel || 'email'
          }
        })
      } catch {}
    }
  })
}

export function useCancelStaffingRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { job_id: string, profile_id: string, phase: 'availability'|'offer' }) => {
      const { error } = await supabase
        .from('staffing_requests')
        .update({ status: 'expired' })
        .eq('job_id', payload.job_id)
        .eq('profile_id', payload.profile_id)
        .eq('phase', payload.phase)
        .eq('status', 'pending') // only cancel pending
      if (error) throw error
      // Fire-and-forget notification via same channel used originally
      try {
        supabase.functions.invoke('notify-staffing-cancellation', { body: payload }).catch(() => {})
      } catch {}
      return true
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['staffing', vars.job_id, vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['staffing-by-date', vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['staffing-matrix'] })
      qc.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] })
      try { window.dispatchEvent(new CustomEvent('staffing-updated')); } catch {}
      // Push broadcast: cancellation
      try {
        const type = vars.phase === 'availability' ? 'staffing.availability.cancelled' : 'staffing.offer.cancelled'
        void supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type,
            job_id: vars.job_id,
            recipient_id: vars.profile_id,
          }
        })
      } catch {}
    }
  })
}
