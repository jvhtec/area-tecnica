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

// Custom error type for conflicts
export class ConflictError extends Error {
  constructor(message: string, public details: any) {
    super(message);
    this.name = 'ConflictError';
  }
}

export function useSendStaffingEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { job_id: string, profile_id: string, phase: 'availability'|'offer', role?: string | null, message?: string | null, channel?: 'email' | 'whatsapp', target_date?: string | null, single_day?: boolean, dates?: string[], override_conflicts?: boolean }) => {
      console.log('🚀 SENDING STAFFING EMAIL:', {
        payload,
        job_id_type: typeof payload.job_id,
        profile_id_type: typeof payload.profile_id,
        phase_valid: ['availability', 'offer'].includes(payload.phase)
      });

      // Use fetch directly to get full control over error responses
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      // Get Supabase URL and construct functions URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/send-staffing-email`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      console.log('📨 EMAIL RESPONSE:', { status: response.status, data });

      // Check for 409 Conflict with structured error details
      if (response.status === 409) {
        console.error('❌ 409 CONFLICT:', data);
        if (data.details?.conflict_type || data.details?.conflicts || data.details?.unavailability) {
          throw new ConflictError(data.error || 'Conflict detected', data.details);
        }
      }

      // Check for other errors
      if (!response.ok) {
        console.error('❌ HTTP ERROR:', { status: response.status, data });
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      if (data?.error) {
        console.error('❌ API ERROR:', data);
        throw new Error(data.error)
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
      console.log('🔴 CANCEL STAFFING: Starting cancellation', payload)

      // First, check what records exist for this combination
      const { data: existingRecords } = await supabase
        .from('staffing_requests')
        .select('id, status, single_day, target_date')
        .eq('job_id', payload.job_id)
        .eq('profile_id', payload.profile_id)
        .eq('phase', payload.phase)

      console.log('🔴 CANCEL STAFFING: Existing records', existingRecords)

      // Cancel ALL non-expired records (not just pending) to ensure cell clears
      const { data, error, count } = await supabase
        .from('staffing_requests')
        .update({ status: 'expired' })
        .eq('job_id', payload.job_id)
        .eq('profile_id', payload.profile_id)
        .eq('phase', payload.phase)
        .neq('status', 'expired') // Cancel any non-expired status
        .select('id')

      console.log('🔴 CANCEL STAFFING: Update result', { data, error, count, rowsAffected: data?.length })

      if (error) throw error

      if (!data?.length) {
        console.warn('🔴 CANCEL STAFFING: No records were updated!')
      }

      // Fire-and-forget notification via same channel used originally
      try {
        supabase.functions.invoke('notify-staffing-cancellation', { body: payload }).catch(() => {})
      } catch {}
      return { success: true, rowsAffected: data?.length || 0 }
    },
    onSuccess: (_data, vars) => {
      console.log('🔴 CANCEL STAFFING: onSuccess, invalidating queries')

      // Invalidate all related queries
      qc.invalidateQueries({ queryKey: ['staffing', vars.job_id, vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['staffing-by-date', vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['staffing-matrix'] })
      qc.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] })
      qc.invalidateQueries({ queryKey: ['assignment-matrix'] })

      // Also refetch to ensure fresh data
      qc.refetchQueries({ queryKey: ['staffing-matrix'], type: 'active' })

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
