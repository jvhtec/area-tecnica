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
      const dayRange = `[${sod},${eod}]`
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        // Jobs that overlap with this calendar day
        .filter('time_range', 'ov', dayRange)

      if (jobsError) {
        console.warn('⚠️ jobs lookup error:', jobsError)
      }
      
      if (!jobs || jobs.length === 0) {
        return { availability_status: null, offer_status: null }
      }

      // Then check staffing requests for this technician for any of these jobs
      const jobIds = jobs.map(j => j.id)

      // Batch job IDs to avoid URL length limits (max ~100 UUIDs per request)
      const BATCH_SIZE = 100;
      const batches: string[][] = [];
      for (let i = 0; i < jobIds.length; i += BATCH_SIZE) {
        batches.push(jobIds.slice(i, i + BATCH_SIZE));
      }

      const batchPromises = batches.map(batchIds =>
        supabase
          .from('staffing_requests')
          .select('job_id, phase, status, updated_at, single_day, target_date')
          .eq('profile_id', profileId)
          .in('job_id', batchIds)
      );

      const batchResults = await Promise.all(batchPromises);

      // Collect all results and check for errors
      let rawStatuses: any[] = [];
      let statusesError = null;
      for (const result of batchResults) {
        if (result.error) {
          statusesError = result.error;
          break;
        }
        if (result.data) {
          rawStatuses.push(...result.data);
        }
      }

      if (statusesError) {
        console.warn('⚠️ staffing view by date error:', statusesError)
      }

      if (!rawStatuses || rawStatuses.length === 0) {
        return { availability_status: null, offer_status: null }
      }

      // Transform raw statuses to separate availability and offer statuses
      const dStr = format(date, 'yyyy-MM-dd')
      const statuses = rawStatuses
        // Respect single-day scoping: only include requests whose target_date matches this day when flagged
        .filter(r => {
          if ((r as any).single_day) {
            return (r as any).target_date === dStr
          }
          return true
        })
        .map(r => ({
        job_id: r.job_id,
        availability_status: r.phase === 'availability' ? (r.status === 'pending' ? 'requested' : r.status) : null,
        availability_updated_at: r.phase === 'availability' ? r.updated_at : null,
        offer_status: r.phase === 'offer' ? (r.status === 'pending' ? 'sent' : r.status) : null,
        offer_updated_at: r.phase === 'offer' ? r.updated_at : null
      }))

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
            status: latest.availability_status,
            job_id: latest.job_id as string
          }
        }
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
            status: latest.offer_status,
            job_id: latest.job_id as string
          }
        }
        return { status: null, job_id: null }
      }

      const availability = pickAvailability()
      const offer = pickOffer()

      return { 
        availability_status: availability.status as 'confirmed' | 'declined' | 'expired' | 'requested' | null,
        offer_status: offer.status as 'confirmed' | 'declined' | 'expired' | 'sent' | null,
        availability_job_id: availability.job_id,
        offer_job_id: offer.job_id
      }
    },
    staleTime: 1_000, // 1 second for fast updates
    refetchOnWindowFocus: true,
    enabled: !!profileId && !!date
  })
}
