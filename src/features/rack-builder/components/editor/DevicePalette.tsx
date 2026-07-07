import { ALL_BRAND } from '../../hooks/useDevices'
import type { Device, DeviceCategory } from '../../types'
import Select from '../ui/Select'
import DraggableDevice from './DraggableDevice'

interface DevicePaletteProps {
  devices: Device[]
  categories: DeviceCategory[]
  selectedCategoryId: string
  onCategoryChange: (value: string) => void
  brands: string[]
  selectedBrand: string
  onBrandChange: (value: string) => void
  searchQuery: string
  onSearchChange: (value: string) => void
  loading: boolean
}

export default function DevicePalette({
  devices,
  categories,
  selectedCategoryId,
  onCategoryChange,
  brands,
  selectedBrand,
  onBrandChange,
  searchQuery,
  onSearchChange,
  loading,
}: DevicePaletteProps) {
  return (
    <div className="w-72 bg-white dark:bg-gray-900 border-r dark:border-gray-800 flex flex-col shrink-0">
      <div className="px-4 py-4 border-b dark:border-gray-800 font-semibold text-base text-gray-700 dark:text-white">
        Device Library
      </div>
      <div className="p-3 border-b dark:border-gray-800 space-y-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Search</label>
          <input
            type="search"
            placeholder="Brand, model or category…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Select
          label="Category"
          value={selectedCategoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
          options={[
            { value: 'favorites', label: 'Favorites' },
            { value: 'all', label: 'All categories' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
        />
        <Select
          label="Brand"
          value={selectedBrand}
          onChange={(e) => onBrandChange(e.target.value)}
          options={[
            { value: ALL_BRAND, label: 'All brands' },
            ...brands.map((b) => ({ value: b, label: b })),
          ]}
        />
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {loading && <p className="text-sm text-gray-400 p-2">Loading...</p>}
        {!loading && devices.length === 0 && (
          <p className="text-sm text-gray-400 p-2">No devices match the current filters.</p>
        )}
        {devices.map((device) => (
          <DraggableDevice key={device.id} device={device} />
        ))}
      </div>
    </div>
  )
}
