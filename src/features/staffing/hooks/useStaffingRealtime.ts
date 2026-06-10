import { useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { UnifiedSubscriptionManager, type RealtimeChangePayload } from '@/lib/unified-subscription-manager'


import { queryKeys } from "@/lib/react-query";
export function useStaffingRealtime() {
  const qc = useQueryClient()
  const location = useLocation()
  const subscriptionManager = useMemo(
    () => UnifiedSubscriptionManager.getInstance(qc),
    [qc],
  )
  const ownerIdRef = useRef(`staffing-realtime-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    console.log('🚀 Setting up staffing realtime subscriptions')
    const ownerRoute = `${location.pathname}:${ownerIdRef.current}`

    // Listen to both staffing_requests and staffing_events tables
    subscriptionManager.subscribeToTable(
      'staffing_requests',
      queryKeys.scope('staffing-realtime', 'requests'),
      {
        event: '*',
        schema: 'public',
      },
      'high',
      {
        ownerRoute,
        invalidateOnPayload: false,
        onPayload: (payload) => {
          console.log('Staffing requests realtime update:', payload)
          void handleStaffingUpdate(payload)
        },
      },
    )

    subscriptionManager.subscribeToTable(
      'staffing_events',
      queryKeys.scope('staffing-realtime', 'events'),
      {
        event: '*',
        schema: 'public',
      },
      'high',
      {
        ownerRoute,
        invalidateOnPayload: false,
        onPayload: (payload) => {
          console.log('Staffing events realtime update:', payload)
          void handleStaffingUpdate(payload)
        },
      },
    )

    // Also listen to activity_log for staffing.* events (secondary source of truth)
    subscriptionManager.subscribeToTable(
      'activity_log',
      queryKeys.scope('staffing-realtime', 'activity-log'),
      {
        event: '*',
        schema: 'public',
      },
      'medium',
      {
        ownerRoute,
        invalidateOnPayload: false,
        onPayload: (payload) => {
          try {
            const rec = (payload.new || payload.old) as Record<string, unknown> | null
            const code = rec?.code
            if (typeof code === 'string' && code.startsWith('staffing.')) {
              console.log('Activity staffing event:', code, rec)
              // We don't know job/profile here, but invalidate broad keys
              qc.invalidateQueries({ queryKey: queryKeys.scope('staffing') })
              qc.invalidateQueries({ queryKey: queryKeys.scope('staffing-by-date') })
              qc.invalidateQueries({ queryKey: queryKeys.scope('staffing-matrix') })
              qc.invalidateQueries({ queryKey: queryKeys.scope('optimized-matrix-assignments') })
            }
          } catch (e) {
            console.warn('Activity staffing event handling error', e)
          }
        },
      },
    )

    async function handleStaffingUpdate(payload: RealtimeChangePayload) {
      console.log('🔄 Realtime update received:', {
        table: payload.table,
        eventType: payload.eventType,
        record: payload.new || payload.old
      })

      const record = (payload.new || payload.old) as Record<string, unknown> | null
      let jobId: string | null = null
      let profileId: string | null = null

      if (record && typeof record === 'object') {
        // Handle staffing_requests updates (have job_id and profile_id directly)
        if (typeof record.job_id === 'string' && typeof record.profile_id === 'string') {
          jobId = record.job_id
          profileId = record.profile_id
        }
        // Handle staffing_events updates (need to fetch related request data)
        else if (typeof record.staffing_request_id === 'string') {
          try {
            const { data: requestData } = await supabase
              .from('staffing_requests')
              .select('job_id, profile_id')
              .eq('id', record.staffing_request_id)
              .single()

            if (requestData) {
              jobId = requestData.job_id
              profileId = requestData.profile_id
            }
          } catch (error) {
            console.warn('Failed to fetch related staffing request data:', error)
          }
        }

        // Invalidate specific staffing queries if we have the IDs
        if (jobId && profileId) {
          console.log('🎯 Invalidating specific query:', ['staffing', jobId, profileId])
          qc.invalidateQueries({
            queryKey: queryKeys.scope('staffing', jobId, profileId)
          })
          // Also invalidate date-based queries for this profile
          qc.invalidateQueries({
            queryKey: queryKeys.scope('staffing-by-date', profileId)
          })
        }
      }

      // Always invalidate broader matrix queries for safety
      console.log('🔄 Invalidating matrix queries')
      qc.invalidateQueries({ queryKey: queryKeys.scope('assignment-matrix') })
      qc.invalidateQueries({ queryKey: queryKeys.scope('optimized-matrix-assignments') })
      qc.invalidateQueries({ queryKey: queryKeys.scope('staffing-matrix') })
    }

    return () => {
      subscriptionManager.cleanupRouteDependentSubscriptions(ownerRoute)
    }
  }, [location.pathname, qc, subscriptionManager])
}
