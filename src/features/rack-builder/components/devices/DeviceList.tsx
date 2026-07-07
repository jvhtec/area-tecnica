import { Star } from 'lucide-react'
import type { Device } from '../../types'
import { getDeviceImageUrl } from '../../hooks/useDevices'
import Button from '../ui/Button'

interface DeviceListProps {
  devices: Device[]
  onEdit: (device: Device) => void
  onDelete: (device: Device) => void
  onToggleFavorite: (device: Device) => void
}

function ImageBadge({ label, present }: { label: string; present: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${present ? 'bg-green-500/90 text-white' : 'bg-gray-400/60 text-gray-100 dark:bg-gray-600/60'}`}
    >
      {label}
    </span>
  )
}

export default function DeviceList({ devices, onEdit, onDelete, onToggleFavorite }: DeviceListProps) {
  if (devices.length === 0) {
    return <p className="text-gray-500 text-sm">No devices defined yet. Create one to get started.</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {devices.map((device) => {
        const thumbUrl = getDeviceImageUrl(device.front_image_path)
        const hasFront = !!device.front_image_path
        const hasRear = !!device.rear_image_path
        return (
          <div key={device.id} className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow">
            <div className="relative mb-3">
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt={`${device.brand} ${device.model}`}
                  className={`w-full h-24 object-contain bg-gray-100 dark:bg-gray-900/50 rounded ${
                    device.invert_image_in_dark_mode ? 'dark:invert' : ''
                  }`}
                />
              ) : (
                <div className="w-full h-24 bg-gray-100 dark:bg-gray-900/50 rounded flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
                  No image
                </div>
              )}
              <div
                className="absolute bottom-1.5 right-1.5 flex gap-1"
                aria-label={`Front image: ${hasFront ? 'present' : 'absent'}. Rear image: ${hasRear ? 'present' : 'absent'}.`}
              >
                <ImageBadge label="F" present={hasFront} />
                <ImageBadge label="R" present={hasRear} />
              </div>
            </div>
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="font-medium text-gray-900 dark:text-white">{device.brand} {device.model}</div>
              <button
                type="button"
                onClick={() => onToggleFavorite(device)}
                className="rounded p-1 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                aria-label={device.fav ? 'Remove from favorites' : 'Add to favorites'}
                title={device.fav ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={16} fill={device.fav ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">{device.category?.name ?? 'Uncategorized'}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {device.rack_units}U &middot; {device.depth_mm}mm &middot; {device.weight_kg}kg &middot; {device.power_w}W
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => onEdit(device)}>
                Edit
              </Button>
              <Button variant="danger" onClick={() => onDelete(device)}>
                Delete
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
