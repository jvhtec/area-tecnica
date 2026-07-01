import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { UnifiedSubscriptionManager, type RealtimeChangePayload } from '@/lib/unified-subscription-manager'


import { queryKeys } from "@/lib/react-query";
/**
 * Hook to subscribe to realtime updates for a staffing campaign
 */
export function useStaffingCampaignRealtime(jobId: string, department: string) {
  const queryClient = useQueryClient()
  const subscriptionManager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(queryClient),
    [queryClient]
  )
  const ownerIdRef = useRef(`staffing-campaign-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!jobId || !department) return
    const ownerRoute = ownerIdRef.current

    subscriptionManager.subscribeToTable(
      'staffing_campaigns',
      queryKeys.scope('staffing_campaign', jobId, department),
      { event: '*', schema: 'public', filter: `job_id=eq.${jobId}` },
      'medium',
      {
        ownerRoute,
        invalidateOnPayload: false,
        onPayload: (payload: RealtimeChangePayload) => {
          const row = (payload.new ?? payload.old) as { department?: string } | null
          if (row?.department !== department) return
          queryClient.invalidateQueries({
            queryKey: queryKeys.scope('staffing_campaign', jobId, department)
          })
        },
      }
    )

    return () => {
      subscriptionManager.cleanupRouteDependentSubscriptions(ownerRoute)
    }
  }, [jobId, department, queryClient, subscriptionManager])
}

/**
 * Hook to subscribe to realtime updates for campaign roles
 */
export function useStaffingCampaignRolesRealtime(campaignId?: string) {
  const queryClient = useQueryClient()
  const subscriptionManager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(queryClient),
    [queryClient]
  )
  const ownerIdRef = useRef(`staffing-campaign-roles-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!campaignId) return
    const ownerRoute = ownerIdRef.current

    subscriptionManager.subscribeToTable(
      'staffing_campaign_roles',
      queryKeys.scope('staffing_campaign_roles', campaignId),
      { event: '*', schema: 'public', filter: `campaign_id=eq.${campaignId}` },
      'medium',
      { ownerRoute }
    )

    return () => {
      subscriptionManager.cleanupRouteDependentSubscriptions(ownerRoute)
    }
  }, [campaignId, subscriptionManager])
}

/**
 * Hook to subscribe to realtime updates for staffing requests (availability/offer responses)
 */
export function useStaffingRequestsRealtime(jobId: string) {
  const queryClient = useQueryClient()
  const subscriptionManager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(queryClient),
    [queryClient]
  )
  const ownerIdRef = useRef(`staffing-requests-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!jobId) return
    const ownerRoute = ownerIdRef.current

    subscriptionManager.subscribeToTable(
      'staffing_requests',
      queryKeys.scope('staffing_requests', jobId),
      { event: '*', schema: 'public', filter: `job_id=eq.${jobId}` },
      'medium',
      {
        ownerRoute,
        invalidateOnPayload: false,
        onPayload: () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.scope('staffing_availability_responses', jobId)
          })
          queryClient.invalidateQueries({
            queryKey: queryKeys.scope('staffing_requests', jobId)
          })
          queryClient.invalidateQueries({
            queryKey: queryKeys.scope('staffing_candidates', jobId)
          })
          queryClient.invalidateQueries({
            queryKey: queryKeys.scope('staffing_roleless_consultations', jobId)
          })
        },
      }
    )

    return () => {
      subscriptionManager.cleanupRouteDependentSubscriptions(ownerRoute)
    }
  }, [jobId, queryClient, subscriptionManager])
}

/**
 * Hook to subscribe to realtime updates for staffing events (audit log)
 */
export function useStaffingEventsRealtime(campaignId?: string) {
  const queryClient = useQueryClient()
  const subscriptionManager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(queryClient),
    [queryClient]
  )
  const ownerIdRef = useRef(`staffing-campaign-events-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!campaignId) return
    const ownerRoute = ownerIdRef.current

    subscriptionManager.subscribeToTable(
      'staffing_campaign_events',
      queryKeys.scope('staffing_campaign_events', campaignId),
      { event: 'INSERT', schema: 'public', filter: `campaign_id=eq.${campaignId}` },
      'low',
      { ownerRoute }
    )

    return () => {
      subscriptionManager.cleanupRouteDependentSubscriptions(ownerRoute)
    }
  }, [campaignId, subscriptionManager])
}
