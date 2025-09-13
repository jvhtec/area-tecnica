import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { format } from 'date-fns'

export function useStaffingStatusByDate(profileId: string, date: Date) {
  return useQuery({
    queryKey: ['staffing-by-date', profileId, format(date, 'yyyy-MM-dd')],
    queryFn: async () => {
      console.log('🔍 Fetching staffing status by date for:', { profileId, date: format(date, 'yyyy-MM-dd') })
      
      // Query staffing_requests for this technician on this date
      const { data } = await supabase
        .from('staffing_requests')
        .select(`
          *,
          staffing_events(*)
        `)
        .eq('profile_id', profileId)
        .gte('requested_date', format(date, 'yyyy-MM-dd'))
        .lte('requested_date', format(date, 'yyyy-MM-dd'))
        .order('created_at', { ascending: false })
        .limit(1)
      
      console.log('📋 Staffing status by date result:', data)
      
      if (!data || data.length === 0) {
        return { availability_status: null, offer_status: null }
      }
      
      // Get the latest status from staffing_events
      const request = data[0]
      const events = request.staffing_events || []
      
      let availability_status = null
      let offer_status = null
      
      // Find the latest availability and offer events
      for (const eventRecord of events) {
        if (eventRecord.event === 'availability_requested' || 
            eventRecord.event === 'availability_confirmed' || 
            eventRecord.event === 'availability_declined') {
          availability_status = eventRecord.event.replace('availability_', '')
        }
        if (eventRecord.event === 'offer_sent' || 
            eventRecord.event === 'offer_confirmed' || 
            eventRecord.event === 'offer_declined') {
          offer_status = eventRecord.event.replace('offer_', '')
        }
      }
      
      return { availability_status, offer_status }
    },
    staleTime: 1_000, // 1 second for fast updates
    refetchOnWindowFocus: true,
    enabled: !!profileId && !!date
  })
}