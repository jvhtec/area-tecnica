import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  formatMatrixDateKey,
  matrixDebug,
  matrixQueryKeys,
} from '@/components/matrix/optimized-assignment-matrix/matrixCore'

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
  availability_requested_by?: string | null
  availability_created_at?: string | null
  offer_requested_by?: string | null
  offer_created_at?: string | null
  // Arrays of ALL job IDs with pending requests for this date (for bulk cancel)
  pending_availability_job_ids?: string[]
  pending_offer_job_ids?: string[]
}

interface StaffingRequestRow {
  job_id: string
  profile_id: string
  phase: 'availability' | 'offer'
  status: string | null
  updated_at: string | null
  single_day: boolean
  target_date: string | Date | null
  created_at: string | null
  requested_by: string | null
}

interface AssignmentMatrixStaffingRow {
  job_id: string
  profile_id: string
  availability_status: string | null
  offer_status: string | null
}

interface LatestByPhaseAccumulator {
  availability_status: Status
  offer_status: Status
  availability_updated_at: number
  offer_updated_at: number
  availability_job_id: string | null
  offer_job_id: string | null
  availability_requested_by: string | null
  availability_created_at: string | null
  offer_requested_by: string | null
  offer_created_at: string | null
  pending_availability_job_ids: string[]
  pending_offer_job_ids: string[]
}

const createLatestByPhaseAccumulator = (): LatestByPhaseAccumulator => ({
  availability_status: null,
  offer_status: null,
  availability_updated_at: 0,
  offer_updated_at: 0,
  availability_job_id: null,
  offer_job_id: null,
  availability_requested_by: null,
  availability_created_at: null,
  offer_requested_by: null,
  offer_created_at: null,
  pending_availability_job_ids: [],
  pending_offer_job_ids: []
})

const normalizeDateLikeToMatrixKey = (value: string | Date | null | undefined): string | null => {
  if (!value) return null
  if (value instanceof Date) return formatMatrixDateKey(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return formatMatrixDateKey(parsed)
}

export function useStaffingMatrixStatuses(
  technicianIds: string[],
  jobs: MatrixJobLite[],
  dates: Date[]
) {
  return useQuery({
    queryKey: matrixQueryKeys.staffingMatrix(technicianIds, jobs, dates),
    queryFn: async () => {
      if (!technicianIds.length || !jobs.length || !dates.length) {
        return { byJob: new Map<string, ByJobStatus>(), byDate: new Map<string, ByDateStatus>() }
      }

      const jobIds = jobs.map(j => j.id)

      // 1) Job-based statuses from aggregated view
      const mapByJob = new Map<string, ByJobStatus>()
      try {
        const { data, error } = await supabase
          .rpc('get_assignment_matrix_staffing')
          .in('job_id', jobIds)
          .in('profile_id', technicianIds)

        if (error) {
          matrixDebug('Staffing matrix byJob error', error)
        }

        ;((data || []) as AssignmentMatrixStaffingRow[]).forEach((r) => {
          const key = `${r.job_id}-${r.profile_id}`
          const mapAvailability = (s: string | null): Status => {
            if (!s) return null
            if (s === 'pending') return 'requested'
            if (s === 'expired') return null // treat cancelled/expired as cleared
            return s as Status
          }
          const mapOffer = (s: string | null): Status => {
            if (!s) return null
            if (s === 'pending') return 'sent'
            if (s === 'expired') return null // treat cancelled/expired as cleared
            return s as Status
          }
          const availStatus = mapAvailability(r.availability_status)
          const offerStatus = mapOffer(r.offer_status)
          // Only add entry if at least one status is non-null (same logic as byDate)
          if (availStatus || offerStatus) {
            mapByJob.set(key, {
              availability_status: availStatus,
              offer_status: offerStatus
            })
          }
        })
      } catch (e) {
        matrixDebug('Staffing matrix byJob error', e)
      }

      // 2) Date-based statuses derived from staffing_requests across visible jobs
      const reqRows: StaffingRequestRow[] = []
      try {
        const { data, error } = await supabase
          .from('staffing_requests')
          .select('job_id, profile_id, phase, status, updated_at, single_day, target_date, created_at, requested_by')
          .in('profile_id', technicianIds)
          .in('job_id', jobIds)

        if (error) {
          matrixDebug('Staffing matrix requests error', error)
        } else if (data?.length) {
          reqRows.push(...data)
        }
      } catch (e) {
        matrixDebug('Staffing matrix requests error', e)
      }

      // Build job lookup with Madrid-normalized date keys for overlap checks.
      const jobLookup = new Map<string, { id: string, startKey: string, endKey: string }>()
      jobs.forEach(j => {
        const startKey = normalizeDateLikeToMatrixKey(j.start_time)
        const endKey = normalizeDateLikeToMatrixKey(j.end_time)
        if (startKey && endKey) {
          jobLookup.set(j.id, { id: j.id, startKey, endKey })
        }
      })

      // Group requests by technician for faster lookups
      const byTech = new Map<string, StaffingRequestRow[]>()
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
          const dStr = formatMatrixDateKey(d)
          // Filter requests based on type:
          // - Single-day requests: exact target_date match (prevents following job reschedules)
          // - Full-span requests: show on all dates within the job's date range
          const matchingRequests = reqs.filter(r => {
            // Single-day requests with target_date: exact match only
            if (r.single_day && r.target_date) {
              return normalizeDateLikeToMatrixKey(r.target_date) === dStr
            }

            // Full-span requests (no target_date): show on all job dates
            if (!r.single_day) {
              const job = jobLookup.get(r.job_id)
              if (!job) return false
              return dStr >= job.startKey && dStr <= job.endKey
            }

            return false
          })
          if (!matchingRequests.length) return

          // Reduce to latest per phase, and collect ALL non-expired job IDs for bulk cancel
          const initialAcc = createLatestByPhaseAccumulator()
          const latest = matchingRequests.reduce((acc, r) => {
            const t = r.updated_at ? new Date(r.updated_at).getTime() : 0
            if (r.phase === 'availability') {
              // Collect ALL non-expired job IDs for this phase (to ensure complete cell clearing)
              if (r.status !== 'expired' && !acc.pending_availability_job_ids.includes(r.job_id)) {
                acc.pending_availability_job_ids.push(r.job_id)
              }
              const accT = acc.availability_updated_at || 0
              if (t > accT) {
                const mapped = r.status === 'pending' ? 'requested' : (r.status === 'expired' ? null : r.status)
                acc.availability_status = mapped
                acc.availability_updated_at = t
                acc.availability_job_id = r.job_id
                acc.availability_requested_by = r.requested_by ?? null
                acc.availability_created_at = r.created_at ?? null
              }
            } else if (r.phase === 'offer') {
              // Collect ALL non-expired job IDs for this phase (to ensure complete cell clearing)
              if (r.status !== 'expired' && !acc.pending_offer_job_ids.includes(r.job_id)) {
                acc.pending_offer_job_ids.push(r.job_id)
              }
              const accT = acc.offer_updated_at || 0
              if (t > accT) {
                const mapped = r.status === 'pending' ? 'sent' : (r.status === 'expired' ? null : r.status)
                acc.offer_status = mapped
                acc.offer_updated_at = t
                acc.offer_job_id = r.job_id
                acc.offer_requested_by = r.requested_by ?? null
                acc.offer_created_at = r.created_at ?? null
              }
            }
            return acc
          }, initialAcc)

          // Only set an entry if there's a non-null status for either phase
          if (latest.availability_status || latest.offer_status) {
            mapByDate.set(`${tid}-${dStr}`, {
              availability_status: latest.availability_status as Status,
              offer_status: latest.offer_status as Status,
              availability_job_id: latest.availability_job_id,
              offer_job_id: latest.offer_job_id,
              availability_requested_by: latest.availability_requested_by,
              availability_created_at: latest.availability_created_at,
              offer_requested_by: latest.offer_requested_by,
              offer_created_at: latest.offer_created_at,
              pending_availability_job_ids: latest.pending_availability_job_ids,
              pending_offer_job_ids: latest.pending_offer_job_ids
            })
          }
        })
      })

      return { byJob: mapByJob, byDate: mapByDate }
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  })
}
