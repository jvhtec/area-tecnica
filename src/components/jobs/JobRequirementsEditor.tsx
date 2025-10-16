import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useJobRequiredRoles, useUpsertJobRequiredRole, useDeleteJobRequiredRole } from '@/hooks/useJobRequiredRoles'
import { roleOptionsForDiscipline, labelForCode } from '@/types/roles'

interface JobRequirementsEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  departments: string[]
}

export const JobRequirementsEditor: React.FC<JobRequirementsEditorProps> = ({ open, onOpenChange, jobId, departments }) => {
  const { data: rows = [] } = useJobRequiredRoles(jobId)
  const { mutateAsync: upsert, isPending: saving } = useUpsertJobRequiredRole()
  const { mutateAsync: remove, isPending: deleting } = useDeleteJobRequiredRole()

  const byDept = React.useMemo(() => {
    const m = new Map<string, Array<any>>()
    ;(rows || []).forEach((r) => {
      const list = m.get(r.department) ?? []
      list.push(r)
      m.set(r.department, list)
    })
    return m
  }, [rows])

  const handleAdd = async (dept: string) => {
    const opts = roleOptionsForDiscipline(dept)
    const defaultCode = opts[0]?.code || ''
    if (!defaultCode) return
    await upsert({ job_id: jobId, department: dept, role_code: defaultCode, quantity: 1, notes: null })
  }

  const handleRoleChange = async (r: any, newCode: string) => {
    await upsert({ id: r.id, job_id: r.job_id, department: r.department, role_code: newCode, quantity: r.quantity, notes: r.notes })
  }

  const handleQtyChange = async (r: any, q: number) => {
    const next = Number.isFinite(q) && q >= 0 ? Math.floor(q) : 0
    await upsert({ id: r.id, job_id: r.job_id, department: r.department, role_code: r.role_code, quantity: next, notes: r.notes })
  }

  const handleDelete = async (r: any) => {
    await remove({ id: r.id, job_id: r.job_id })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Required Crew</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {departments.map((dept) => (
            <div key={dept} className="border rounded-md p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium capitalize">{dept}</div>
                <Button size="sm" variant="outline" onClick={() => handleAdd(dept)} disabled={saving}>Add Role</Button>
              </div>
              <div className="space-y-2">
                {(byDept.get(dept) || []).map((r) => (
                  <div key={r.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-7">
                      <Label className="sr-only">Role</Label>
                      <Select defaultValue={r.role_code} onValueChange={(v) => handleRoleChange(r, v)}>
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
                    <div className="col-span-3">
                      <Label className="sr-only">Qty</Label>
                      <Input type="number" min={0} step={1} defaultValue={r.quantity} onBlur={(e) => handleQtyChange(r, Number(e.target.value))} />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(r)} disabled={deleting}>Delete</Button>
                    </div>
                  </div>
                ))}
                {(byDept.get(dept) || []).length === 0 && (
                  <div className="text-sm text-muted-foreground">No roles configured</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

