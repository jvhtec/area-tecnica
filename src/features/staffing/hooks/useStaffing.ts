import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  invalidateMatrixAssignmentQueries,
  invalidateMatrixJobsAndStaffingQueries,
  matrixDebug,
} from '@/components/matrix/optimized-assignment-matrix/matrixCore'

type StaffingViewStatus = 'requested' | 'sent' | 'confirmed' | 'declined' | null

interface StaffingViewRow {
  availability_status: string | null
  offer_status: string | null
}

const dispatchStaffingUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('staffing-updated'))
  }
}

export function useStaffingStatus(jobId: string, profileId: string) {
  return useQuery({
    queryKey: ['staffing', jobId, profileId],
    queryFn: async () => {
      // Use the RPC function which reflects the latest statuses
      const { data, error } = await supabase
        .rpc('get_assignment_matrix_staffing')
        .eq('job_id', jobId)
        .eq('profile_id', profileId)
        .maybeSingle()

      if (error) {
        matrixDebug('staffing view error, falling back to null', error)
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

      const viewRow = data as StaffingViewRow
      const result: { availability_status: StaffingViewStatus; offer_status: StaffingViewStatus } = {
        availability_status: mapAvailability(viewRow.availability_status),
        offer_status: mapOffer(viewRow.offer_status)
      }
      return result
    },
    staleTime: 1_000,
    refetchOnWindowFocus: true,
    enabled: !!jobId && !!profileId
  })
}

// Custom error type for conflicts
export class ConflictError extends Error {
  constructor(message: string, public details: Record<string, unknown>) {
    super(message);
    this.name = 'ConflictError';
  }
}

export function useSendStaffingEmail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { job_id: string, profile_id: string, phase: 'availability'|'offer', role?: string | null, message?: string | null, channel?: 'email' | 'whatsapp', target_date?: string | null, single_day?: boolean, dates?: string[], override_conflicts?: boolean }) => {
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

      // Check for 409 Conflict with structured error details
      if (response.status === 409) {
        if (data.details?.conflict_type || data.details?.conflicts || data.details?.unavailability) {
          throw new ConflictError(data.error || 'Conflict detected', data.details);
        }
      }

      // Check for other errors
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      if (data?.error) {
        throw new Error(data.error)
      }
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['staffing', vars.job_id, vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['staffing-by-date', vars.profile_id] })
      void invalidateMatrixJobsAndStaffingQueries(qc)
      void invalidateMatrixAssignmentQueries(qc)
      dispatchStaffingUpdated()
      // Fan out push notification (fire-and-forget)
      const type = vars.phase === 'availability' ? 'staffing.availability.sent' : 'staffing.offer.sent'
      void supabase.functions.invoke('push', {
        body: {
          action: 'broadcast',
          type,
          job_id: vars.job_id,
          recipient_id: vars.profile_id,
          channel: vars.channel || 'email'
        }
      }).catch(() => undefined)
    }
  })
}

export function useCancelStaffingRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { job_id: string, profile_id: string, phase: 'availability'|'offer' }) => {
      // First, check what records exist for this combination
      const { data: _existingRecords } = await supabase
        .from('staffing_requests')
        .select('id, status, single_day, target_date')
        .eq('job_id', payload.job_id)
        .eq('profile_id', payload.profile_id)
        .eq('phase', payload.phase)

      // Cancel ALL non-expired records (not just pending) to ensure cell clears
      const { data, error, count: _count } = await supabase
        .from('staffing_requests')
        .update({ status: 'expired' })
        .eq('job_id', payload.job_id)
        .eq('profile_id', payload.profile_id)
        .eq('phase', payload.phase)
        .neq('status', 'expired') // Cancel any non-expired status
        .select('id')

      if (error) throw error

      // Fire-and-forget notification via same channel used originally
      void supabase.functions
        .invoke('notify-staffing-cancellation', { body: payload })
        .catch(() => undefined)
      return { success: true, rowsAffected: data?.length || 0 }
    },
    onSuccess: (_data, vars) => {
      // Invalidate all related queries
      qc.invalidateQueries({ queryKey: ['staffing', vars.job_id, vars.profile_id] })
      qc.invalidateQueries({ queryKey: ['staffing-by-date', vars.profile_id] })
      void invalidateMatrixJobsAndStaffingQueries(qc)
      void invalidateMatrixAssignmentQueries(qc)

      // Also refetch to ensure fresh data
      qc.refetchQueries({ queryKey: ['staffing-matrix'], type: 'active' })

      dispatchStaffingUpdated()
      // Push broadcast: cancellation
      const type = vars.phase === 'availability' ? 'staffing.availability.cancelled' : 'staffing.offer.cancelled'
      void supabase.functions.invoke('push', {
        body: {
          action: 'broadcast',
          type,
          job_id: vars.job_id,
          recipient_id: vars.profile_id,
        }
      }).catch(() => undefined)
    }
  })
}
