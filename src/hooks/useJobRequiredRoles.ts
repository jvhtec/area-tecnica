import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface JobRequiredRoleRow {
  id: string
  job_id: string
  department: string
  role_code: string
  quantity: number
  notes: string | null
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

export interface RequiredRoleSummaryItem {
  job_id: string
  department: string
  total_required: number
  roles: Array<{ role_code: string; quantity: number; notes?: string | null }>
}

function parseSummaryRow(row: any): RequiredRoleSummaryItem | null {
  if (!row) return null
  const roles = Array.isArray(row.roles)
    ? (row.roles as any[]).map((r) => ({
        role_code: r.role_code as string,
        quantity: Number(r.quantity || 0),
        notes: (r.notes ?? null) as string | null,
      }))
    : []
  return {
    job_id: row.job_id as string,
    department: row.department as string,
    total_required: Number(row.total_required || 0),
    roles,
  }
}

export function useJobRequiredRoles(jobId: string) {
  return useQuery<JobRequiredRoleRow[]>({
    queryKey: ['job-required-roles', jobId],
    queryFn: async () => {
      if (!jobId) return []
      const { data, error } = await supabase
        .from('job_required_roles')
        .select('*')
        .eq('job_id', jobId)
        .order('department', { ascending: true })
        .order('role_code', { ascending: true })
      if (error) throw error
      return (data || []) as JobRequiredRoleRow[]
    },
    enabled: !!jobId,
    staleTime: 60_000,
  })
}

export function useRequiredRoleSummary(jobId: string) {
  const q = useQuery<RequiredRoleSummaryItem[]>({
    queryKey: ['job-required-summary', jobId],
    queryFn: async () => {
      if (!jobId) return []
      const { data, error } = await supabase
        .from('job_required_roles_summary')
        .select('job_id, department, total_required, roles')
        .eq('job_id', jobId)
      if (error) throw error
      const rows = (data || []).map(parseSummaryRow).filter(Boolean) as RequiredRoleSummaryItem[]
      return rows
    },
    enabled: !!jobId,
    staleTime: 30_000,
  })

  const byDepartment = useMemo(() => {
    const m = new Map<string, RequiredRoleSummaryItem>()
    ;(q.data || []).forEach((r) => m.set(r.department, r))
    return m
  }, [q.data])

  return { ...q, byDepartment }
}

export function useUpsertJobRequiredRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<JobRequiredRoleRow, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'> & { id?: string }) => {
      const { id, ...rest } = payload
      if (id) {
        const { data, error } = await supabase
          .from('job_required_roles')
          .update(rest)
          .eq('id', id)
          .select('*')
          .single()
        if (error) throw error
        return { row: data as JobRequiredRoleRow, action: 'updated' as const }
      } else {
        const { data, error } = await supabase
          .from('job_required_roles')
          .insert(rest)
          .select('*')
          .single()
        if (error) throw error
        return { row: data as JobRequiredRoleRow, action: 'created' as const }
      }
    },
    onSuccess: ({ row, action }) => {
      queryClient.invalidateQueries({ queryKey: ['job-required-roles', row.job_id] })
      queryClient.invalidateQueries({ queryKey: ['job-required-summary', row.job_id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      void (async () => {
        try {
          const jobId = row.job_id
          const { data: sessionData } = await supabase.auth.getSession()
          const actorId = sessionData?.session?.user?.id ?? null

          const { data: summaryData, error: summaryError } = await supabase
            .from('job_required_roles_summary')
            .select('department, total_required, roles')
            .eq('job_id', jobId)

          if (summaryError) throw summaryError

          const summaryItems = (summaryData || [])
            .map(parseSummaryRow)
            .filter(Boolean) as RequiredRoleSummaryItem[]

          const departmentRoles = summaryItems.map((item) => ({
            department: item.department,
            total_required: item.total_required,
            roles: item.roles.map((role) => ({
              role_code: role.role_code,
              quantity: role.quantity,
              notes: role.notes ?? null,
            })),
          }))

          const activityPayload = {
            department_roles: departmentRoles,
            last_change: {
              type: action,
              department: row.department,
              role_code: row.role_code,
              quantity: row.quantity,
            },
          }

          const activityResult = await supabase.rpc('log_activity', {
            _code: 'job.requirements.updated',
            _job_id: jobId,
            _entity_type: 'job_required_roles',
            _entity_id: row.id,
            _payload: activityPayload,
          })

          if (activityResult.error) {
            console.warn('Failed to record job requirements activity:', activityResult.error)
          }

          const pushResult = await supabase.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: 'job.requirements.updated',
              job_id: jobId,
              actor_id: actorId ?? undefined,
              department_roles: departmentRoles,
            },
          })

          if (pushResult.error) {
            console.warn('Failed to invoke job requirements push:', pushResult.error)
          }
        } catch (err) {
          console.warn('Failed to broadcast job requirements update:', err)
        }
      })()
    },
  })
}

export function useDeleteJobRequiredRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, job_id }: { id: string; job_id: string }) => {
      const { error } = await supabase.from('job_required_roles').delete().eq('id', id)
      if (error) throw error
      return { id, job_id }
    },
    onSuccess: ({ job_id, id }) => {
      queryClient.invalidateQueries({ queryKey: ['job-required-roles', job_id] })
      queryClient.invalidateQueries({ queryKey: ['job-required-summary', job_id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      void (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const actorId = sessionData?.session?.user?.id ?? null

          const { data: summaryData, error: summaryError } = await supabase
            .from('job_required_roles_summary')
            .select('department, total_required, roles')
            .eq('job_id', job_id)

          if (summaryError) throw summaryError

          const summaryItems = (summaryData || [])
            .map(parseSummaryRow)
            .filter(Boolean) as RequiredRoleSummaryItem[]

          const departmentRoles = summaryItems.map((item) => ({
            department: item.department,
            total_required: item.total_required,
            roles: item.roles.map((role) => ({
              role_code: role.role_code,
              quantity: role.quantity,
              notes: role.notes ?? null,
            })),
          }))

          const activityPayload = {
            department_roles: departmentRoles,
            last_change: {
              type: 'deleted',
              deleted_role_id: id,
            },
          }

          const activityResult = await supabase.rpc('log_activity', {
            _code: 'job.requirements.updated',
            _job_id: job_id,
            _entity_type: 'job_required_roles',
            _entity_id: id,
            _payload: activityPayload,
          })

          if (activityResult.error) {
            console.warn('Failed to record job requirements activity:', activityResult.error)
          }

          const pushResult = await supabase.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: 'job.requirements.updated',
              job_id,
              actor_id: actorId ?? undefined,
              department_roles: departmentRoles,
            },
          })

          if (pushResult.error) {
            console.warn('Failed to invoke job requirements push:', pushResult.error)
          }
        } catch (err) {
          console.warn('Failed to broadcast job requirements deletion:', err)
        }
      })()
    },
  })
}

