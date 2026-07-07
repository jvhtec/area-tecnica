import Button from '../ui/Button'
import type { ConnectorDefinition } from '../../types'
import { getDeviceImageUrl } from '../../hooks/useDevices'

interface ConnectorListProps {
  connectors: ConnectorDefinition[]
  onEdit: (connector: ConnectorDefinition) => void
  onDelete: (connector: ConnectorDefinition) => void
}

export default function ConnectorList({ connectors, onEdit, onDelete }: ConnectorListProps) {
  if (connectors.length === 0) {
    return <p className="text-sm text-gray-500">No connectors defined yet. Create one to get started.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {connectors.map((connector) => {
        const thumbUrl = getDeviceImageUrl(connector.image_path, 'rack-builder-connector-images')
        return (
          <div key={connector.id} className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 p-4 transition-shadow hover:shadow-sm">
            {thumbUrl ? (
              <img src={thumbUrl} alt={connector.name} className="mb-3 h-24 w-full rounded bg-gray-100 dark:bg-gray-900/50 object-contain" />
            ) : (
              <div className="mb-3 flex h-24 w-full items-center justify-center rounded bg-gray-100 dark:bg-gray-900/50 text-xs text-gray-400 dark:text-gray-500">No image</div>
            )}
            <div className="mb-1 font-medium text-gray-900 dark:text-white">{connector.name}</div>
            <div className="mb-1 text-xs text-blue-700 dark:text-blue-400">{connector.category}</div>
            <div className="mb-3 text-xs text-gray-500 dark:text-gray-400">
              ID: {connector.id} · {connector.grid_width}×{connector.grid_height} · {connector.mounting} · {connector.weight_kg}kg
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => onEdit(connector)}>Edit</Button>
              <Button variant="danger" onClick={() => onDelete(connector)}>Delete</Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
