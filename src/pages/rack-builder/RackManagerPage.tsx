import { useState } from 'react'
import { useRacks } from '@/features/rack-builder/hooks/useRacks'
import PageHeader from '@/features/rack-builder/components/layout/PageHeader'
import Button from '@/features/rack-builder/components/ui/Button'
import Modal from '@/features/rack-builder/components/ui/Modal'
import ConfirmDialog from '@/features/rack-builder/components/ui/ConfirmDialog'
import RackList from '@/features/rack-builder/components/racks/RackList'
import RackForm from '@/features/rack-builder/components/racks/RackForm'
import type { Rack, RackWidth } from '@/features/rack-builder/types'

export default function RackManagerPage() {
  const { racks, loading, createRack, updateRack, deleteRack } = useRacks()
  const [formOpen, setFormOpen] = useState(false)
  const [editingRack, setEditingRack] = useState<Rack | undefined>()
  const [deletingRack, setDeletingRack] = useState<Rack | undefined>()

  const handleSubmit = async (data: {
    name: string
    rack_units: number
    depth_mm: number
    width: RackWidth
  }) => {
    if (editingRack) {
      await updateRack(editingRack.id, data)
    } else {
      await createRack(data)
    }
    setFormOpen(false)
    setEditingRack(undefined)
  }

  const handleEdit = (rack: Rack) => {
    setEditingRack(rack)
    setFormOpen(true)
  }

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditingRack(undefined)
  }

  if (loading) {
    return <div className="text-gray-500">Loading...</div>
  }

  return (
    <div>
      <PageHeader
        title="Rack Manager"
        action={<Button onClick={() => setFormOpen(true)} className="w-full sm:w-auto">Add Rack</Button>}
      />
      <div className="mb-4 text-gray-700 dark:text-gray-300">
        Total: {racks.length} rack{racks.length !== 1 ? 's' : ''}
      </div>
      <RackList racks={racks} onEdit={handleEdit} onDelete={setDeletingRack} />

      <Modal
        isOpen={formOpen}
        onClose={handleCloseForm}
        title={editingRack ? 'Edit Rack' : 'New Rack'}
      >
        <RackForm
          initialData={editingRack}
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingRack}
        onClose={() => setDeletingRack(undefined)}
        onConfirm={() => deletingRack && deleteRack(deletingRack.id)}
        title="Delete Rack"
        message={`Are you sure you want to delete "${deletingRack?.name}"? This will also delete all layouts using this rack.`}
      />
    </div>
  )
}
