import React, { useEffect, useMemo, useState } from 'react'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { REQUEST_TRANSPORT_OPTIONS } from '@/constants/transportOptions'
import { useQuery } from '@tanstack/react-query'
import { dataLayerClient } from '@/services/dataLayerClient';
import { format } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import type { Database, Json } from '@/integrations/supabase/types'


import { queryKeys } from "@/lib/react-query";
type Department = 'sound' | 'lights' | 'video'
type JobRow = Database['public']['Tables']['jobs']['Row']
type TransportRequestRow = Database['public']['Tables']['transport_requests']['Row']
type TransportRequestItemRow = Database['public']['Tables']['transport_request_items']['Row']

interface TourLogisticsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tourId: string
}

type VehicleItem = { transport_type: string; leftover_space_meters?: number | '' }
type TransportRequestRpcItem = { transport_type: string; leftover_space_meters: number | null }
type TourLogisticsJob = Pick<JobRow, 'id' | 'title' | 'start_time' | 'job_type' | 'status'>
type TransportRequestWithItems = Pick<
  TransportRequestRow,
  'id' | 'job_id' | 'department' | 'note' | 'status' | 'created_by'
> & {
  items?: Array<Pick<TransportRequestItemRow, 'transport_type' | 'leftover_space_meters'>> | null
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

const parseLeftoverSpaceInput = (value: string): VehicleItem['leftover_space_meters'] | null => {
  if (value === '') return ''

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null

  return Math.max(0, parsed)
}

const toTransportRequestRpcItems = (items: VehicleItem[]): TransportRequestRpcItem[] =>
  items
    .filter((item) => Boolean(item.transport_type))
    .map((item) => ({
      transport_type: item.transport_type,
      leftover_space_meters: item.leftover_space_meters === '' ? null : item.leftover_space_meters ?? null,
    }))

export function TourLogisticsDialog({ open, onOpenChange, tourId }: TourLogisticsDialogProps) {
  const { toast } = useToast()
  const [department, setDepartment] = useState<Department>('sound')
  const [note, setNote] = useState('')
  const [defaultItems, setDefaultItems] = useState<VehicleItem[]>([{ transport_type: 'trailer', leftover_space_meters: '' }])
  const [overrides, setOverrides] = useState<Record<string, VehicleItem[]>>({})

  // Load tour jobs (tour dates)
  const { data: tourJobs = [] } = useQuery({
    queryKey: queryKeys.scope('tour-logistics-jobs', tourId),
    enabled: open && !!tourId,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('jobs')
        .select('id, title, start_time, job_type, status')
        .eq('tour_id', tourId)
        .eq('job_type', 'tourdate')
        .order('start_time', { ascending: true })
      if (error) throw error
      return (data || []) as TourLogisticsJob[]
    },
  })

  const jobIds = useMemo(() => tourJobs.map((j) => j.id), [tourJobs])

  // Load existing requests for current department
  const { data: existingReqs = [], refetch: refetchRequests } = useQuery({
    queryKey: queryKeys.scope('tour-logistics-requests', tourId, department, jobIds.join(',')),
    enabled: open && jobIds.length > 0,
    queryFn: async () => {
      const { data, error } = await dataLayerClient.from('transport_requests')
        .select('id, job_id, department, note, status, created_by, items:transport_request_items(transport_type, leftover_space_meters)')
        .in('job_id', jobIds)
        .eq('department', department)
      if (error) throw error
      return (data || []) as TransportRequestWithItems[]
    },
  })

  // Initialize defaults/overrides from existing on department change
  useEffect(() => {
    if (!open) return
    // Pick the first request as the default template if available
    if (existingReqs.length > 0) {
      const first = existingReqs[0]
      const items: VehicleItem[] = Array.isArray(first.items) && first.items.length > 0
        ? first.items.map((it): VehicleItem => ({ transport_type: it.transport_type, leftover_space_meters: it.leftover_space_meters ?? '' }))
        : [{ transport_type: 'trailer', leftover_space_meters: '' }]
      setDefaultItems(items)
      setNote(first.note || '')

      const nextOverrides: Record<string, VehicleItem[]> = {}
      existingReqs.forEach((r) => {
        const its: VehicleItem[] = Array.isArray(r.items)
          ? r.items.map((it): VehicleItem => ({ transport_type: it.transport_type, leftover_space_meters: it.leftover_space_meters ?? '' }))
          : []
        // Consider an override if items differ from default or note differs
        const differ = JSON.stringify(its) !== JSON.stringify(items) || (r.note || '') !== (first.note || '')
        if (differ) nextOverrides[r.job_id] = its.length ? its : [{ transport_type: 'trailer', leftover_space_meters: '' }]
      })
      setOverrides(nextOverrides)
    } else {
      setDefaultItems([{ transport_type: 'trailer', leftover_space_meters: '' }])
      setNote('')
      setOverrides({})
    }
  }, [department, open, existingReqs])

  const setOverrideFor = (jobId: string, items: VehicleItem[]) => {
    setOverrides(prev => ({ ...prev, [jobId]: items }))
  }

  const removeOverrideFor = (jobId: string) => {
    setOverrides(prev => {
      const next = { ...prev }
      delete next[jobId]
      return next
    })
  }

  const saveAll = async () => {
    try {
      // Ensure we have auth
      const { data: userData } = await dataLayerClient.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('Not authenticated')

      for (const job of tourJobs) {
        const jobId = job.id
        const items = overrides[jobId] || defaultItems

        // Find existing request for job+department
        const existing = existingReqs.find(r => r.job_id === jobId)
        const { error } = await dataLayerClient.rpc('replace_transport_request_with_items', {
          p_request_id: existing?.id || null,
          p_job_id: jobId,
          p_department: department,
          p_note: note || null,
          p_status: existing?.status || 'requested',
          p_created_by: existing?.created_by || userId,
          p_items: toTransportRequestRpcItems(items) as unknown as Json,
        })

        if (error) throw error
      }

      toast({ title: 'Logística actualizada para las fechas de gira' })
      await refetchRequests()
      onOpenChange(false)
    } catch (e: unknown) {
      toast({ title: 'Error', description: getErrorMessage(e) || 'Error al guardar la logística', variant: 'destructive' })
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl w-[95vw] md:w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-base md:text-lg">Logística de Gira – Transporte</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {/* Department + Note */}
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="w-full sm:w-auto">
            <Label>Departamento</Label>
            <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sound">Sonido</SelectItem>
                <SelectItem value="lights">Luces</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full min-w-0 flex-1 sm:min-w-[240px]">
            <Label>Nota (se aplica a todas a menos que se anule en los elementos)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota opcional" />
          </div>
          <div className="w-full sm:ml-auto sm:w-auto">
            <Button onClick={saveAll} className="w-full sm:w-auto">Guardar en todas las fechas</Button>
          </div>
        </div>

        {/* Default vehicles */}
        <div className="mt-4 space-y-2">
          <Label>Vehículos por defecto para la gira</Label>
          <div className="space-y-2">
            {defaultItems.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border p-2 sm:flex sm:items-center sm:border-0 sm:p-0">
                <Select
                  value={it.transport_type}
                  onValueChange={(val) => {
                    const next = defaultItems.slice()
                    next[idx] = { ...next[idx], transport_type: val }
                    setDefaultItems(next)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REQUEST_TRANSPORT_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt.replace('_',' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  className="w-full sm:w-52"
                  placeholder="Espacio sobrante (m) - opcional"
                  value={it.leftover_space_meters === '' ? '' : it.leftover_space_meters}
                  onChange={(e) => {
                    const val = e.target.value
                    const num = parseLeftoverSpaceInput(val)
                    if (num === null) return
                    const next = defaultItems.slice()
                    next[idx] = { ...next[idx], leftover_space_meters: num }
                    setDefaultItems(next)
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const next = defaultItems.slice()
                    next.splice(idx, 1)
                    setDefaultItems(next.length ? next : [{ transport_type: 'trailer', leftover_space_meters: '' }])
                  }}
                >
                  Eliminar
                </Button>
              </div>
            ))}
            <div>
              <Button type="button" variant="secondary" onClick={() => setDefaultItems([...defaultItems, { transport_type: 'trailer', leftover_space_meters: '' }])}>Añadir Vehículo</Button>
            </div>
          </div>
        </div>

        {/* Per-date overrides */}
        <div className="mt-6">
          <Label>Anulaciones por fecha (opcional)</Label>
          <div className="mt-2 space-y-3 max-h-[40vh] overflow-y-auto pr-2">
            {tourJobs.map((job) => {
              const items = overrides[job.id]
              return (
                <div key={job.id} className="p-3 border rounded-md">
                  <div className="mb-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="outline">{format(new Date(job.start_time), 'EEE, MMM d')}</Badge>
                      <span className="min-w-0 break-words text-sm text-muted-foreground">{job.title}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {job.status === 'Cancelado' && (
                        <Badge variant="destructive" className="text-[10px]">Cancelado</Badge>
                      )}
                      {items ? (
                        <Button variant="outline" size="sm" onClick={() => removeOverrideFor(job.id)}>Usar por defecto</Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => setOverrideFor(job.id, defaultItems)}>Anular</Button>
                      )}
                    </div>
                  </div>
                  {items && (
                    <div className="space-y-2">
                      {items.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border p-2 sm:flex sm:items-center sm:border-0 sm:p-0">
                          <Select
                            value={it.transport_type}
                            onValueChange={(val) => {
                              const next = (overrides[job.id] || []).slice()
                              next[idx] = { ...next[idx], transport_type: val }
                              setOverrideFor(job.id, next)
                            }}
                          >
                            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {REQUEST_TRANSPORT_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt.replace('_',' ')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            className="w-full sm:w-52"
                            placeholder="Espacio sobrante (m) - opcional"
                            value={it.leftover_space_meters === '' ? '' : it.leftover_space_meters}
                            onChange={(e) => {
                              const val = e.target.value
                              const num = parseLeftoverSpaceInput(val)
                              if (num === null) return
                              const next = (overrides[job.id] || []).slice()
                              next[idx] = { ...next[idx], leftover_space_meters: num }
                              setOverrideFor(job.id, next)
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const next = (overrides[job.id] || []).slice()
                              next.splice(idx, 1)
                              setOverrideFor(job.id, next.length ? next : [{ transport_type: 'trailer', leftover_space_meters: '' }])
                            }}
                          >
                            Eliminar
                          </Button>
                        </div>
                      ))}
                      <div>
                        <Button type="button" variant="secondary" onClick={() => setOverrideFor(job.id, [...(overrides[job.id] || []), { transport_type: 'trailer', leftover_space_meters: '' }])}>Añadir Vehículo</Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
