import { useEffect, useRef, type LegacyRef } from 'react'
import { useDrag } from 'react-dnd'
import type { Device } from '../../types'
import { getDeviceImageUrl } from '../../hooks/useDevices'
import { useHaptic } from '../../contexts/HapticContext'

export const DEVICE_TYPE = 'DEVICE'
export const PLACED_DEVICE_TYPE = 'PLACED_DEVICE'

export interface DeviceDragItem {
  type: typeof DEVICE_TYPE
  deviceId: string
  rackUnits: number
  isHalfRack: boolean
  forceFullWidth: boolean
  depthMm: number
  rackEarOffsetMm: number
}

export interface PlacedDeviceDragItem {
  type: typeof PLACED_DEVICE_TYPE
  itemId: string
  deviceId: string
  rackUnits: number
  isHalfRack: boolean
  forceFullWidth: boolean
  depthMm: number
  rackEarOffsetMm: number
}

interface DraggableDeviceProps {
  device: Device
}

export default function DraggableDevice({ device }: DraggableDeviceProps) {
  const { trigger } = useHaptic()
  const wasDraggingRef = useRef(false)

  const [{ isDragging }, dragRef] = useDrag<DeviceDragItem, unknown, { isDragging: boolean }>({
    type: DEVICE_TYPE,
    item: {
      type: DEVICE_TYPE,
      deviceId: device.id,
      rackUnits: device.rack_units,
      isHalfRack: device.is_half_rack,
      forceFullWidth: false,
      depthMm: device.depth_mm,
      rackEarOffsetMm: 0,
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  })

  useEffect(() => {
    if (isDragging && !wasDraggingRef.current) trigger('nudge')
    wasDraggingRef.current = isDragging
  }, [isDragging, trigger])

  const thumbUrl = getDeviceImageUrl(device.front_image_path)

  return (
    <div
      ref={dragRef as unknown as LegacyRef<HTMLDivElement>}
      className={`border dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800 cursor-grab active:cursor-grabbing transition-opacity shadow-sm ${
        isDragging ? 'opacity-40' : 'opacity-100'
      }`}
      style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {thumbUrl && (
        <img
          src={thumbUrl}
          alt={device.model}
          draggable={false}
          className={`w-full h-14 object-contain bg-gray-50 dark:bg-gray-900/50 rounded mb-2 ${
            device.invert_image_in_dark_mode ? 'dark:invert' : ''
          }`}
        />
      )}
      <div className="text-sm font-medium truncate dark:text-white">{device.brand} {device.model}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {device.rack_units}U{device.is_half_rack ? ' · ½' : ''} · {device.power_w}W
      </div>
    </div>
  )
}
