import { useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export function useStaffingRealtime() {
  const qc = useQueryClient()
  
  useEffect(() => {
    console.log('🚀 Setting up staffing realtime subscriptions')
    // Listen to both staffing_requests and staffing_events tables
    const staffingRequestsChannel = supabase.channel('staffing-requests')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'staffing_requests' 
      }, (payload) => {
        console.log('Staffing requests realtime update:', payload)
        handleStaffingUpdate(payload)
      })
      .subscribe()

    const staffingEventsChannel = supabase.channel('staffing-events')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'staffing_events' 
      }, (payload) => {
        console.log('Staffing events realtime update:', payload)
        handleStaffingUpdate(payload)
      })
      .subscribe()

    // Also listen to activity_log for staffing.* events (secondary source of truth)
    const activityChannel = supabase.channel('activity-log-staffing')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'activity_log'
      }, (payload) => {
        try {
          const rec: any = payload.new || payload.old
          const code = rec?.code || ''
          if (typeof code === 'string' && code.startsWith('staffing.')) {
            console.log('Activity staffing event:', code, rec)
            // We don't know job/profile here, but invalidate broad keys
            qc.invalidateQueries({ queryKey: ['staffing'] })
            qc.invalidateQueries({ queryKey: ['staffing-by-date'] })
            qc.invalidateQueries({ queryKey: ['staffing-matrix'] })
            qc.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] })
          }
        } catch (e) {
          console.warn('Activity staffing event handling error', e)
        }
      })
      .subscribe()

    async function handleStaffingUpdate(payload: any) {
      console.log('🔄 Realtime update received:', {
        table: payload.table,
        eventType: payload.eventType,
        record: payload.new || payload.old
      })
      
      const record = payload.new || payload.old
      let jobId = null
      let profileId = null
      
      if (record && typeof record === 'object') {
        // Handle staffing_requests updates (have job_id and profile_id directly)
        if ('job_id' in record && 'profile_id' in record) {
          jobId = record.job_id
          profileId = record.profile_id
        }
        // Handle staffing_events updates (need to fetch related request data)
        else if ('staffing_request_id' in record) {
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
            queryKey: ['staffing', jobId, profileId] 
          })
          // Also invalidate date-based queries for this profile
          qc.invalidateQueries({ 
            queryKey: ['staffing-by-date', profileId] 
          })
        }
      }
      
      // Always invalidate broader matrix queries for safety
      console.log('🔄 Invalidating matrix queries')
      qc.invalidateQueries({ queryKey: ['assignment-matrix'] })
      qc.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] })
      qc.invalidateQueries({ queryKey: ['staffing-matrix'] })
    }
      
    return () => { 
      supabase.removeChannel(staffingRequestsChannel)
      supabase.removeChannel(staffingEventsChannel)
      supabase.removeChannel(activityChannel)
    }
  }, [qc])
}
