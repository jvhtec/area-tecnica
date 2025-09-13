import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { format, startOfDay, endOfDay } from 'date-fns'

type StaffingByDate = {
  availability_status: 'confirmed' | 'declined' | 'expired' | 'requested' | null,
  offer_status: 'confirmed' | 'declined' | 'expired' | 'sent' | null,
  availability_job_id?: string | null,
  offer_job_id?: string | null,
}

export function useStaffingStatusByDate(profileId: string, date: Date) {
  return useQuery({
    queryKey: ['staffing-by-date', profileId, format(date, 'yyyy-MM-dd')],
    queryFn: async (): Promise<StaffingByDate> => {
      console.log('🔍 Fetching staffing status by date for:', { profileId, date: format(date, 'yyyy-MM-dd') })
      
      // First, find all jobs that span this date
      const sod = startOfDay(date).toISOString()
      const eod = endOfDay(date).toISOString()
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        // Jobs that overlap with this calendar day
        .lte('start_time', eod)
        .gte('end_time', sod)

      if (jobsError) {
        console.warn('⚠️ jobs lookup error:', jobsError)
      }
      
      if (!jobs || jobs.length === 0) {
        return { availability_status: null, offer_status: null }
      }

      // Then check the aggregated staffing view for this technician for any of these jobs
      const jobIds = jobs.map(j => j.id)
      const { data: statuses, error: statusesError } = await supabase
        .from('assignment_matrix_staffing')
        .select('job_id, availability_status, availability_updated_at, offer_status, offer_updated_at')
        .eq('profile_id', profileId)
        .in('job_id', jobIds)

      if (statusesError) {
        console.warn('⚠️ staffing view by date error:', statusesError)
      }

      if (!statuses || statuses.length === 0) {
        return { availability_status: null, offer_status: null }
      }

      // Combine statuses across matching jobs preferring the most recent per phase
      const pickAvailability = () => {
        const withAvail = statuses.filter(s => s.availability_status)
        if (withAvail.length > 0) {
          const latest = withAvail.reduce((acc, s) => {
            const t = s.availability_updated_at ? new Date(s.availability_updated_at as any).getTime() : 0
            const accT = acc.availability_updated_at ? new Date(acc.availability_updated_at as any).getTime() : 0
            return t > accT ? s : acc
          }, withAvail[0])
          return { 
            status: latest.availability_status === 'pending' ? 'requested' : latest.availability_status,
            job_id: latest.job_id as string
          }
        }
        // Fallback precedence: confirmed > declined > expired > pending
        if (statuses.some(s => s.availability_status === 'confirmed')) return { status: 'confirmed' as const, job_id: (statuses.find(s => s.availability_status === 'confirmed') as any)?.job_id }
        if (statuses.some(s => s.availability_status === 'declined')) return { status: 'declined' as const, job_id: (statuses.find(s => s.availability_status === 'declined') as any)?.job_id }
        if (statuses.some(s => s.availability_status === 'expired')) return { status: 'expired' as const, job_id: (statuses.find(s => s.availability_status === 'expired') as any)?.job_id }
        if (statuses.some(s => s.availability_status === 'pending')) return { status: 'requested' as const, job_id: (statuses.find(s => s.availability_status === 'pending') as any)?.job_id }
        return { status: null, job_id: null }
      }
      const pickOffer = () => {
        const withOffer = statuses.filter(s => s.offer_status)
        if (withOffer.length > 0) {
          const latest = withOffer.reduce((acc, s) => {
            const t = s.offer_updated_at ? new Date(s.offer_updated_at as any).getTime() : 0
            const accT = acc.offer_updated_at ? new Date(acc.offer_updated_at as any).getTime() : 0
            return t > accT ? s : acc
          }, withOffer[0])
          return { 
            status: latest.offer_status === 'pending' ? 'sent' : latest.offer_status,
            job_id: latest.job_id as string
          }
        }
        // Fallback precedence
        if (statuses.some(s => s.offer_status === 'confirmed')) return { status: 'confirmed' as const, job_id: (statuses.find(s => s.offer_status === 'confirmed') as any)?.job_id }
        if (statuses.some(s => s.offer_status === 'declined')) return { status: 'declined' as const, job_id: (statuses.find(s => s.offer_status === 'declined') as any)?.job_id }
        if (statuses.some(s => s.offer_status === 'expired')) return { status: 'expired' as const, job_id: (statuses.find(s => s.offer_status === 'expired') as any)?.job_id }
        if (statuses.some(s => s.offer_status === 'pending')) return { status: 'sent' as const, job_id: (statuses.find(s => s.offer_status === 'pending') as any)?.job_id }
        return { status: null, job_id: null }
      }

      const availability = pickAvailability()
      const offer = pickOffer()

      return { 
        availability_status: availability.status,
        offer_status: offer.status,
        availability_job_id: availability.job_id,
        offer_job_id: offer.job_id
      }
    },
    staleTime: 1_000, // 1 second for fast updates
    refetchOnWindowFocus: true,
    enabled: !!profileId && !!date
  })
}
