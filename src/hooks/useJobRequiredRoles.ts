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

export type JobRequiredRoleInput = Omit<
  JobRequiredRoleRow,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>

type JobRequiredRoleUpdate = Pick<
  JobRequiredRoleRow,
  'id' | 'job_id' | 'department' | 'role_code' | 'quantity' | 'notes'
>

export interface SaveJobRequirementsPayload {
  jobId: string
  inserts: JobRequiredRoleInput[]
  updates: JobRequiredRoleUpdate[]
  deletes: string[]
}

interface SaveJobRequirementsResult {
  jobId: string
  inserted: JobRequiredRoleRow[]
  updated: JobRequiredRoleRow[]
  deleted: string[]
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

export function useRequiredRoleSummary(jobId: string, enabled: boolean = true) {
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
    enabled: enabled && !!jobId,
    staleTime: 30_000,
  })

  const byDepartment = useMemo(() => {
    const m = new Map<string, RequiredRoleSummaryItem>()
    ;(q.data || []).forEach((r) => m.set(r.department, r))
    return m
  }, [q.data])

  return { ...q, byDepartment }
}

async function fetchDepartmentRoleSummaries(jobId: string): Promise<RequiredRoleSummaryItem[]> {
  const { data: summaryData, error: summaryError } = await supabase
    .from('job_required_roles_summary')
    .select('department, total_required, roles')
    .eq('job_id', jobId)

  if (summaryError) throw summaryError

  const summaryItems = (summaryData || [])
    .map(parseSummaryRow)
    .filter(Boolean) as RequiredRoleSummaryItem[]

  return summaryItems
}

async function broadcastJobRequirementsUpdate(
  jobId: string,
  changeSummary: SaveJobRequirementsResult,
) {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const actorId = sessionData?.session?.user?.id ?? null

    const summaryItems = await fetchDepartmentRoleSummaries(jobId)

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
        type: 'batch' as const,
        created: changeSummary.inserted.map((row) => ({
          id: row.id,
          department: row.department,
          role_code: row.role_code,
          quantity: row.quantity,
        })),
        updated: changeSummary.updated.map((row) => ({
          id: row.id,
          department: row.department,
          role_code: row.role_code,
          quantity: row.quantity,
        })),
        deleted: changeSummary.deleted,
      },
    }

    const activityResult = await supabase.rpc('log_activity', {
      _code: 'job.requirements.updated',
      _job_id: jobId,
      _entity_type: 'job_required_roles',
      _entity_id:
        changeSummary.inserted[0]?.id ??
        changeSummary.updated[0]?.id ??
        changeSummary.deleted[0] ??
        jobId,
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
}

export function useSaveJobRequirements() {
  const queryClient = useQueryClient()
  return useMutation<SaveJobRequirementsResult, unknown, SaveJobRequirementsPayload>({
    mutationFn: async ({ jobId, inserts, updates, deletes }) => {
      const inserted: JobRequiredRoleRow[] = []
      const updated: JobRequiredRoleRow[] = []

      if (inserts.length > 0) {
        const { data, error } = await supabase
          .from('job_required_roles')
          .insert(inserts)
          .select('*')
        if (error) throw error
        inserted.push(...((data || []) as JobRequiredRoleRow[]))
      }

      if (updates.length > 0) {
        const { data, error } = await supabase
          .from('job_required_roles')
          .upsert(updates, { onConflict: 'id' })
          .select('*')
        if (error) throw error
        updated.push(...((data || []) as JobRequiredRoleRow[]))
      }

      if (deletes.length > 0) {
        const { error } = await supabase
          .from('job_required_roles')
          .delete()
          .in('id', deletes)
        if (error) throw error
      }

      return { jobId, inserted, updated, deleted: deletes }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['job-required-roles', result.jobId] })
      queryClient.invalidateQueries({ queryKey: ['job-required-summary', result.jobId] })
      queryClient.invalidateQueries({ queryKey: ['optimized-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })

      void broadcastJobRequirementsUpdate(result.jobId, result)
    },
  })
}

export function useUpsertJobRequiredRole() {
  const saveMutation = useSaveJobRequirements()
  return useMutation({
    mutationFn: async (
      payload: JobRequiredRoleInput & { id?: string },
    ) => {
      const { id, ...rest } = payload
      const result = await saveMutation.mutateAsync({
        jobId: rest.job_id,
        inserts: id ? [] : [rest],
        updates: id
          ? [
              {
                id,
                ...rest,
              },
            ]
          : [],
        deletes: [],
      })

      if (id) {
        const row = result.updated.find((item) => item.id === id)
        if (!row) throw new Error('Failed to update job required role')
        return { row, action: 'updated' as const }
      }

      const row = result.inserted[0]
      if (!row) throw new Error('Failed to create job required role')
      return { row, action: 'created' as const }
    },
  })
}

export function useDeleteJobRequiredRole() {
  const saveMutation = useSaveJobRequirements()
  return useMutation({
    mutationFn: async ({ id, job_id }: { id: string; job_id: string }) => {
      await saveMutation.mutateAsync({
        jobId: job_id,
        inserts: [],
        updates: [],
        deletes: [id],
      })

      return { id, job_id }
    },
  })
}
