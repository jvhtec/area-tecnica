import React, { useMemo, useState } from 'react'
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from '@/components/ui/responsive-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { roleOptionsForDiscipline } from '@/types/roles'
import { dataLayerClient } from '@/services/dataLayerClient';
import { useToast } from '@/hooks/use-toast'
import type { Json } from '@/integrations/supabase/types'

type Dept = 'sound' | 'lights' | 'video'

interface RequirementRow { role_code: string; quantity: number }
interface RequirementRpcRow extends RequirementRow { department: Dept; notes: string | null }

interface TourRequirementsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tourId: string
}

const DEPARTMENTS: Dept[] = ['sound', 'lights', 'video']

export const TourRequirementsDialog: React.FC<TourRequirementsDialogProps> = ({ open, onOpenChange, tourId }) => {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [byDept, setByDept] = useState<Record<Dept, RequirementRow[]>>({
    sound: [],
    lights: [],
    video: []
  })

  const addRow = (dept: Dept) => {
    const opts = roleOptionsForDiscipline(dept)
    if (!opts.length) return
    setByDept((prev) => ({
      ...prev,
      [dept]: [...prev[dept], { role_code: opts[0].code, quantity: 1 }]
    }))
  }

  const updateRow = (dept: Dept, idx: number, patch: Partial<RequirementRow>) => {
    setByDept((prev) => {
      const rows = [...prev[dept]]
      rows[idx] = { ...rows[idx], ...patch }
      return { ...prev, [dept]: rows }
    })
  }

  const removeRow = (dept: Dept, idx: number) => {
    setByDept((prev) => {
      const rows = prev[dept].filter((_, i) => i !== idx)
      return { ...prev, [dept]: rows }
    })
  }

  const totalRows = useMemo(() => DEPARTMENTS.reduce((n, d) => n + byDept[d].length, 0), [byDept])

  const handleApply = async () => {
    try {
      setSaving(true)
      if (!tourId) throw new Error('Missing tour id')
      const selectedDepts = DEPARTMENTS.filter((d) => byDept[d].length > 0)
      if (selectedDepts.length === 0) {
        toast({ title: 'Nothing to apply', description: 'Add at least one requirement', variant: 'destructive' })
        return
      }

      // 1) Fetch all jobs for this tour
      const { data: jobs, error: jobsErr } = await dataLayerClient.from('jobs')
        .select('id')
        .eq('tour_id', tourId)

      if (jobsErr) throw jobsErr
      const jobIds = (jobs || []).map((j) => j.id).filter(Boolean)
      if (jobIds.length === 0) {
        toast({ title: 'No jobs found', description: 'This tour has no jobs to update', variant: 'destructive' })
        return
      }

      // 2) For each job, replace required roles for selected departments atomically
      for (const jobId of jobIds) {
        const rows: RequirementRpcRow[] = selectedDepts.flatMap((dept) =>
          byDept[dept].filter((r) => (r.quantity ?? 0) > 0).map((r): RequirementRpcRow => ({
            department: dept,
            role_code: r.role_code,
            quantity: Math.max(0, Math.floor(r.quantity || 0)),
            notes: null,
          }))
        )

        const { error: replaceErr } = await dataLayerClient.rpc('replace_job_required_roles', {
          p_job_id: jobId,
          p_departments: selectedDepts,
          p_rows: rows as unknown as Json,
        })

        if (replaceErr) throw replaceErr
      }

      toast({ title: 'Applied', description: `Requirements applied to ${jobIds.length} job(s)` })
      onOpenChange(false)
    } catch (e: any) {
      console.error('Tour requirements apply error:', e)
      toast({ title: 'Error', description: e?.message || 'Failed to apply requirements', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-3xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Tour‑wide Personnel Requirements</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure required crew for this tour. These requirements will be applied to every job in the tour and replace existing per‑job requirements for the selected departments.
          </p>

          {DEPARTMENTS.map((dept) => (
            <div key={dept} className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium capitalize">{dept}</div>
                <Button size="sm" variant="outline" onClick={() => addRow(dept)}>Add Role</Button>
              </div>
              <div className="space-y-2">
                {byDept[dept].map((r, idx) => (
                  <div key={`${dept}-${idx}`} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12">
                    <div className="sm:col-span-7">
                      <Label className="sr-only">Role</Label>
                      <Select value={r.role_code} onValueChange={(v) => updateRow(dept, idx, { role_code: v })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptionsForDiscipline(dept).map((opt) => (
                            <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="sr-only">Qty</Label>
                      <Input type="number" min={0} step={1} value={r.quantity}
                        onChange={(e) => updateRow(dept, idx, { quantity: Number(e.target.value) })} />
                    </div>
                    <div className="flex justify-end sm:col-span-2">
                      <Button className="w-full sm:w-auto" variant="destructive" size="sm" onClick={() => removeRow(dept, idx)}>Delete</Button>
                    </div>
                  </div>
                ))}
                {byDept[dept].length === 0 && (
                  <div className="text-sm text-muted-foreground">No roles configured</div>
                )}
              </div>
            </div>
          ))}

          <Separator />
          <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleApply} disabled={saving || totalRows === 0}>{saving ? 'Applying…' : 'Apply to All Tour Jobs'}</Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
