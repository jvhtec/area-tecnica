import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { format, isSameDay, isWithinInterval } from 'date-fns'

type Status = 'confirmed' | 'declined' | 'expired' | 'requested' | 'sent' | null

export interface MatrixJobLite {
  id: string
  start_time: string
  end_time: string
}

interface ByJobStatus {
  availability_status: Status
  offer_status: Status
}

interface ByDateStatus extends ByJobStatus {
  availability_job_id?: string | null
  offer_job_id?: string | null
}

export function useStaffingMatrixStatuses(
  technicianIds: string[],
  jobs: MatrixJobLite[],
  dates: Date[]
) {
  return useQuery({
    queryKey: ['staffing-matrix', technicianIds, jobs.map(j => j.id), dates[0]?.toISOString(), dates[dates.length - 1]?.toISOString()],
    queryFn: async () => {
      if (!technicianIds.length || !jobs.length || !dates.length) {
        return { byJob: new Map<string, ByJobStatus>(), byDate: new Map<string, ByDateStatus>() }
      }

      const jobIds = jobs.map(j => j.id)

      const chunk = <T,>(arr: T[], size: number) => {
        const out: T[][] = []
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
        return out
      }

      // 1) Job-based statuses from aggregated view
      const mapByJob = new Map<string, ByJobStatus>()
      try {
        const techBatches = chunk(technicianIds, 20)
        const jobBatches = chunk(jobIds, 20)
        const promises: Promise<any>[] = []
        for (const tb of techBatches) {
          for (const jb of jobBatches) {
            promises.push(
              Promise.resolve(supabase
                .rpc('get_assignment_matrix_staffing')
                .in('job_id', jb)
                .in('profile_id', tb))
            )
          }
        }
        const results = await Promise.all(promises)
        results.forEach(res => {
          if (res.error) {
            console.warn('Staffing matrix byJob error (batch):', res.error)
            return
          }
          (res.data || []).forEach((r: any) => {
            const key = `${r.job_id}-${r.profile_id}`
            const mapAvailability = (s: string | null): Status => {
              if (!s) return null
              if (s === 'pending') return 'requested'
              if (s === 'expired') return null // treat cancelled/expired as cleared
              return s as any
            }
            const mapOffer = (s: string | null): Status => {
              if (!s) return null
              if (s === 'pending') return 'sent'
              if (s === 'expired') return null // treat cancelled/expired as cleared
              return s as any
            }
            mapByJob.set(key, {
              availability_status: mapAvailability(r.availability_status),
              offer_status: mapOffer(r.offer_status)
            })
          })
        })
      } catch (e) {
        console.warn('Staffing matrix byJob batch error:', e)
      }

      // 2) Date-based statuses derived from staffing_requests across visible jobs
      const reqRows: any[] = []
      try {
        const techBatches = chunk(technicianIds, 20)
        const jobBatches = chunk(jobIds, 20)
        const promises: Promise<any>[] = []
        for (const tb of techBatches) {
          for (const jb of jobBatches) {
            promises.push(
              Promise.resolve(supabase
                .from('staffing_requests')
                .select('job_id, profile_id, phase, status, updated_at, single_day, target_date')
                .in('profile_id', tb)
                .in('job_id', jb))
            )
          }
        }
        const results = await Promise.all(promises)
        results.forEach(res => {
          if (res.error) {
            console.warn('Staffing matrix requests error (batch):', res.error)
            return
          }
          if (res.data?.length) reqRows.push(...res.data)
        })
      } catch (e) {
        console.warn('Staffing matrix requests batch error:', e)
      }

      // Build job lookup with parsed dates for overlap check
      const jobLookup = new Map<string, { id: string, start: Date, end: Date }>()
      jobs.forEach(j => {
        const start = j.start_time ? new Date(j.start_time) : new Date()
        const end = j.end_time ? new Date(j.end_time) : new Date()
        jobLookup.set(j.id, { id: j.id, start, end })
      })

      // Group requests by technician for faster lookups
      const byTech = new Map<string, any[]>()
      ;(reqRows || []).forEach(r => {
        const arr = byTech.get(r.profile_id) || []
        arr.push(r)
        byTech.set(r.profile_id, arr)
      })

      const mapByDate = new Map<string, ByDateStatus>()
      // For each technician and visible date, compute latest per-phase over overlapping jobs
      technicianIds.forEach(tid => {
        const reqs = byTech.get(tid) || []
        dates.forEach(d => {
          const dStr = format(d, 'yyyy-MM-dd')
          // Filter requests based on type:
          // - Single-day requests: exact target_date match (prevents following job reschedules)
          // - Full-span requests: show on all dates within the job's date range
          const matchingRequests = reqs.filter(r => {
            // Single-day requests with target_date: exact match only
            if (r.single_day && r.target_date) {
              const rDate = typeof r.target_date === 'string' ? r.target_date : format(r.target_date, 'yyyy-MM-dd')
              return rDate === dStr
            }

            // Full-span requests (no target_date): show on all job dates
            if (!r.single_day) {
              const job = jobLookup.get(r.job_id)
              if (!job) return false
              const cellDate = new Date(d)
              cellDate.setHours(0, 0, 0, 0)
              const start = new Date(job.start)
              start.setHours(0, 0, 0, 0)
              const end = new Date(job.end)
              end.setHours(0, 0, 0, 0)
              return cellDate >= start && cellDate <= end
            }

            return false
          })
          if (!matchingRequests.length) return

          // Reduce to latest per phase
          const latest = matchingRequests.reduce((acc: any, r: any) => {
            const t = r.updated_at ? new Date(r.updated_at).getTime() : 0
            if (r.phase === 'availability') {
              const accT = acc.availability_updated_at || 0
              if (t > accT) {
                const mapped = r.status === 'pending' ? 'requested' : (r.status === 'expired' ? null : r.status)
                acc.availability_status = mapped
                acc.availability_updated_at = t
                acc.availability_job_id = r.job_id
              }
            } else if (r.phase === 'offer') {
              const accT = acc.offer_updated_at || 0
              if (t > accT) {
                const mapped = r.status === 'pending' ? 'sent' : (r.status === 'expired' ? null : r.status)
                acc.offer_status = mapped
                acc.offer_updated_at = t
                acc.offer_job_id = r.job_id
              }
            }
            return acc
          }, { availability_status: null, offer_status: null, availability_updated_at: 0, offer_updated_at: 0, availability_job_id: null, offer_job_id: null })

          // Only set an entry if there's a non-null status for either phase
          if (latest.availability_status || latest.offer_status) {
            mapByDate.set(`${tid}-${dStr}`, {
              availability_status: latest.availability_status as Status,
              offer_status: latest.offer_status as Status,
              availability_job_id: latest.availability_job_id,
              offer_job_id: latest.offer_job_id
            })
          }
        })
      })

      return { byJob: mapByJob, byDate: mapByDate }
    },
    staleTime: 1500,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev as any,
  })
}
