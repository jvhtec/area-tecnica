import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Hook to subscribe to realtime updates for a staffing campaign
 */
export function useStaffingCampaignRealtime(jobId: string, department: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!jobId || !department) return

    const channel = supabase
      .channel(`staffing-campaign-${jobId}-${department}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staffing_campaigns', filter: `job_id=eq.${jobId}` },
        (payload: any) => {
          const row = payload.new ?? payload.old
          if (row?.department !== department) return
          queryClient.invalidateQueries({
            queryKey: ['staffing_campaign', jobId, department]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobId, department, queryClient])
}

/**
 * Hook to subscribe to realtime updates for campaign roles
 */
export function useStaffingCampaignRolesRealtime(campaignId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!campaignId) return

    const channel = supabase
      .channel(`staffing-campaign-roles-${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staffing_campaign_roles', filter: `campaign_id=eq.${campaignId}` },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['staffing_campaign_roles', campaignId]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId, queryClient])
}

/**
 * Hook to subscribe to realtime updates for staffing requests (availability/offer responses)
 */
export function useStaffingRequestsRealtime(jobId: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!jobId) return

    const channel = supabase
      .channel(`staffing-requests-${jobId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staffing_requests', filter: `job_id=eq.${jobId}` },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['staffing_availability_responses', jobId]
          })
          queryClient.invalidateQueries({
            queryKey: ['staffing_requests', jobId]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [jobId, queryClient])
}

/**
 * Hook to subscribe to realtime updates for staffing events (audit log)
 */
export function useStaffingEventsRealtime(campaignId?: string) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!campaignId) return

    const channel = supabase
      .channel(`staffing-campaign-events-${campaignId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'staffing_campaign_events', filter: `campaign_id=eq.${campaignId}` },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['staffing_campaign_events', campaignId]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId, queryClient])
}
