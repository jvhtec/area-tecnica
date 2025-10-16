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
        return data as JobRequiredRoleRow
      } else {
        const { data, error } = await supabase
          .from('job_required_roles')
          .insert(rest)
          .select('*')
          .single()
        if (error) throw error
        return data as JobRequiredRoleRow
      }
    },
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ['job-required-roles', row.job_id] })
      queryClient.invalidateQueries({ queryKey: ['job-required-summary', row.job_id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
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
    onSuccess: ({ job_id }) => {
      queryClient.invalidateQueries({ queryKey: ['job-required-roles', job_id] })
      queryClient.invalidateQueries({ queryKey: ['job-required-summary', job_id] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

