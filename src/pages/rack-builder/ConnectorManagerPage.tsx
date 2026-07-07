import { useMemo, useState } from 'react'
import PageHeader from '@/features/rack-builder/components/layout/PageHeader'
import Button from '@/features/rack-builder/components/ui/Button'
import Modal from '@/features/rack-builder/components/ui/Modal'
import ConfirmDialog from '@/features/rack-builder/components/ui/ConfirmDialog'
import Select from '@/features/rack-builder/components/ui/Select'
import ConnectorList from '@/features/rack-builder/components/connectors/ConnectorList'
import ConnectorForm from '@/features/rack-builder/components/connectors/ConnectorForm'
import { useConnectors } from '@/features/rack-builder/hooks/useConnectors'
import type { ConnectorDefinition } from '@/features/rack-builder/types'

export default function ConnectorManagerPage() {
  const { connectors, loading, createConnector, updateConnector, deleteConnector } = useConnectors()
  const [formOpen, setFormOpen] = useState(false)
  const [editingConnector, setEditingConnector] = useState<ConnectorDefinition | undefined>()
  const [deletingConnector, setDeletingConnector] = useState<ConnectorDefinition | undefined>()
  const [selectedCategory, setSelectedCategory] = useState<'all' | ConnectorDefinition['category']>('all')

  const filteredConnectors = useMemo(
    () => selectedCategory === 'all' ? connectors : connectors.filter((connector) => connector.category === selectedCategory),
    [connectors, selectedCategory],
  )

  const handleSubmit = async (data: {
    id: string
    name: string
    category: ConnectorDefinition['category']
    image_path: string
    is_d_size: boolean
    grid_width: number
    grid_height: number
    mounting: ConnectorDefinition['mounting']
    notes: string
    weight_kg: number
  }) => {
    if (editingConnector) {
      await updateConnector(editingConnector.id, {
        name: data.name,
        category: data.category,
        image_path: data.image_path,
        is_d_size: data.is_d_size,
        grid_width: data.grid_width,
        grid_height: data.grid_height,
        mounting: data.mounting,
        notes: data.notes,
        weight_kg: data.weight_kg,
      })
    } else {
      await createConnector(data)
    }
    setEditingConnector(undefined)
    setFormOpen(false)
  }

  if (loading) return <div className="text-gray-500">Loading...</div>

  return (
    <div>
      <div className="sticky top-0 z-10 mb-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/95 dark:bg-gray-900/95 pb-4 backdrop-blur">
        <PageHeader
          title="Connector Manager"
          action={<Button onClick={() => setFormOpen(true)} className="w-full sm:w-auto">Add Connector</Button>}
        />

        <div className="mb-4 text-gray-700 dark:text-gray-300">
          Showing {filteredConnectors.length} of {connectors.length} connector{connectors.length === 1 ? '' : 's'}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Select
            label="Category"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value as 'all' | ConnectorDefinition['category'])}
            options={[
              { value: 'all', label: 'All categories' },
              { value: 'audio', label: 'Audio' },
              { value: 'data', label: 'Data' },
              { value: 'power', label: 'Power' },
              { value: 'multipin', label: 'Multipin' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>
      </div>

      <ConnectorList
        connectors={filteredConnectors}
        onEdit={(connector) => { setEditingConnector(connector); setFormOpen(true) }}
        onDelete={setDeletingConnector}
      />

      <Modal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingConnector(undefined) }}
        title={editingConnector ? 'Edit Connector' : 'New Connector'}
      >
        <ConnectorForm
          initialData={editingConnector}
          onSubmit={handleSubmit}
          onCancel={() => { setFormOpen(false); setEditingConnector(undefined) }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingConnector}
        onClose={() => setDeletingConnector(undefined)}
        onConfirm={async () => {
          if (!deletingConnector) return
          await deleteConnector(deletingConnector.id)
          setDeletingConnector(undefined)
        }}
        title="Delete Connector"
        message={`Are you sure you want to delete "${deletingConnector?.name}"?`}
      />
    </div>
  )
}
