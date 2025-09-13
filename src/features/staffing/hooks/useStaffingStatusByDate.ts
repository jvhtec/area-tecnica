import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { format } from 'date-fns'

export function useStaffingStatusByDate(profileId: string, date: Date) {
  return useQuery({
    queryKey: ['staffing-by-date', profileId, format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      console.log('🔍 Fetching staffing status by date for:', { profileId, date: format(date, 'yyyy-MM-dd') })
      
      // First, find all jobs that span this date
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
        .lte('start_date', format(date, 'yyyy-MM-dd'))
        .gte('end_date', format(date, 'yyyy-MM-dd'))
      
      if (!jobs || jobs.length === 0) {
        return { availability_status: null, offer_status: null }
      }
      
      // Then check staffing requests for this technician for any of these jobs
      const { data: staffingData } = await supabase
        .from('staffing_requests')
        .select(`
          *,
          staffing_events(*)
        `)
        .eq('profile_id', profileId)
        .in('job_id', jobs.map(job => job.id))
        .order('created_at', { ascending: false })
      
      console.log('📋 Staffing status by date result:', staffingData)
      
      if (!staffingData || staffingData.length === 0) {
        return { availability_status: null, offer_status: null }
      }
      
      // Process all staffing requests to find the latest status
      let availability_status = null
      let offer_status = null
      
      for (const request of staffingData) {
        const events = request.staffing_events || []
        
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
      }
      
      return { availability_status, offer_status }
    },
    staleTime: 1_000, // 1 second for fast updates
    refetchOnWindowFocus: true,
    enabled: !!profileId && !!date
  })
}