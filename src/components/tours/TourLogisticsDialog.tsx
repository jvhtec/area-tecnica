import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { REQUEST_TRANSPORT_OPTIONS } from '@/constants/transportOptions'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

type Department = 'sound' | 'lights' | 'video'

interface TourLogisticsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tourId: string
}

type VehicleItem = { transport_type: string; leftover_space_meters?: number | '' }

export function TourLogisticsDialog({ open, onOpenChange, tourId }: TourLogisticsDialogProps) {
  const { toast } = useToast()
  const [department, setDepartment] = useState<Department>('sound')
  const [note, setNote] = useState('')
  const [defaultItems, setDefaultItems] = useState<VehicleItem[]>([{ transport_type: 'trailer', leftover_space_meters: '' }])
  const [overrides, setOverrides] = useState<Record<string, VehicleItem[]>>({})

  // Load tour jobs (tour dates)
  const { data: tourJobs = [] } = useQuery({
    queryKey: ['tour-logistics-jobs', tourId],
    enabled: open && !!tourId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, start_time, job_type, status')
        .eq('tour_id', tourId)
        .eq('job_type', 'tourdate')
        .order('start_time', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  const jobIds = useMemo(() => tourJobs.map((j: any) => j.id), [tourJobs])

  // Load existing requests for current department
  const { data: existingReqs = [], refetch: refetchRequests } = useQuery({
    queryKey: ['tour-logistics-requests', tourId, department, jobIds.join(',')],
    enabled: open && jobIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transport_requests')
        .select('id, job_id, department, note, items:transport_request_items(transport_type, leftover_space_meters)')
        .in('job_id', jobIds)
        .eq('department', department)
      if (error) throw error
      return data || []
    },
  })

  // Initialize defaults/overrides from existing on department change
  useEffect(() => {
    if (!open) return
    // Pick the first request as the default template if available
    if (existingReqs.length > 0) {
      const first = existingReqs[0] as any
      const items = Array.isArray(first.items) && first.items.length > 0
        ? first.items.map((it: any) => ({ transport_type: it.transport_type, leftover_space_meters: it.leftover_space_meters ?? '' }))
        : [{ transport_type: 'trailer', leftover_space_meters: '' }]
      setDefaultItems(items)
      setNote((first.note as string) || '')

      const nextOverrides: Record<string, VehicleItem[]> = {}
      existingReqs.forEach((r: any) => {
        const its = Array.isArray(r.items) ? r.items.map((it: any) => ({ transport_type: it.transport_type, leftover_space_meters: it.leftover_space_meters ?? '' })) : []
        // Consider an override if items differ from default or note differs
        const differ = JSON.stringify(its) !== JSON.stringify(items) || (r.note || '') !== ((first.note as string) || '')
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
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) throw new Error('Not authenticated')

      for (const job of tourJobs as any[]) {
        const jobId = job.id as string
        const items = overrides[jobId] || defaultItems

        // Find existing request for job+department
        const existing = (existingReqs as any[]).find(r => r.job_id === jobId)
        let requestId: string | null = existing?.id || null

        const payload = {
          job_id: jobId,
          department,
          note: note || null,
          status: existing?.status || 'requested',
          created_by: existing?.created_by || userId,
        } as any

        if (requestId) {
          const { error: uErr } = await supabase.from('transport_requests').update(payload).eq('id', requestId)
          if (uErr) throw uErr
          // replace items
          await supabase.from('transport_request_items').delete().eq('request_id', requestId)
          const toInsert = items.filter(it => !!it.transport_type).map(it => ({
            request_id: requestId!,
            transport_type: it.transport_type,
            leftover_space_meters: it.leftover_space_meters === '' ? null : it.leftover_space_meters,
          }))
          if (toInsert.length) {
            const { error: iErr } = await supabase.from('transport_request_items').insert(toInsert)
            if (iErr) throw iErr
          }
        } else {
          const { data: ins, error: iErr } = await supabase
            .from('transport_requests')
            .insert(payload)
            .select('id')
            .single()
          if (iErr) throw iErr
          requestId = (ins as any).id
          const toInsert = items.filter(it => !!it.transport_type).map(it => ({
            request_id: requestId!,
            transport_type: it.transport_type,
            leftover_space_meters: it.leftover_space_meters === '' ? null : it.leftover_space_meters,
          }))
          if (toInsert.length) {
            const { error: iiErr } = await supabase.from('transport_request_items').insert(toInsert)
            if (iiErr) throw iiErr
          }
        }
      }

      toast({ title: 'Logistics updated for tour dates' })
      await refetchRequests()
      onOpenChange(false)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save logistics', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tour Logistics – Transport</DialogTitle>
        </DialogHeader>

        {/* Department + Note */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label>Department</Label>
            <Select value={department} onValueChange={(v) => setDepartment(v as Department)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sound">Sound</SelectItem>
                <SelectItem value="lights">Lights</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <Label>Note (applies to all unless overridden in items)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
          </div>
          <div className="ml-auto">
            <Button onClick={saveAll}>Save to all dates</Button>
          </div>
        </div>

        {/* Default vehicles */}
        <div className="mt-4 space-y-2">
          <Label>Default vehicles for tour</Label>
          <div className="space-y-2">
            {defaultItems.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={it.transport_type}
                  onValueChange={(val) => {
                    const next = defaultItems.slice()
                    next[idx] = { ...next[idx], transport_type: val }
                    setDefaultItems(next)
                  }}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
                  className="w-52"
                  placeholder="Leftover space (m) - optional"
                  value={it.leftover_space_meters === '' ? '' : it.leftover_space_meters}
                  onChange={(e) => {
                    const val = e.target.value
                    const num = val === '' ? '' : Math.max(0, Number(val))
                    const next = defaultItems.slice()
                    next[idx] = { ...next[idx], leftover_space_meters: num as any }
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
                  Remove
                </Button>
              </div>
            ))}
            <div>
              <Button type="button" variant="secondary" onClick={() => setDefaultItems([...defaultItems, { transport_type: 'trailer', leftover_space_meters: '' }])}>Add Vehicle</Button>
            </div>
          </div>
        </div>

        {/* Per-date overrides */}
        <div className="mt-6">
          <Label>Per-date overrides (optional)</Label>
          <div className="mt-2 space-y-3 max-h-[40vh] overflow-y-auto pr-2">
            {tourJobs.map((job: any) => {
              const items = overrides[job.id]
              return (
                <div key={job.id} className="p-3 border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{format(new Date(job.start_time), 'EEE, MMM d')}</Badge>
                      <span className="text-sm text-muted-foreground">{job.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'Cancelado' && (
                        <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>
                      )}
                      {items ? (
                        <Button variant="outline" size="sm" onClick={() => removeOverrideFor(job.id)}>Use default</Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => setOverrideFor(job.id, defaultItems)}>Override</Button>
                      )}
                    </div>
                  </div>
                  {items && (
                    <div className="space-y-2">
                      {items.map((it, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Select
                            value={it.transport_type}
                            onValueChange={(val) => {
                              const next = (overrides[job.id] || []).slice()
                              next[idx] = { ...next[idx], transport_type: val }
                              setOverrideFor(job.id, next)
                            }}
                          >
                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
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
                            className="w-52"
                            placeholder="Leftover space (m) - optional"
                            value={it.leftover_space_meters === '' ? '' : it.leftover_space_meters}
                            onChange={(e) => {
                              const val = e.target.value
                              const num = val === '' ? '' : Math.max(0, Number(val))
                              const next = (overrides[job.id] || []).slice()
                              next[idx] = { ...next[idx], leftover_space_meters: num as any }
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
                            Remove
                          </Button>
                        </div>
                      ))}
                      <div>
                        <Button type="button" variant="secondary" onClick={() => setOverrideFor(job.id, [...(overrides[job.id] || []), { transport_type: 'trailer', leftover_space_meters: '' }])}>Add Vehicle</Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

