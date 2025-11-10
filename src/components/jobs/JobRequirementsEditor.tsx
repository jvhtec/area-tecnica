import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  useJobRequiredRoles,
  useSaveJobRequirements,
  type JobRequiredRoleRow,
  type JobRequiredRoleInput,
} from '@/hooks/useJobRequiredRoles'
import { roleOptionsForDiscipline } from '@/types/roles'

interface JobRequirementsEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  departments: string[]
}

type EditableRowStatus = 'clean' | 'new' | 'updated'

interface EditableRow
  extends Pick<JobRequiredRoleRow, 'id' | 'job_id' | 'department' | 'role_code' | 'quantity' | 'notes'> {
  localId: string
  status: EditableRowStatus
}

const createEditableRow = (row: JobRequiredRoleRow): EditableRow => ({
  localId: row.id,
  id: row.id,
  job_id: row.job_id,
  department: row.department,
  role_code: row.role_code,
  quantity: row.quantity,
  notes: row.notes,
  status: 'clean',
})

const createLocalId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tmp-${Math.random().toString(36).slice(2, 11)}`

export const JobRequirementsEditor: React.FC<JobRequirementsEditorProps> = ({ open, onOpenChange, jobId, departments }) => {
  const { data: rows = [], isLoading } = useJobRequiredRoles(jobId)
  const {
    mutateAsync: saveChanges,
    isPending: saving,
    reset: resetSave,
  } = useSaveJobRequirements()
  const [editableRows, setEditableRows] = React.useState<EditableRow[]>([])
  const [deletedIds, setDeletedIds] = React.useState<string[]>([])
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const resetStateFromServer = React.useCallback(() => {
    const next = (rows || []).map(createEditableRow)
    setEditableRows(next)
    setDeletedIds([])
  }, [rows])

  const isDirty = React.useMemo(
    () =>
      deletedIds.length > 0 ||
      editableRows.some((row) => row.status === 'new' || row.status === 'updated'),
    [editableRows, deletedIds],
  )

  React.useEffect(() => {
    if (!open) return
    if (isDirty) return
    resetStateFromServer()
  }, [open, rows, isDirty, resetStateFromServer])

  const rowsByDepartment = React.useMemo(() => {
    const map = new Map<string, EditableRow[]>()
    departments.forEach((dept) => map.set(dept, []))
    editableRows.forEach((row) => {
      const list = map.get(row.department) ?? []
      list.push(row)
      map.set(row.department, list)
    })
    return map
  }, [editableRows, departments])

  const handleAdd = (dept: string) => {
    if (!jobId) return
    const options = roleOptionsForDiscipline(dept)
    const defaultCode = options[0]?.code ?? ''
    if (!defaultCode) return

    const newRow: EditableRow = {
      localId: createLocalId(),
      id: undefined,
      job_id: jobId,
      department: dept,
      role_code: defaultCode,
      quantity: 1,
      notes: null,
      status: 'new',
    }

    setEditableRows((prev) => [...prev, newRow])
  }

  const markRowUpdated = (localId: string, updater: (row: EditableRow) => EditableRow) => {
    setEditableRows((prev) =>
      prev.map((row) => {
        if (row.localId !== localId) return row
        const updatedRow = updater(row)
        const nextStatus: EditableRowStatus = row.status === 'new' ? 'new' : 'updated'
        return { ...updatedRow, status: nextStatus }
      }),
    )
  }

  const handleRoleChange = (localId: string, newCode: string) => {
    markRowUpdated(localId, (row) => ({ ...row, role_code: newCode }))
  }

  const handleQtyChange = (localId: string, value: number) => {
    const next = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
    markRowUpdated(localId, (row) => ({ ...row, quantity: next }))
  }

  const handleDelete = (row: EditableRow) => {
    setEditableRows((prev) => prev.filter((item) => item.localId !== row.localId))
    if (row.id) {
      setDeletedIds((prev) => [...prev, row.id!])
    }
  }

  const handleCancel = () => {
    resetStateFromServer()
    setErrorMessage(null)
    resetSave()
  }

  const handleSave = async () => {
    if (!jobId) return

    const inserts = editableRows
      .filter((row) => row.status === 'new')
      .map<JobRequiredRoleInput>((row) => ({
        job_id: row.job_id,
        department: row.department,
        role_code: row.role_code,
        quantity: row.quantity,
        notes: row.notes,
      }))

    const updates = editableRows
      .filter((row) => row.status === 'updated' && row.id)
      .map((row) => ({
        id: row.id!,
        job_id: row.job_id,
        department: row.department,
        role_code: row.role_code,
        quantity: row.quantity,
        notes: row.notes,
      }))

    if (inserts.length === 0 && updates.length === 0 && deletedIds.length === 0) return

    try {
      const result = await saveChanges({
        jobId,
        inserts,
        updates,
        deletes: deletedIds,
      })

      setEditableRows((prev) => {
        const updatedMap = new Map(result.updated.map((row) => [row.id, row]))
        const existing = prev
          .filter((row) => row.status !== 'new')
          .map((row) => {
            if (row.id && result.deleted.includes(row.id)) {
              return null
            }
            if (row.id && updatedMap.has(row.id)) {
              return createEditableRow(updatedMap.get(row.id)!)
            }
            return { ...row, status: 'clean' as EditableRowStatus, localId: row.id ?? row.localId }
          })
          .filter((row): row is EditableRow => row !== null)

        const inserted = result.inserted.map(createEditableRow)
        return [...existing, ...inserted]
      })

      setDeletedIds([])
      setErrorMessage(null)
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Failed to save job requirements.'
      setErrorMessage(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <DialogHeader>
            <DialogTitle>Required Crew</DialogTitle>
            {isLoading && <p className="text-sm text-muted-foreground">Loading requirements…</p>}
          </DialogHeader>
          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
              Save
            </Button>
          </div>
        </div>
        {errorMessage && <div className="text-sm text-destructive">{errorMessage}</div>}
        <div className="space-y-6">
          {departments.map((dept) => {
            const deptRows = rowsByDepartment.get(dept) ?? []
            return (
              <div key={dept} className="border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium capitalize">{dept}</div>
                  <Button size="sm" variant="outline" onClick={() => handleAdd(dept)} disabled={saving}>
                    Add Role
                  </Button>
                </div>
                <div className="space-y-2">
                  {deptRows.map((row) => (
                    <div key={row.localId} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-7">
                        <Label className="sr-only">Role</Label>
                        <Select value={row.role_code} onValueChange={(value) => handleRoleChange(row.localId, value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleOptionsForDiscipline(dept).map((opt) => (
                              <SelectItem key={opt.code} value={opt.code}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Label className="sr-only">Qty</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={row.quantity}
                          onChange={(event) => handleQtyChange(row.localId, Number(event.target.value))}
                        />
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(row)} disabled={saving}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                  {deptRows.length === 0 && (
                    <div className="text-sm text-muted-foreground">No roles configured</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

